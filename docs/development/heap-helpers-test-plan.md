# heap-helpers Test Plan

## Scope

- Validate baseline behavior of `attachSizeHelpers` and `attachHeapAccessors` prior to TypeScript migration.
- Exercise helper installation side effects and runtime guard rails referenced in `heap-helpers.mjs`.

## Test Strategy

Use Vitest unit tests colocated with the module (`heap-helpers.test.ts`). Each test creates a mock `WhWasmInstallerContext` object exposing:

- `target`: plain object that receives installed helpers.
- `ptrSizeof`: configurable pointer size (default 8 bytes).
- `getHeapViews()`: returns stub heap view collection with typed arrays.
- `toss(message)`: mock that throws to assert error cases.

## Test Cases

1. **Size helpers map primitive IR names**
    - After `attachSizeHelpers`, ensure `sizeofIR("i8" | "i16" | "i32" | "f32" | "float" | "i64" | "f64" | "double")`
      resolve to 1/2/4/8 bytes respectively.
2. **Pointer-aware identifiers**
    - `sizeofIR("*")` and arbitrary identifiers ending with `*` (e.g., `Foo*`) should return `ptrSizeof`.
    - Non-matching identifiers return `undefined`.
3. **Heap accessor pass-through**
    - `heap8`, `heap8u`, `heap16`, `heap16u`, `heap32`, `heap32u` all delegate to the arrays returned by `getHeapViews()`
      and re-fetch on each call (simple object identity comparison).
4. **heapForSize numeric selectors**
    - Passing 8/16/32 with optional `unsigned=false` returns the matching signed/unsigned typed arrays.
5. **heapForSize typed array constructors**
    - Passing constructors (`Int8Array`, `Uint32Array`, etc.) resolves to the matching heap view.
6. **64-bit selection gate**
    - When `HEAP64`/`HEAP64U` exist, `heapForSize(64)` respects the `unsigned` flag.
    - If `bigIntEnabled` is true, `heapForSize(BigInt64Array)` and `heapForSize(BigUint64Array)` return `HEAP64`/`HEAP64U`.
7. **Invalid selector triggers toss**
    - Missing constructor/width combination results in `context.toss` being called (assert via thrown error message).

## Test Data / Fixtures

- Pre-built typed arrays backed by shared `ArrayBuffer` to ensure consistent identity comparisons.
- Pointer size variations (`ptrSizeof = 4` and `ptrSizeof = 8`) to cover pointer return paths.

## Tooling / Setup

- File path: `src/jswasm/utils/whwasm/heap-helpers.test.ts`.
- Command: `pnpm test:unit` (Vitest). Passing output establishes JS baseline.
