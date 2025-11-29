# Mode Operations Test Plan

## Overview

This document outlines the comprehensive test strategy for migrating `src/jswasm/vfs/filesystem/mode-operations.mjs` to TypeScript. The tests will validate POSIX mode bit operations and filesystem permission checking functionality.

## Test Scope

### Mode Type Checkers

Test all type identification functions with various mode values:

```typescript
// File type identification
- isFile() with FILE mode, DIRECTORY mode, SYMLINK mode, etc.
- isDir() with DIRECTORY mode, non-directory modes
- isLink() with SYMLINK mode, non-symlink modes
- isChrdev(), isBlkdev(), isFIFO(), isSocket() with respective modes
- Edge cases: mode = 0, invalid mode values, mode with multiple type bits
```

### Permission String Generation

Test conversion of open flags to permission strings:

```typescript
// Open flag to permission mapping
- flagsToPermissionString() with O_RDONLY, O_WRONLY, O_RDWR
- Combined flags with O_TRUNC (should append "w")
- Edge cases: invalid flag values, empty flags
```

### Node Permission Validation

Test permission checking against file node modes:

```typescript
// Permission validation scenarios
- nodePermissions() with read/write/execute permissions
- Tests with FS.ignorePermissions = true (should always return 0)
- Tests with various permission combinations on node.mode
- Error cases: missing read, write, or execute permissions
```

### High-level Permission Operations

Test filesystem operation permission checks:

```typescript
// mayLookup() tests
- Directory validation (returns ENOTDIR for non-directories)
- Execute permission checking
- Missing lookup operations (returns EACCES)
- Success cases (returns 0)

// mayCreate() tests
- File exists scenarios (returns EEXIST)
- Write + execute permission checking
- Success cases when file doesn't exist and permissions allow

// mayDelete() tests
- Directory vs file validation (EISDIR, ENOTDIR)
- Permission validation on parent directory
- Protected directories (root, cwd) - returns EBUSY
- Node lookup failures

// mayOpen() tests
- Null node handling (ENOENT)
- Symbolic link handling (ELOOP)
- Directory opening restrictions (EISDIR for non-read or truncate)
- Permission validation on target node
```

## Test Data and Fixtures

### Mock FS Object

Create a minimal MutableFS mock with:

```typescript
const mockFS = {
    ignorePermissions: false,
    isDir: vi.fn(),
    lookupNode: vi.fn(),
    nodePermissions: vi.fn(),
    isRoot: vi.fn(),
    getPath: vi.fn(),
    cwd: vi.fn(),
    flagsToPermissionString: vi.fn(),
};
```

### Mock FSNode Objects

Create test nodes with various properties:

```typescript
const fileNode: FSNode = {
    mode: MODE.FILE | MODE.DEFAULT_FILE_PERMISSIONS,
    parent: null as any,
    mount: null as any,
    mounted: null,
    id: null,
    name: "test.txt",
    node_ops: {},
    stream_ops: {},
    rdev: 0,
    readMode: MODE.PERMISSION_READ,
    writeMode: MODE.PERMISSION_WRITE,
    assignId: vi.fn(),
    read: true,
    write: true,
    isFolder: false,
    isDevice: false,
};
```

## Test Organization

### Test Groups

1. **Type Identification Tests** - All `is*` functions
2. **Permission String Tests** - `flagsToPermissionString`
3. **Node Permission Tests** - `nodePermissions`
4. **Filesystem Operation Tests** - `may*` functions

### Setup and Teardown

- Reset all mocks between tests
- Test both permission enforcement enabled/disabled
- Isolate test cases to prevent cross-contamination

## Test Execution Plan

### Initial Baseline

1. Create tests targeting the existing `.mjs` implementation
2. Run `npm run test:unit` to establish passing baseline
3. Verify all functionality works as expected

### Migration Validation

1. Update tests to target new TypeScript implementation
2. Run tests to ensure behavioral parity
3. Verify TypeScript compilation produces equivalent output

## Expected Outcomes

### Success Criteria

- All tests pass against both JavaScript and TypeScript implementations
- Permission checking behaves identically in both versions
- Edge cases and error conditions are properly handled
- TypeScript types are properly enforced

### Edge Cases to Cover

- Invalid mode values
- Missing file system methods
- Permission bypass scenarios
- Special file types (devices, sockets, etc.)
- Complex permission combinations

This test plan will ensure the TypeScript migration maintains full behavioral compatibility while adding type safety.
