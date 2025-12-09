# Migration Spec: OPFS Utilities

## 1. Analysis

### Target Module

- **Path**: `src/jswasm/vfs/opfs/installer/utils/opfs-util.mjs`
- **Exports**: `createOpfsUtil` (default export)
- **Functionality**:
    - Generates random filenames.
    - Resolves/normalizes paths.
    - Manages directories (create, check existence, tree list, recursive remove).
    - Imports databases (from bytes or chunked callback).
    - Provides metrics dumping and resetting.
    - Provides debug utilities (shutdown, restart).
- **Dependencies**: `deps` object containing `state`, `util`, `sqlite3`.
- **Runtime Assumptions**: Browser environment with OPFS support (`navigator.storage.getDirectory()`), `URL` API, `Math.random`.

### Existing Documentation

- JSDoc comments present for most functions.
- `opfs-util.d.ts` referenced in JSDoc imports but file missing on disk (likely implicitly defined or I need to infer types).
- Returns an object conforming to `OpfsUtilInterface`.

## 2. Test Plan

### Test Type

- **Unit Tests**: `src/jswasm/vfs/opfs/installer/utils/opfs-util.unit.test.ts`

### Test Scenarios

1.  **Random Filename Generation**
    - Verify length and character set.
    - Verify randomness (multiple calls produce different results).

2.  **Path Resolution**
    - `getResolvedPath`: Check normalization, splitting behavior.

3.  **Directory Management (Mocked OPFS)**
    - `getDirForFilename`: Verify it traverses/creates directories using mocked `rootDirectory`.
    - `mkdir`: Verify success/failure cases.
    - `entryExists`: Verify true/false for existing/missing entries.
    - `treeList`: Verify structure of returned object.
    - `rmfr`: Verify it calls `removeEntry` on root.
    - `unlink`: Verify file removal.
    - `traverse`: Verify it visits all nodes.

4.  **Database Import**
    - `importDb`:
        - Direct bytes (ArrayBuffer/Uint8Array).
        - Chunked callback.
        - Verify SQLite header validation (mock `util.affirmIsDb`, `util.affirmDbHeader`).
        - Verify file creation and writing via `createSyncAccessHandle` (mocked).

5.  **Metrics & Debug**
    - `metrics.dump`: Verify logging calls.
    - `metrics.reset`: Verify counters are reset.
    - `debug.asyncShutdown/Restart`: Verify worker messaging/callback invocation.

### Scaffolding

- **Mock `deps`**:
    - `state`: `{ opIds: { ... } }`
    - `util`: `{ affirmIsDb: vi.fn(), affirmDbHeader: vi.fn() }`
    - `sqlite3`: `{ config: { log: vi.fn() } }`
- **Mock `rootDirectory`**:
    - Implement a fake FileSystemDirectoryHandle with `getDirectoryHandle`, `getFileHandle`, `removeEntry`, `values`.
- **Mock `Worker`**:
    - `postMessage`.

## 3. Migration Steps

1.  Create `src/jswasm/vfs/opfs/installer/utils/opfs-util.unit.test.ts`.
2.  Implement mocks for OPFS and dependencies.
3.  Write tests covering all `opfsUtil` methods.
4.  Run tests against `.mjs`.
5.  Create `src/jswasm/vfs/opfs/installer/utils/opfs-util/opfs-util.ts`.
6.  Migrate code, adding types.
7.  Move test to `src/jswasm/vfs/opfs/installer/utils/opfs-util/opfs-util.unit.test.ts`.
8.  Update test imports.
9.  Build and verify.
