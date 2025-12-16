# Web‑SQLite DB API Specification

This document explains the intended client API surface, worker message contract, and implementation guidance for the SQLite API used in this repository. It documents design choices, recommended TypeScript types, `prepare` semantics (handle-based and callback-scoped), lifecycle rules, and example mappings.

## Goals

- Keep backwards compatibility with the existing `exec` engine while providing clear, typed client APIs (`exec`, `run`, `query`, `get`, `prepare`, `transaction`, `close`).
- Provide worker message contracts so the worker can implement efficient prepared statements (handle-based) and the safe `prepare(...)` callback pattern.
- Prevent resource leaks (auto-finalize prepared statements used in a callback pattern) and provide best-practices for large results and concurrency.
- **Type Safety**: Use `unknown` instead of `any` to ensure strict type checking for database results and parameters.

> Note: this specification references and follows the project coding rules in `.clinerules/base_rules.md`. Follow that file for documentation conventions, the three-phase numeric comment pattern, line-length constraints, and other readability rules.

## Terminology

- `DB.exec`: the bundle's canonical execution function (see `sqlite3.d.ts` DB.exec/ExecOptions).
- Prepared Statement (`Stmt`): compiled SQL statement created by `db.prepare(sql)` on the worker-side.
- `stmtId`: numeric handle used by the worker to refer to a prepared statement.
- `ExecResult`: metadata returned for non-query statements, typically `{ changes?, lastInsertRowid? }`.
- `SQLParams`: either a positional array or a named parameter object.

## Recommended TypeScript types (file: `src/types/DB.d.ts`)

Place the canonical type definitions in `src/types/DB.d.ts`. The block below includes JSDoc comments for every API and every argument name as required by project rules.

```ts
/** A bindable parameter collection: positional or named. */
export type SQLParams = unknown[] | Record<string, unknown>;

/**
 * Metadata returned for non-query statements.
 * @property changes Number of rows changed by last operation (may be bigint on some builds).
 * @property lastInsertRowid Last inserted row id when applicable.
 */
export type ExecResult = {
    changes?: number | bigint;
    lastInsertRowid?: number | bigint;
};

/**
 * A prepared statement client wrapper.
 * @remarks The `stmtId` is optional and intended for debugging only; callers should not depend on it.
 */
export interface PreparedStatement {
    /**
     * Execute the prepared statement for DML/DDL and return execution metadata.
     * @param params - Positional array or named parameters to bind to the statement.
     */
    run(params?: SQLParams): Promise<ExecResult>;

    /**
     * Execute the prepared statement and return all result rows as an array of objects.
     * @param params - Bind parameters for the statement execution.
     */
    all<T = unknown>(params?: SQLParams): Promise<T[]>;

    /**
     * Execute the prepared statement and return the first row, or `undefined` if none.
     * @param params - Bind parameters for the statement execution.
     */
    get<T = unknown>(params?: SQLParams): Promise<T | undefined>;

    /** Reset the statement cursor to allow re-execution with different parameters. */
    reset(): Promise<void>;

    /** Finalize the statement and release worker-side resources. Idempotent. */
    finalize(): Promise<void>;

    /** Optional debug-only statement id returned by the worker when the statement was prepared. */
    readonly stmtId?: number;
}

/** Primary DB interface used by client code. */
export interface DBInterface {
    /**
     * Execute a SQL script (one or more statements) without returning rows.
     * Intended for migrations, schema setup, or bulk SQL execution.
     * @param sql - SQL string to execute.
     */
    exec(sql: string): Promise<void>;

    /**
     * Run a single DML/DDL statement and return execution metadata.
     * @param sql - Single SQL statement to execute (INSERT/UPDATE/DELETE/DDL).
     * @param params - Optional bind parameters for the statement.
     */
    run(sql: string, params?: SQLParams): Promise<ExecResult>;

    /**
     * Execute a query and return all result rows as an array of objects.
     * @param sql - SELECT SQL to execute.
     * @param params - Optional bind parameters for the query.
     */
    query<T = unknown>(sql: string, params?: SQLParams): Promise<T[]>;

    /**
     * Execute a query and return the first row or `undefined`.
     * @param sql - SELECT SQL to execute.
     * @param params - Optional bind parameters for the query.
     */
    get<T = unknown>(sql: string, params?: SQLParams): Promise<T | undefined>;

    /**
     * Prepare a statement and provide a prepared-statement object. The implementation may be
     * handle-based (worker holds the compiled Stmt) or stateless (worker executes SQL each call).
     * @param sql - SQL to prepare.
     */
    prepare(sql: string): Promise<PreparedStatement>;

    /**
     * Prepare a statement, run the provided callback with a PreparedStatement wrapper,
     * and guarantee the statement is finalized after the callback completes (success or error).
     * This `prepare(sql, fn)` overload prevents leaked worker-side statements when developers forget to call
     * `finalize()` themselves.
     * @param sql - SQL to prepare.
     * @param fn - Async callback that receives a PreparedStatement and returns a value or promise.
     */
    prepare<T = unknown>(
        sql: string,
        fn: (stmt: PreparedStatement) => Promise<T>,
    ): Promise<T>;

    /**
     * Run a callback inside a transaction. The implementation should BEGIN before calling `fn`
     * and COMMIT on success or ROLLBACK on error.
     * @param fn - Callback that receives a DBInterface and performs transactional work.
     */
    transaction<T>(fn: (db: DBInterface) => Promise<T>): Promise<T>;

    /** Close the database and release resources. */
    close(): Promise<void>;
}
```

## Worker message contract (recommended)

Use the `SqliteEvent` enum in `src/types/message.d.ts` for message types.
The existing enum should be extended with the following events:

Message types and payloads (handle-based prepared statements):

- `SqliteEvent.EXECUTE` (Existing)
    - Request: `{ sql: string }` (or `ExecOptions` for internal backward compatibility)
    - Response: `void` (or `ExecResult` / rows depending on internal mode)

- `SqliteEvent.RUN` (New)
    - Request: `{ sql: string, bind?: SQLParams }`
    - Response: `ExecResult`

- `SqliteEvent.QUERY` (New, optional optimization)
    - Request: `{ sql: string, bind?: SQLParams }`
    - Response: rows array (objects)

- `SqliteEvent.PREPARE` (New)
    - Request: `{ sql: string }`
    - Response: `{ stmtId: number }`

- `SqliteEvent.STMT_RUN` (New)
    - Request: `{ stmtId: number, bind?: SQLParams }`
    - Response: `ExecResult`

- `SqliteEvent.STMT_ALL` (New)
    - Request: `{ stmtId: number, bind?: SQLParams, rowMode?: 'object' | 'array' }`
    - Response: rows array

- `SqliteEvent.STMT_GET` (New, optional)
    - Request: `{ stmtId: number, bind?: SQLParams }`
    - Response: single row object or `null`

- `SqliteEvent.STMT_RESET` (New)
    - Request: `{ stmtId: number }`
    - Response: `void`

- `SqliteEvent.STMT_FINALIZE` (New)
    - Request: `{ stmtId: number }`
    - Response: `void`

- `SqliteEvent.TRANSACTION` (New)
    - Request: `{ /* worker-specific: begin qualifier, or an indicator that the worker should run a sub-flow */ }`
    - Response: result of the transaction callback

- `SqliteEvent.CLOSE` (Existing)
    - Request: `{}` or filename
    - Response: `void`

## Worker error handling contract (required)

The worker message format is defined in `src/types/message.d.ts` (`SqliteResMsg`).
The worker bridge MUST use this response envelope for all RPCs.

- The client bridge MUST inspect the envelope: if `success` is `false`, the bridge MUST throw the provided `error` object (or a wrapper `Error` containing the error fields).
- Worker implementation MUST wrap all handler code in `try { ... } catch (err) { postMessage({ success: false, error: serializeError(err) }) }` so errors propagate to the client through the bridge.

## Client wrapper strategies

There are two main approaches to `prepare`:

1. Handle-based prepared statements (recommended for performance)
    - `prepare(sql)` → send `PREPARE` to worker → receive `stmtId` → return a small client wrapper that calls `STMT_*` messages.
    - Requires worker changes and lifecycle management.

2. Stateless prepared statement wrapper (simple)
    - `prepare(sql)` returns an object whose `run/all/get` simply calls `RUN`/`EXECUTE` with the SQL each time (no stmt handle on worker).
    - Simpler to implement, but you lose repeated-compile performance.

## `prepare` (callback-scoped prepare — safe pattern)

The spec prefers a callback-scoped `prepare` API that guarantees worker-side statements are finalized after the callback completes. This is the preferred safe pattern.

Signature and usage:

```ts
// Overload 1: obtain a PreparedStatement directly
const stmt = await db.prepare("INSERT INTO users(name) VALUES(?)");

// Overload 2: callback-scoped prepare — guarantees finalize()
await db.prepare("INSERT INTO users(name) VALUES(?)", async (stmt) => {
    for (const name of names) {
        await stmt.run([name]);
    }
});
```

Behavior:

- `PREPARE` → worker allocates a `Sqlite3Stmt` and returns `stmtId`.
- Client builds a small `PreparedStatement` wrapper that forwards calls to `STMT_*` messages.
- Client executes the provided callback `fn(stmt)` inside a `try { await fn(stmt) } finally { await STMT_FINALIZE }` block so finalize is always attempted.

This pattern prevents statement handle leaks in the common case where developers might forget to call `finalize()` explicitly.

## How to implement query/get/run reliably

- `query(sql, params)` should always return `T[]`. Implementation on client-side: call

```js
sendMsg(SqliteEvent.EXECUTE, {
    sql,
    bind: params,
    rowMode: "object",
    returnValue: "resultRows",
});
```

and return the returned rows.

- `get(sql, params)` should return first row or `undefined` — client can call `query` and pick the first element (worker can also expose `STMT_GET` or convenience `selectObject`).

- `run(sql, params)` should return `ExecResult`. Either implement a worker `RUN` message that calls `db.exec({ sql, bind })` and then returns `{ changes: db.changes(), lastInsertRowid: db.selectValue('last_insert_rowid()') }` or implement `RUN` via prepare + stepFinalize.

## Concurrency, streaming and large results

- `exec(... returnValue: 'resultRows')` collects all rows into memory — avoid for very large datasets. Prefer:
    - implementing a streaming callback via `ExecOptions.callback` on worker → send rows in batches to client, or
    - use pagination and LIMIT/OFFSET for very large sets.
- If DB access must be serialized, add request queuing on the worker.

## Resource and leak mitigations

- `prepare` (callback-scoped) to auto-finalize statements.
- Worker-side TTL/eviction of idle prepared statements.
- Worker-to-client heartbeat or stats to identify leaked statements.
- Max open statement limit enforced by worker.
- On DB close: finalize all statement handles immediately.

## Security considerations

- Always use parameter binding (do not allow unescaped interpolation for external input).
- Sanitize or omit sensitive bind values from error logs.
- If executing untrusted SQL (e.g., user-supplied), run in a sandboxed worker and limit available resources/time.

## Tests & validation

All APIs must have end-to-end tests with the suffix `e2e.test.ts` placed under `tests/e2e/`.

**Reference Implementation:**
See `tests/e2e/sqlite3.e2e.test.ts` for the canonical way to initialize the database in a test environment using `openDB`. New tests should mirror this setup pattern.

Required e2e tests:

- `exec.e2e.test.ts` — tests `exec` for DDL and multi-statement scripts.
- `run.e2e.test.ts` — tests successful DML and returned `ExecResult` metadata.
- `query.e2e.test.ts` — tests `query<T>` returns typed rows and `get<T>` returns first row.
- `prepare.e2e.test.ts` — tests the callback-scoped `prepare(sql, fn)` API: ensures `STMT_FINALIZE` is observed and that bulk inserts succeed.
- `transaction.e2e.test.ts` — tests transaction commit and rollback semantics.

Unit tests may be added for client-side wrappers, but e2e tests are required to validate worker<->client integration.

## Implementation Phases

To ensure stability and iterative verification, the implementation will proceed in distinct phases. Each phase targets a specific API and includes its corresponding E2E tests.

### Phase 1: `exec` (Script Execution)

- **Goal**: Enable running raw SQL scripts (migrations, schema setup).
- **Tasks**:
    - Define `exec` signature in `DBInterface`.
    - Implement `exec` in client to send `SqliteEvent.EXECUTE`.
    - Verify worker handles `EXECUTE`.
- **Test Strategy** (`tests/e2e/exec.e2e.test.ts`):
    1.  **Setup**: Initialize `const db = await openDB('exec_test.sqlite');`.
    2.  **Action**: `await db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);');`
    3.  **Action**: `await db.exec("INSERT INTO test (name) VALUES ('a');");`
    4.  **Validation (File System)**: Access the OPFS file handle (reference `sqlite3.e2e.test.ts`). Assert `(await fileHandle.getFile()).size` is greater than 0 and grows after inserts.
    5.  **Validation (Persistence)**: Call `await db.close()`. Reopen the DB. This ensures the Journal/WAL is flushed and the file is valid.

### Phase 2: `run` (Parameterized DML)

- **Goal**: Enable safe INSERT/UPDATE/DELETE with parameter binding.
- **Tasks**:
    - Define `run` signature.
    - Implement `SqliteEvent.RUN` handler in worker (returns `ExecResult`).
    - Implement client `run` method.
- **Test Strategy** (`tests/e2e/run.e2e.test.ts`):
    1.  **Setup**: Create table via `db.exec`.
    2.  **Action**: `const result = await db.run('INSERT INTO test (name) VALUES (?)', ['foo']);`
    3.  **Validation (Metadata)**: `expect(result.changes).toBe(1);` `expect(result.lastInsertRowid).toBeTypeOf('number');`. This confirms the engine processed the change.
    4.  **Action (Named Params)**: `await db.run('INSERT INTO test (name) VALUES ($n)', { $n: 'bar' });`

### Phase 3: `query` & `get` (Data Retrieval)

- **Goal**: Enable fetching typed results.
- **Tasks**:
    - Define `query` and `get` signatures.
    - Implement `SqliteEvent.QUERY` handler.
    - Implement client `query` (returns `T[]`) and `get` (returns `T | undefined`).
- **Test Strategy** (`tests/e2e/query.e2e.test.ts`):
    1.  **Setup**: Seed data ('Alice', 'Bob') using `run`.
    2.  **Validation (Read-Your-Writes)**: `const rows = await db.query('SELECT name FROM test');`. Assert rows match inserted data.
    3.  **Validation (Persistence)**:
        - Insert 'Charlie'.
        - `await db.close()`.
        - `await openDB(...)`.
        - `await db.get('SELECT name FROM test WHERE name = ?', ['Charlie'])`.
        - Assert 'Charlie' is found. This proves data was written to disk.

### Phase 4: `prepare` (Handle-based Statements)

- **Goal**: High-performance repeated execution and leak prevention.
- **Tasks**:
    - Define `PreparedStatement` interface.
    - Implement worker handlers (`PREPARE`, `STMT_*`).
    - Implement client `prepare` method.
- **Test Strategy** (`tests/e2e/prepare.e2e.test.ts`):
    1.  **Manual Management**:
        - `const stmt = await db.prepare('INSERT INTO test (name) VALUES (?)');`
        - `await stmt.run(['one']); await stmt.run(['two']);`
        - `await stmt.finalize();`
        - **Validation**: `query` table to confirm 'one' and 'two' exist.
    2.  **Callback Scope (Safe)**:
        - `await db.prepare('INSERT...', async (stmt) => { await stmt.run(['three']); });`
        - **Validation**: Verify 'three' exists. Verify `stmt` cannot be reused (throws error) to prove finalization.

### Phase 5: `transaction`

- **Goal**: Atomic operations.
- **Tasks**:
    - Define `transaction` signature.
    - Implement transaction wrapper logic.
- **Test Strategy** (`tests/e2e/transaction.e2e.test.ts`):
    1.  **Commit Case**:
        - `await db.transaction(async (tx) => { await tx.run('INSERT...'); });`
        - **Validation**: `query` confirms row exists.
    2.  **Rollback Case**:
        - `try { await db.transaction(async (tx) => { await tx.run('INSERT...'); throw new Error('fail'); }); } catch (e) {}`
        - **Validation**: `query` confirms row does **not** exist.

### Phase 6: `close` (Lifecycle Management)

- **Goal**: Explicit resource cleanup, lock release, and **worker termination**.
- **Tasks**:
    - Define `close` signature.
    - Implement `SqliteEvent.CLOSE` handler (finalize all statements, close DB).
    - Implement client `close` method: Send `CLOSE` event, await response, then **terminate the worker** to free memory.
- **Test Strategy** (`tests/e2e/close.e2e.test.ts`):
    1.  **Setup**: Open DB, run query.
    2.  **Action**: `await db.close()`.
    3.  **Validation (State)**: Attempting `await db.exec(...)` after close should throw "Database is closed" error.
    4.  **Validation (Worker)**: Verify the worker thread is terminated (e.g., by checking if the underlying worker object is terminated or if sending a raw message fails immediately).
    5.  **Validation (Locking)**: Immediately `await openDB(...)` again. It should succeed without "Database locked" error.

## Quick reference: recommended mapping

- Client `exec` → worker `EXECUTE` with SQL string
- Client `run` → worker `RUN` (returns `ExecResult`)
- Client `query` → worker `EXECUTE` with `returnValue:'resultRows'` (rowMode:'object')
- Client `get` → `query(...)[0]`
- Client `prepare` (handle-based) → `PREPARE` + `STMT_*` messages
- Client `prepare(sql, fn)` → `PREPARE` + callback wrapper + `STMT_FINALIZE` in finally
