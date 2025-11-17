# create-wh-wasm-util-installer Test Plan

## Objective

- Ensure the legacy `.mjs` installer stays backward compatible while the TypeScript
  migration is in progress.
    - Confirm the returned installer function exposes the familiar helper APIs.
    - Verify the attached `yawl` loader factory follows the existing factory signature.

## Test cases

1. **Installer surface** – Import `createWhWasmUtilInstaller` from the original
   `.mjs` file, call it to obtain the installer function, and assert:
    - The installer is a function whose `yawl` property is also a function.
    - Calling the installer with a minimal fake target returns that target.
2. **Helper attachment** – After running the installer against the fake target,
   confirm core helpers are present and behave as expected:
    - `sizeofIR("i32")` returns `4`.
    - `heap8()`/`heap32()`/`heapForSize(32)` expose valid typed-array views backed
      by the fake target's `WebAssembly.Memory`.
    - `cstrlen` and `cstrToJs` can read a string written directly into the heap.

## Test data

- `WebAssembly.Memory` (1 page) and `WebAssembly.Table` (for the indirect table).
- UTF-8 helper data: write "hi" plus terminator into the heap and reuse the
  numeric pointer when evaluating `cstrlen`/`cstrToJs`.

## Scaffolding

- Helper `createFakeTarget()` returns a target object satisfying the installer
  context:
    - `pointerIR` set to `"i32"`.
    - `memory`/`exports.memory` referencing the same `WebAssembly.Memory`.
    - `exports.__indirect_function_table` returning a small WebAssembly.Table.
    - `isPtr` helper for pointer validation.
    - Optional `bigIntEnabled` flag set to `false`.
- Helper `writeCString(target, text)` writes a NUL-terminated string into the
  heap and returns the pointer used.

Once the plan is approved, the test file will live next to the `.mjs` file and
use Vitest (`npm run test:unit`) to confirm the baseline behavior before the
TypeScript migration begins.
