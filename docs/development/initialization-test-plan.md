# Initialization Module Test Plan

## Overview

This document outlines the test strategy for migrating `src/jswasm/vfs/filesystem/initialization.mjs` to TypeScript. The tests will verify that all filesystem initialization helpers work correctly and maintain behavioral parity with the original JavaScript implementation.

## Test Scope

### Module Under Test
- **File**: `src/jswasm/vfs/filesystem/initialization.mjs`
- **Function**: `createInitializationHelpers(FS, options)`
- **Dependencies**: Constants from `constants/constants`, MutableFS from `base-state`

### Test Categories

#### 1. Default Directory Creation
**Test**: `createDefaultDirectories()`
- Creates `/tmp`, `/home`, `/home/web_user` directories
- Verifies correct directory permissions and mode bits
- Ensures parent-child relationships are established
- Tests that directories are properly registered in the filesystem

#### 2. Default Device Setup
**Test**: `createDefaultDevices(TTY, randomFill)`
- Creates `/dev` directory structure
- Registers `/dev/null` device (returns 0 on read, writes length on write)
- Sets up TTY devices with provided operations
- Configures `/dev/random` and `/dev/urandom` devices
- Verifies random buffer management and refilling logic
- Tests device registration with correct major/minor numbers

#### 3. Special Directory Creation
**Test**: `createSpecialDirectories()`
- Creates `/proc` directory structure
- Sets up `/proc/self/fd` synthetic mount
- Tests file descriptor lookup functionality
- Verifies symlink behavior for fd entries
- Ensures proper mount point configuration

#### 4. Standard Stream Configuration
**Test**: `createStandardStreams(input, output, error)`
- Sets up stdin, stdout, stderr devices
- Tests with and without custom callbacks
- Verifies symlink fallback to TTY devices
- Ensures streams are properly opened with correct flags
- Tests stream registration and fd assignment

#### 5. Static Initialization
**Test**: `staticInit(MEMFS)`
- Sets up generic error entries for ENOENT
- Initializes name table with MAX_OPEN_FDS capacity
- Mounts MEMFS at root path
- Registers MEMFS in filesystems table
- Calls createDefaultDirectories()

#### 6. Runtime Initialization
**Test**: `init(input, output, error)`
- Sets FS.initialized flag to true
- Resolves stdio callbacks from Module object
- Delegates to createStandardStreams
- Tests with custom and default stdio implementations

#### 7. Cleanup Operations
**Test**: `quit()`
- Sets FS.initialized flag to false
- Iterates through all open streams
- Properly closes each stream
- Tests cleanup with no open streams
- Verifies state reset after quit

## Test Data and Fixtures

### Mock Objects
- **MutableFS Mock**: Implements required filesystem operations
- **TTY Mock**: Provides register() and default operations
- **Module Mock**: Simulates Emscripten module behavior
- **RandomFill Mock**: Provides predictable random data for testing

### Test Constants
- Standard errno codes for error testing
- Known device numbers for verification
- Permission masks for directory creation
- Buffer sizes for random device testing

## Scaffolding and Helpers

### Test Helper Functions
```typescript
// Create a minimal mock filesystem for testing
function createMockFS(): MutableFS

// Create mock TTY operations for device testing
function createMockTTY(): TTYOperations

// Create predictable random fill function
function createPredictableRandomFill(): (buffer: Uint8Array) => Uint8Array

// Verify directory exists with correct properties
function expectDirectoryExists(fs: MutableFS, path: string, mode?: number): void

// Verify device is registered correctly
function expectDeviceRegistered(fs: MutableFS, dev: number): void
```

### Setup and Teardown
- Fresh filesystem instance for each test
- Cleanup of any created resources
- Reset of mock function call counts
- Isolation between test cases

## Integration Considerations

### Dependencies
- Tests should import from the existing `.mjs` file (Step 2)
- Constants should be imported from `constants/constants.js`
- Types from `base-state.d.ts` and `runtime-types.d.ts`

### Error Scenarios
- Invalid device numbers
- Stream creation failures
- Permission errors in directory creation
- Missing TTY operations

### Edge Cases
- Multiple initialization calls
- Quit without prior init
- Device registration conflicts
- Stream cleanup with null entries

## Success Criteria

1. **Behavioral Parity**: All tests pass against the existing `.mjs` implementation
2. **Coverage**: All public methods and error paths are tested
3. **Integration**: Tests work with real MutableFS instances
4. **Performance**: Tests run efficiently and don't create resource leaks
5. **Maintainability**: Test code is clear and follows project patterns

## Test Files

**Location**: `src/jswasm/vfs/filesystem/initialization.test.ts`
**Framework**: Vitest (following project conventions)
**Imports**: Point to existing `.mjs` file in Step 2
**Structure**: Group tests by function with descriptive describe blocks