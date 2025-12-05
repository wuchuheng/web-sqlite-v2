# environment-validation Migration Specification

> **Status**: Ready for Implementation  
> **Migration Type**: JS (.mjs) → TypeScript (.ts)  
> **Complexity**: Low (Pure validation logic, no dependencies)  
> **Estimated Time**: 1-2 hours  
> **Priority**: Medium

---

## Request Template

### 1. Target module
**Original Path**: `src/jswasm/vfs/opfs/installer/core/environment-validation.mjs` (53 lines)

### 2. Declaration file
**DTS Path**: `src/jswasm/vfs/opfs/installer/core/environment-validation.d.ts` (20 lines)

### 3. Behavioral notes

**Module Purpose**: Validates browser environment support for OPFS (Origin Private File System) functionality.

**Module Category**: Environment Detection / Validation  
**Dependencies**: None (uses only globalThis)  
**Side Effects**: None (pure validation logic)  
**Browser APIs Used**: FileSystem API, SharedArrayBuffer, Atomics, WorkerGlobalScope, Navigator.storage

**Exports**:
1. `validateOpfsEnvironment(globalObj: typeof globalThis): Error | null`
   - Validates complete OPFS environment requirements
   - Checks: SharedArrayBuffer, Atomics, WorkerGlobalScope, OPFS FileSystem APIs
   - Returns specific error messages for different failure scenarios
   - Returns `null` on success
   - Note: Parameter `globalObj` is currently unused (prefixed with `_`)

2. `thisThreadHasOPFS(): boolean`
   - Quick check for OPFS API presence in current thread
   - Does not check SharedArrayBuffer or WorkerGlobalScope
   - Returns boolean indicating OPFS API availability

**Runtime Constraints**:
- Runs in browser Worker environment (requires WorkerGlobalScope)
- Requires COOP/COEP headers for SharedArrayBuffer/Atomics
- Validates OPFS FileSystem APIs: FileSystemHandle, FileSystemDirectoryHandle, FileSystemFileHandle, createSyncAccessHandle, navigator.storage.getDirectory

**Edge Cases**:
- Different error messages for different failure types (SharedArrayBuffer/Atomics vs WorkerGlobalScope vs OPFS APIs)
- Unused parameter in validateOpfsEnvironment (keeps API surface stable)
- Boolean coercion in thisThreadHasOPFS return value

**Code Style**:
- Follows three-phase processing pattern (1.x Input, 2.x Core, 3.x Output)
- Numbered comments inside function bodies only
- Specific error messages with helpful documentation links
- Error messages reference SQLite WASM documentation
- Uses optional chaining (`?.`) for safe property access
- Consistent boolean expression patterns

**Known Issues/Quirks**:
- `validateOpfsEnvironment` parameter `globalObj` is unused (API design choice for future extensibility)
- Returns `null` instead of `undefined` on success (explicit null pattern)
- `thisThreadHasOPFS` returns truthy value that needs boolean coercion

### 4. Dependent imports

**Files importing this module**:
- `src/jswasm/vfs/opfs/installer/index.mjs` (line 64-67)
  - Imports: `validateOpfsEnvironment`, `thisThreadHasOPFS`
  - Used in: OPFS VFS installer initialization

---

## Test Plan

### Test Type
**Unit Tests** (`*.unit.test.ts`) - This module has no external dependencies and pure validation logic

**Rationale**: 
- No database operations → No E2E tests needed
- No async operations → Synchronous unit tests sufficient
- No network calls → No mocking infrastructure required
- No file I/O → Fast, deterministic tests
- Global API mocking → Ideal for unit test isolation

### Test Coverage Goals

**Target Coverage**: 100% (branch, line, function)  
**Critical Paths**: All error conditions and success case  
**Edge Cases**: Partial API availability, missing nested properties

### Test Coverage Strategy

#### validateOpfsEnvironment Tests

1. **Missing SharedArrayBuffer**
   - Mock: `globalThis.SharedArrayBuffer = undefined`
   - Expect: Error containing "Cannot install OPFS: Missing SharedArrayBuffer" and "COOP/COEP"

2. **Missing Atomics**
   - Mock: `globalThis.Atomics = undefined`
   - Expect: Error containing "Atomics" and "COOP/COEP"

3. **Not in WorkerGlobalScope (Main Thread)**
   - Mock: `WorkerGlobalScope` is undefined
   - Expect: Error containing "cannot run in the main thread" and "Atomics.wait()"

4. **Missing FileSystemHandle**
   - Mock: All required except `globalThis.FileSystemHandle = undefined`
   - Expect: Error "Missing required OPFS APIs."

5. **Missing FileSystemDirectoryHandle**
   - Mock: All required except `globalThis.FileSystemDirectoryHandle = undefined`
   - Expect: Error "Missing required OPFS APIs."

6. **Missing FileSystemFileHandle**
   - Mock: All required except `globalThis.FileSystemFileHandle = undefined`
   - Expect: Error "Missing required OPFS APIs."

7. **Missing createSyncAccessHandle**
   - Mock: All required except `FileSystemFileHandle.prototype.createSyncAccessHandle = undefined`
   - Expect: Error "Missing required OPFS APIs."

8. **Missing navigator.storage.getDirectory**
   - Mock: All required except `navigator.storage.getDirectory = undefined`
   - Expect: Error "Missing required OPFS APIs."

9. **Valid Environment**
   - Mock: All required globals present
   - Expect: Returns `null`

#### thisThreadHasOPFS Tests

1. **Missing FileSystemHandle**
   - Mock: `globalThis.FileSystemHandle = undefined`
   - Expect: Returns `false`

2. **Missing FileSystemDirectoryHandle**
   - Mock: `globalThis.FileSystemDirectoryHandle = undefined`
   - Expect: Returns `false`

3. **Missing FileSystemFileHandle**
   - Mock: `globalThis.FileSystemFileHandle = undefined`
   - Expect: Returns `false`

4. **Missing createSyncAccessHandle**
   - Mock: `FileSystemFileHandle.prototype.createSyncAccessHandle = undefined`
   - Expect: Returns `false`

5. **Missing navigator.storage.getDirectory**
   - Mock: `navigator.storage.getDirectory = undefined`
   - Expect: Returns `false`

6. **All OPFS APIs Present**
   - Mock: All OPFS APIs available
   - Expect: Returns `true`

### Test Scaffolding

**Approach**: Use `Object.defineProperty` to set/unset global properties
- More reliable than `vi.stubGlobal` for this use case (observed failures with `vi.stubGlobal`)
- Save original values at test suite scope
- Restore in `afterEach` hooks to prevent test pollution
- Use `writable: true, configurable: true` for proper descriptor management

**Why Object.defineProperty over vi.stubGlobal**:
1. Direct control over property descriptors
2. More predictable behavior with global objects
3. Explicit cleanup guarantees
4. Better TypeScript inference

**Test Structure**:
```typescript
describe("environment-validation", () => {
  describe("validateOpfsEnvironment", () => {
    // Store original globals at suite scope
    const originals = {
      SharedArrayBuffer: globalThis.SharedArrayBuffer,
      Atomics: globalThis.Atomics,
      // ... etc
    };

    afterEach(() => {
      // Restore all originals
    });

    it("should return error when SharedArrayBuffer is missing", () => {
      // 1. Setup - Mock environment
      // 2. Execute - Call function
      // 3. Verify - Assert error message
    });
    // ... more tests
  });
  
  describe("thisThreadHasOPFS", () => {
    // Similar structure
  });
});
```

**Test Organization Principles**:
- Group by function (two describe blocks)
- Follow AAA pattern (Arrange, Act, Assert)
- Use three-phase comments (1. Setup, 2. Execute, 3. Verify)
- Descriptive test names following "should..." convention
- Each test focuses on single failure condition

### Test Data

**Mock Values**:
- `SharedArrayBuffer`: `ArrayBuffer` (valid) or `undefined` (invalid)
- `Atomics`: `{}` (valid) or `undefined` (invalid)
- `WorkerGlobalScope`: `function WorkerGlobalScope() {}` (valid) or `undefined` (invalid)
- `FileSystemHandle`: `function() {}` (valid) or `undefined` (invalid)
- `FileSystemDirectoryHandle`: `function() {}` (valid) or `undefined` (invalid)
- `FileSystemFileHandle`: `{ prototype: { createSyncAccessHandle: vi.fn() } }` (valid) or variations (invalid)
- `navigator.storage.getDirectory`: `vi.fn()` (valid) or `undefined` (invalid)

**Mock Realism**:
- Functions as constructors (e.g., `FileSystemHandle`) match browser behavior
- Prototype chain preserved for method checks
- Navigator object structure mirrors browser API
- Mock functions use `vi.fn()` for potential call verification

**Error Message Validation Strategy**:
- Use `.toContain()` for partial message matching (more resilient to message changes)
- Verify key phrases: "Cannot install OPFS", "COOP/COEP", "main thread", "Atomics.wait()"
- Don't validate entire error message (too brittle)
- Focus on discriminating error types

---

## Pre-Migration Validation

**Before starting migration, verify**:
- [ ] No pending changes to source file
- [ ] Current .mjs file passes existing integration tests
- [ ] Declaration file is accurate and up-to-date
- [ ] All dependent imports identified
- [ ] No active branches modifying this file
- [ ] Build system supports TypeScript compilation

---

## Migration Checklist

```migration-checklist
currentStep: 0
steps:
- [ ] 1. Analyze the originals
- [ ] 2. Add a test harness (Spec & Implementation)
- [ ] 3. Create the migration subdirectory
- [ ] 4. Redirect tests to the new TypeScript source
- [ ] 5. Compile the migration
- [ ] 6. Build, format, and lint
- [ ] 7. Update runtime references
- [ ] 8. Remove now-unused artifacts
- [ ] 9. Final verification
- [ ] 10. Document and hand over
```

---

## Expected Migration Structure

### Before Migration
```
src/jswasm/vfs/opfs/installer/core/
├── environment-validation.mjs             # Original JavaScript (53 lines)
└── environment-validation.d.ts            # Hand-written declarations (20 lines)
```

### During Migration (Steps 2-7)
```
src/jswasm/vfs/opfs/installer/core/
├── environment-validation/
│   ├── environment-validation.ts          # TypeScript source (in progress)
│   └── environment-validation.unit.test.ts # Unit tests (created in step 2)
├── environment-validation.mjs             # Still present, tests validate against this
└── environment-validation.d.ts            # Still present, reference for type migration
```

### After Migration (Step 8+)
```
src/jswasm/vfs/opfs/installer/core/
└── environment-validation/
    ├── environment-validation.ts          # TypeScript source (~65 lines with docs)
    ├── environment-validation.js          # Compiled ESM output
    ├── environment-validation.d.ts        # Generated declarations
    └── environment-validation.unit.test.ts # Unit tests (~300 lines)
```

**File Size Expectations**:
- TypeScript source: ~65 lines (original 53 + enhanced TSDoc)
- Test file: ~300 lines (15 test cases with proper scaffolding)
- Generated .d.ts: Should match original 20 lines closely

---

## TypeScript Migration Notes

### Type Annotations

**validateOpfsEnvironment**:
```typescript
function validateOpfsEnvironment(
  _globalObj: typeof globalThis
): Error | null
```

**thisThreadHasOPFS**:
```typescript
function thisThreadHasOPFS(): boolean
```

### Type Safety Improvements

1. **Explicit return types** instead of relying on inference
2. **Optional chaining** already used correctly (`navigator?.storage?.getDirectory`)
3. **Boolean coercion** explicit with `as boolean` for clarity
4. **Unused parameter** keeps underscore prefix to indicate intentional

### Documentation Requirements

**TSDoc Standard**: Use JSDoc-style comments compatible with TypeScript

**Required Documentation Elements**:
1. **Function-level comments**:
   - `/** ... */` block before each export
   - Purpose: One-line summary + detailed description
   - `@param` for each parameter (including unused ones)
   - `@returns` with type and description
   - `@throws` if applicable (not needed here)
   - `@example` for complex usage (optional)

2. **Special annotations**:
   - Mark unused parameters: `@param _globalObj - ... - parameter currently unused`
   - Note side effects: `@sideEffects none` (if using custom tags)
   - Reference related functions: `@see thisThreadHasOPFS`

3. **Inline documentation**:
   - Three-phase numbered comments (1.x, 2.x, 3.x)
   - Sub-step comments (1.1, 1.2, etc.)
   - No comments outside function bodies (per project rules)

4. **External references**:
   - Link to SQLite WASM docs: `https://sqlite.org/wasm/doc/trunk/persistence.md#coop-coep`
   - Link to MDN for OPFS: `https://developer.mozilla.org/en-US/docs/Web/API/File_System_API`
   - Reference COOP/COEP headers

**Example Template**:
```typescript
/**
 * Validates if current environment supports OPFS.
 *
 * Checks for required browser APIs including SharedArrayBuffer, Atomics,
 * WorkerGlobalScope, and OPFS FileSystem APIs. This function must be called
 * before attempting to initialize the OPFS VFS.
 *
 * @param _globalObj - Global object to check (typically globalThis)
 *                      Parameter currently unused but reserved for future extension
 * @returns Error object with specific message if validation fails, null if all checks pass
 * @see thisThreadHasOPFS For checking only OPFS APIs without worker requirements
 * @see https://sqlite.org/wasm/doc/trunk/persistence.md#coop-coep
 */
export function validateOpfsEnvironment(
  _globalObj: typeof globalThis
): Error | null {
  // Implementation
}
```

---

## Success Criteria

### Phase 1: Test Baseline (Step 2)
- [ ] All 15 unit tests written and documented
- [ ] Tests pass against original .mjs implementation
- [ ] Test coverage report shows 100% coverage
- [ ] No test failures or warnings

### Phase 2: TypeScript Migration (Steps 3-5)
- [ ] TypeScript source created in subdirectory
- [ ] Tests redirected to new .ts implementation
- [ ] All tests still pass (behavioral parity verified)
- [ ] `npm run build:migration` succeeds without errors
- [ ] Generated .d.ts exports match original declaration file

### Phase 3: Quality Assurance (Step 6)
- [ ] `npm run format` passes (no formatting changes needed)
- [ ] `npm run lint` passes with zero errors/warnings
- [ ] TypeScript strict mode compliance (no `any` types)
- [ ] No `@ts-ignore` or `@ts-expect-error` comments in source
- [ ] TSDoc comments validate with documentation linter

### Phase 4: Integration (Steps 7-8)
- [ ] Import path updated in `src/jswasm/vfs/opfs/installer/index.mjs`
- [ ] Import uses extension-less path (e.g., `./core/environment-validation/environment-validation`)
- [ ] All dependent files still compile
- [ ] Original .mjs file deleted
- [ ] Original .d.ts file deleted
- [ ] Migration entry removed from `tsconfig.migration.json`

### Phase 5: Final Verification (Steps 9-10)
- [ ] Full unit test suite passes (`npm run test:unit`)
- [ ] Full e2e test suite passes (`npm run test:e2e`)
- [ ] No console errors or warnings
- [ ] Build artifacts verified (correct .js and .d.ts generated)
- [ ] Git status clean (no unintended changes)
- [ ] Migration documented in handover notes

### Acceptance Criteria
- **Zero test failures** across all test suites
- **Zero linting errors** or TypeScript compilation errors
- **100% behavioral parity** with original implementation
- **Enhanced documentation** with comprehensive TSDoc
- **Clean git diff** showing only intended changes

---

## Risk Assessment

**Risk Level**: LOW

**Rationale**:
- Pure validation logic with no side effects
- No external dependencies or async operations
- Comprehensive test coverage prevents regression
- Simple boolean/error return types
- No database or file system interactions

**Potential Risks**:
1. **Global mocking inconsistencies** → Mitigated by using Object.defineProperty
2. **Type inference issues** → Mitigated by explicit return types
3. **Import path errors** → Mitigated by single dependent file
4. **Test pollution** → Mitigated by proper cleanup in afterEach

**Rollback Plan**:
1. Revert git commit
2. Restore original .mjs and .d.ts from version control
3. Remove migration subdirectory
4. Verify tests pass with original implementation

---

## Related Documentation

- **Migration Guide**: `docs/development/minimal-js-to-ts-migration-spec.md`
- **Project Rules**: `AGENTS.md`, `CLAUDE.md`
- **OPFS Documentation**: `docs/modules/opfs.md`
- **Testing Strategy**: `docs/development/testing.md`
- **Code Style Guide**: `.github/copilot-instructions.md`

---

## Post-Migration Tasks

- [ ] Update this spec with actual migration time and any issues encountered
- [ ] Document any deviations from plan in handover notes
- [ ] Update related documentation if API surface changed
- [ ] Consider migrating dependent modules (e.g., other installer/core modules)
- [ ] Add migration completion to project changelog
