# xwrap-internals Test Plan

## Scope

Validate the low-level adapters produced by
`src/jswasm/utils/whwasm/xwrap-internals.mjs` before migrating the module to
TypeScript. The tests target the per-type converter registration, the concrete
`FuncPtrAdapter`, and helper utilities returned by `createXWrapInternals`.

## Test matrix

1. **Numeric/pointer converters**
    - `ptrAdapter` masks values appropriately for `i32` and `i64` pointer IR modes.
    - Built-in integer/floating-point adapters coerce values to the documented ranges.
    - `copyThrough` registration ensures result converters mirror the argument
      adapters for every primitive type (including `i64` when big-int mode is active).
2. **String and JSON adapters**
    - `"string"`, `"utf8"`, and `"pointer"` arguments allocate via
      `target.scopedAllocCString`.
    - Result adapters decode using `target.cstrToJs`, with `:dealloc` variants always
      invoking `target.dealloc` even on failure.
    - `"json"` adapters return parsed objects and honor nullish pointers.
3. **Adapter lookup helpers**
    - `ensureArgAdapter` / `ensureResultAdapter` throw through
      `context.toss` when a mapping is missing.
    - `convertArg` / `convertResult` and their `NoCheck` variants respect `null`
      types and forward arguments untouched when expected.
4. **FuncPtrAdapter behavior**
    - Installs JS callbacks through `installFunctionInternal`, memoizing per
      `bindScope` (`singleton` vs. `context` vs. `transient`).
    - Reuses previously installed pointers when passed the same JS function.
    - Accepts existing function pointers (`number`/`bigint`) and passes them
      through untouched.
    - Throws descriptive errors when provided incompatible inputs or invalid scopes.
5. **`configureAdapter` contract**
    - With one argument, returns the existing adapter for the requested type.
    - With two arguments, registers or clears adapters depending on whether the
      second parameter is supplied.
    - Rejects invalid argument shapes via `context.toss`.

## Test data & scaffolding

- Instantiate a real `WhWasmInstallerContext` backed by a mock target mirroring
  the setup used in `xwrap-helpers.test.ts`:
    - `pointerIR` toggled between `"i32"` and `"i64"`; enable `bigIntEnabled`
      when verifying 64-bit-specific behavior.
    - `scopedAllocCString`, `cstrToJs`, `dealloc`, `scopedAllocPush`, and
      `scopedAllocPop` implemented via Vitest spies to assert allocation and cleanup.
    - `installFunctionInternal` mocked to hand out monotonically increasing
      function pointers so `FuncPtrAdapter` behavior is deterministic.
- Helpers inside the test suite will wrap `createXWrapInternals(context)` to
  expose the returned maps and adapter utilities for direct assertions.
- The Vitest suite will import the `.mjs` implementation (pre-migration) and run
  through `pnpm test:unit` to capture the baseline.

Once this plan is approved, the test file
`src/jswasm/utils/whwasm/xwrap-internals.test.ts` can be authored to match the
matrix above.
