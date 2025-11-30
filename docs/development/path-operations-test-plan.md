# Test Plan for `src/jswasm/vfs/filesystem/path-operations.mjs`

## Intended Test Cases:

1.  **`lookupPath` Functionality:**
    - Basic path resolution (absolute and relative).
    - Handling of `.` and `..` in paths.
    - Handling of root directory `/`.
    - `parent` option: should return the parent node and path.
    - `follow_mount` option: should traverse mount points.
    - `recurse_count` limit for `ELOOP` on excessive recursion (symlinks).
    - `follow` option for resolving final segment symlinks.
    - Non-existent paths.
2.  **`getPath` Functionality:**
    - Reconstructing paths from various nodes (root, child, deep child).
    - Handling mount points correctly when reconstructing path.
3.  **`hashName`, `hashAddNode`, `hashRemoveNode`, `lookupNode`:**
    - Verify correct hashing.
    - Verify nodes are added and removed from the hash table correctly (including collision handling).
    - Verify `lookupNode` can find nodes after `hashAddNode` and not find them after `hashRemoveNode`.
    - `mayLookup` error propagation for `lookupNode`.
4.  **`createNode`, `destroyNode`:**
    - Verify new nodes are created with correct properties.
    - Verify `createNode` adds node to hash table.
    - Verify `destroyNode` removes node from hash table.
5.  **`isRoot`, `isMountpoint`:**
    - Verify `isRoot` correctly identifies the root node.
    - Verify `isMountpoint` correctly identifies mount points.

## Test Data/Scaffolding:

- **Mock `FS` Object:** A mock `FS` object will be required to simulate filesystem operations (e.g., `FS.root`, `FS.lookupNode`, `FS.isMountpoint`, `FS.readlink`, `FS.isLink`, `FS.mayLookup`, `FS.FSNode`, `FS.nameTable`). This mock needs to be stateful to simulate node creation/deletion and path lookups.
- **Mock `FSNode` Class:** A minimal mock `FSNode` class to represent filesystem nodes, with properties like `id`, `name`, `parent`, `mode`, `mounted`, `name_next`.
- **Mock `PATH_FS`:** A mock for `PATH` object with `resolve` and `dirname` methods.
- **Constants:** `ERRNO_CODES` will be imported directly.
- **Test Utility Functions:** Helpers to set up initial filesystem state for each test scenario (e.g., `createMockFs`, `createMockNode`).
