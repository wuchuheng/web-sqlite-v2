# Migration Spec: Sanity Check Utils

## 1. Analysis

- **Target Module**: `src/jswasm/vfs/opfs/installer/utils/sanity-check.mjs`
- **Declaration**: `src/jswasm/vfs/opfs/installer/utils/sanity-check.d.ts`
- **Functionality**:
    - Exports `runSanityCheck(deps)`.
    - Validates the OPFS VFS implementation by performing a sequence of operations:
        - Serialization/deserialization.
        - File existence checks (`xAccess`).
        - File creation (`xOpen`).
        - IO operations (`xWrite`, `xRead`, `xTruncate`, `xFileSize`).
        - Synchronization (`xSync`).
        - Cleanup (`xClose`, `xDelete`).
    - Uses `wasm` allocators and C API structs (`sqlite3_file`).
    - Relies on `deps` object for all external dependencies (DI pattern).

## 2. Test Plan

- **Type**: Unit Test
- **Path**: `src/jswasm/vfs/opfs/installer/utils/sanity-check.unit.test.ts`
- **Strategy**:
    - Since `runSanityCheck` relies heavily on injected dependencies (`deps`), we can mock all these dependencies.
    - We will create a `createMockDeps()` helper to generate a spy-enabled `SanityCheckDeps` object.
    - **Test Cases**:
        1. **Happy Path**: Verify that `runSanityCheck` calls all expected methods in the correct order (serialize, xAccess, xOpen, xSync, xTruncate, xFileSize, xWrite, xRead, xClose, xDelete) without throwing.
        2. **Error Handling - Serialization**: Mock `deserialize` to return incorrect string, expect `toss` to be called.
        3. **Error Handling - Open Failure**: Mock `xOpen` to return non-zero rc, expect `error` to be called.
        4. **Error Handling - xAccess (file missing)**: Mock `xAccess` (post-open) to indicate file missing, expect `toss`.
        5. **Error Handling - IO Errors**: Mock `xSync`, `xTruncate`, `xFileSize`, `xWrite` to return error codes, expect `toss`.
        6. **Error Handling - Read Verification**: Mock `xRead` to return unexpected content, expect `toss`.
        7. **Feature Flag - xSleep**: Verify `xSleep` is called if present in `vfsSyncWrappers`.

## 3. Migration Steps

1.  **Create Test Harness**:
    - Create `src/jswasm/vfs/opfs/installer/utils/sanity-check.unit.test.ts`.
    - Implement mocks for `wasm`, `capi`, `state`, `vfsSyncWrappers`, `ioSyncWrappers`, etc.
    - Verify tests pass against `sanity-check.mjs`.
2.  **Create Migration Directory**:
    - Create `src/jswasm/vfs/opfs/installer/utils/sanity-check/`.
    - Create `src/jswasm/vfs/opfs/installer/utils/sanity-check/sanity-check.ts`.
    - Copy logic from `.mjs` and types from `.d.ts`.
3.  **Redirect Tests**:
    - Move test file to `src/jswasm/vfs/opfs/installer/utils/sanity-check/sanity-check.unit.test.ts`.
    - Update import to point to `./sanity-check`.
4.  **Compile & Lint**:
    - Add to `tsconfig.migration.json`.
    - Run `npm run build:migration`.
    - Run `npm run lint` and `npm run format`.
5.  **Update References**:
    - Search for importers of `sanity-check.mjs`.
    - Update them to point to the new build output.
6.  **Cleanup**:
    - Remove original `.mjs` and `.d.ts`.

## 4. Verification

- Run `npm run test` to ensure all tests pass.
- Verify coverage is >= 80%.
