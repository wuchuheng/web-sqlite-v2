# Migration Plan for `sync-handle-error.mjs`

## Analysis of Originals

- **Original Path**: `src/jswasm/vfs/opfs/async-proxy/sync-handle-error.mjs`
- **Declaration Path**: `src/jswasm/vfs/opfs/async-proxy/sync-handle-error.d.ts`
- **Exports**:
    - `GetSyncHandleError` (class, assigned to `globalThis.GetSyncHandleError`)
- **Key Behaviors**:
    - Extends `Error`.
    - Constructor takes a `cause` (DOMException | Error) and `messageParts`.
    - Constructs message by joining parts and appending cause name/message.
    - Sets `this.name = "GetSyncHandleError"`.
    - Static method `toSQLiteCode` maps errors to SQLite error codes.
        - Maps `NoModificationAllowedError` or "Access Handles cannot..." to `SQLITE_BUSY`.
        - Maps `NotFoundError` to `SQLITE_CANTOPEN`.
        - Returns `fallbackCode` otherwise.
- **Runtime Assumptions**:
    - `globalThis` assignment is used because it runs in a worker where module imports might be tricky or legacy.
    - Depends on `SQLiteErrorCodes` structure (duck-typed in JS, imported in d.ts).

## Test Plan

1.  **Scaffolding**:
    - Create `src/jswasm/vfs/opfs/async-proxy/sync-handle-error.test.ts`.
    - Import `./sync-handle-error.mjs` (for side effects to populate `globalThis.GetSyncHandleError`).
    - Define interface for `GetSyncHandleError` to use in tests (since it's on globalThis).

2.  **Test Cases**:
    - **Constructor**:
        - Verify instance creation.
        - Verify message formatting (parts joined + cause details).
        - Verify `cause` property is set.
        - Verify `name` property is "GetSyncHandleError".
    - **toSQLiteCode**:
        - `SQLITE_BUSY` mapping:
            - `NoModificationAllowedError`.
            - `DOMException` with specific message "Access Handles cannot...".
        - `SQLITE_CANTOPEN` mapping:
            - `NotFoundError` (as cause of GetSyncHandleError).
            - `NotFoundError` (as direct error object).
        - Fallback:
            - Verify it returns `fallbackCode` for unrelated errors.

3.  **Execution**:
    - Run `npm run test:unit src/jswasm/vfs/opfs/async-proxy/sync-handle-error.test.ts`.
