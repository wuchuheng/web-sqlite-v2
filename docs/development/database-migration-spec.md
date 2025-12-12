# [Database] Migration Spec & Test Plan

**Target Module:** `src/jswasm/api/oo1-db/db-statement/database.mjs`
**Related Issues/PRs:** N/A

---

## 1. Deep Analysis

### 1.1 Exports & API Surface

- `createDatabaseClass(context, dbCtorHelper, validators, execHelpers, Statement, statementToken)` -> returns `Database`.
- Instance methods: `isOpen()`, `affirmOpen()`, `close()`, `export()`, `changes(total?, sixtyFour?)`, `dbFilename(dbName?)`, `dbName(dbNumber?)`, `dbVfsName(dbName?)`, `prepare(sql)`, `exec(sql|ExecOptions, options?)`, `createFunction(name|FunctionOptions, xFunc?, opt?)`, `selectValue()`, `selectValues()`, `selectArray()`, `selectObject()`, `selectArrays()`, `selectObjects()`, `openStatementCount()`, `transaction()`, `savepoint()`, `checkRc()`, `_getStatementRegistry()`, `_pointer()`.
- Static members: `Database.dbCtorHelper`, `Database.checkRc`.
- Runtime hooks: optional `onclose.before`/`onclose.after` invoked around `close()`.

### 1.2 Dependencies & External References

- Depends on `Oo1Context` members: `capi`, `wasm`, `util`, `ptrMap`, `stmtMap`, `toss`, `checkRc`.
- Validation helpers: `pointerOf`, `ensureDbOpen` from `StatementValidators`.
- Execution helpers: `selectFirstRow`, `selectAllRows`, `parseExecPlan` from `ExecHelpers`.
- Statement class: needs `parameterCount`, `columnCount`, `bind()`, `step()`, `get()`, `reset()`, `finalize()`, `getColumnNames()`, `_lockedByExec` guard.
- SQLite C API calls: `sqlite3_prepare_v2`, `sqlite3_prepare_v3`, `sqlite3_close_v2`, `sqlite3_create_function_v2`, `sqlite3_create_window_function`, `sqlite3_db_filename`, `sqlite3_db_name`, `sqlite3_js_db_vfs`, `sqlite3_js_db_export`, change counters, `sqlite3_sql`.
- WASM helpers: `pstack`, `scopedAlloc`, `jstrcpy`, `jstrlen`, `heap8`, `peek`, `peekPtr`, `poke`, `pokePtr`, `cstrToJs`, typed array checks.
- Wiki reference: `.qoder/repowiki/en/content/API Reference/Database API.md` (notes savepoint name `oo1`, close finalizes outstanding statements, exec returns collected rows when requested).

### 1.3 Logic & Complexity

- `close()` finalizes any tracked statements, tolerates hook exceptions, clears pointer/stmt maps, calls `sqlite3_close_v2`, deletes `filename`.
- `prepare()` allocates via `pstack`, checks return pointer, throws via `toss` on empty SQL, returns guarded `Statement`.
- `exec()` normalizes arguments via `parseExecPlan`, supports string/typed array SQL, multi-statement loop with `sqlite3_prepare_v3`, optional `saveSql` collection, binds once per statement, handles `rowMode` callback construction, toggles `_lockedByExec` while iterating, resets/finalizes statements in `finally`, supports `multi: false` short-circuit.
- `createFunction()` validates scalar vs aggregate vs window callback combinations, enforces `pApp` pointer shape, builds deterministic/directOnly/innocuous flags, computes arity, dispatches to `sqlite3_create_function_v2` or `sqlite3_create_window_function`, then `checkRc`.
- `transaction()` and `savepoint()` manage commit/rollback with qualifier validation.
- Type gaps: `.d.ts` exposes fewer methods (e.g., missing `affirmOpen`, `dbFilename`, `createFunction`, `selectValues`, diagnostics helpers) and models `isOpen` as a property instead of a method; `ExecOptions` misses `sql`, `saveSql`, `resultRows`, numeric/`$col` row modes, and `returnValue` handling; `ExecResult` omits `saveSql`; `onclose` hooks are untyped.

---

## 2. Test Strategy

### 2.1 Strategy Selection

- **Selected Type:** Unit
- **Rationale:** Database methods are pure JS wrappers around injected context helpers; behavior can be exercised with mocked `capi/wasm`/`Statement` without requiring the WASM binary or browser environment. Unit tests keep coverage focused on argument normalization, control flow, and integration with helpers.

### 2.2 Test Scenarios

- Constructor delegates to `dbCtorHelper` with forwarded arguments.
- `isOpen()`/`affirmOpen()`: respect `pointerOf` results and ensure `ensureDbOpen` is invoked for chaining.
- `close()`: no-op when pointer falsy; when open, calls hooks (even if they throw), finalizes tracked statements, clears maps, calls `sqlite3_close_v2`, and drops `filename`.
- `export()` uses `sqlite3_js_db_export` with an open pointer.
- `changes()` routes to correct 32/64-bit and total/non-total counters based on flags.
- `dbFilename()`, `dbName()`, `dbVfsName()`: resolve values via capi; `dbVfsName` converts `sqlite3_vfs` names and disposes; returns `undefined` when no VFS pointer.
- `prepare()` ensures open DB, calls `sqlite3_prepare_v2`, restores stack, throws on null stmt pointer, returns `Statement` with guard token.
- `exec()`:
  - Throws when `parseExecPlan` yields empty SQL.
  - Binds only once per prepared statement when parameters exist.
  - Exercises `rowMode` paths that collect column names, invoke callbacks, populate `resultRows`, and respect `multi: false`.
  - Captures `saveSql` entries.
  - Ensures `_lockedByExec` cleared and statements finalized on early exit and in `finally`.
- `createFunction()`:
  - Accepts scalar callbacks; rejects ambiguous aggregate/window combinations.
  - Validates `pApp` shape and `xDestroy` type.
  - Builds flags for `deterministic`, `directOnly`, `innocuous`; computes arity fallback from callbacks.
  - Calls correct capi function (window vs scalar) and routes through `checkRc`.
- Select helpers: `selectValue`, `selectValues`, `selectArray`, `selectObject`, `selectArrays`, `selectObjects` delegate to `execHelpers`/Statement primitives with expected arguments.
- `openStatementCount()` counts only truthy registry entries when DB is open; returns 0 if closed.
- Transactions: `transaction()` commits on success, rolls back on thrown error, and rejects invalid qualifiers; `savepoint()` mirrors commit/rollback behavior with fixed name.
- Diagnostics: `checkRc()` proxies context and returns `this`; `_getStatementRegistry()`/`_pointer()` expose internals.

---

## 3. Type Strategy (Crucial for Step 6)

### 3.1 Existing Types

- Reuse `Oo1Context`, `DbCtorHelper`, `StatementValidators`, `ExecHelpers`, `Stmt`, `BindSpecification`, `NormalizedExecPlan` from existing `.d.ts` files.
- Preserve `PointerLike`, `StatementRegistry`, and `VfsPostOpenCallback` shapes from `context.d.ts` for map interactions.

### 3.2 New Type Definitions

- Expand `ExecRowMode` to include template-string column selectors and numeric indexes:

```typescript
export type ExecRowMode = "array" | "object" | "stmt" | number | `$${string}`;
```

- Broaden `ExecSqlSource` for options-based calls:

```typescript
export type ExecSqlSource = string | Uint8Array | Int8Array | ArrayBuffer | string[];
```

- Replace `ExecOptions` with a precise interface (no `any`):

```typescript
export interface ExecOptions {
  sql?: ExecSqlSource;
  bind?: BindSpecification;
  callback?: (row: unknown, stmt: Stmt) => unknown;
  rowMode?: ExecRowMode;
  columnNames?: string[];
  returnValue?: "resultRows";
  multi?: boolean;
  saveSql?: string[];
  resultRows?: unknown[];
}
```

- Extend `ExecResult` to mirror runtime return values:

```typescript
export interface ExecResult {
  resultRows?: unknown[];
  saveSql?: string[];
}
```

- Model `onclose` hooks for typed property access:

```typescript
export interface CloseHooks {
  before?: (db: DB) => void;
  after?: (db: DB) => void;
}
```

- Function registration options:

```typescript
export interface CreateFunctionOptions {
  name?: string;
  xFunc?: (...args: unknown[]) => unknown;
  xStep?: (...args: unknown[]) => unknown;
  xFinal?: (...args: unknown[]) => unknown;
  xValue?: (...args: unknown[]) => unknown;
  xInverse?: (...args: unknown[]) => unknown;
  pApp?: number | null;
  xDestroy?: () => void;
  deterministic?: boolean;
  directOnly?: boolean;
  innocuous?: boolean;
  arity?: number;
}
```

- Add internal utility types as needed for stmt registries without introducing `any`.

### 3.3 Handling Ambiguity

- Align `ExecOptions` with `parseExecPlan` behavior in `execution.mjs` and the wiki; if conflicts appear, prefer the runtime logic over the old `.d.ts`.
- Keep `isOpen` as a method (matching implementation) and expose a typed `pointer` getter via `definePointerAccessors`.
- Use `unknown` with explicit narrowing for callback results; avoid `any` entirely.
- If callback signatures differ in capi helpers, mirror the existing `capi` function parameter types instead of loosening with `any`.

---

## 4. Verification Plan

- Pre-migration: add `database.unit.test.ts` targeting the current `.mjs` implementation; run `npm run test:unit` (coverage >= 80% for `database.mjs`) and `npm run test` to baseline.
- Migration steps: add `database` entry to `tsconfig.migration.json`, move tests alongside new TS module, and ensure imports drop `.mjs`.
- Post-migration: run `npm run build:migration`, `npm run format`, `npm run lint`, then `npm run test` to confirm parity and type correctness.
