# struct-binder-signatures.h tests

## Intent

- confirm the helper factory returns glyph mapping, IR, DataView accessors, and wrappers consistent with the existing `.mjs` implementation.
- cover the pointer-size/BigInt variations and error cases mentioned in the current code so migration preserves behavior.

## Key test cases

1. **Glyph detection and base metadata**: pass signatures like `"p"`, `"P"`, `"C"`, `"j"`, and a function signature `"p(i)"` to ensure `glyphFor` drops the suffix and handles the auto-pointer marker.
2. **IR mapping**: verify `irFor` returns expected names (`"i8"`, "`i32`", `"i64"`, `ptrIR`, `"float"`, `"double"`) for each glyph without throwing.
3. **DataView getters/setters**: ensure pointer-ish glyphs respect pointer width and fall back to BigInt getters only when `ptrSizeof === 8` and `bigIntEnabled` true; other glyphs map to the listed getters/setters.
4. **Wrap helpers**: confirm `wrapForSet` returns `Number` for most glyphs but uses `BigInt` when `ptrSizeof === 8` or signature `"j"` while `bigIntEnabled` is true, and throws when BigInt support is missing.
5. **Error gating**: verify `toss` is called when an unknown glyph or missing BigInt support is encountered (e.g., monkey-patch `globalThis.BigInt64Array` to `undefined` and request `getterFor("j")`).

## Test data / scaffolding

- reuse the production config shape `{ ptrSizeof, ptrIR, bigIntEnabled }` and instantiate `createSignatureHelpers` from `struct-binder-signatures.mjs`.
- provide `ptrIR` as a sentinel string (e.g., `"i64"`) during tests to ensure pointer-like glyphs return that value.
- mock `globalThis.BigInt64Array` within test scope when exercising BigInt-reliant paths and restore afterward.
- import `toss` from the helper module to assert error messages originate from the same source.

## Execution notes

- Tests will initially point at `struct-binder-signatures.mjs` to validate parity with the existing runtime.
- The Vitest file will live alongside the `.mjs` during this step and follow the naming pattern `struct-binder-signatures.test.ts`.
- After the TypeScript migration, the same test file will shift into the new subdirectory and import the extension-less module.
