# Scoped Alloc Helpers JS → TS Migration Test Plan

## Scope

Validate `attachScopedAllocators` in `src/jswasm/utils/whwasm/scoped-alloc-helpers.mjs` before migrating it to
TypeScript. The Vitest suite will first exercise the `.mjs` helper to guard existing behavior, then the `.ts` version
after the migration wiring is updated.

## Test Cases

1. **Scoped frame bookkeeping**
    - Call `scopedAllocPush` twice and ensure the exported `scopedAlloc.level` tracks the depth.
    - After allocating a few pointers with `scopedAlloc`, invoke `scopedAllocPop` (implicit and explicit) and confirm the
      recorded pointers are freed via `dealloc`.
    - Include at least one pointer recognized as a function entry so `uninstallFunction` is triggered instead of `dealloc`.
2. **Allocation guards and CString plumbing**
    - Verify `scopedAlloc` throws if no scope is active.
    - Ensure `scopedAllocCString` delegates to `context.allocCStringInternal` with the scoped allocator and returns either
      a pointer or `[pointer, length]` tuple unchanged.
3. **Argv helpers**
    - Exercise `scopedAllocMainArgv` and `allocMainArgv` with a small list, then inspect the mocked heap to ensure the
      pointer table contains the CString addresses followed by a terminating `0`.
    - Feed the produced buffer into `cArgvToJs` and assert it yields the original string array (with `null` for zero
      entries).
4. **scopedAllocCall safety**
    - Wrap a callback that allocates scoped memory and throws; confirm `scopedAllocPop` unwinds automatically and the
      throw propagates.
5. **Pointer slot helpers**
    - Check `allocPtr()` zero-initializes the allocated slot using `context.ptrIR`, and that requesting multiple slots
      returns distinct addresses with zeros written to each stride.

## Test Data

- Deterministic pointer arithmetic: `alloc` increments by the requested size while returning aligned base addresses
  (multiples of 16) so tests can assert exact offsets.
- CString allocations return predictable pointers recorded in a map for later verification by `cArgvToJs`.
- Use short sample strings (`["foo", "bar"]`) and include a `null` entry to cover pointer tables with zero values.

## Scaffolding & Utilities

- Add a `createMockContext()` helper inside the test file that:
    - Instantiates `WhWasmInstallerContext` with a minimal `target`.
    - Stubs `alloc`, `dealloc`, `functionEntry`, `uninstallFunction`, `allocCString`, `pokePtr`, `peekPtr`, `poke`, and
      `cstrToJs` using in-memory Maps so we can inspect heap writes.
    - Injects `context.allocCStringInternal` to mimic the string helper behavior that scoped alloc relies on.
- Tests import `attachScopedAllocators` from the `.mjs` implementation until the migration step switches them over to the
  new `.ts` module.
