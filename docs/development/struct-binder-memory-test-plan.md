# struct-binder-memory Test Plan

## Scope

Target module: `src/jswasm/utils/struct-binder/struct-binder-memory/struct-binder-memory.ts`.
Tests will exercise the TypeScript implementation side-by-side with the compiled JS during the migration.

## Intended test cases

1. **Allocation lifecycle** – verify `allocStruct` stores a pointer for an instance, zeroes memory, and respects debug logging without throwing when the allocator succeeds and when the constructor is reused with an external pointer override.
2. **Disposal flow** – ensure `addOnDispose` accumulates handlers, `freeStruct` invokes them, removes `ondispose`, and calls the deallocator only when an internal buffer was allocated.
3. **CString helpers** – test `allocCString` encodes a string, writes a null terminator, and rejects allocation failures; `decodeCString` returns the expected string when reading from a `Uint8Array` backed by both `ArrayBuffer` and a `SharedArrayBuffer`.
4. **Member lookup** – confirm `lookupMember` finds members by key or prefix/suffix variants, and that `assertCStringSignature` accepts only signature `'s'` while `toss` is thrown otherwise.

## Test data

- Simple mock struct info object with `sizeof`, `members`, and `structName` fields.
- Mock encoder/decoder based on the real `TextEncoder`/`TextDecoder` constructors.
- `Alloc`/`dealloc` spies implemented with `Map`-backed buffers to track addresses.
- Minimal `StructTypeRefAccessor` stub exposing a constructor with a `dispose` method so `disposeHandler` can call it.

## Scaffolding

- Shared fixtures for `pointerMap`, `externalPointers`, and `viewHeap` that wrap the repo's `Uint8Array` helpers used throughout the binder modules.
- `describeMember` stub that returns a formatted string so error messages are deterministic.
- Consumable `log` and `debugFlags` toggles to observe when the helpers log without cluttering test output.
- Use Vitest hooks to reset maps between tests to avoid cross-test state.

## Execution

- Point the tests at `import { createMemoryHelpers } from "./struct-binder-memory"` (pre-transpile) and pass mocked dependencies.
- Run `npm run test:unit` after adding the test file to ensure the `.mjs` implementation continues to behave before migration.
