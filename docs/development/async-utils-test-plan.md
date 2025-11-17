---
title: Async Utils Test Plan
module: src/jswasm/utils/async-utils/async-utils.ts
---

# Async Utils Test Plan

- **Objective**: Demonstrate parity between the existing `createAsyncLoad` implementation and the future TypeScript migration by exercising the public loader behavior.

- **Test cases**
    1. **Success path**: mock `readAsync` to resolve a known `ArrayBuffer`, verify the supplied `onload` is called with the expected `Uint8Array`, and confirm dependency tracker functions `addRunDependency` / `removeRunDependency` are invoked when `noRunDep` is falsy.
    2. **Explicit error handler**: have `readAsync` reject, provide `onerror`, and assert the handler is called while dependencies added earlier are cleaned up as expected after the rejection.
    3. **Default error throw**: reject without an `onerror`; expect the returned promise chain to throw, allowing Vitest to surface the failure.
    4. **No-dependency mode**: call the loader with `noRunDep = true` and confirm the dependency factory / tracker helpers are never touched even during a successful load.

- **Test data**
    - Fixed URL string such as `"https://example.com/data.bin"`.
    - `ArrayBuffer` derived from `[1, 2, 3]` so the resulting `Uint8Array` payload is easy to assert.

- **Scaffolding**
    - Use Vitest to spy on the dependency helpers via `vi.fn()`.
    - Call `createAsyncLoad` imported from `./async-utils/async-utils`.
    - Wrap each loader invocation in a promise to await asynchronous callbacks before asserting side effects.

After these cases run against the current `.ts`, we can reuse the same tests once the compiled `.js` ships.
