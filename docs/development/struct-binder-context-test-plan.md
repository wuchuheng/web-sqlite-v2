# Struct Binder Context Test Plan

## Target

Module: `src/jswasm/utils/struct-binder/struct-binder-context/struct-binder-context.ts`

## Test Focus

1. **`ensureConfig` validation**
    - Throws when `config` is missing.
    - Throws when `heap` is neither `WebAssembly.Memory` nor a function returning a `Uint8Array`.
    - Throws when `alloc`/`dealloc` are missing or non-functions.
    - Accepts a valid config (no throw).

2. **`ensureDebugFlagFactories` behavior**
    - Lazily installs `__makeDebugFlags` and `debugFlags`.
    - Generated controller respects `DEBUG_FLAG_MASK` bits and inherits from parent when provided.
    - Setting mask `< 0` clears individual debug flags.

3. **`createContext` essentials**
    - Uses provided `heap` function to obtain a `Uint8Array` view.
    - `memberKey` and `memberKeys` reflect prefix/suffix config.
    - `memberSignature` returns original signature and Emscripten-formatted variant.
    - `memberToJsString` decodes CString members and returns `null` when pointer is `0`.
    - `pointerIsWritable` throws after the struct instance pointer is cleared.
    - `coerceSetterValue` accepts numeric, `null`, and auto-pointer struct instances while rejecting invalid inputs.

## Test Data & Scaffolding

- Use a fake config with:
    - `heap` returning a shared `Uint8Array`.
    - Stubbed `alloc`/`dealloc` tracking calls.
    - Custom `memberPrefix/memberSuffix` strings to assert key transformations.
- Mock `StructTypeRef` with minimal fields (`structInfo`, `pointer`).
- Lightweight struct definition object matching helper expectations (members map with signature info).
- Utilize Vitest `describe/it` + `expect` assertions; no browser APIs required.
