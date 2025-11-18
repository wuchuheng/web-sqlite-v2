# Struct Binder Factory – Test Plan

## Goals

- Prove the current `.mjs` implementation validates configs before use.
- Exercise creation of struct constructors to ensure member accessors read/write heap-backed values.
- Check the static helpers (`isA`, `structInfo`, `memberKeys`, `memberKey`) that must remain stable after migration.
- Confirm debug flag controllers are initialized so downstream tooling can probe them.

## Test Cases

1. **Config validation**
    - Calling `StructBinderFactory(undefined as never)` throws the standard config error.
    - Missing required callbacks (e.g., `dealloc`) throws the corresponding error string.

2. **Struct creation / member access**
    - Create a realistic config with a heap-backed `Uint8Array`, deterministic allocator, and pointer metadata.
    - Define a simple `Point` struct (`x`, `y`, `child`) to verify integer + pointer members.
    - Assert that writing to `instance.x`/`instance.y` persists reads, and that `dispose()` is callable.

3. **Static helpers**
    - Validate that `StructCtor.structInfo` equals the definition input.
    - `StructCtor.isA` returns `true` for constructed instances and `false` for others.
    - `StructCtor.memberKeys()` returns the normalized member key list.
    - `StructCtor.memberKey("x")` returns a string containing the prefix/suffix (if configured).

4. **Debug flag controller**
    - `StructBinderFactory.debugFlags()` returns an object with keys for `getter`, `setter`, `alloc`, `dealloc`.
    - `StructCtor.debugFlags()` exposes the same flags to the constructor and prototype.

## Test Data & Helpers

- Reuse the deterministic allocator helper from the existing tests (array buffer + bump pointer).
- Extend it with `memberPrefix` to ensure `memberKey` is observable.
- Use Vitest (`describe/it/expect`) colocated with the module at
  `src/jswasm/utils/struct-binder/struct-binder-factory.test.ts`.
