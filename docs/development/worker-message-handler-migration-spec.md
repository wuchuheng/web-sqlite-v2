# Migration Spec: Worker Message Handler

## Target Module

- Source: `src/jswasm/vfs/opfs/installer/utils/worker-message-handler.mjs`
- Types: `src/jswasm/vfs/opfs/installer/utils/worker-message-handler.d.ts`

## Test Strategy

- **Type**: Unit Tests (`*.unit.test.ts`)
- **Framework**: Vitest

## Test Cases

### 1. `opfs-unavailable`

- **Input**: Message event with `data: { type: "opfs-unavailable", payload: ["Error reason"] }`
- **Expected Behavior**: Calls `promiseReject` with an Error containing the payload.

### 2. `opfs-async-loaded`

- **Input**: Message event with `data: { type: "opfs-async-loaded" }`
- **Expected Behavior**:
    - Creates a copy of `state` (filtering out functions).
    - Calls `W.postMessage` with `{ type: "opfs-async-init", args: stateForWorker }`.

### 3. `opfs-async-inited`

- **Input**: Message event with `data: { type: "opfs-async-inited" }`
- **Scenarios**:
    - **Success Path**:
        - Installs VFS via `sqlite3.vfs.installVfs`.
        - Initializes SAB views (`sabOPView`, `sabFileBufView`, `sabS11nView`).
        - If `options.sanityChecks` is true, calls `runSanityCheck()`.
        - If `thisThreadHasOPFS()` returns true:
            - Calls `navigator.storage.getDirectory()`.
            - On success: sets `opfsUtil.rootDirectory`, cleans up `W.onerror`, and calls `promiseResolve`.
            - On failure: calls `promiseReject`.
        - If `thisThreadHasOPFS()` returns false:
            - Calls `promiseResolve` immediately.
    - **Promise Already Rejected**:
        - If `promiseWasRejected.value` is true, does nothing.
    - **Error Handling**:
        - If any step throws, calls `error()` and `promiseReject()`.

### 4. Unknown Message Type

- **Input**: Message event with `data: { type: "unknown-type" }`
- **Expected Behavior**: Calls `error()` and `promiseReject` with an unexpected message error.

## Scaffolding & Mocks

- **Mocks**:
    - `promiseResolve`, `promiseReject`
    - `sqlite3` (with `vfs.installVfs`)
    - `opfsVfs`, `opfsIoMethods`, `ioSyncWrappers`, `vfsSyncWrappers`
    - `state` (with SAB properties)
    - `opfsUtil`
    - `options`
    - `warn`, `error`, `runSanityCheck`
    - `thisThreadHasOPFS`
    - `W` (Worker mock with `postMessage`, `onerror`)
    - `navigator.storage.getDirectory`

## Verification

- Coverage goal: ≥ 80%
