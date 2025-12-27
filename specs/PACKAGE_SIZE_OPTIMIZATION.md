# Specification: Bundle Size Optimization

## Overview

This document outlines the strategy for reducing the final bundle size of the `web-sqlite-js` library. The primary focus is on optimizing the vendored SQLite module (`sqlite3.mjs`), minimizing internal assets, and ensuring dead-code elimination.

## Problem Statement

The current bundle includes a significant amount of unnecessary code from the vendored `sqlite3.mjs` file, which contains logic for environments other than the browser (Node.js, Shell). Additionally, some internal assets like the OPFS proxy script are imported as raw strings without minification, and the WASM inlining process could be more efficient.

## Optimization Targets

### 1. Environment-Specific Dead Code Elimination

`sqlite3.mjs` (Emscripten glue code) includes checks for various environments:

- `ENVIRONMENT_IS_NODE`
- `ENVIRONMENT_IS_SHELL`
- `ENVIRONMENT_IS_WEB`
- `ENVIRONMENT_IS_WORKER`

**Action:**

- Use Vite's `define` or a custom transform plugin to hardcode `ENVIRONMENT_IS_NODE` and `ENVIRONMENT_IS_SHELL` to `false`.
- Hardcode `ENVIRONMENT_IS_WEB` and `ENVIRONMENT_IS_WORKER` based on the target environment (browser worker).
- This allows Terser to remove entire blocks of code related to Node.js and Shell during the minification phase.

### 2. Minification of Internal Assets

The `sqlite3-opfs-async-proxy.js` (~20KB) is currently imported as a raw string. Vite does not minify strings imported via `?raw`.

**Action:**
Use the project's existing `prebuild` infrastructure to create a minified asset:

1.  **Create a Minification Script**: Add a small utility (e.g., `scripts/bundle-proxy-asset.ts`) that uses `esbuild` (already a dependency) to minify `sqlite3-opfs-async-proxy.js` and write it as an exported string to a new file: `src/jswasm/opfs-proxy-asset.ts`.
2.  **Update `package.json`**: Add the execution of this script to the `prebuild` command.
3.  **Modify `src/jswasm/sqlite3.mjs`**:
    - Remove: `import opfsProxyContent from "./sqlite3-opfs-async-proxy.js?raw";`
    - Add: `import { opfsProxyContent } from "./opfs-proxy-asset.js";`

**Benefits:**

- **Significant Size Reduction**: The proxy script will be minified (comments removed, variables mangled) before being embedded.
- **Reliability**: No dependency on Vite's internal string handling or complex plugin logic.
- **Consistency**: Matches the `wasm-asset.js` pattern exactly.
- **Type Safety**: By generating a `.ts` or `.js` file with an export, we avoid TypeScript warnings about missing `?raw` modules.

### 3. SQLite Module Optimization

The `sqlite3.mjs` file contains many optional features and internal Emscripten utilities that might not be used.

**Action:**

- Implement a `sqliteOptimizePlugin` in `vite.config.ts` to perform regex-based stripping of known unnecessary sections in `sqlite3.mjs`.
- Example: Strip out large error message strings or optional FS implementations (like `FS_createPreloadedFile` if not used).

### 4. Build Configuration Refinement

**Action:**

- Enable aggressive Terser optimizations in `vite.config.ts`.
- Set `compress.passes` to 3 or more.
- Ensure `mangle` is fully enabled for the worker code.

### 5. Single Bundle Integrity

**Action:**

- Ensure all parts (WASM, Proxy, Glue code) are correctly bundled into a single `index.js`.
- Verify that no external files are required at runtime, keeping the library truly portable.

## Implementation Steps

1.  **Modify `vite.config.ts`**:
    - Enhance `sqliteOptimizePlugin` to handle environment stripping.
    - Add a transformation for `sqlite3-opfs-async-proxy.js` to minify it.
2.  **Verify Results**:
    - Compare `dist/index.js` size before and after changes.
    - Run E2E tests to ensure SQLite functionality remains intact.
3.  **Documentation**:
    - Update the build instructions if any new pre-build steps are added.

## Success Metrics

- Reduction in `dist/index.js` file size (target: >20% reduction).
- No regression in database performance or OPFS persistence.
