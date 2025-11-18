# installer-context Test Plan

## Objective

- Lock in the current behavior of `WhWasmInstallerContext` while its module is
  migrated from `.mjs` to TypeScript.
- Ensure helper targets keep receiving consistent pointer metadata, memory
  resolution, and heap view caching semantics.

## Test cases

1. **Memory resolution preference**
    - Construct a target exposing both `memory` and `exports.memory`, and verify
      `resolveMemory()` returns the direct `memory` instance and memoizes it.
    - Remove the direct `memory` reference but keep `exports.memory`, ensuring the
      fallback path is used without throwing.

2. **Heap view caching and refresh**
    - Call `getHeapViews()` twice on an untouched memory object and assert the
      second call reuses the cached typed arrays (same object references).
    - Grow the memory and confirm the cache detects the new `heapSize`, replacing
      each typed array with views into the expanded buffer.
    - Toggle `bigIntEnabled` on the target and grow the memory to ensure bigint
      heap views are defined only after a cache refresh and removed again after
      the flag is cleared and the heap grows.

3. **Pointer metadata validation**
    - Default constructor behavior should set `ptrIR` to `"i32"` and `ptrSizeof`
      to `4`.
    - Passing `pointerIR: "i64"` yields `ptrSizeof === 8`.
    - Supplying an unsupported `pointerIR` causes `toss()` to be invoked (throws
      with the provided fragments).

4. **`toss()` consistency**
    - Calling `toss("bad", "input")` should throw an `Error` whose message joins
      arguments with spaces (`"bad input"`). This covers expectations from other
      helper modules that rely on readable error text.

## Test data

- `WebAssembly.Memory` instances with two pages total so the `.grow()` based
  refresh path can be exercised.
- Dummy targets with optional `pointerIR`, `bigIntEnabled`, `exports.memory`,
  and `memory` properties. No actual WASM instance is required since the tests
  only interact with the memory buffer.

## Scaffolding

- Helper `createTarget(overrides)` returns a minimal
  `WhWasmHelperTarget`-shaped object containing:
    - `memory`: `new WebAssembly.Memory({ initial: 2 })`.
    - `exports`: `{ memory }` to cover the fallback path.
    - Spreads any overrides on top.
- Helper `newContext(overrides)` constructs
  `WhWasmInstallerContext(createTarget(overrides))` to keep each test focused on
  a single behavior.

Once approved, the Vitest suite (`npm run test:unit`) will live next to
`src/jswasm/utils/whwasm/installer-context/installer-context.ts` and use the
helpers above to exercise the implementation before redirecting to the new
TypeScript source.
