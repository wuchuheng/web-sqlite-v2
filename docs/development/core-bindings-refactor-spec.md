# Core Bindings Refactor Spec & Test Plan

**Target Module:** `src/jswasm/api/bindings/core-bindings.ts`  
**Objective:** Improve readability and maintainability of the core binding definitions without altering runtime behavior.

## 1. Behavior Baseline

- `createCoreBindings` must return the same ordered set of SQLite binding signatures consumed by `wasm.xWrap`.
- `createOptionalBindings` must only emit bindings when the corresponding wasm exports exist, preserving current function pointer adapter options (names, signatures, bind scopes, `contextKey`, and `callProxy` behaviors).
- `createWasmInternalBindings` must continue exposing the wasm helper bindings used by higher-level utilities.
- Callback adapters (`sqlite3_exec`, `sqlite3_set_authorizer`, hooks) must keep their error-handling fallbacks (`resultCode` or `capi.SQLITE_ERROR`) and argument conversions (`cArgvToJs`, `cstrToJs`).

## 2. Refactor Goals

- Reduce cognitive load by grouping binding definitions and isolating repeated `FuncPtrAdapter` setup.
- Improve naming clarity for helper builders while keeping exported API stable.
- Keep binding signatures, order, and optional inclusion logic unchanged.

## 3. Validation Plan

- Run `npm run test:unit` to ensure the refactor preserves existing behavior covered by the unit suite.
- Spot-check generated binding collections to confirm no signatures, order, or optional gating changed.

## 4. Success Criteria

- Core binding lists are easier to read and modify, with helpers extracted for repeated adapter construction.
- No changes to public exports or runtime binding behavior.
- `npm run test:unit` completes successfully.
