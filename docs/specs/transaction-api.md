# Transaction API (`DBInterface.transaction`) Specification

## Goal

Implement the `transaction(fn)` method exposed by `src/main.ts` so callers can run multiple SQL operations atomically.

## Relevant Code Paths

- Client entrypoint: `src/main.ts`.
- Worker bridge RPC: `src/worker-bridge.ts`.
- Worker implementation: `src/worker.ts`.
- Public DB types: `src/types/DB.ts`.
- Worker message events: `src/types/message.ts`.

## Context: How Requests Execute Today

- Each `openDB(...)` call creates a dedicated Web Worker (`createWorkerBridge()` in `src/worker-bridge.ts`).
- The returned `DBInterface` methods (`exec`, `query`, etc.) send messages to the worker.
- The worker (`src/worker.ts`) runs SQL on a single `OpfsDb` connection and replies per request.

This means all operations for a given `DBInterface` instance share a single worker-side DB connection.

## Problem: Transactions Need Exclusive Ordering

SQLite transaction boundaries depend on strict ordering:

1. `BEGIN`
2. All statements inside the transaction
3. `COMMIT` (success) or `ROLLBACK` (failure)

Even though the worker processes messages sequentially, the main thread can still enqueue messages from unrelated call sites while a transaction callback is running. That would place “outside” statements between `BEGIN` and `COMMIT`, unintentionally becoming part of the transaction.

## API Contract

From `src/types/DB.ts`:

```ts
transaction<T>(fn: (db: DBInterface) => Promise<T>): Promise<T>;
```

Required behavior:

- Call `_exec("BEGIN")` before executing `fn`.
- If `fn` resolves: call `_exec("COMMIT")` and return the callback’s result.
- If `fn` throws/rejects: call `_exec("ROLLBACK")` and rethrow the original error.
- If rollback fails: throw an error whose `cause` includes both the original error and rollback error.

## Implementation Strategy (Client-Side)

### 1. Use a per-DB mutex to serialize all operations

Implement a simple queue-based mutex in `src/main.ts` (e.g. `createMutex()` returning `runMutex(fn)`).

Rules:

- All public DB methods (`exec`, `query`, `close`, `transaction`, and later `prepare`) must go through the mutex.
- `transaction(fn)` must hold the mutex for the entire duration from `BEGIN` to `COMMIT/ROLLBACK`.

This guarantees no unrelated operations can be interleaved into the active transaction for that DB instance.

### 2. Split public methods into locked and unlocked versions

In `src/main.ts`, keep:

- `_exec(sql, params?)`: sends `SqliteEvent.EXECUTE` directly (no mutex).
- `_query(sql, params?)`: sends `SqliteEvent.QUERY` directly (no mutex).

Then:

- `db.exec(...)` becomes `runMutex(() => _exec(...))`.
- `db.query(...)` becomes `runMutex(() => _query(...))`.

Inside a transaction, use the unlocked helpers to avoid deadlocks (the mutex is already held).

### 3. Provide a transaction-scoped DB object (`txDb`)

Inside `transaction(fn)`, construct a `txDb` object which:

- Uses `_exec` / `_query` directly (bypasses the mutex).
- Rejects `close()` calls (closing during a transaction is undefined behavior for the wrapper).
- Uses a nested transaction implementation based on SQLite `SAVEPOINT` (see below).
- Until `prepare` is implemented, throws `"Function not implemented."` to avoid deadlocks.

Important rule to document for users:

- Inside `transaction(fn)`, only use the passed `txDb` instance.
- Calling the outer `db.transaction(...)` from inside the callback can deadlock because it tries to re-acquire the same mutex.

## Nested Transactions (Recommended)

SQLite supports nesting via savepoints.

Implement `txDb.transaction(innerFn)` using a unique savepoint name, e.g. `ws_tx_1`, `ws_tx_2`, ...

Behavior:

- `_exec("SAVEPOINT <name>")`
- On success: `_exec("RELEASE SAVEPOINT <name>")`
- On error: `_exec("ROLLBACK TO SAVEPOINT <name>; RELEASE SAVEPOINT <name>")`, then rethrow.

This makes nested transaction usage inside a transaction callback predictable without requiring users to hand-write savepoint SQL.

## Rollback Failure Handling

Rollback can fail if:

- The callback manually committed/rolled back.
- The connection is in an invalid state.
- The DB was closed unexpectedly.

If rollback fails, throw a new error with:

- Message: `"Rollback failed after transaction error."`.
- `cause`: `{ error, rollbackError }`.

This preserves the primary failure and exposes that rollback also failed.

## Test Plan (Browser E2E)

Add E2E coverage (mirroring existing tests under `tests/e2e/`):

1. **Commit case**: insert rows in a transaction and verify they exist after commit.
2. **Rollback case**: insert rows then throw; verify they do not exist.
3. **Nested case**: run `tx.transaction(async () => ...)` inside an outer transaction and verify behavior.
4. **Mutual exclusion**: start a transaction and concurrently queue `db.exec(...)`; verify the outside statement runs after commit.
