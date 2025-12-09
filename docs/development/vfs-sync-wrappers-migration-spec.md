# Migration Spec: VFS Sync Wrappers

**Target Module:** `src/jswasm/vfs/opfs/installer/wrappers/vfs-sync-wrappers.mjs`
**Declaration File:** `src/jswasm/vfs/opfs/installer/wrappers/vfs-sync-wrappers.d.ts`

## Analysis

The module exports `createVfsSyncWrappers`, a factory function that creates an object containing SQLite VFS method implementations (`xAccess`, `xCurrentTime`, `xOpen`, etc.). These methods bridge SQLite's C VFS interface to the synchronous side of the OPFS implementation (likely communicating via SharedArrayBuffer with an async worker).

**Dependencies:**

- `VfsSyncWrapperDeps` interface from `shared/opfs-vfs-installer`.
- `sqlite3_file` class (via `capi`).
- `wasm` utilities (for pointer manipulation, string conversion).
- `opRun` (operation runner).
- `state` (OPFS state).
- `__openFiles` (map of open file handles).

**Key Behaviors to Preserve:**

- **xAccess**: Checks file existence/access using `opRun("xAccess", ...)`.
- **xCurrentTime/xCurrentTimeInt64**: Returns current time (Julian day or Unix epoch ms).
- **xDelete**: Deletes file using `opRun("xDelete", ...)`.
- **xFullPathname**: Copies name to output buffer.
- **xOpen**:
    - Generates random filename if name is 0.
    - Parses URI flags (`opfs-unlock-asap`, `delete-before-open`).
    - Creates file handle structure (`fh`) with `sab` (SharedArrayBuffer).
    - Calls `opRun("xOpen", ...)` to open file in async worker.
    - Initializes `sqlite3_file` instance and links it to `opfsIoMethods`.
- **xGetLastError**: Returns 0.

## Test Plan

**Test Type:** Unit Tests (`vfs-sync-wrappers.unit.test.ts`)

**Strategy:**
Since this module relies heavily on injected dependencies (`deps` object), we will mock these dependencies to verify that `createVfsSyncWrappers` correctly:

1. Returns an object with the expected VFS methods.
2. Calls `opRun` with correct arguments for `xAccess`, `xDelete`, `xOpen`.
3. Manipulates WASM memory correctly (via mocked `wasm.poke`, `wasm.cstrToJs`, `wasm.cstrncpy`).
4. Updates `__openFiles` map upon successful `xOpen`.
5. Handles `xOpen` URI flags correctly.

**Test Cases:**

1.  **`xAccess`**:
    - Mock `opRun` to return success/failure.
    - Verify `wasm.poke` is called with correct result code (0 for success, 1 for failure, inverted logic from `opRun` return?).
    - _Correction_: The code says `wasm.poke(pOut, rc ? 0 : 1, "i32");`. If `opRun` returns `rc` (non-zero usually means error in SQLite, but `access` is different in POSIX vs SQLite VFS).
        - In SQLite `xAccess`: `*pResOut` is set to true (non-zero) if file exists/access allowed.
        - Code: `const rc = opRun(...)`. `rc` is result of `opRun`.
        - `wasm.poke(pOut, rc ? 0 : 1, "i32")`. If `rc` is truthy (error?), poke 0 (false/no access). If `rc` is 0 (success?), poke 1 (true/access ok).
    - Verify correct op name "xAccess".

2.  **`xCurrentTime` / `xCurrentTimeInt64`**:
    - Verify `wasm.poke` is called with a value close to current time (Julian or Unix ms).

3.  **`xDelete`**:
    - Verify calls `opRun("xDelete", ...)` with correct args.
    - Returns result of `opRun`.

4.  **`xFullPathname`**:
    - Mock `wasm.cstrncpy`.
    - Verify returns 0 on success, `SQLITE_CANTOPEN` if buffer too small.

5.  **`xOpen`**:
    - **Scenario 1: Random filename**: `zName` is 0. Verify `randomFilename` called.
    - **Scenario 2: URI flags**: `zName` is ptr. Mock `sqlite3_uri_boolean` to return true for flags. Verify `state.opfsFlags` logic.
    - **Scenario 3: Successful Open**: `opRun` returns 0.
        - Verify `__openFiles[pFile]` is populated.
        - Verify `sqlite3_file` instantiated.
        - Verify `fh.sab` created.
    - **Scenario 4: Read-only**: Flag `SQLITE_OPEN_READONLY` set. Verify `pOutFlags` updated.

## Scaffolding

- Mock `wasm` object (`poke`, `peek`, `cstrToJs`, `cstrncpy`, `isPtr`).
- Mock `capi` object (`sqlite3_uri_boolean`, constants like `SQLITE_OK`, `SQLITE_OPEN_READONLY`, etc.).
- Mock `opRun`.
- Mock `state` (`opfsFlags`, `fileBufferSize`).
- Mock `sqlite3_file` class.
- Mock `mTimeStart`, `mTimeEnd`.
