# Legacy Helpers Test Plan

## Overview

This document outlines the comprehensive test strategy for migrating `legacy-helpers.mjs` from JavaScript to TypeScript. The legacy helpers provide compatibility with historical Emscripten FS APIs while delegating to modern filesystem primitives.

## Test Architecture

### Test Dependencies

- **Base State**: Mock `MutableFS` instance with required methods (`analyzePath`, `lookupPath`, `getPath`, `mkdir`, `create`, `chmod`, `open`, `write`, `close`, `createDevice`, `makedev`, `registerDevice`, `mkdev`)
- **Path Module**: Mock `PATH` utilities (`basename`, `join2`)
- **Constants**: Import actual constants from `constants/constants.js`
- **Mode Function**: Mock `FS_getMode(canRead, canWrite)` function

### Test Data Setup

- Mock filesystem with `/` root
- Mock nodes for files and directories
- Mock streams for file operations
- Mock device registry for character devices

## Test Cases

### 1. `createLegacyHelpers` Factory Function

- **Objective**: Verify the factory creates a proper `LegacyHelpers` object
- **Test Cases**:
    - Returns object with all 9 expected methods
    - Throws if `FS` parameter is missing
    - Throws if `FS_getMode` is missing from options
    - Properly binds provided `FS` instance

### 2. `findObject` Method

- **Objective**: Test object lookup functionality
- **Test Cases**:
    - Returns node when path exists and resolves correctly
    - Returns `null` when path doesn't exist
    - Handles `dontResolveLastLink` parameter correctly
    - Delegates to `FS.analyzePath` correctly
    - Preserves error handling from underlying `analyzePath`

### 3. `analyzePath` Method

- **Objective**: Test detailed path analysis with fallback handling
- **Test Cases**:
    - Returns complete `PathAnalysis` object for existing paths
    - Returns analysis with `exists: false` for non-existent paths
    - Correctly populates parent information (`parentExists`, `parentPath`, `parentObject`)
    - Handles `dontResolveLastLink` parameter
    - Sets proper `error` code on lookup failures
    - Identifies root paths correctly (`isRoot: true` for `/`)
    - Handles symbolic link resolution
    - Populates `name` from basename extraction

### 4. `createPath` Method

- **Objective**: Test nested directory creation
- **Test Cases**:
    - Creates single directory under parent
    - Creates nested directory hierarchy (`/a/b/c/d`)
    - Handles string parent paths correctly
    - Handles node parent objects correctly
    - Uses `PATH.join2` for path joining
    - Calls `FS.mkdir` for each directory level
    - Ignores existing directories (error handling)
    - Returns final created path
    - Handles empty path components

### 5. `createFile` Method

- **Objective**: Test file node creation
- **Test Cases**:
    - Creates file with string parent path
    - Creates file with node parent object
    - Calls `FS.getPath` when parent is node
    - Uses `PATH.join2` for full path construction
    - Calls `FS_getMode` for permission calculation
    - Calls `FS.create` with correct parameters
    - Returns created node
    - Handles `properties` parameter (unused but passed through)

### 6. `createDataFile` Method

- **Objective**: Test file creation with initial data
- **Test Cases**:
    - Creates file with string data content
    - Creates file with ArrayLike data content
    - Creates empty file when data is null
    - Handles parent path construction correctly
    - Sets proper permissions with `FS_getMode`
    - Converts string data to character array correctly
    - Sets write permissions temporarily for data writing
    - Opens file with correct flags (`O_WRONLY | O_CREAT | O_TRUNC`)
    - Writes data at correct offset
    - Restores original permissions after writing
    - Handles `canOwn` parameter correctly
    - Calls `FS.close` after writing

### 7. `createDevice` Method

- **Objective**: Test character device creation and registration
- **Test Cases**:
    - Creates device with input and output callbacks
    - Creates read-only device (input only)
    - Creates write-only device (output only)
    - Creates device with no callbacks
    - Increments `FS.createDevice.major` correctly
    - Starts with `DEVICE_MAJOR_BASE` when undefined
    - Calls `FS.makedev` with major/minor numbers
    - Registers device with correct stream operations:
        - `open`: Sets `seekable = false`
        - `close`: Calls output with newline if buffer has data
        - `read`: Handles input callback, EOF detection, error handling
        - `write`: Handles output callback, error handling
    - Updates timestamp on read/write operations
    - Returns created device node

### 8. `forceLoadFile` Method

- **Objective**: Test file loading enforcement
- **Test Cases**:
    - Returns `true` for device nodes
    - Returns `true` for folder nodes
    - Returns `true` for nodes with symlinks
    - Returns `true` for nodes with existing contents
    - Throws `EIO` error for regular files without contents
    - Throws specific error message about XMLHttpRequest when in browser
    - Proper error code propagation

### 9. `createLazyFile` Method

- **Objective**: Test deprecated method behavior
- **Test Cases**:
    - Always throws with deprecation message
    - Message mentions `--embed-file` or `--preload-file` alternatives
    - Error type is appropriate (not silent failure)

## Edge Cases and Error Handling

### Input Validation

- Null/undefined parameters
- Empty strings
- Invalid path formats
- Non-existent parent directories
- Permission failures

### Resource Management

- Proper cleanup on errors
- Memory leak prevention
- Stream closure guarantees
- Device registration cleanup

### Integration Scenarios

- Multiple device creation with major number tracking
- Nested path creation with existing intermediate directories
- Data file creation with large data sets
- Path traversal attempts

## Mock Implementation Strategy

### FS Mock

```typescript
interface MockFS extends MutableFS {
  analyzePath: vi.fn();
  lookupPath: vi.fn();
  getPath: vi.fn();
  mkdir: vi.fn();
  create: vi.fn();
  chmod: vi.fn();
  open: vi.fn();
  write: vi.fn();
  close: vi.fn();
  createDevice: { major?: number };
  makedev: vi.fn();
  registerDevice: vi.fn();
  mkdev: vi.fn();
}
```

### Path Module Mock

```typescript
const mockPATH = {
    basename: vi.fn(),
    join2: vi.fn(),
};
```

### Test Fixtures

- Pre-configured mock filesystem
- Standard error codes from constants
- Common test data (strings, arrays)
- Device callback spies

## Success Criteria

- All tests pass against the original `.mjs` implementation
- Test coverage ≥ 95% of the legacy helpers functionality
- All edge cases and error paths tested
- Tests are deterministic and repeatable
- Mock behavior matches real filesystem semantics
- Performance tests complete within reasonable time limits

## Migration Validation

After TypeScript migration:

- All existing tests continue to pass
- Generated `.d.ts` matches original type definitions
- No behavioral regressions in integration tests
- Browser compatibility maintained
