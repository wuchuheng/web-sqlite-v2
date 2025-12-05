# Minimal JS -> TS Migration Spec: sqlite3-opfs-async-proxy

## Request Template

1.  **Target module** (`originalPath`): `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy.js`
2.  **Declaration file** (`dtsPath`): None found. This is a Web Worker entry point, not a module with exports.
3.  **Behavioral notes**:
    - **Worker Context**: This file runs as a Web Worker (`globalThis` is a `WorkerGlobalScope`). It must not be run on the main thread.
    - **Messaging**: It communicates via `postMessage` and `SharedArrayBuffer`/`Atomics` (SAB/Atomics) with the main thread (specifically `sqlite3-vfs-opfs.js`).
    - **OPFS Access**: It uses the synchronous Access Handle API (`createSyncAccessHandle`) on files within the Origin Private File System (OPFS).
    - **Dependencies**: It requires `navigator.storage.getDirectory` and `SharedArrayBuffer`/`Atomics`.
    - **Initialization**: It waits for an `opfs-async-init` message to receive configuration (buffers, op codes, etc.) before entering its main loop.
    - **Main Loop**: `waitLoop` blocks on an Atomic wait until notified by the main thread to perform an operation.
4.  **Dependent imports**:
    - It is loaded as a worker by `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy.e2e.test.ts` (and presumably `sqlite3-vfs-opfs.js` or similar in the full system, though the search only found the test).
    - Since it's a worker file, it is not imported via `import` statements but loaded via `new Worker(...)`.

---

## Migration Workflow

### 1. Analyze the originals.

- **File**: `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy.js`
- **Type**: Web Worker script.
- **Exports**: None (side-effect only).
- **Inputs**:
    - `postMessage` from parent: `opfs-async-init`, `opfs-async-restart`.
    - `SharedArrayBuffer`: `sabOP` (operations), `sabIO` (data/serialization).
- **Outputs**:
    - `postMessage` to parent: `opfs-async-loaded`, `opfs-async-inited`, `opfs-unavailable`.
    - Direct mutation of `SharedArrayBuffer`.
- **Key Logic**:
    - `installAsyncProxy`: Main setup function.
    - `getSyncHandle`: Acquires synchronous access handle, with retry logic and locking.
    - `vfsAsyncImpls`: Dictionary of file system operations (`xOpen`, `xRead`, `xWrite`, etc.) mapped to `state.opIds`.
    - `initS11n`: Initializes serialization helper for passing complex arguments via SAB.
    - `waitLoop`: Infinite loop (conceptually) that waits on `Atomics.wait` for commands.
- **Environment**: Browser Web Worker with `FileSystemSyncAccessHandle` support.

### 2. Add a test harness.

**Phase 1: Spec Generation (Gate 1)**

- **Test Type**: E2E (End-to-End) / Integration. Since this is a Worker that interacts via messages and SharedMemory, unit testing individual internal functions is difficult without mocking the entire Worker environment. The existing `sqlite3-opfs-async-proxy.e2e.test.ts` is a good baseline.
- **Plan**:
    1.  We already have `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy.e2e.test.ts` which spawns the worker and tests it.
    2.  We will use this existing test as the verification harness.
    3.  We need to ensure `tsconfig.migration.json` includes the new file to be created.

**Phase 2: Implementation (Autonomous Start)**

- **Action**:
    1.  Verify `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy.e2e.test.ts` passes against the current `.js` file.
    2.  Add `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy.ts` (future) to `tsconfig.migration.json` (or ensure the pattern matches).

### 3. Create the migration subdirectory.

- **Path**: `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy/`
- **Action**:
    1.  Create folder `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy/`.
    2.  Create `index.ts` (or `sqlite3-opfs-async-proxy.ts` inside it) which implements the worker logic.
    3.  **Types**: Define interfaces for the `state` object, `OpfsProxyOptions`, and the message protocols.
    4.  **Refactoring**:
        - Extract `installAsyncProxy` and helper functions.
        - Type the `state` object strongly.
        - Type the `vfsAsyncImpls` map.
        - Preserve the "script-like" execution at the bottom (checking for SAB/Atomics and calling `installAsyncProxy`).

### 4. Redirect tests to the new TypeScript source.

- **Action**:
    1.  Move `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy.e2e.test.ts` to `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy/index.test.ts`.
    2.  Update the test to spawn the worker from the **compiled JS output** of the new TS file.
        - _Note_: Workers need a JS file path. We will point the test to the expected output path of the migration build, or use a bundler/loader if available. Given the project structure, we likely need to build the TS to JS first to run the test against the new worker code.
        - Alternatively, if Vitest supports TS workers directly, we point to the `.ts` file. (Vitest generally runs in Node/JSDOM, real browser workers might be tricky without a build step. The existing test uses `new Worker(..., { type: "module" })` which implies it expects a module.
    3.  **Crucial**: The test currently does: `new URL("./sqlite3-opfs-async-proxy.js", import.meta.url)`. We will change this to point to the _new_ artifacts in `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy/` (for example, `./sqlite3-opfs-async-proxy.ts` in tests or the compiled `./sqlite3-opfs-async-proxy.js`).

### 5. Compile the migration.

- **Action**:
    1.  Run `npm run build:migration`.
    2.  Verify `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy/index.js` is generated.

### 6. Build, format, and lint.

- **Action**:
    1.  Run `npm run format`.
    2.  Run `npm run lint`.

### 7. Update runtime references.

- **Action**:
    1.  If there are other consumers (like `sqlite3-vfs-opfs.js`), they need to be updated to point to the new worker location/filename.
    2.  _Self-correction_: The user asked to "refactor `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy.js`". If this file is referenced by string path in other files, we must ensure we either keep the original path (by compiling back to it) or update the references (e.g., to `../sqlite3-opfs-async-proxy/sqlite3-opfs-async-proxy.js`).
    3.  **Decision**: We will compile the new TS to `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy/index.js`. Consumers might need updates.

### 8. Remove now-unused artifacts.

- **Action**:
    1.  Delete `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy.js`.

### 9. Final verification.

- **Action**:
    1.  Run the moved test `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy/index.test.ts`.

### 10. Document and hand over.
