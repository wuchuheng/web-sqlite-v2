# XWrap Helpers Migration Test Plan

## Scope

- Module: `src/jswasm/utils/whwasm/xwrap-helpers.mjs`
- Goal: lock down current adapter wiring before rewriting the module in TypeScript.

## Test Targets

1. **Converter registration**
    - `cache.xWrap.convertArg` handles numeric, pointer, and string/json inputs (including scoped allocations and string decoding).
    - `cache.xWrap.convertResult` routes through the context's `cstrToJs` and JSON parsing helpers.
2. **Wrapper lifecycle**
    - `target.xWrap` enforces argument counts, pushes/pops scoped allocators, and returns the converted result.
    - `target.xWrap.argAdapter` / `resultAdapter` register adapters without mutating global state outside the cache.
3. **Function pointer adapters**
    - `target.xWrap.FuncPtrAdapter` installs callbacks via `context.installFunctionInternal` and caches the resulting pointer per bind scope.
    - Subsequent invocations reuse existing pointers and accept already-installed numeric pointers.
4. **xCallWrapped convenience path**
    - Accepts either `(name, resultType, argTypes, ...args)` or `(name, resultType, argTypesArray)` signatures and delegates to `xWrap`.

## Scaffolding / Fixtures

- Vitest suite created beside the module (`src/jswasm/utils/whwasm/xwrap-helpers.test.ts`).
- Harness helper `createXWrapHarness` that constructs a `WhWasmInstallerContext` with stubbed `target` and `cache` members.
- Spies for scoped allocators, `cstrToJs`, `installFunctionInternal`, and wasm export lookups to capture behavior.
- Fake wasm exports stored in a `Map` (simulating `target.xGet`).

## Test Data

- Numeric arguments: `i16`, `i32`, pointer `*` conversions.
- Strings: ASCII, JSON payload, and `null` pointer cases.
- Function pointers: callback functions plus preexisting numeric pointers for bypass scenarios.
- Wrapped function example: `wasmAdd` returning integer sum.
