# SQLite OPFS Async Proxy Migration Test Plan

## 1. Overview

This document outlines the strategy for testing the `sqlite3-opfs-async-proxy.ts` conversion. Since the proxy operates as a dedicated Web Worker communicating via `SharedArrayBuffer` and interacting with the Origin Private File System (OPFS), validation requires a real browser environment.

We will use **Vitest Browser Mode**. This approach allows us to:

1.  Use **Vitest** as the test framework (assertions, structure).
2.  Use **Playwright** (under the hood) to provide the Chrome environment with OPFS support.
3.  Run tests directly in the browser while maintaining a standard development workflow.

## 2. Test Strategy

### 2.1 Architecture: Vitest + Playwright

The testing stack consists of:

1.  **Test Framework (Vitest):**
    - Configured with `@vitest/browser`.
    - Orchestrates the test execution.
    - Compiles tests using Vite.

2.  **Browser Provider (Playwright):**
    - Managed by Vitest.
    - Launches a real Chrome instance (`headless: false` for visibility).
    - Provides the necessary security headers (COOP/COEP) via the test server.

3.  **System Under Test (SUT):**
    - The `sqlite3-opfs-async-proxy.ts` worker.
    - Spawned by the test code running inside the browser.

### 2.2 Test Execution Flow

1.  **Start:** Developer runs `pnpm run test:browser`.
2.  **Launch:** Vitest launches Chrome using Playwright.
3.  **Execution:** Tests in `src/jswasm/vfs/opfs/**/*.test.ts` run inside the browser page.
4.  **Interaction:** The test code spawns the OPFS Proxy Worker and communicates via `postMessage` / `SharedArrayBuffer`.
5.  **Reporting:** Results are reported back to the terminal via Vitest.

### 2.3 Test Cases

The following scenarios will be covered to ensure parity with the original JavaScript implementation:

#### A. Initialization & Lifecycle

- **TC-01: Worker Initialization:** Verify the worker starts, accepts initialization parameters, and enters the wait loop (`opfs-async-inited` message).
- **TC-02: Invalid Environment:** Verify behavior when `SharedArrayBuffer` is missing (if feasible).

#### B. File System Operations (The "x" Methods)

- **TC-03: `xAccess` (File Existence):** Check for non-existent file; create file and check existence.
- **TC-04: `xOpen` & `xClose`:** Open with `SQLITE_OPEN_CREATE`; close and verify resource release.
- **TC-05: `xWrite` & `xRead`:** Write known bytes; read back and verify identity; test partial ops.
- **TC-06: `xFileSize` & `xTruncate`:** Check size; write/truncate and verify size updates.
- **TC-07: `xLock` & `xUnlock`:** Acquire and release locks.
- **TC-08: `xDelete`:** Delete file and verify `xAccess` returns not found.

#### C. Protocol & Error Handling

- **TC-09: Serialization:** Verify complex argument serialization.
- **TC-10: Error Propagation:** Trigger OPFS errors and verify SQLite error codes.

## 3. Implementation Plan

### 3.1 Setup

1.  **Install Dependencies:**

    ```bash
    pnpm install -D @vitest/browser playwright
    ```

2.  **Configure Vitest:** Update `vitest.config.ts` to include a browser configuration that reuses the existing setup but adds the browser provider.

    ```typescript
    import { defineConfig } from "vitest/config";

    export default defineConfig({
        test: {
            // Keep existing include pattern for unit tests
            include: ["src/**/*.test.ts", "tests/browser/**/*.test.ts"],

            // Default to node for standard unit tests, but allow browser mode override
            environment: "node",
            globals: false,
            pool: "threads",
            reporters: ["default"],

            // Browser mode configuration
            browser: {
                enabled: true, // Can be toggled via CLI flag --browser
                name: "chromium",
                provider: "playwright",
                headless: false,
                // Ensure COOP/COEP headers are set for SharedArrayBuffer
            },
        },
    });
    ```

### 3.2 Helper Class: `OpfsProxyClient`

A helper class to abstract the raw `postMessage`/`Atomics` communication for testing.

```typescript
export class OpfsProxyClient {
    private worker: Worker;
    private sabIO: SharedArrayBuffer;
    private sabOP: Int32Array;

    constructor(workerPath: string) {
        this.worker = new Worker(workerPath);
        // ... setup SABs ...
    }

    async init() {
        // ... handshake logic ...
    }

    async send(op: string, args: any[]) {
        // ... serialization, notify, wait, deserialization ...
    }
}
```

### 3.3 Proposed Test File: `src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { OpfsProxyClient } from "../../../../../tests/src/utils/opfs-proxy-client";

describe("OPFS Async Proxy", () => {
    let client: OpfsProxyClient;

    beforeAll(async () => {
        client = new OpfsProxyClient(
            new URL("./sqlite3-opfs-async-proxy.js", import.meta.url).href,
        );
        await client.init();
    });

    test("should open and close a file", async () => {
        const filename = "/test-file-" + Date.now();
        const fid = await client.send("xOpen", [filename, 0x00000040]); // CREATE
        expect(fid).toBeGreaterThan(0);

        const closeResult = await client.send("xClose", [fid]);
        expect(closeResult).toBe(0);
    });

    test("should write and read data", async () => {
        // ... implementation ...
    });
});
```

## 4. Verification of Success

1.  `pnpm run test:browser` launches a visible Chrome window.
2.  All tests in `opfs-proxy.test.ts` pass.
3.  The proxy is proven to work with actual OPFS in a real browser environment.
