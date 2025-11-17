# wasm-loader Test Plan

## Objective

Verify that `createWasmLoader` orchestrates WebAssembly instantiation the way the legacy `.mjs` loader did: prefer the `Module.instantiateWasm` hook, fall back to streaming or array-buffer instantiation, and forward lifecycle hooks (`addRunDependency`, `removeRunDependency`, `setWasmExports`, `readyPromiseReject`, etc.).

## Test cases

1. **Module-level instantiation hook**
    - Provide a stubbed `Module.instantiateWasm` that returns a fake exports object.
    - Confirm `createWasm()` invokes the hook with the imports returned by `getWasmImports`, forwards the resulting exports to `setWasmExports`, and removes the `wasm-instantiate` run dependency.

2. **Async instantiation flow**
    - Omit `Module.instantiateWasm`, mock `readAsync` to resolve to an `ArrayBuffer`, and mock `WebAssembly.instantiate` to resolve a fake instance.
    - Assert that `WebAssembly.instantiate` receives the binary returned by `readAsync` and that `createWasm()` eventually resolves to the created exports.

3. **Streaming fallback behavior**
    - Mock `fetch` and `WebAssembly.instantiateStreaming` to reject, then verify `err` logs the fallback message and `instantiateArrayBuffer` is used instead.
    - Ensure `readyPromiseReject` is called if the asynchronous instantiation fails entirely.

4. **Locate file usage**
    - Provide `Module.locateFile` and `locateFile` implementations that record the requested path to make sure `findWasmBinary` prefers the hook instead of naively using `import.meta.url`.

## Test data and scaffolding

- Use a small `Uint8Array` (`Uint8Array.of(0x01)`) for the fake binary payload.
- Provide spies/stubs for lifecycle functions (`addRunDependency`, `removeRunDependency`, `addOnInit`, `setWasmExports`, `readyPromiseReject`, `err`, `abort`) so each test can assert whether they were called.
- Reuse helper factories to assemble `WasmLoaderConfig` objects with the desired permutations of hooks (with/without `Module.instantiateWasm`, streaming support, etc.).
- Place the tests in `src/jswasm/utils/wasm-loader/wasm-loader.test.ts` after the migration so they run against the TypeScript module.
