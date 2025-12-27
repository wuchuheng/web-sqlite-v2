# Package Size Optimization Plan (Vite-Native)

## Overview

Reduce bundle size from ~1.3MB to ~700KB while maintaining a single-file distribution and using explicit Vite configurations.

## 1. WASM Binary Optimization

We use a `prebuild` step to handle binary compression. This is necessary because binary manipulation is more efficient in the shell.

**Commands:**

- `wasm-opt -Oz`: Shrinks the WASM instructions.
- `gzip -9`: Compresses the binary (WASM is highly compressible).
- `base64`: Inlines the compressed binary as a string asset.

## 2. Explicit Code Stripping (Vite Plugin)

Instead of modifying source files, we use a **Vite Transform Plugin** in `vite.config.ts`.

**Action:**
During build, the plugin explicitly replaces:

- `ENVIRONMENT_IS_NODE` -> `false`
- `ENVIRONMENT_IS_SHELL` -> `false`

**Result:**
Because these are now constants, Vite's minifier (Terser/Esbuild) will perform **Tree-Shaking**, automatically deleting all the unreachable Node.js-specific logic from the final `dist/index.js`.

## 3. Runtime Decompression Loader

In `src/jswasm/sqlite3.mjs`, we use the browser's native `DecompressionStream` to inflate the Gzipped WASM.

```javascript
import { wasmBase64 } from "./wasm-asset.js";

async function getDecompressedWasm(base64) {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const stream = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).arrayBuffer();
}
```

## CDN & CORS Compatibility

Inlining the WASM binary as a Base64 string provides a major compatibility benefit for CDN users:

- **Zero Secondary Requests**: Since the WASM is part of the JS bundle, the browser does not need to perform a separate `fetch()` for the `.wasm` file. This eliminates potential CORS errors and "Missing MIME type" issues that frequently occur when loading WASM from a different origin.
- **Easier Integration**: Users only need to manage a single file path, making it much harder to break the library's internal resource resolution logic.

_Note: The requirement for COOP/COEP headers on the hosting server remains mandatory due to the use of SharedArrayBuffer._

## Implementation Checklist

1. [x] Install `binaryen` (`npm install --save-dev binaryen`).

2. [x] Add `prebuild` script to `package.json` (WASM compression only).

3. [x] Configure `sqliteOptimizePlugin` in `vite.config.ts` for explicit tree-shaking.

4. [x] Update `sqlite3.mjs` loader to handle decompression.

5. [x] Build and verify size.
