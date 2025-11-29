# Test Plan: base-state Module Migration

## Overview

This document outlines the test strategy for migrating `src/jswasm/vfs/filesystem/base-state.mjs` to TypeScript. The goal is to ensure behavioral parity between the original JavaScript implementation and the new TypeScript version.

## Test Scope

### Primary Functionality

**createBaseState() Function**

- Verify the function returns a properly initialized MutableFS object
- Test all default property values and initial state
- Ensure all required classes (ErrnoError, FSStream, FSNode) are properly constructed

### Class Behaviors

**ErrnoError Class**

- Test error instance creation with errno values
- Verify error name property is set to "ErrnoError"
- Test error inheritance from Error prototype

**FSStream Class**

- Test stream instance initialization with shared state
- Verify getter/setter behavior for:
    - `object` property (node mapping)
    - `flags` property (delegating to shared.flags)
    - `position` property (delegating to shared.position)
    - `isRead`, `isWrite`, `isAppend` computed properties
- Test flag-based read/write mode detection

**FSNode Class**

- Test node creation with parent, name, mode, and rdev parameters
- Verify parent assignment logic (self-parenting when no parent provided)
- Test getter/setter behavior for:
    - `read` property (mode manipulation)
    - `write` property (mode manipulation)
    - `isFolder` property (mode checking)
    - `isDevice` property (mode checking)
- Test `assignId()` method for inode assignment

### State Properties

**MutableFS Interface Properties**

- Verify all required properties exist with correct types:
    - `root: null`
    - `mounts: []`
    - `devices: {}`
    - `streams: []`
    - `nextInode: 1`
    - `nameTable: null`
    - `currentPath: "/"`
    - `initialized: false`
    - `ignorePermissions: true`
    - `genericErrors: {}`
    - `filesystems: null`
    - `syncFSRequests: 0`
    - `readFiles: {}`

## Test Data

### Constants Dependencies

- Mock filesystem constants (MODE, OPEN_FLAGS, STREAM_STATE_MASK, PERMISSION)
- Test various flag combinations for stream mode detection
- Test different mode values for node type detection

### Test Scenarios

**Basic State Creation**

- Default state initialization
- Property type validation
- Class constructor validation

**Stream Operations**

- Read/write mode detection based on flags
- Position and flag delegation to shared state
- Object/node relationship management

**Node Operations**

- Permission mode manipulation
- Folder/device type detection
- Inode assignment and increment

**Error Handling**

- ErrnoError creation with various errno values
- Error property validation

## Test Infrastructure

### Test Framework

- Use Vitest (already configured in project)
- Follow existing test patterns in the codebase
- Include both positive and negative test cases

### Test Organization

```typescript
describe("createBaseState", () => {
    describe("MutableFS properties", () => {
        // Test all default properties
    });

    describe("ErrnoError class", () => {
        // Test error creation and properties
    });

    describe("FSStream class", () => {
        // Test stream behavior and getters/setters
    });

    describe("FSNode class", () => {
        // Test node creation and methods
    });
});
```

### Mock Dependencies

- Mock the constants module to provide predictable flag values
- Test with various flag combinations to ensure bitwise operations work correctly

## Success Criteria

1. All tests pass against the original .mjs implementation (baseline)
2. All tests pass against the new TypeScript implementation (migration verification)
3. Test coverage > 90% for the module
4. No behavioral regressions detected
5. Type checking passes with strict TypeScript settings

## Edge Cases to Consider

- Null/undefined handling in class constructors
- Boundary conditions for inode assignment
- Flag combinations that might not be expected
- Self-parenting nodes (root nodes)
- Stream shared state delegation edge cases
