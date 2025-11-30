# Node Actions Test Plan

## Migration Test Plan for node-actions.mjs

### Purpose

This plan outlines the test cases needed to verify that the TypeScript migration of `node-actions.mjs` maintains behavioral parity with the original JavaScript implementation.

### Target Module

- **Original**: `src/jswasm/vfs/filesystem/node-actions.mjs`
- **Migration**: `src/jswasm/vfs/filesystem/node-actions/node-actions.ts`
- **Type Definitions**: `src/jswasm/vfs/filesystem/node-actions.d.ts`

### Test Strategy

#### 1. Factory Function Tests

**Goal**: Verify that `createNodeActions` correctly instantiates the facade with proper dependencies.

- Test that the function returns a complete NodeActions interface
- Test that core operations and metadata operations are properly combined
- Test that invalid parameters are handled appropriately
- Test dependency injection works correctly

#### 2. API Completeness Tests

**Goal**: Ensure all NodeActions interface methods are properly exported.

- Verify all core operations are available (create, mkdir, mkdirTree, mkdev, symlink, rename, rmdir, readdir, unlink, readlink)
- Verify all metadata operations are available (stat, lstat)
- Verify all permission operations are available (chmod, lchmod, fchmod, chown, lchown, fchown)
- Verify all content operations are available (truncate, ftruncate, utime)
- Verify file access operations are available (open)

#### 3. Integration Tests with Dependencies

**Goal**: Test that the NodeActions facade correctly delegates to underlying operation modules.

- Mock `createCoreOperations` and verify its methods are properly exposed
- Mock `createMetadataOperations` and verify its methods are properly exposed
- Test that the combined interface maintains method signatures
- Test error propagation through the facade

#### 4. Parameter Validation Tests

**Goal**: Ensure proper validation of input parameters.

- Test that FS parameter is required and validated
- Test that options parameter is required and has expected properties
- Test edge cases for null/undefined parameters

### Test Data

#### Mock Objects

- **MockFS**: Complete filesystem mock with all required methods
- **MockOptions**: Configuration object with all required utilities
- **MockPathFS**: Path utility mock for resolve/relative operations
- **MockNodes/Streams**: Filesystem node and stream objects for testing

#### Edge Cases

- Empty or invalid FS objects
- Missing required option properties
- Invalid parameter types
- Error conditions from underlying operations

### Scaffolding Requirements

#### Test Utilities

- Helper functions to create mock FS, nodes, and streams
- Constants for common test values (modes, flags, error codes)
- Mock implementations for path utilities and runtime module

#### Test Environment

- Vitest configuration for unit testing
- Proper TypeScript compilation for test files
- Mock implementations for all external dependencies

### Existing Test Coverage Analysis

The current `node-actions.test.ts` provides comprehensive coverage for:

- ✅ File creation operations (create, mkdir, mkdirTree, mkdev)
- ✅ Status operations (stat, lstat)
- ✅ Permission operations (chmod, fchmod)
- ✅ Content operations (truncate, ftruncate, utime)
- ✅ Error handling and edge cases

### Migration Testing Approach

#### Phase 1: Baseline Verification

- Run existing tests against the current `.mjs` implementation
- Ensure all tests pass to establish baseline behavior
- Document any current test failures or issues

#### Phase 2: Test Migration

- Move test file to new subdirectory alongside TypeScript source
- Update imports to target the new TypeScript implementation
- Verify all tests continue to pass with the TS implementation

#### Phase 3: Parity Verification

- Compare generated `.d.ts` with original manual definitions
- Verify API surface remains identical
- Test runtime behavior matches original implementation

### Success Criteria

1. **All existing tests pass** against both `.mjs` and `.ts` implementations
2. **Generated .d.ts matches** original manual type definitions
3. **API surface remains identical** - no breaking changes
4. **Performance characteristics** remain equivalent
5. **Error handling behavior** is preserved

### Test Commands

```bash
# Run unit tests against current implementation
npm run test:unit

# Run tests for specific module
npx vitest run src/jswasm/vfs/filesystem/node-actions.test.ts

# Run tests after migration
npm run test:unit
```

### Notes

- The current test suite is comprehensive and well-structured
- Tests focus on the facade behavior rather than implementation details
- Mock-based testing approach isolates the module from filesystem dependencies
- All major operation categories are covered with edge cases and error conditions
