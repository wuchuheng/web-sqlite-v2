# Test Plan: struct-binder-members

## Goal

Lock down every helper returned from `src/jswasm/utils/struct-binder/struct-binder-members/struct-binder-members.ts` with Vitest cases that exercise both happy paths and guard clauses so we can safely rewrite the implementation in TypeScript.

## Test cases

1. **`memberToJsString`**
    - Provide a fake struct instance whose member `key` points to a non-zero pointer; the stubbed `decodeCString` returns a known string and the assertion verifies it is returned.
    - Confirm that when the member pointer is `0`, the helper returns `null`.
2. **`memberIsString`**
    - Ensure a member with signature `["s"]` and with/without `tossIfNotFound` returns `true` (existing member) or `false` if missing, respecting the `tossIfNotFound` flag.
3. **`memberSignature`**
    - Validate the default signature array for a member (e.g., `["s", "i"]`) matches the raw result.
    - Pass `emscriptenFormat = true` and assert the returned string filters invalid characters and maps pointer-like signatures to `i`, mirroring the regex replacements in the implementation.
4. **`setMemberCString`**
    - Stub `allocCString` to return a pointer and ensure the member key on the instance is updated.
    - Confirm `addOnDispose` receives the same pointer while the helper returns the mutated instance.
5. **`pointerIsWritable`**
    - When `pointerOf` returns zero, expect the helper to throw via `toss` with the disposal message.
    - When a positive pointer is returned, verify the helper yields that pointer.
6. **`coerceSetterValue`**
    - Null input should return `0`.
    - Numeric input (including `Number` wrappers) should be returned as-is.
    - If the descriptor signature is pointer-like (`"P"`), `StructTypeRefAccessor.get()` returns a fake constructor, and the provided value is an instance; assert the pointer is extracted and `log` is called when `debugFlags.setter` is truthy.
    - Non-numeric, non-pointer inputs should trigger `toss`, matching the error message path.

## Fixtures and scaffolding

- The test helper file will live next to the `.ts` module (`src/jswasm/utils/struct-binder/struct-binder-members/struct-binder-members.test.ts`) and import `createMemberHelpers` directly from `./struct-binder-members`.
- Provide a stub `memoryHelpers` object implementing `lookupMember`, `assertCStringSignature`, `pointerOf`, `allocCString`, `addOnDispose`, and `decodeCString` to avoid depending on other modules.
- Define a minimal `signature` helper with `isAutoPointer` that treats `"P"`/`"p"` as pointer-like and return `false` otherwise.
- Use Vitest spies/mocks for `log` and `toss` so we can verify error paths and debug logging.

## Validation

- Run `pnpm run test:unit` to ensure all `struct-binder-members` cases pass before and after the migration.
- Once tests are green, they will guard the TypeScript rewrite and the expectations for each helper will stay fixed even after the new implementation is added.
