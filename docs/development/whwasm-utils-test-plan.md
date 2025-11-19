# whwasm utils JS → TS Migration Test Plan

## Scope

Validate `assertAllocator` from `src/jswasm/utils/whwasm/utils.mjs` before migrating to TypeScript (and then confirm the
new `src/jswasm/utils/whwasm/utils/utils.ts` build behaves the same). The goal is to exercise both success and failure
paths to ensure installer helpers depending on allocator validation continue to work unchanged.

## Test Cases

1. **Pass-through assertion**
    - Provide a mock context whose `target` exposes `alloc` and `dealloc` functions.
    - Expect `assertAllocator` to return `void` without throwing.
2. **Missing alloc function**
    - Omit `alloc` on the target while keeping `dealloc`.
    - Ensure `assertAllocator` throws using the context `toss` helper with the function name in the message.
3. **Missing dealloc function**
    - Provide `alloc` but not `dealloc` to trigger the same error path.
4. **Non-function members**
    - Set `alloc` or `dealloc` to non-function values (e.g., numbers) and verify they are rejected as well.

## Test Data

- Minimal mock context implementing `toss` (throws an Error) and a mutable `target` object referencing the `alloc` and
  `dealloc` properties under test.
- Reuse deterministic function references (`() => 1`) to assert that only their presence/type matters, not behavior.

## Scaffolding & Utilities

- Inline helper `createMockContext(overrides)` that merges overrides into `target` and returns
  `{ context, target }` for the tests.
- Tests will import `assertAllocator` from the `.mjs` module until the migration wiring directs them to the `.ts`
  implementation.
