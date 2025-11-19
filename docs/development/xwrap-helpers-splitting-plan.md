# XWrap Helpers Split & Validation Plan

## Overview

- **Target module**: `src/jswasm/utils/whwasm/xwrap-helpers.mjs`
- **Intent**: follow `docs/development/minimal-js-file-splitting-spec.md` to move the low-level adapter/setup helpers into a new internal module while keeping the public `attachXWrapAdapters` API identical.
- **Key behavior constraints**:
    - Existing `cache.xWrap.convert*` helpers must continue to wrap the same converter registries.
    - `target.xWrap`, `target.xWrap.argAdapter`, `target.xWrap.resultAdapter`, `target.xWrap.FuncPtrAdapter`, and `target.xCallWrapped` must behave exactly as before (argument validation, scoped alloc usage, pointer reuse).
    - No additional allocations inside hot conversion loops beyond what the current implementation performs.

## Validation Scope

1. **Unit tests (new)**
    - Introduce a Vitest suite beside the module to cover:
        - Initializing a fake `WhWasmInstallerContext` with stubbed `target`/`cache` objects.
        - Verifying integer and pointer adapters (`cache.xWrap.convertArg` / `convertResult`) normalize values as expected.
        - Confirming the `FuncPtrAdapter` still installs callbacks via `installFunctionInternal` and caches the pointer per bind scope.
        - Ensuring `target.xWrap` enforces arity, pushes/pops scoped allocators, and invokes adapters.
    - File: `src/jswasm/utils/whwasm/xwrap-helpers.test.ts`.

2. **Regression commands**
    - `npm run test:unit` (command-gated for Steps 2, 4, and 6 of the splitting workflow).
    - `pnpm lint` (after rewiring to ensure ESLint compliance).
    - `pnpm test` (final confirmation that browser smoke tests still load).

3. **Manual checks**
    - Confirm no other files import helpers from the new module directly.
    - Verify that tree-shaking behavior stays the same (no new exports consumed externally).

## Acceptance Criteria

- Unit tests described above exist and pass against the pre-split file (baseline), then again after extraction.
- The new helper module contains the extracted logic, and `xwrap-helpers.mjs` is reduced to orchestration while preserving its export surface.
- All required commands complete successfully without additional warnings or regressions.
