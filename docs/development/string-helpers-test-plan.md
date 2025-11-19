# string-helpers Test Plan

## Scope

Exercise the UTF-8 helper behaviors provided by
`src/jswasm/utils/whwasm/string-helpers.mjs` before migrating the module to
TypeScript. The suite focuses on reading/writing null-terminated strings,
transcoding JS ↔ UTF-8, and the allocator plumbing that installs onto the
`WhWasmInstallerContext`.

## Test matrix

1. **`cstrlen` / `cstrToJs` basics**
    - Valid pointer returns the correct byte length and decoded JavaScript string.
    - Zero/invalid pointers return `null` without touching memory.
2. **`jstrlen` encoding math**
    - ASCII strings report their length.
    - Multi-byte characters (e.g., emoji) expand to the correct UTF-8 byte count.
    - Non-string inputs yield `null`.
3. **`jstrcpy` buffer writes**
    - Copies into a provided `Uint8Array`, honoring `offset`, `maxBytes`, and `addNul`.
    - Rejects non-typed-array targets via `context.toss`.
4. **`cstrncpy` heap copy semantics**
    - Copies up to `n` bytes (or the inferred value when `n < 0`) and ensures null termination when space permits.
    - Throws when either source or target pointer is nullish.
5. **`jstrToUintArray` encoding helper**
    - Returns an encoded `Uint8Array`, optionally appending the terminating NUL.
6. **`allocCString` / `allocCStringInternal` plumbing**
    - Calls into `target.alloc`, writes UTF-8 bytes plus the trailing NUL, and returns either the pointer or `[ptr, length]`.
    - Stores the shared `context.allocCStringInternal` hook.

## Test data & scaffolding

- Instantiate a real `WhWasmInstallerContext` using a mock target with:
    - `memory: new WebAssembly.Memory({ initial: 1 })`
    - `isPtr(value)` validating pointers within the heap bounds.
    - `heap8u()` helper returning `context.getHeapViews().HEAP8U`.
    - `alloc(size)` that hands out monotonically increasing heap offsets.
    - A `toss` spy that throws `Error`.
- Provide helper utilities inside the test suite to:
    - Allocate JS strings into the heap and return their pointers (for `cstrlen`, `cstrToJs`, `cstrncpy` baselines).
    - Create fresh typed-array views for local buffer tests (`jstrcpy`).
    - Inspect the heap contents written by `allocCString`.
- The Vitest suite will import the `.mjs` module during the baseline phase and run via `pnpm test:unit`.

Once these tests are approved and passing against the `.mjs` implementation, the migration workflow can continue.
