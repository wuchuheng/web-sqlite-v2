# Test Plan: struct-binder-helpers

## Goal

Cover every export from `src/jswasm/utils/struct-binder/struct-binder-helpers.mjs` through lightweight Vitest cases so that behavior is locked down before migrating the implementation to TypeScript.

## Test cases

1. **`toss`**
    - Call with a few string pieces and assert that the thrown error message matches the joined parts.
    - Confirm that the helper never returns by catching the exception and inspecting the message.

2. **`defineReadonly`**
    - Define a temporary object property via the helper and assert it is non-writable, non-enumerable, and non-configurable.
    - Verify the value can be read back but cannot be reassigned.

3. **`describeMember`**
    - Pass a struct name and member key, check that the returned string matches the `struct::member` pattern.

4. **`isNumericValue`**
    - Validate that finite numbers, bigints, and `Number` wrappers return `true`.
    - Assert that `NaN`, `Infinity`, strings, and plain objects return `false`.

5. **`detectLittleEndian`**
    - Ensure the helper returns a boolean (the environment is expected to be little endian).
    - Compare the result against a known `ArrayBuffer` pattern to confirm determinism.

## Fixtures and scaffolding

- The test file will live alongside the original module (`src/jswasm/utils/struct-binder/struct-binder-helpers.test.ts`).
- Imports will directly reference `./struct-binder-helpers.mjs` to lock the baseline behavior.
- Vitest assertions will rely on modern JS globals already available in the browser/runtime that the module targets.

## Validation

- After writing the tests, run `pnpm run test:unit` to ensure the baseline module passes. The test suite should serve as a regression guard before rewriting the module in TypeScript.
