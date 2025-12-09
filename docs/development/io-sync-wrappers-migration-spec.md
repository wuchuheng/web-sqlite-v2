# IO Sync Wrappers Migration Spec

## 1. Analysis

The `io-sync-wrappers.mjs` module exports a single function `createIoSyncWrappers` which returns a set of SQLite I/O methods (`xRead`, `xWrite`, `xClose`, etc.) adapted for synchronous OPFS usage via a WASM bridge.

### Dependencies

- **Input:** `IoSyncWrapperDeps` (defined in `io-sync-wrappers.d.ts` and `shared/opfs-vfs-installer.d.ts`)
    - `wasm`: WASM memory accessors (`poke`, `heap8u`).
    - `capi`: SQLite C API constants and functions (`SQLITE_IOERR`, `SQLITE_LOCK_NONE`, etc.).
    - `state`: Global state including `s11n` (serialization) and `sq3Codes`.
    - `opRun`: Synchronous operation runner (communicates with worker).
    - `mTimeStart` / `mTimeEnd`: Performance timing.
    - `error`: Error logging.
    - `__openFiles`: Registry of open file handles.

### Functionality

The module implements the `sqlite3_io_methods` interface:

- `xCheckReservedLock`: Always returns 0.
- `xClose`: Closes file, updates `__openFiles`, disposes `sq3File`.
- `xDeviceCharacteristics`: Returns `SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN`.
- `xFileControl`: Returns `SQLITE_NOTFOUND`.
- `xFileSize`: Uses `opRun("xFileSize")` + deserialization.
- `xLock`: Updates local lock state + `opRun("xLock")`.
- `xRead`: `opRun("xRead")` + copies data from `sabView` to WASM memory.
- `xSync`: `opRun("xSync")`.
- `xTruncate`: `opRun("xTruncate")`.
- `xUnlock`: `opRun("xUnlock")` + updates local lock state.
- `xWrite`: Copies data from WASM memory to `sabView` + `opRun("xWrite")`.

### Edge Cases & Assumptions

- **Error Handling:** Catches exceptions in `xRead`, `xWrite`, `xFileSize` and converts them to SQLite error codes.
- **Shared Memory:** Relies heavily on `state.sabFileBufView` (via `f.sabView`) for data transfer to avoid copying large buffers across the boundary repeatedly (though `xRead`/`xWrite` do copy between WASM heap and SAB).
- **Type Safety:** The original code uses JSDoc types which we will promote to full TypeScript interfaces.

## 2. Test Plan

We will use **Unit Tests** to verify the wrapper logic. Since we cannot easily spin up a full real OPFS environment in a pure unit test without a browser, we will mock the dependencies (`wasm`, `capi`, `opRun`, `__openFiles`).

### Test Suite: `io-sync-wrappers.unit.test.ts`

**Mocking Strategy:**

- **`wasm`**: Mock `poke`, `heap8u` (returning a `Uint8Array`).
- **`capi`**: Provide constant values (`SQLITE_OK`, `SQLITE_IOERR`, etc.).
- **`opRun`**: Spy that returns success (0) by default, or specific values for testing logic.
- **`state`**: Mock `s11n.deserialize`.
- **`__openFiles`**: Real object/map to track state during test.
- **`mTimeStart`/`mTimeEnd`**: No-op spies.

**Test Cases:**

1. **Lifecycle (`xClose`)**:
    - Verify it removes file from `__openFiles`.
    - Verify it calls `sq3File.dispose()`.
    - Verify it calls `opRun("xClose")`.
2. **Locking (`xLock`, `xUnlock`, `xCheckReservedLock`)**:
    - `xCheckReservedLock`: Returns 0.
    - `xLock`: Updates `f.lockType`, calls `opRun`.
    - `xUnlock`: Updates `f.lockType`, calls `opRun`.
3. **I/O (`xRead`, `xWrite`)**:
    - `xRead`:
        - Success: Calls `opRun`, copies from `sabView` to `wasm.heap8u`.
        - Short read: Handled as success.
        - Exception: Returns `SQLITE_IOERR_READ`.
    - `xWrite`:
        - Success: Copies from `wasm.heap8u` to `sabView`, calls `opRun`.
        - Exception: Returns `SQLITE_IOERR_WRITE`.
4. **Attributes (`xFileSize`, `xTruncate`, `xDeviceCharacteristics`, `xFileControl`)**:
    - `xFileSize`: Deserializes size from `state.s11n`.
    - `xDeviceCharacteristics`: Returns expected constant.
    - `xFileControl`: Returns `SQLITE_NOTFOUND`.

## 3. Migration Steps

1. Create `src/jswasm/vfs/opfs/installer/wrappers/io-sync-wrappers.unit.test.ts` targeting the `.mjs` file.
2. Achieve >80% coverage.
3. Create `src/jswasm/vfs/opfs/installer/wrappers/io-sync-wrappers/io-sync-wrappers.ts`.
4. Move tests and update imports.
5. Compile and verify.
6. Replace original files.
