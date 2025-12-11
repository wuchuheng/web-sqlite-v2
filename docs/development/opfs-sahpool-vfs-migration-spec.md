# OPFS SAH Pool VFS Migration Spec & Test Plan

**Target Module:** `src/jswasm/vfs/opfs/opfs-sahpool-vfs.mjs`
**Related Issues/PRs:** N/A

---

## 1. Deep Analysis

### 1.1 Exports & API Surface

- **Default Export:** None.
- **Named Export:** `initializeOpfsSahpool(sqlite3)`
    - Adds `sqlite3.installOpfsSAHPoolVfs(options)` method.
    - `options`: Object with `name`, `directory`, `initialCapacity`, `clearOnInit`, `verbosity`, `forceReinitIfPreviouslyFailed`.
    - Returns: A Promise resolving to `OpfsSAHPoolUtil` instance.

### 1.2 Dependencies & External References

- **Internal:**
    - `sqlite3.util.toss`, `sqlite3.util.toss3`, `sqlite3.util.affirmDbHeader`
    - `sqlite3.capi` (SQLITE*OPEN*_, SQLITE*IOERR*_, sqlite3_vfs, sqlite3_io_methods, sqlite3_file, etc.)
    - `sqlite3.wasm` (poke*, heap8u, cstrncpy, cstrToJs, allocCString, scopedAlloc*, etc.)
    - `sqlite3.config`
    - `sqlite3.vfs.installVfs`
    - `sqlite3.oo1` (optional, for `OpfsSAHPoolDb`)
- **Browser/Environment:**
    - `navigator.storage.getDirectory`
    - `FileSystemHandle`, `FileSystemDirectoryHandle`, `FileSystemFileHandle`
    - `FileSystemSyncAccessHandle` (standardized as `createSyncAccessHandle`)
    - `TextDecoder`, `TextEncoder`
    - `Math.random`
    - `Date`

### 1.3 Logic & Complexity

- **High Complexity:**
    - Implements a full SQLite VFS using OPFS SyncAccessHandles.
    - Manages a pool of SAHs (`OpfsSAHPool`) to work around browser limits or performance characteristics.
    - Maps virtual filenames (in SQLite) to opaque files in OPFS.
    - Handles VFS method mapping (`xOpen`, `xRead`, `xWrite`, `xClose`, `xDelete`, etc.) with error translation.
    - Handles initialization logic (`installOpfsSAHPoolVfs`) including feature detection and recovery.
    - Includes a utility class `OpfsSAHPoolUtil` for management (import/export, wipe, capacity).

---

## 2. Test Strategy

### 2.1 Strategy Selection

- **Selected Type:** Mixed (Unit + E2E)
- **Rationale:**
    - **E2E (`*.e2e.test.ts`):** CRITICAL. The code relies heavily on `navigator.storage` and `createSyncAccessHandle`, which are only available in specific browser contexts (Workers) and are hard to mock perfectly. Real browser environment (via Playwright/Vitest Browser) is required to verify actual VFS behavior.
    - **Unit (`*.test.ts`):** Requested by user. Can be used to test the `OpfsSAHPool` logic if we mock the underlying `sqlite3` and `FileSystem*` APIs. Useful for testing edge cases in logic (e.g., pool capacity management, path mapping) without full browser overhead, but likely requires significant mocking.

### 2.2 Test Scenarios

- **E2E Scenarios:**
    - Initialize VFS successfully.
    - Create a database using the VFS.
    - Perform CRUD operations (verify `xRead`, `xWrite`, `xSync`).
    - Verify persistence (close and reopen).
    - Test `importDb` and `exportDb` utilities.
    - Test pool capacity expansion/reduction.
    - Test error handling (e.g., quota exceeded, missing permissions - if simulatable).
- **Unit Scenarios (with mocks):**
    - Test `getAssociatedPath` logic.
    - Test `computeDigest`.
    - Test `OpfsSAHPool` resource management (add/remove capacity) using mock handles.

---

## 3. Type Strategy

### 3.1 Existing Types

- `sqlite3` types are expected to be available (or need to be inferred/defined if missing in the project).
- standard `lib.dom.d.ts` for File System Access API (though `createSyncAccessHandle` might need specific checks).

### 3.2 New Type Definitions

- **Interfaces:**
    - `OpfsSAHPoolOptions`
    - `OpfsSAHPoolUtil` interface.
- **Signatures:**
    - `initializeOpfsSahpool(sqlite3: any): void;` (Refine `sqlite3` type).

### 3.3 Handling Ambiguity

- Use `any` only for the opaque `sqlite3` object if strictly necessary, but prefer defining a partial `Sqlite3` interface covering used properties (`capi`, `wasm`, `util`, `vfs`).

---

## 4. Verification Plan

- **Pre-migration:**
    - Create `src/jswasm/vfs/opfs/opfs-sahpool-vfs.test.ts` (Unit/Mock).
    - Create `src/jswasm/vfs/opfs/opfs-sahpool-vfs.e2e.test.ts`.
    - Run `npm run test` (or `pnpm test`).
- **Post-migration:**
    - Move tests to `src/jswasm/vfs/opfs/opfs-sahpool-vfs/`.
    - Update imports.
    - Run tests.
- **Lint Check:** Ensure clean lint.
