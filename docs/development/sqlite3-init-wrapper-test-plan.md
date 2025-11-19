# SQLite3 Init Wrapper Test Plan

## Overview

Verify that `wrapSqlite3InitModule` wires the Emscripten initializer into the expected global state, runs the post-load hooks, and exposes the testing flag while preserving the original async initialization contract.

## Test cases

1. **Error path**: calling `wrapSqlite3InitModule` without an initializer should throw the same error emitted in production (guarding against missing globals).
2. **Happy path**: the wrapped initializer:
    - Replaces `globalThis.sqlite3InitModule` with a function that invokes `runSQLite3PostLoadInit`, swaps out `asyncPostInit`, and resolves the original module.
    - Records `sqlite3InitModuleState` with `moduleScript`, `location`, `urlParams`, and derives `sqlite3Dir` + `scriptDir`.
    - Honors `wrappedInit.__isUnderTest` by propagating the flag to `sqlite3.__isUnderTest`.
3. **Debug routing**: when the URL params contain `sqlite3.debugModule`, the `debugModule` helper should be a no-op (the test ensures it can be invoked without throwing).

## Test data

- Stub `originalInit` as a function returning a resolved Promise with:
    - `runSQLite3PostLoadInit` mocked via `vi.fn()`.
    - `sqlite3` object containing an `asyncPostInit` that resolves to a sentinel value.
    - `sqlite3.asyncPostInit` is deleted after wrapping to mimic the production flow.
- `globalThis.document.currentScript.src` pointing at a known path so the derived directories can be asserted.
- `globalThis.location` set to a `URL` (e.g., `https://example.com/app/index.mjs?sqlite3.dir=/assets/&sqlite3.debugModule=1`) to exercise query-based branches.
- `globalThis.sqlite3InitModuleState` is cleaned between tests to avoid leakage.
- `console.warn` can remain the real implementation since `debugModule` only calls `console.warn` when enabled. Expect Vitest stderr noise from the debugModule logs; this is normal.

## Scaffolding

- Create the test file as `src/jswasm/utils/sqlite3-init-wrapper/sqlite3-init-wrapper.test.ts` importing from `./sqlite3-init-wrapper`.
- Use Vitest helpers (`vi.fn()`, `beforeEach`, `afterEach`) to manage globals and spies.
- Clean up `globalThis.sqlite3InitModule`, `globalThis.sqlite3InitModuleState`, `globalThis.document`, and `globalThis.location` after each test.
- The tests will assert that `runSQLite3PostLoadInit` and the stubbed `asyncPostInit` are invoked exactly once, that `sqlite3InitModuleState` fields contain the expected substrings, and that the resolved value matches the `asyncPostInit` return.
- Command to run for verification: `npm run test:unit` (success means all tests pass against the current TS implementation).

## Approval

Please confirm this plan so I can write the Vitest harness that exercises `src/jswasm/utils/sqlite3-init-wrapper/sqlite3-init-wrapper.ts`.
