# Stream Helpers Test Plan

## Overview

This document outlines the test strategy for migrating `src/jswasm/vfs/filesystem/stream-helpers.mjs` to TypeScript. The tests will ensure behavioral parity between the original JavaScript implementation and the new TypeScript version.

## Module Under Test

**Target**: `src/jswasm/vfs/filesystem/stream-helpers.mjs`
**Factory Function**: `createStreamHelpers(FS: MutableFS): StreamHelpers`

## Test Categories

### 1. Stream Lifecycle Tests

#### close() Tests

- **Valid close**: Close an open stream and verify fd is set to null
- **Double close**: Attempt to close already closed stream → EBADF error
- **getdents cleanup**: Verify getdents property is nulled on close
- **Stream ops cleanup**: Verify stream.stream_ops.close is called if exists

#### isClosed() Tests

- **Open stream**: Returns false for newly opened stream
- **Closed stream**: Returns true after calling close()

#### llseek() Tests

- **Valid seek**: Seek to different positions (SEEK_SET, SEEK_CUR, SEEK_END)
- **Closed stream**: Seek on closed stream → EBADF error
- **Non-seekable stream**: Attempt seek on non-seekable stream → ESPIPE error
- **Invalid whence**: Invalid whence value → EINVAL error
- **Position update**: Verify stream.position is updated correctly
- **Ungotten reset**: Verify stream.ungotten array is cleared

### 2. I/O Operations Tests

#### read() Tests

- **Valid read**: Successful read with buffer, offset, length
- **Negative parameters**: Negative length/position → EINVAL error
- **Closed stream**: Read from closed stream → EBADF error
- **Write-only stream**: Read from write-only stream → EBADF error
- **Directory read**: Attempt read from directory → EISDIR error
- **No read support**: Stream without read operation → EINVAL error
- **Position handling**: Test with explicit position and with stream position
- **Non-seekable positioning**: Explicit position on non-seekable → ESPIPE error
- **Position update**: Verify stream.position updated for non-seeking reads

#### write() Tests

- **Valid write**: Successful write with buffer, offset, length
- **Negative parameters**: Negative length/position → EINVAL error
- **Closed stream**: Write to closed stream → EBADF error
- **Read-only stream**: Write to read-only stream → EBADF error
- **Directory write**: Attempt write to directory → EISDIR error
- **No write support**: Stream without write operation → EINVAL error
- **Append mode**: Verify seeking to end for O_APPEND flag
- **Position handling**: Test with explicit position and with stream position
- **Non-seekable positioning**: Explicit position on non-seekable → ESPIPE error
- **Position update**: Verify stream.position updated for non-seeking writes

### 3. Memory Management Tests

#### allocate() Tests

- **Valid allocate**: Successful allocation with offset and length
- **Closed stream**: Allocate on closed stream → EBADF error
- **Invalid parameters**: Negative offset/zero-or-negative length → EINVAL error
- **Read-only stream**: Allocate on read-only stream → EBADF error
- **Unsupported node**: Allocate on non-file/non-dir → ENODEV error
- **No allocate support**: Stream without allocate → ENOTSUP error

#### mmap() Tests

- **Valid mmap**: Successful memory mapping with all parameters
- **Permission denied**: Write protection without proper flags → EACCES error
- **Closed stream**: mmap on closed stream → EBADF error
- **Write-only stream**: mmap on write-only stream → EACCES error
- **No mmap support**: Stream without mmap → ENODEV error
- **Zero length**: Zero length mapping → EINVAL error
- **Return value**: Verify return structure { ptr, length }

#### msync() Tests

- **Valid msync**: Successful sync with all parameters
- **No msync support**: Stream without msync returns 0
- **Return value**: Verify proper return codes

### 4. Device Control Tests

#### ioctl() Tests

- **Valid ioctl**: Successful ioctl operation
- **No ioctl support**: Stream without ioctl → ENOTTY error
- **Return value**: Verify proper return codes

### 5. High-Level File Operations Tests

#### readFile() Tests

- **Binary read**: Read file as Uint8Array
- **UTF-8 read**: Read file as decoded string
- **Default flags**: Verify default flag handling
- **Custom flags**: Test with custom opening flags
- **Invalid encoding**: Invalid encoding type → Error
- **File cleanup**: Verify stream is closed after read
- **File not found**: Non-existent file → ENOENT error

#### writeFile() Tests

- **String write**: Write string data to file
- **Buffer write**: Write ArrayBufferView data to file
- **Default flags**: Verify default flags (O_WRONLY|O_CREAT|O_TRUNC)
- **Custom flags**: Test with custom opening flags
- **Custom mode**: Test with custom file mode
- **canOwn option**: Test buffer ownership transfer
- **Unsupported data**: Invalid data type → Error
- **File cleanup**: Verify stream is closed after write
- **UTF-8 encoding**: Verify proper UTF-8 encoding for strings

### 6. Directory Operations Tests

#### cwd() Tests

- **Get current path**: Return current working directory path
- **Path changes**: Reflect changes after chdir operations

#### chdir() Tests

- **Valid chdir**: Change to existing directory
- **Non-existent path**: Change to non-existent → ENOENT error
- **Not a directory**: Change to file → ENOTDIR error
- **Permission denied**: No execute permissions → EPERM/EACCES error
- **Path update**: Verify FS.currentPath is updated correctly

## Test Data Requirements

### Mock Filesystem State

- Mock FS object with required properties and methods
- Mock stream objects with different configurations (read/write, seekable, permissions)
- Mock node objects for files and directories
- Mock path resolution system

### Test Fixtures

- Sample UTF-8 text data for encoding/decoding tests
- Binary data for buffer operations
- Directory structure for navigation tests
- File permission combinations for access control tests

## Scaffolding Requirements

### Helper Functions

- `createMockFS()`: Factory for creating filesystem mocks
- `createMockStream()`: Factory for creating stream mocks with specific behaviors
- `createMockNode()`: Factory for creating node mocks with permissions
- `assertErrnoError()`: Helper to assert specific errno errors

### Test Utilities

- Buffer comparison utilities
- UTF-8 encoding verification helpers
- Path manipulation test helpers
- Error assertion helpers

## Test Environment Setup

### Dependencies

- Mock implementations of UTF8 utilities
- Mock constants (ERRNO_CODES, OPEN_FLAGS, STREAM_STATE_MASK)
- Vitest test framework configuration
- TypeScript compilation support

### Module Resolution

- Import stream-helpers.mjs for baseline tests
- Import stream-helpers (extensionless) for TypeScript tests
- Ensure proper module resolution in test environment

## Success Criteria

1. **All tests pass** against the original .mjs implementation (baseline)
2. **All tests pass** against the new TypeScript implementation
3. **No behavioral regressions** between implementations
4. **TypeScript compilation** succeeds without errors
5. **Linting passes** with no rule violations
6. **Generated .d.ts** matches original type definitions

## Implementation Notes

- Test each method individually with focused test cases
- Use descriptive test names that indicate the scenario
- Include both positive and negative test cases
- Verify error codes and messages match exactly
- Test edge cases and boundary conditions
- Ensure proper cleanup in each test
