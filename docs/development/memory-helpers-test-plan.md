# Memory Helpers JS → TS Migration Test Plan

## Scope

Validate the behavior of `attachMemoryAccessors` (`src/jswasm/utils/whwasm/memory-helpers.mjs`) before migrating the
module to TypeScript. The Vitest harness must run against the existing `.mjs` implementation first, then against the new
`.ts` source once created.

## Test Cases

1. **Scalar peek/poke round trips**
    - Write to the underlying heaps via the exposed helpers (`poke8`, `poke16`, `poke32`, `poke32f`, `poke64f`) and confirm
      that the corresponding `peek*` method returns the written value.
    - Covers signed integer handling (`i8`, `i16`, `i32`) and floating point views (`f32`, `f64`).
2. **Pointer-sized helpers**
    - Set `ptrIR` to `"i32"` in the mock context.
    - Use `pokePtr`/`peekPtr` to populate a pointer location and ensure values flow through `ptrIR`.
    - Verify the `"*"` suffix resolution by calling `poke`/`peek` with the `"ptr*"` pseudo-type and checking that it
      delegates to the pointer IR.
3. **64-bit integer handling**
    - Enable `target.bigIntEnabled` and set up a `HEAP64` view.
    - Write with `poke64` using a `bigint` literal, then ensure `peek64` yields the same `bigint`.
    - Confirm that the helper stores `BigInt` values in the heap.
4. **Multi-pointer requests**
    - Pass an array of pointers into `peek`/`poke` (and `peek32`, etc.) and ensure the helpers operate across the array,
      returning an array of values.
5. **Alias helpers**
    - Confirm `getMemValue`/`setMemValue` and `getPtrValue`/`setPtrValue` reference the underlying `peek`/`poke` methods
      (e.g., mutate via an alias and read back through the canonical helper).
6. **Pointer guards**
    - Exercise `isPtr32`/`isPtr` with valid (non-negative 32-bit ints) and invalid inputs (negative values, non-integers,
      non-numeric) to ensure they correctly report pointer status.

## Test Data

- Allocate a single `ArrayBuffer` and derive the typed heap views (`Int8Array`, `Int16Array`, `Int32Array`, `BigInt64Array`,
  `Float32Array`, `Float64Array`).
- Use deterministic constants: `0x01`, `0x7fff`, `0x7fffffff`, `123.5`, `9876.5`, and pointer offsets spaced four bytes
  apart to avoid overlap.
- For multi-pointer cases, populate two adjacent addresses and assert both values return in-order.

## Scaffolding & Utilities

- Implement a `createMockContext()` helper inside the test to fabricate the minimal
  `WhWasmInstallerContext` surface: `target`, `ptrIR`, `getHeapViews()`, and a `toss` spy that throws Errors.
- The helper should expose methods for seeding the heaps and retrieving the instrumented `target`.
- Tests will import `attachMemoryAccessors` from the `.mjs` module until the migration step redirects them.
