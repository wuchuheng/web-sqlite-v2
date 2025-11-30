# Node Core Operations Test Plan

## Overview

This document outlines the test strategy for `src/jswasm/vfs/filesystem/node-core-operations.mjs` to ensure comprehensive coverage before and during the TypeScript migration.

## Test Scope

### Core Operations to Test

1. **File Creation Operations**
    - `create(path, mode)` - Create regular files with default/custom permissions
    - `mkdev(path, mode, dev)` - Create character devices

2. **Directory Operations**
    - `mkdir(path, mode)` - Create directories with default/custom permissions
    - `mkdirTree(path, mode)` - Create directory trees recursively
    - `rmdir(path)` - Remove empty directories
    - `readdir(path)` - List directory contents

3. **Link and Path Operations**
    - `symlink(oldpath, newpath)` - Create symbolic links
    - `readlink(path)` - Read symbolic link targets
    - `rename(oldPath, newPath)` - Move/rename files and directories

4. **File Removal Operations**
    - `unlink(path)` - Remove files and symbolic links

## Test Data Setup

### Mock Filesystem Structure

```
/
├── test.txt (regular file)
├── subdir/
│   ├── nested.txt
│   └── subsubdir/
└── symlink.txt -> /test.txt
```

### Test Paths

- Root paths: "/", "/tmp", "/usr"
- File paths: "/test.txt", "/subdir/nested.txt"
- Directory paths: "/subdir", "/subdir/subsubdir"
- Symlink paths: "/symlink.txt" -> "/test.txt"
- Invalid paths: "/nonexistent", "/invalid/../path"

## Test Cases

### 1. create(path, mode)

**Success Cases:**

- Create file with default mode (should use `MODE.DEFAULT_FILE_PERMISSIONS`)
- Create file with custom mode (should respect `MODE.PERMISSION_MASK`)
- Verify returned node has correct properties (mode, name, parent)

**Error Cases:**

- Create file in non-existent directory (ENOENT)
- Create file without permissions (EACCES)
- Create file where directory already exists (EEXIST)

### 2. mkdir(path, mode)

**Success Cases:**

- Create directory with default mode (`MODE.DEFAULT_DIRECTORY_PERMISSIONS`)
- Create directory with custom mode
- Verify returned node is marked as directory
- Verify mode has `MODE.DIRECTORY` bit set

**Error Cases:**

- Create directory in non-existent parent (ENOENT)
- Create directory without permissions (EACCES)
- Create directory where file exists (ENOTDIR)

### 3. mkdirTree(path, mode)

**Success Cases:**

- Create single directory tree: "/a/b/c"
- Create directory with empty segments: "/a//b/c"
- Create directory at root: "/newdir"
- Create existing intermediate directories

**Error Cases:**

- Handle permission denied at intermediate level
- Handle invalid characters in path

### 4. mkdev(path, mode, dev)

**Success Cases:**

- Create character device with default permissions
- Create character device with custom permissions
- Verify returned node has correct rdev and mode
- Verify mode has `MODE.CHARACTER_DEVICE` bit set

**Parameter Overloading:**

- Handle `mkdev(path, dev)` where dev is used as mode

### 5. symlink(oldpath, newpath)

**Success Cases:**

- Create valid symbolic link
- Verify link resolution through `getPathFS()`
- Verify returned node has correct mode (SYMLINK)

**Error Cases:**

- Create symlink to non-existent target (ENOENT)
- Create symlink without permissions (EACCES)
- Create symlink where file exists (EEXIST)
- Create symlink without symlink support (EPERM)

### 6. rename(oldPath, newPath)

**Success Cases:**

- Rename file within same directory
- Rename file to different directory
- Rename directory with contents
- Rename over existing file (replacement)

**Error Cases:**

- Rename non-existent source (ENOENT)
- Rename across different mounts (EXDEV)
- Rename directory to existing non-empty directory (ENOTEMPTY)
- Rename without permissions (EACCES)
- Rename mountpoint (EBUSY)

**Complex Cases:**

- Test relative path validation (should start with ".")
- Test node preservation during rename
- Test hash table management (hashRemoveNode/hashAddNode)

### 7. rmdir(path)

**Success Cases:**

- Remove empty directory
- Verify node destruction

**Error Cases:**

- Remove non-existent directory (ENOENT)
- Remove file instead of directory (ENOTDIR)
- Remove non-empty directory (ENOTEMPTY)
- Remove without permissions (EACCES)
- Remove mountpoint (EBUSY)

### 8. readdir(path)

**Success Cases:**

- Read directory with contents
- Read empty directory
- Verify array contains only names (string[])
- Follow symbolic links to directories

**Error Cases:**

- Read non-existent path (ENOENT)
- Read file instead of directory (ENOTDIR)
- Read without permissions (EACCES)
- Read directory without readdir support (ENOTDIR)

### 9. unlink(path)

**Success Cases:**

- Remove regular file
- Remove symbolic link
- Verify node destruction

**Error Cases:**

- Unlink non-existent file (ENOENT)
- Unlink directory instead of file (EISDIR)
- Unlink without permissions (EACCES)
- Unlink mountpoint (EBUSY)

### 10. readlink(path)

**Success Cases:**

- Read symbolic link target
- Resolve relative paths against parent directory
- Return absolute path to target

**Error Cases:**

- Read non-existent path (ENOENT)
- Read regular file instead of symlink (EINVAL)
- Read without readlink support (EINVAL)

## Mock Implementation Strategy

### MockFS Structure

```typescript
interface MockFS extends Partial<MutableFS> {
    // Core filesystem methods
    mknod: MockFunction<(path: string, mode: number, dev: number) => FSNode>;
    lookupPath: MockFunction<(path: string, options?: any) => { node: FSNode }>;
    mayCreate: MockFunction<(parent: FSNode, name: string) => number>;
    mayDelete: MockFunction<
        (parent: FSNode, name: string, isdir: boolean) => number
    >;

    // Node operations
    lookupNode: MockFunction<(parent: FSNode, name: string) => FSNode>;
    isDir: MockFunction<(mode: number) => boolean>;
    isMountpoint: MockFunction<(node: FSNode) => boolean>;

    // Hash and node management
    hashRemoveNode: MockFunction<(node: FSNode) => void>;
    hashAddNode: MockFunction<(node: FSNode) => void>;
    destroyNode: MockFunction<(node: FSNode) => void>;

    // Permission checking
    nodePermissions: MockFunction<(node: FSNode, perm: string) => number>;
}
```

### Mock Node Creation

```typescript
function createMockNode(overrides: Partial<FSNode> = {}): FSNode {
    return {
        parent: null as any,
        mount: createMockMount(),
        mounted: null,
        id: null,
        name: "",
        mode: 0,
        node_ops: {},
        stream_ops: {},
        rdev: 0,
        readMode: 0,
        writeMode: 0,
        assignId: vi.fn(),
        read: false,
        write: false,
        isFolder: false,
        isDevice: false,
        name_next: null,
        ...overrides,
    };
}
```

## Test Organization

### File Structure

```
src/jswasm/vfs/filesystem/node-core-operations.test.ts
├── Mock creation utilities
├── createCoreOperations basic tests
├── Operation-specific describe blocks
│   ├── create
│   ├── mkdir/mkdirTree
│   ├── mkdev
│   ├── symlink/readlink
│   ├── rename
│   ├── rmdir
│   ├── readdir
│   └── unlink
└── Integration tests
```

### BeforeEach/AfterEach Setup

- Reset all mocks
- Create fresh mock filesystem
- Create fresh core operations instance
- Mock PATH utilities (dirname, basename)

## Success Criteria

### Baseline Tests (Step 2)

- All tests pass against the existing `.mjs` implementation
- Coverage >= 90% for all exported functions
- Error cases properly throw with correct errno codes

### Migration Tests (Step 4)

- Same tests pass against TypeScript implementation
- Type checking catches potential issues
- Generated `.d.ts` matches expected signatures

### Edge Cases

- Path traversal attempts
- Permission boundary conditions
- Mount point operations
- Symbolic link resolution
- Hash table consistency

## Integration Considerations

### Dependencies to Mock

- `PATH` utilities (dirname, basename)
- `ERRNO_CODES` and `MODE` constants
- `getPathFS()` function for symlink operations
- `_Module` parameter (currently unused)

### Cross-Module Testing

- Verify compatibility with node-actions facade
- Test interaction with mount-operations
- Ensure proper error propagation

This comprehensive test plan will ensure the node-core-operations module is thoroughly validated both before and after the TypeScript migration.
