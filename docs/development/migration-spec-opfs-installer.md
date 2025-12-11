# OPFS VFS Installer Migration Spec & Test Plan

**Target Module:** `src/jswasm/vfs/opfs/installer/index.mjs`
**Related Issues/PRs:** N/A

---

## 1. Deep Analysis

### 1.1 Exports & API Surface

The module exports a factory function `createInstallOpfsVfsContext` that returns an object containing two functions: `installOpfsVfs` and `installOpfsVfsInitializer`.

#### `createInstallOpfsVfsContext(sqlite3)`

- **Input:**
    - `sqlite3` (`SQLite3Module`): The SQLite3 module instance.
- **Output:**
    - `InstallOpfsVfsContext`: Object containing:
        - `installOpfsVfs`: The main installer function.
        - `installOpfsVfsInitializer`: A helper for initialization.

#### `installOpfsVfs(options)`

- **Input:**
    - `options` (`OpfsInstallerOptions` | `undefined`): Optional configuration object.
        - `verbose` (`number`): Verbosity level (0=error, 1=warn, 2=log).
        - `sanityChecks` (`boolean`): Whether to run sanity checks.
        - `proxyUri` (`string` | `() => string`): URI for the async proxy worker.
- **Output:**
    - `Promise<SQLite3Module>`: Resolves with the `sqlite3` instance upon success.
- **Properties:**
    - `defaultProxyUri` (`string`): The default URI for the proxy worker (default: `../sqlite3-opfs-async-proxy/sqlite3-opfs-async-proxy.js`).

#### `installOpfsVfsInitializer(sqlite3Ref)`

- **Input:**
    - `sqlite3Ref` (`SQLite3Module`): Reference to the SQLite3 module.
- **Output:**
    - `Promise<void>`: Resolves when initialization is complete.

### 1.2 Dependencies & External References

The module orchestrates several sub-modules. The types for these dependencies are well-defined in `src/jswasm/shared/opfs-vfs-installer.d.ts` and their respective TypeScript files.

- **Core Modules:**
    - `validateOpfsEnvironment`: Validates browser APIs.
    - `prepareOpfsConfig`: Normalizes configuration.
    - `initializeOpfsState`: Sets up shared state (`OpfsState`).
    - `initializeMetrics`: Sets up metrics (`OpfsMetrics`).
    - `createOperationRunner`: Creates the operation runner (`OperationRunner`).
    - `createOperationTimer`: Creates the operation timer (`OperationTimer`).
    - `createSerializer`: Creates the serializer (`SerializerInterface`).
- **Wrappers:**
    - `createIoSyncWrappers`: Creates I/O wrappers (`IoSyncWrappers`).
    - `createVfsSyncWrappers`: Creates VFS wrappers (`VfsSyncWrappers`).
    - `setupOptionalVfsMethods`: Adds optional methods to VFS.
    - `integrateWithOo1`: Integrates with the OO1 API.
- **Utils:**
    - `createOpfsUtil`: Creates filesystem utilities (`OpfsUtilInterface`).
    - `runSanityCheck`: Runs sanity checks.
    - `createWorkerMessageHandler`: Creates the worker message handler.

### 1.3 Logic & Complexity

- **Orchestration:** The primary responsibility is to wire up all the above components.
- **Worker Management:** Creates and manages a `Worker` instance for the async proxy.
- **Error Handling:** Catches errors during initialization and properly rejects the promise.
- **C API Integration:** Interacts with `sqlite3.capi` to register the VFS and I/O methods.
- **State Management:** Maintains `OpfsState` which is shared with the worker via `SharedArrayBuffer`.

---

## 2. Test Strategy

### 2.1 Strategy Selection

- **Selected Type:** Unit Tests (Mock-heavy)
- **Rationale:**
    - The logic is primarily orchestration.
    - Real OPFS interactions require a browser environment and are covered by E2E tests.
    - Unit tests with mocks allow us to verify that:
        - Configuration is passed correctly.
        - Dependencies are initialized in the correct order.
        - Error handling paths are taken correctly.
        - The worker is initialized with the correct URI.
        - The VFS is registered with the correct pointers.

### 2.2 Test Scenarios

1.  **Happy Path:**
    - Call `installOpfsVfs` with no options. Verify default config is used.
    - Call `installOpfsVfs` with custom options. Verify options are respected.
    - Verify `Worker` is created with the correct URI.
    - Verify `sqlite3.vfs.installVfs` is NOT called directly (it's called in the worker message handler).
    - Verify `installOpfsVfsInitializer` calls `installOpfsVfs`.

2.  **Error States:**
    - **Environment Validation Fail:** `validateOpfsEnvironment` returns an error. Verify promise rejection.
    - **Config Disabled:** `prepareOpfsConfig` returns `disabled: true`. Verify promise resolution (no-op).
    - **Worker Timeout:** Verify timeout logic rejects the promise if worker doesn't respond.
    - **Worker Error:** Verify `worker.onerror` rejects the promise.
    - **Dependency Failure:** Mock one of the creation functions (e.g., `initializeOpfsState`) to throw. Verify promise rejection.

---

## 3. Type Strategy

We will use the existing types from `src/jswasm/shared/opfs-vfs-installer.d.ts` and `src/jswasm/vfs/opfs/installer/index.d.ts`.

### 3.1 Key Types

- **`SQLite3Module`**: The main SQLite3 interface.
- **`OpfsConfig`**: The normalized configuration.
- **`OpfsInstallerOptions`**: The user-provided options.
- **`InstallOpfsVfsContext`**: The return type of the factory.
- **`OpfsState`**: The shared state object.
- **`OpfsMetrics`**: The metrics object.

### 3.2 Type Definitions & Fixes

The existing `.d.ts` files are quite comprehensive. However, we need to ensure strict typing in the implementation:

1.  **`sqlite3.capi`**: Ensure we access `sqlite3_vfs`, `sqlite3_file`, `sqlite3_io_methods` correctly from `capi`.
2.  **`Worker`**: We need to treat `Worker` as a standard Web Worker.
3.  **`SharedArrayBuffer`**: Ensure `SharedArrayBuffer` is available or polyfilled/mocked in tests.
4.  **`__openFiles`**: Define the type for the open files map: `Record<number, OpfsFileHandle>`.
5.  **`promiseWasRejected`**: Ensure the type `{ value: boolean | undefined }` is used.

### 3.3 Explicit Type Annotations

In the new `.ts` file, we will add explicit type annotations to:

- Function parameters.
- Return types.
- Variable declarations where inference is insufficient.

**Example:**

```typescript
// Explicitly type the factory function
export function createInstallOpfsVfsContext(
    sqlite3: SQLite3Module,
): InstallOpfsVfsContext {
    // ...
}

// Explicitly type the installer function
const installOpfsVfs: InstallOpfsVfs = function callee(
    options?: OpfsInstallerOptions,
): Promise<SQLite3Module> {
    // ...
};
```

---

## 4. Verification Plan

1.  **Baseline:** Create `src/jswasm/vfs/opfs/installer/index.unit.test.ts` (targeting `.mjs`) to verify current behavior.
2.  **Implementation:** Create `src/jswasm/vfs/opfs/installer/installer/index.ts` (new TS implementation).
3.  **Migration:** Move tests to `src/jswasm/vfs/opfs/installer/installer/index.unit.test.ts` and update imports to point to the new TS file.
4.  **Validation:** Run `npm run test` and `npm run lint`.
5.  **Cleanup:** Remove old files after approval.
