# Migration Plan: From Custom Test Runner to Vitest + Playwright

## Overview

This document outlines the migration plan for the `@wuchuheng/web-sqlite-tests` package. The goal is to replace the current custom web-based test runner (Vite + UI Controller + Worker) with a standardized, automated testing infrastructure using **Vitest Browser Mode** (powered by **Playwright**).

This migration will enable:

1.  **Automated Execution**: Tests run via CLI (`pnpm run test:e2e`) without manual browser interaction.
2.  **Standard Assertions**: Use Vitest's `expect` API instead of custom helpers.
3.  **CI Integration**: Easy integration with CI/CD pipelines.
4.  **Unified Tooling**: Consistent testing experience across unit and E2E tests.

---

## Current Architecture Analysis

The current test suite (`tests/`) is structured as a standalone Vite application:

- **Entry Point**: `tests/src/main.ts` (UI Controller)
- **Execution**: `tests/src/worker.ts` (Web Worker) runs the tests to avoid blocking the main thread.
- **Runner Core**: `tests/src/core/test-runner.ts` manages suites and execution.
- **Suites**: `tests/src/suites/*.suite.ts` contain the actual test logic.
- **Utils**: `tests/src/utils/test-utils.ts` provides assertion and DB helpers.
- **Package**: Depends on the parent workspace `@wuchuheng/web-sqlite`.

**Key Limitations:**

- Requires manual visual verification (checking "green" status in browser).
- No CLI exit code for CI.
- Custom assertion logic (`TestUtils.assertEqual`).

---

## Migration Strategy

We will migrate the existing test suites into a new directory structure within the main repository (or keep them in `tests/` but refactored), utilizing Vitest's browser mode.

### 1. Directory Structure

We will create a new directory `tests/e2e` (or repurposed `tests/browser`) to house the migrated tests.

```
tests/
├── browser/                 <-- New Vitest-based E2E tests
│   ├── setup/
│   │   └── vitest.setup.ts  <-- Global setup (mocks, etc.)
│   ├── utils/
│   │   └── test-utils.ts    <-- Adapted helpers
│   ├── crud-operations.test.ts
│   ├── transactions.test.ts
│   └── ... (other suites)
├── src/                     <-- Legacy runner (to be deprecated/removed)
├── vitest.config.ts         <-- New config for browser tests
└── package.json
```

### 2. Configuration Changes

**File:** `tests/vitest.config.ts` (New)

We need a specific Vitest configuration for the `tests` package that enables the browser environment with necessary headers for OPFS/SharedArrayBuffer.

```typescript
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
    test: {
        browser: {
            enabled: true,
            name: "chromium", // Chrome supports OPFS best
            provider: playwright(),
            headless: true, // Run headless for CI/CLI
        },
        // Vital for OPFS/SAB support
        server: {
            headers: {
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Embedder-Policy": "require-corp",
            },
        },
    },
});
```

### 3. Test Suite Migration Pattern

Each suite in `tests/src/suites/*.suite.ts` will be converted to a `*.test.ts` file.

**Transformation Rules:**

1.  **Structure**: `export const mySuite = [...]` -> `describe('Suite Name', () => { ... })`
2.  **Test Case**: `{ name: '...', fn: async (sqlite3) => { ... } }` -> `test('...', async () => { ... })`
3.  **Initialization**: instead of passing `sqlite3` into every function, use `beforeAll` to initialize the library once per suite (or globally).
4.  **Assertions**: `TestUtils.assertEqual(a, b)` -> `expect(a).toBe(b)`.

**Example: CRUD Operations**

_Legacy (`tests/src/suites/crud-operations.suite.ts`):_

```typescript
export const crudOperationsTests: TestCase[] = [
    {
        name: "INSERT single row",
        fn: async (sqlite3) => {
            const db = TestUtils.createTestDb(sqlite3, "crud.db");
            // ...
            TestUtils.assertEqual(result.length, 1, "Should have one row");
        },
    },
];
```

_Migrated (`tests/browser/crud-operations.test.ts`):_

```typescript
import { describe, test, expect, beforeAll } from "vitest";
import sqlite3InitModule from "@wuchuheng/web-sqlite";
import type { SQLite3API } from "@wuchuheng/web-sqlite";

describe("CRUD Operations", () => {
    let sqlite3: SQLite3API;

    beforeAll(async () => {
        sqlite3 = await sqlite3InitModule();
    });

    test("INSERT single row", async () => {
        const db = new sqlite3.oo1.DB("file:crud.db?vfs=opfs");
        try {
            db.exec("CREATE TABLE t (a)");
            db.exec("INSERT INTO t VALUES (1)");
            const rows = db.exec("SELECT * FROM t", {
                returnValue: "resultRows",
            });
            expect(rows.length).toBe(1);
        } finally {
            db.close();
        }
    });
});
```

### 4. Dependency Updates

Update `package.json` in the root or `tests` workspace to include:

- `vitest`
- `@vitest/browser`
- `@vitest/browser-playwright`
- `playwright`

(Note: These are already in the root `package.json`, so we just need to ensure the `tests` package can access them or has them in its own `devDependencies`).

### 5. Step-by-Step Execution Plan

1.  **Setup**: Create `tests/vitest.config.ts` and ensuring dependencies are linked.
2.  **Pilot**: Migrate one simple suite (e.g., `version-info.suite.ts` or `environment.suite.ts`) to `tests/browser/`.
3.  **Verify**: Run `vitest --config tests/vitest.config.ts` to confirm the pilot passes in headless browser mode.
4.  **Bulk Migration**: Systematically migrate remaining suites.
    - _Phase A_: Core DB features (Lifecycle, Schema, CRUD).
    - _Phase B_: Advanced features (Transactions, Constraints, Prepared Statements).
    - _Phase C_: Edge cases (Error handling, Types).
5.  **Cleanup**: Remove the legacy `src/` runner code (`main.ts`, `worker.ts`, `core/`, `suites/`) once all tests are migrated.
6.  **CI Update**: Update `pnpm run test` to point to the new Vitest command.
7.  **UI Command**: Add `pnpm run test:ui` to `package.json` to run tests with the Vitest UI (`vitest --ui --config tests/vitest.config.ts`).

## Verification Strategy

- **Headless Run**: `pnpm run test` should execute all tests in a headless Chromium instance and exit with code 0.
- **UI Mode**: `pnpm run test:ui` should open Vitest UI for interactive debugging (replacing the old custom UI).
- **OPFS Verification**: Ensure tests that write to OPFS actually persist/cleanup correctly (using the existing cleanup logic adapted for `afterAll`).

## Next Steps

Awaiting user approval to proceed with **Step 1 (Setup)** and **Step 2 (Pilot)**.
