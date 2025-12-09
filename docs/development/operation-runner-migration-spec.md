# Migration Spec: operation-runner

## 1. Target module

- **Path:** `src/jswasm/vfs/opfs/installer/core/operation-runner.mjs`
- **Declaration:** `src/jswasm/vfs/opfs/installer/core/operation-runner.d.ts`

## 2. Analysis

- **Exports:**
    - `createOperationRunner(state, metrics, error, toss)`: Returns a function that executes operations via Atomics.
    - `createOperationTimer(metrics)`: Returns an object with `mTimeStart(op)` and `mTimeEnd()` for performance tracking.
- **Dependencies:**
    - `state`: Needs `opIds`, `s11n`, `sabOPView`, `sabS11nOffset`, `sabS11nSize`.
    - `metrics`: Object where keys are operation names, values have `wait`, `time`, `count`.
    - `Atomics`: Used for thread synchronization (`store`, `notify`, `wait`, `load`).
    - `performance`: Used for timing (`now()`).
- **Behavior:**
    - `createOperationRunner` creates a closure that handles serialization, atomic signaling, waiting, and deserialization of results/errors.
    - `createOperationTimer` creates a simple timer object.
- **Types:**
    - Heavily relies on `OpfsState`, `OpfsMetrics`, `OperationRunner`, `OperationTimer` from shared types.
    - `toss` and `error` are utility functions.

## 3. Test Plan

- **Type:** Unit tests (`operation-runner.unit.test.ts`)
- **Location:** `src/jswasm/vfs/opfs/installer/core/operation-runner.unit.test.ts` (initially), then move to `src/jswasm/vfs/opfs/installer/core/operation-runner/operation-runner.unit.test.ts`.
- **Test Cases:**
    1. **`createOperationRunner`**:
        - Should serialize arguments.
        - Should set atomic flags correctly (`rc = -1`, `whichOp = opNdx`).
        - Should notify the worker.
        - Should wait for `rc` to change.
        - Should return the result code.
        - Should update metrics (`wait` time).
        - Should handle invalid op IDs (throw via `toss`).
        - Should handle async exceptions (deserialize error and call `error`).
    2. **`createOperationTimer`**:
        - `mTimeStart` should record start time and increment count.
        - `mTimeEnd` should update total time.

## 4. Migration Steps

1.  **Test Harness:** Create `operation-runner.unit.test.ts` testing the current `.mjs` implementation.
2.  **Migration Subdirectory:** Create `src/jswasm/vfs/opfs/installer/core/operation-runner/` and implementation `operation-runner.ts`.
3.  **Redirect Tests:** Move tests to subdirectory and point to new `.ts`.
4.  **Compile:** Add to `tsconfig.migration.json` and build.
5.  **Runtime Update:** Update references in other files (if any, likely `opfs-vfs-installer.mjs` or similar).
6.  **Cleanup:** Remove old `.mjs` and `.d.ts`.
