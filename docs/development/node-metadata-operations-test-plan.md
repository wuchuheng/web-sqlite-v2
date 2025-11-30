# Test Plan: node-metadata-operations Migration

This document outlines the testing strategy for migrating `node-metadata-operations.mjs` to TypeScript.

## Test Cases

### Core Functionality Tests

#### 1. stat() Operation Tests

- **Basic stat retrieval**: Test getting file/directory stats with valid paths
- **Non-existent paths**: Verify proper ENOENT error is thrown
- **Missing getattr handler**: Verify EPERM error when node lacks getattr operation
- **Path vs node handling**: Test both string paths and direct node objects
- **Symlink following**: Test with and without dontFollow flag

#### 2. lstat() Operation Tests

- **Symlink behavior**: Verify lstat returns symlink info, not target info
- **Error handling**: Test propagation of stat errors

#### 3. Permission Operations Tests (chmod/lchmod/fchmod)

- **Basic permission changes**: Test file permission modifications
- **Directory permissions**: Test directory permission modifications
- **Invalid modes**: Test behavior with invalid permission values
- **Missing setattr handler**: Verify EPERM error handling
- **Path vs node**: Test both string paths and node objects
- **File descriptor ops**: Test fchmod with valid file descriptor
- **Symlink behavior**: Test lchmod doesn't follow symlinks

#### 4. Ownership Operations Tests (chown/lchown/fchown)

- **Basic ownership changes**: Test uid/gid modifications
- **Permission handling**: Test with proper write permissions
- **Missing setattr handler**: Verify EPERM error handling
- **File descriptor ops**: Test fchown with valid file descriptor
- **Symlink behavior**: Test lchown doesn't follow symlinks

#### 5. Content Operations Tests (truncate/ftruncate)

- **File truncation**: Test successful truncation to various sizes
- **Negative length**: Verify EINVAL error for negative lengths
- **Directory truncation**: Verify EISDIR error for directories
- **Non-file truncation**: Verify EINVAL error for non-regular files
- **Permission checks**: Test write permission requirements
- **File descriptor ops**: Test ftruncate with valid file descriptor
- **Read-only streams**: Verify EINVAL error for read-only file descriptors

#### 6. Time Operations Tests (utime)

- **Basic time updates**: Test setting atime/mtime
- **Time calculation**: Verify timestamp is set to max(atime, mtime)
- **Missing setattr handler**: Verify error handling

#### 7. File Opening Tests (open)

- **Basic file opening**: Test opening existing files
- **File creation**: Test O_CREAT flag behavior
- **Exclusive creation**: Test O_EXCL flag with existing/non-existing files
- **Directory handling**: Test O_DIRECTORY flag behavior
- **Character device handling**: Test O_TRUNC flag behavior with character devices
- **Permission checks**: Test mayOpen permission validation
- **Empty path handling**: Verify ENOENT error for empty paths
- **String flag conversion**: Test modeStringToFlags functionality
- **Stream creation**: Verify stream object creation with proper properties
- **Read file logging**: Test Module.logReadFiles functionality

## Test Data

### Mock Filesystem Structure

```
/
├── file.txt (regular file, rw-rw-rw-)
├── dir/ (directory, rwxrwxrwx)
├── symlink.txt -> file.txt (symlink)
└── device.txt (character device)
```

### Mock Objects Required

- **MockFS**: Complete filesystem interface with all required methods
- **MockFSNode**: Node objects with proper mode, ops, and metadata
- **MockFSStream**: Stream objects with flags, position, and file descriptor
- **MockModule**: Module object with logReadFiles property
- **MockOptions**: NodeActionsOptions with required helpers

### Error Scenarios to Test

- **ENOENT**: Non-existent file paths
- **EPERM**: Missing operation handlers (getattr, setattr)
- **EEXIST**: Exclusive creation with existing files
- **ENOTDIR**: Directory flag on non-directory files
- **EISDIR**: Truncation attempt on directories
- **EINVAL**: Invalid parameters (negative lengths, read-only truncation)
- **EACCES**: Permission denied scenarios

## Scaffolding Requirements

### Test Utilities

1. **createMockFS()**: Factory for complete mocked filesystem
2. **createMockNode()**: Factory for filesystem nodes with configurable properties
3. **createMockStream()**: Factory for file streams with proper configuration
4. **createMockOptions()**: Factory for NodeActionsOptions with all dependencies
5. **createTestFilesystem()**: Setup complete test environment with files/directories

### Mock Implementations

- **FS.lookupPath**: Path resolution with proper error handling
- **FS.getStreamChecked**: File descriptor validation
- **FS.isDir/FS.isFile**: Type checking utilities
- **FS.nodePermissions**: Permission validation
- **FS.mayOpen**: Open permission checking
- **FS.createStream**: Stream creation with proper properties
- **FS.getPath**: Path extraction from nodes

## Integration Points

### Dependencies to Mock

- **PATH.normalize**: Path normalization utilities
- **Constants**: MODE, OPEN_FLAGS, ERRNO_CODES, STREAM_STATE_MASK
- **FS_modeStringToFlags**: String flag conversion function
- **Module.logReadFiles**: File read tracking

### Type Safety Validation

- Verify all functions accept correct parameter types
- Test return type compatibility with interfaces
- Validate error types and errno codes
- Ensure proper handling of optional parameters

This test plan provides comprehensive coverage of the node-metadata-operations functionality while ensuring the TypeScript migration maintains full behavioral compatibility with the original JavaScript implementation.
