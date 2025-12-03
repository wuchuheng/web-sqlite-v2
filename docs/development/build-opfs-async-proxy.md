# Spec: Packaging Async Proxy with Vite

## Goal
Package `src/jswasm/vfs/opfs/async-proxy/index.ts` to `src/jswasm/vfs/opfs/async-proxy/index.js` using Vite via a new command `npm run build:opfs:async-proxy`.

## Motivation
The user wants to compile a specific TypeScript file (`src/jswasm/vfs/opfs/async-proxy/index.ts`) into a JavaScript file (`src/jswasm/vfs/opfs/async-proxy/index.js`) in the same directory. This is likely for a Web Worker or a specific runtime environment where a standalone JS file is needed alongside the source.

## Implementation Plan

### 1. Create a new Vite configuration file
Create `vite.config.opfs-async-proxy.ts` to handle this specific build.
This ensures we don't interfere with the main `vite.config.ts` which packages the library to `dist/`.

**Configuration Details:**
- **Input:** `src/jswasm/vfs/opfs/async-proxy/index.ts`
- **Output Directory:** `src/jswasm/vfs/opfs/async-proxy` (Same directory as source)
- **Output Filename:** `index.js`
- **Format:** IIFE or ES (depending on usage, assuming ES/Module given the path, but Worker often needs iife/es. Will default to `es` or `iife` if requested, but `es` is standard for modern "module" workers. Given it's likely a worker, we will use `es` unless otherwise specified, but `iife` is safer for broad compatibility if it's not a module worker. Let's stick to `es` format as it's a "package" request, likely for internal consumption). *Correction*: The user said "package", implying a build artifact.
- **EmptyOutDir:** `false` (Critical: we don't want to delete the source file `index.ts` in the same directory).

### 2. Update `package.json`
Add the new script:
```json
"scripts": {
  "build:opfs:async-proxy": "vite build -c vite.config.opfs-async-proxy.ts"
}
```

### 3. File Structure Changes
- New file: `vite.config.opfs-async-proxy.ts`
- Modified file: `package.json`

## Verification
1. Run `npm run build:opfs:async-proxy`.
2. Check if `src/jswasm/vfs/opfs/async-proxy/index.js` exists.
3. Verify the content of `index.js`.
