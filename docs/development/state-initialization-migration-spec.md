# Migration Spec: State Initialization

## 1. Goal

Convert `src/jswasm/vfs/opfs/installer/core/state-initialization.mjs` to TypeScript.

## 2. Source Analysis

- **File**: `src/jswasm/vfs/opfs/installer/core/state-initialization.mjs`
- **Exports**:
    - `initializeOpfsState(opfsVfs, capi, toss)`
    - `initializeMetrics(state)`
- **Dependencies**:
    - `opfsVfs`: `SQLite3VFSInstance`
    - `capi`: `SQLite3CAPI`
    - `toss`: `(msg: string, ...args: any[]) => never`
- **Logic**:
    - Initializes `OpfsState` object.
    - Sets up `SharedArrayBuffer`s for IO and OP.
    - Initializes operation IDs.
    - Maps SQLite constants from CAPI.
    - Initializes metrics.

## 3. Destination

- **File**: `src/jswasm/vfs/opfs/installer/core/state-initialization/state-initialization.ts`
- **Types**:
    - Use `OpfsState`, `OpfsMetrics`, `OpfsOpIds`, `SQLiteConstants`, `OpfsFlags` from `../../../../../shared/opfs-vfs-installer.d.ts`.

## 4. Test Plan

- Create a unit test `src/jswasm/vfs/opfs/installer/core/state-initialization.unit.test.ts` (initially testing the .mjs file).
- Verify the .mjs implementation.
- Switch the test to import the .ts file.
- Verify the .ts implementation.
