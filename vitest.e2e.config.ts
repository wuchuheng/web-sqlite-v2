import { playwright } from "@vitest/browser-playwright";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const srcDir = resolve(rootDir, "src");

/**
 * Unified E2E Test Configuration for SQLite3 WASM
 *
 * This configuration supports:
 * - OPFS E2E tests in src/jswasm/vfs/opfs/
 * - Browser E2E tests in tests/browser/
 * - Required headers for OPFS and SharedArrayBuffer functionality
 */
export default defineConfig({
  test: {
    // Include both OPFS and browser E2E tests
    include: [
      // "src/jswasm/vfs/opfs/*.e2e-test.ts",
      "**/*.e2e.test.ts",
      // "src/**/*.test.ts",
    ],

    // Browser testing configuration
    browser: {
      enabled: true,
      instances: [
        {
          browser: "chromium",
        },
      ],
      provider: playwright(),
      headless: false,
    },

    // Test timeout for E2E tests
    testTimeout: 1000 * 60 * 3,

    // Reporters
    reporters: ["default"],
  },

  // Server configuration for OPFS/SAB support
  server: {
    headers: {
      // Required for SharedArrayBuffer and OPFS functionality
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  },

  // Build configuration for test dependencies
  build: {
    target: "esnext",
    minify: false,
  },

  resolve: {
    alias: {
      "@": srcDir,
      "@wuchuheng/web-sqlite": resolve(srcDir, "main.ts"),
    },
  },

  /* Optimize dependencies */
  optimizeDeps: {
    exclude: ["@wuchuheng/web-sqlite"],
  },

  // Worker configuration for OPFS proxy tests
  worker: {
    format: "es",
  },
});
