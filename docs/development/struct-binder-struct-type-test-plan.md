# Test Plan: struct-binder-struct-type

## Goal

Lock down the runtime behavior of `src/jswasm/utils/struct-binder/struct-binder-struct-type.mjs` before migrating it to TypeScript. The tests should verify that the struct constructor enforces internal tokens, instances delegate to the shared context, and helper accessors work exactly as documented in the declarations.

## Test cases

1. **Constructor token guard**
    - Calling the generated `StructType` without `INTERNAL_STRUCT_TOKEN` must throw via `toss`.
    - When the correct token is passed, readonly `structName` and `structInfo` properties should mirror the constructor arguments.

2. **Context delegation**
    - Each instance method (`lookupMember`, `memberToJsString`, `memberIsString`, `memberKey`, `memberKeys`, `memberSignature`, `setMemberCString`, `addOnDispose`) calls the matching context function with the right arguments.
    - Fluent methods (`setMemberCString`, `addOnDispose`) should return the instance for chaining.

3. **Pointer plumbing**
    - The prototype `pointer` getter returns whatever `context.pointerOf` provides and never writes.
    - Setting `instance.pointer` should throw the expected error message.

4. **Memory dump behavior**
    - When `context.pointerOf` resolves to `undefined`, `memoryDump()` returns `null`.
    - When it resolves to a valid pointer, the method should slice bytes from `context.heap()` covering exactly `structInfo.sizeof`.

5. **Static helpers and registration**
    - `StructType.allocCString`, `.isA`, `.hasExternalPointer`, and `.memberKey` proxy to the context and honor the expected type guards.
    - The provided context receives a `setStructType` call with the created constructor.

## Fixtures and scaffolding

- A Vitest file `src/jswasm/utils/struct-binder/struct-binder-struct-type.test.ts` will import the existing `.mjs` module directly to capture current behavior.
- Tests will build lightweight fake contexts using `vi.fn()` to capture argument lists and return canned values (e.g., mock heaps via `Uint8Array`).
- `StructTypeInstance` data such as `structInfo` and heap buffers will match the declaration types so parity with the `.d.ts` file remains obvious.

## Validation

- After implementing the tests, run `pnpm run test:unit` to confirm the current `.mjs` implementation satisfies the assertions before migrating to TypeScript.
