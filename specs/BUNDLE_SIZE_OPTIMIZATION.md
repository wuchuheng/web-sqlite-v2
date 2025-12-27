# Bundle Size Optimization Plan

## Current Status

- **Bundle Size:** ~1.5MB (uncompressed `dist/index.js`).
- **Composition:**
    - `sqlite3.wasm`: ~832KB.
    - `sqlite3.mjs` (Glue code) + Library logic: ~640KB.

## Objective

Reduce the single-file bundle size to under **1.4MB** using a surgical approach that targets both the binary and the JS glue code.

## Proposed Strategies

### 1. WASM Binary Pruning (Priority)

Since the `.wasm` file is the largest component, we will use specialized tools to prune it.

- **Action:** Use `wasm-opt -Oz` (part of Binaryen) to perform binary-level size optimization.
- **Expected Gain:** 50KB - 100KB.

### 2. Multi-Pass Terser Minification

Switching from `esbuild` to `terser` for more aggressive compression of the complex Emscripten-generated glue code.

- **Action:** Enable `terser` with `passes: 3` and `toplevel: true`.
- **Expected Gain:** 20KB - 40KB.

### 3. Surgical Tree Shaking & Constant Injection

Hardcoding environment constants to allow the minifier to strip dead branches from `sqlite3.mjs`.

- **Action:** Use Vite's `define` to set `ENVIRONMENT_IS_NODE: false`, `ENVIRONMENT_IS_SHELL: false`, etc.
- **Expected Gain:** 10KB - 20KB.

### 4. Runtime WASM Decompression (High Impact)

The largest part of the bundle is the Base64-encoded WASM. By compressing the WASM with Gzip before inlining and decompressing it at runtime using the `DecompressionStream` API, we can bypass the "Base64 Tax".

- **Action:**
    1. Compress `sqlite3.wasm` to `sqlite3.wasm.gz` during the build process.

    2. Modify `sqlite-ops.ts` to provide a custom `instantiateWasm` loader that decompresses the data at runtime.

- **Expected Gain:** ~500KB - 600KB.

- **Final Target Size:** ~800KB.

## Implementation Steps

1. **Prepare Compressed Asset:** Create a script to generate `src/jswasm/sqlite3.wasm.gz`.

2. **Update Loader:** Refactor `src/core/sqlite-ops.ts` to implement the decompression logic.

3. **Configure Vite:** Ensure `.gz` files are handled correctly and inlined.

4. **Build & Verify:** Run `npm run build` and compare the new size with the 1.32MB baseline.

5. **Test:** Run `npm run test:e2e` to ensure the decompression works correctly in the browser.
