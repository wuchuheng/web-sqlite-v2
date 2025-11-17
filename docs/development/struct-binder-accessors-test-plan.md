# Struct Binder Accessors Test Plan

## Purpose

Document the minimal behaviors we intend to lock in while migrating `struct-binder-accessors` to TypeScript inside its own subdirectory. Tests will exercise the current implementation so we can prove parity for validation, normalization, and accessor wiring logic.

## Key Scenarios

1. **Validation rejects bad struct definitions**
    - Missing `structInfo`, missing `members`, or aligning issues (`sizeof`/`offset` not multiples of 4 or missing `sizeof` for a member) should throw via `toss`.
    - Provide a well-aligned definition so we know the "happy path" passes.

2. **Member signature validation guards collisions and invalid signatures**
    - Ensure `validateMemberSignature` throws when the prototype already exposes the member key or when the signature fails `RX_SIG_SIMPLE|RX_SIG_FUNCTION`.

3. **Accessor wiring follows the descriptor metadata**
    - Use a stub context (heap view, pointer helpers, signature helpers) to define getters/setters via `defineMemberAccessors`.
    - Verify the defined property reads/writes the simulated WebAssembly heap correctly, calling through the `context.signature` helpers to locate `getter/setter` names and `wrapForSet`.
    - Confirm the setter throws when marked `readOnly`, and that debug logging paths call the provided `log` when flags are set.

4. **Argument normalization handles both overloads**
    - Calling `normalizeStructArgs("Foo", info)` returns the tuple with `info.name` set to `"Foo"`.
    - Passing only the info object whose `name` is already set returns the expected values.

## Fixtures and Scaffolding

- Reuse the actual `struct-binder-helpers` exports (`toss`, `describeMember`, regex helpers) via the `.mjs` import path.
- Create a fake context that exposes:
    - `heap()` returning a `Uint8Array` and `pointer` helpers that map an instance to an offset inside a shared buffer.
    - A `coerceSetterValue` that simply returns the value (or performs minimal type checking) so we can focus on DataView behavior.
    - `signature` helpers that return mock getter/setter names (`getUint32`, `setUint32`, etc.), an `irFor` label, and `wrapForSet` identity functions.
    - `log` that records calls when debug flags enable them, allowing assertions.
    - `littleEndian` flag to mirror the real behavior.

## Test Execution Notes

- Place the tests inside `src/jswasm/utils/struct-binder/struct-binder-accessors/struct-binder-accessors.test.ts` and import the module without the `.mjs` suffix (`from "./struct-binder-accessors"`).
- Running `npm run test:unit` should exercise the emitted JS (or the TS source during local development) so we guard against regressions before the old `.mjs` artifacts are retired.

## Pending Approval

Wait for confirmation on this plan before authoring `struct-binder-accessors.test.ts`.
