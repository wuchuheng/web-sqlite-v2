# Memory Utils Test Plan

## Purpose

Exercise the existing `memory-utils.mjs` behaviors so the baseline
Vitest suite documents stability before the TypeScript migration begins.

## Planned test cases

1. **`initRandomFill`** – confirm it returns a function that proxies to
   `crypto.getRandomValues` when available and throws if the API is missing.
2. **`randomFill`** – verify the exported variable reassigns itself to the
   initialized filling function after the first call and fills the view.
3. **`zeroMemory`** – zeroes the specified slice of a `Uint8Array` heap.
4. **`alignMemory`** – rounds input sizes up to the nearest multiple of the
   provided alignment (e.g., 64 and 256 bytes).
5. **`createMmapAlloc`** – ensures the returned allocator:
    - aligns the requested size to 64KB,
    - calls the provided `_emscripten_builtin_memalign`,
    - zeroes the heap on success, and
    - returns the pointer (or `0` when the allocation fails).

## Test data

- `Uint8Array` heap of 256 bytes seeded with non-zero values for zeroing tests.
- Alignment sizes such as `64` and `65536` to verify rounding logic.
- Stubbed `_emscripten_builtin_memalign` that records its arguments and returns
  a mock pointer (non-zero) or `0` for failure scenarios.
- A deterministic `crypto.getRandomValues` implementation that mirrors the
  input buffer to keep the assertions predictable.

## Scaffolding

- Tests live in `src/jswasm/utils/memory-utils.test.ts` and import the current
  `memory-utils.mjs` module directly.
- Use Vitest `beforeEach` hooks to restore any global overrides (e.g.,
  `crypto`) so other tests stay stable.
- Helper functions:
    - `mockCrypto()` to inject a `getRandomValues` spy.
    - `createHeap(size)` to produce zeroed views with `fill`.

## Commands

- Run `npm run test:unit` to execute the new suite against the `.mjs` module.

The plan targets the baseline behavior only; once the TypeScript source exists,
the same tests will switch to the extension-less import path.
