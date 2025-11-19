---
title: Yawl Loader Test Plan
module: src/jswasm/utils/whwasm/yawl-loader/yawl-loader.ts
---

# Yawl Loader JS → TS Migration Test Plan

- **Objective**: Prove the `createYawlLoader` factory keeps its behavior during migration by validating loader creation, streaming fallback, target wiring, and callback handling before and after moving to TypeScript.

- **Test cases**
    1. **Factory output**: calling `createYawlLoader` with a stub installer returns a loader whose invocation yields a callable instantiate thunk.
    2. **Streaming vs. fallback**: mock `WebAssembly.instantiateStreaming` and `WebAssembly.instantiate` plus fetch results to assert the loader prefers streaming until `noStreaming` is true or returns true, at which point it uses the fallback path.
    3. **Target instrumentation**: provide a `wasmUtilTarget` with partial fields and verify the finalize step copies `module`/`instance`, attaches `memory` from `imports.env`, and installs `alloc`/`dealloc` when exports expose `malloc`/`free`, eventually calling the installer with the enriched target.
    4. **Onload invocation**: supply an `onload` spy and confirm it receives the instantiate result and the normalized config options after the installer runs.

- **Test data**
    - Deterministic stubs for fetch responses that return a known `ArrayBuffer`.
    - Mock WASM instantiate results exposing `module`, `instance`, `exports.malloc`, and `exports.free`.
    - Spy functions for the installer, allocator wrappers, and onload callback.

- **Scaffolding**
    - Use Vitest mocks for `globalThis.fetch` and `WebAssembly` helpers.
    - Import the implementation from `./yawl-loader` so the same tests first exercise the existing `.mjs` and later the `.ts` build once redirected.
    - Reset spies between tests to avoid cross-test leakage.

Once validated against the `.mjs`, the same tests will run against the new `.ts` output during the migration workflow.
