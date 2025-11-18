# function-table-helpers Test Plan

## Scope

Validate the behaviors covered by `src/jswasm/utils/whwasm/function-table-helpers.mjs` before migrating it to TypeScript. The plan exercises indirect function table helpers added to a `WhWasmInstallerContext`.

## Test matrix

1. **Function table accessors**
    - `target.functionTable()` returns the indirect table from `target.exports`.
    - `target.functionEntry(ptr)` returns the entry when `ptr < length` and `undefined` otherwise.
2. **Baseline install/uninstall**
    - `target.installFunction(fn, "v")` stores the JS function into the table and returns the pointer.
    - `target.uninstallFunction(ptr)` frees the slot, queues it in `cache.freeFuncIndexes`, and returns the previous function.
    - Next `installFunction` call should reuse a freed pointer.
3. **Scoped installs**
    - `target.scopedInstallFunction` requires an active `cache.scopedAlloc` frame.
    - When called inside a scope, it records the pointer inside the top scope array.
4. **Signature swapping & argument validation**
    - Passing `(sig, fn)` order also works.
    - Invalid argument combinations throw via `context.toss`.
5. **TypeError fallback via `jsFuncToWasm`**
    - Simulate a `WebAssembly.Table` that rejects bare JS functions (throws `TypeError` from `.set`).
    - Verify the helper wraps the function through `target.jsFuncToWasm` to satisfy the table.
6. **`uninstallFunction` nullish handling**
    - Passing `null`/`undefined` returns `undefined` without touching the table.

## Test data & scaffolding

- Instantiate a fresh `WhWasmInstallerContext` with a mock `target` exposing `exports.__indirect_function_table`.
- Use a lightweight `FakeTable` class inside the tests that mimics the essential WebAssembly table API (`length`, `grow`, `get`, `set`). Allow configuring whether `set` throws `TypeError` for raw JS functions so we can cover the wrapper fallback.
- Push/pull arrays into `cache.scopedAlloc` manually to simulate active scopes.
- Simple counter-based functions (`() => 123`) keep assertions deterministic.

## Tooling

- New test file: `src/jswasm/utils/whwasm/function-table-helpers.test.ts`.
- Framework: Vitest (already configured via `vitest.config.ts`).
- Command: `pnpm test:unit`.

Once these tests are in place and passing against the `.mjs` implementation, proceed with the TypeScript migration steps.
