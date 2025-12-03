# Test Refactoring Specification

## Current Test Structure Analysis

### 1. Current Test Types and Configurations

**Unit Tests (src/ directory)**

- Location: `src/**/*.test.ts` (excluding OPFS files)
- Configuration: `vitest.config.ts` (root level)
- Current suffix: `.test.ts`
- Test framework: Vitest with browser support
- Count: 13 files

**OPFS E2E Tests (src/ directory)**

- Location: `src/jswasm/vfs/opfs/*.test.ts`
- Files:
    - `sqlite3-opfs-async-proxy.test.ts`
    - `opfs-proxy-client.test.ts`
- Configuration: Currently uses root `vitest.config.ts`
- Current suffix: `.test.ts`
- Test framework: Vitest with browser support

**Feature E2E Tests (tests/ directory)**

- Location: `tests/browser/*.test.ts`
- Configuration: `tests/vitest.config.ts`
- Current suffix: `.test.ts`
- Test framework: Vitest + Playwright
- Count: 15 files

**Legacy Tests (tests/ directory)**

- Location: `tests/src/` (custom test runner)
- Configuration: `tests/vite.config.ts` + custom runner
- Framework: Custom implementation with Web Workers
- Status: Deprecated, needs removal

### 2. Current Configuration Files

**Root vitest.config.ts**

```typescript
- include: ["src/**/*.test.ts"]
- browser: enabled with playwright provider
- globals: false
```

**tests/vitest.config.ts**

```typescript
- include: ["browser/**/*.test.ts"]
- browser: enabled with playwright provider
- server: headers for OPFS/SAB support
```

**tests/vite.config.ts (Legacy)**

```typescript
- Custom server configuration
- Headers for OPFS/SAB support
- Build configuration for legacy runner
```

## Proposed Refactoring Plan

### Phase 1: File Suffix Standardization

**Unit Tests**

- Rename all `src/**/*.test.ts` files (excluding OPFS) to `*.unit.test.ts`
- Files to rename:
    - `src/jswasm/utils/sqlite3-init-wrapper/sqlite3-init-wrapper.test.ts` → `*.unit.test.ts`
    - `src/jswasm/utils/whwasm/utils/utils.test.ts` → `*.unit.test.ts`
    - And 11 other similar files in src/

**E2E Tests**

- Rename OPFS tests and browser tests to `*.e2e.test.ts`
- Files to rename:
    - `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy.test.ts` → `*.e2e.test.ts`
    - `src/jswasm/vfs/opfs/opfs-proxy-client.test.ts` → `*.e2e.test.ts`
    - `tests/browser/*.test.ts` → `*.e2e.test.ts` (15 files)

### Phase 2: Configuration Unification

**Unified E2E Configuration (`vitest.e2e.config.ts`)**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: [
            "src/jswasm/vfs/opfs/*.e2e.test.ts",
            "tests/browser/*.e2e.test.ts",
        ],
        browser: {
            enabled: true,
            provider: "playwright",
            name: "chromium",
            headless: false,
        },
    },
    server: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
});
```

**Updated Unit Test Configuration (`vitest.config.ts`)**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["src/**/*.unit.test.ts"],
        globals: false,
        reporters: ["default"],
    },
});
```

### Phase 3: Legacy Code Removal

**Files to Remove:**

- `tests/src/` - entire directory with legacy test runner
- `tests/vite.config.ts` - legacy configuration
- `tests/dist/` - build artifacts
- Remove `test:legacy` script from package.json

**Files to Keep:**

- `tests/browser/` - will be renamed to `*.e2e.test.ts`
- `tests/vitest.config.ts` - will be replaced with unified config
- `tests/node_modules/` - dependencies for current tests

### Phase 4: Package.json Script Updates

**Current Scripts:**

```json
{
    "test": "vitest run --config tests/vitest.config.ts",
    "test:ui": "vitest --ui --config tests/vitest.config.ts",
    "test:legacy": "pnpm --filter @wuchuheng/web-sqlite-tests exec vite --port 50001 --host 0.0.0.0",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest"
}
```

**Updated Scripts:**

```json
{
    "test": "vitest run",
    "test:ui": "vitest --ui",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "test:e2e:ui": "vitest --ui --config vitest.e2e.config.ts"
}
```

## Implementation Steps

### Step 1: Rename Files

1. Rename all unit test files in `src/` from `.test.ts` to `.unit.test.ts`
2. Rename OPFS test files from `.test.ts` to `.e2e.test.ts`
3. Rename browser test files from `.test.ts` to `.e2e.test.ts`

### Step 2: Update Configurations

1. Create `vitest.e2e.config.ts` for unified E2E testing
2. Update root `vitest.config.ts` for unit tests only
3. Remove `tests/vitest.config.ts`

### Step 3: Update Package.json

1. Remove legacy test scripts
2. Add new unified test scripts
3. Update existing script commands

### Step 4: Remove Legacy Code

1. Remove `tests/src/` directory
2. Remove `tests/vite.config.ts`
3. Clean up `tests/` directory to only contain browser E2E tests

### Step 5: Verification

1. Run unit tests: `npm run test:unit`
2. Run E2E tests: `npm run test:e2e`
3. Verify all tests pass with new configuration

## Expected Benefits

1. **Clear Test Organization**: Unit tests and E2E tests are clearly separated by suffix
2. **Simplified Configuration**: Only 2 config files instead of 3+ configurations
3. **Removed Legacy Code**: Eliminates deprecated test runner and associated code
4. **Consistent Naming**: Standardized file suffixes across the project
5. **Better Test Management**: Easier to run specific test types

## Risk Assessment

**Low Risk:**

- File renaming (git will track changes)
- Configuration updates (can be reverted)
- Script updates (can be rolled back)

**Medium Risk:**

- Legacy code removal (should be backed up)
- Test execution changes (needs verification)

**Mitigation:**

- Create backup branch before implementation
- Test each phase separately
- Verify all tests pass after each change

## Timeline Estimate

**Phase 1 (File Renaming):** 1-2 hours
**Phase 2 (Configuration):** 1 hour  
**Phase 3 (Legacy Removal):** 30 minutes
**Phase 4 (Verification):** 1-2 hours
**Total:** 3.5-5.5 hours

## Success Criteria

1. All unit tests pass with new `.unit.test.ts` suffix
2. All E2E tests pass with new `.e2e.test.ts` suffix
3. Legacy test runner is completely removed
4. Only 2 test configurations exist (unit and E2E)
5. Package.json scripts are simplified and functional
6. No deprecated code remains in the test directory
