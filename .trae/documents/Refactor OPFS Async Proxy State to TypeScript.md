## Step 1: Analyze the originals

- Target module: `src/jswasm/vfs/opfs/async-proxy/state.mjs` implements `createDefaultState()` and assigns it to the worker global: `globalThis.createDefaultState = createDefaultState` (src/jswasm/vfs/opfs/async-proxy/state.mjs:109).
- Declaration file: `src/jswasm/vfs/opfs/async-proxy/state.d.ts` defines `SQLiteErrorCodes`, `AsyncOpfsFlags`, `OperationIds`, `AsyncProxyState`, and `createDefaultState()` signatures (src/jswasm/vfs/opfs/async-proxy/state.d.ts:1–68).
- Public API:
    - `createDefaultState(): AsyncProxyState` returning a zeroed-out state with shared buffers, flags, error codes and `SerializationBuffer` (src/jswasm/vfs/opfs/async-proxy/state.mjs:82–108).
    - Globals consumed: `detectLittleEndian` from environment (src/jswasm/vfs/opfs/async-proxy/environment/environment.ts:113–130) and `SerializationBuffer` from the TS implementation that assigns itself to global (src/jswasm/vfs/opfs/async-proxy/serialization-buffer/serialization-buffer.ts:219–221).
- Runtime usage:
    - `AsyncProxyWorker` constructs `this.state = createDefaultState()` and uses `state.serialization` and type fields throughout (src/jswasm/vfs/opfs/async-proxy/async-proxy-worker.mjs:23–38, 124–132, 186–207).
    - Worker bootstrap loads `state.mjs` via `importScripts(resolveUrl("state.mjs"))` (src/jswasm/vfs/opfs/async-proxy/index.mjs:31–38).
- Behavioral constraints to preserve:
    - All defaults and shapes of nested objects (`sq3Codes`, `opfsFlags`, `opIds`) must remain identical, including the quoted key `"opfs-async-shutdown"` (src/jswasm/vfs/opfs/async-proxy/state.mjs:56–75).
    - Views over empty `SharedArrayBuffer(0)` for `sabOPView`, `sabFileBufView`, `sabS11nView` (src/jswasm/vfs/opfs/async-proxy/state.mjs:88–91).
    - `littleEndian` computed via `detectLittleEndian()` (src/jswasm/vfs/opfs/async-proxy/state.mjs:83–100) and passed into `SerializationBuffer` construction with `exceptionVerbosity: 0` (src/jswasm/vfs/opfs/async-proxy/state.mjs:100–107).
    - Backward compatibility: keep global assignment of `createDefaultState` and do not introduce ESM-only imports into worker runtime.

## Step 2: Add a test harness (plan for approval)

- Create `docs/development/async-proxy-state.testplan.md` summarizing cases:
    - `createDefaultState()` returns an object matching `AsyncProxyState` keys and types.
    - `sq3Codes` fields are all `0`; `opfsFlags` numeric flags `0` and `defaultUnlockAsap === false`.
    - `opIds` contains all named operation keys (including `"opfs-async-shutdown"`) and all values `0`.
    - Buffers and views are constructed over empty shared buffers; `sabOPView instanceof Int32Array`, `sabFileBufView instanceof Uint8Array`, `sabS11nView instanceof Uint8Array`.
    - `littleEndian === detectLittleEndian()`.
    - `serialization` is an instance of the global `SerializationBuffer` and constructed with zero size.
- Add baseline unit test next to the original:
    - File: `src/jswasm/vfs/opfs/async-proxy/state.test.ts`.
    - Load the JS implementation so it attaches to globals: `await import("./state.mjs")`.
    - Assert `typeof globalThis.createDefaultState === "function"`; call it and validate all fields against the test plan.
- Run baseline: `npm run test:unit` and ensure all tests pass against `.mjs`.

## Step 3: Create the migration subdirectory and TypeScript source

- Create `src/jswasm/vfs/opfs/async-proxy/state/state.ts` implementing the same behavior in TypeScript:
    - Lift type definitions from `state.d.ts` and export them to let the compiler emit `state.d.ts`.
    - Preserve zero-build helpers: `createZeroSqliteCodes()`, `createZeroOpfsFlags()`, `createZeroOperationIds()` with precise return types.
    - Implement `export function createDefaultState(): AsyncProxyState` with identical logic; keep global assignment: `(globalThis as unknown as { createDefaultState: unknown }).createDefaultState = createDefaultState`.
    - Reference globals for `detectLittleEndian` and `SerializationBuffer` to avoid changing worker import model.
- Add migration include to `tsconfig.migration.json`:
    - Append `"src/jswasm/vfs/opfs/async-proxy/state/*.ts"` to `include` (tsconfig.migration.json:14–47).

## Step 4: Redirect tests to the new TypeScript source

- Move baseline test into the migration folder: `src/jswasm/vfs/opfs/async-proxy/state/state.test.ts`.
- Update imports to be extension-less and near the TS file:
    - `import "./state"` (executes module and attaches global) or `import { createDefaultState } from "./state"` while still asserting the global assignment exists.
- Run `npm run test:unit` and fix any discrepancies until tests pass against TS.

## Step 5: Compile the migration

- Run `npm run build:migration` to emit `state.js` and `state.d.ts` next to `state.ts`.
- Compare the generated `state.d.ts` to the original `state.d.ts` and adjust TS source to align:
    - Ensure interfaces match the original property mutability (e.g., `AsyncProxyState` properties are mutable, others readonly as declared).
    - Ensure `OperationIds` includes the index signature `[key: string]: number`.

## Step 6: Build, format, and lint

- Run: `npm run build:migration && npm run format && npm run lint`.
- Iterate on any TypeScript, formatting, or linting issues until clean.

## Step 7: Update runtime references

- Update worker bootstrap `importScripts` to point to the compiled TS module path without suffix:
    - Change `resolveUrl("state.mjs")` → `resolveUrl("state/state")` (src/jswasm/vfs/opfs/async-proxy/index.mjs:31–38).
- Re-run `npm run test:unit` and ensure all unit tests pass with the new import path.

## Step 8: Remove now-unused artifacts

- Remove `src/jswasm/vfs/opfs/async-proxy/state.mjs` and the original `src/jswasm/vfs/opfs/async-proxy/state.d.ts` once parity is proven.
- Confirm no imports reference the old files.

## Step 9: Final verification

- Execute `npm run test` and open the test app in the browser to verify no console errors.
- Manually exercise OPFS flows; ensure `AsyncProxyWorker` runs, initializes state, and performs operations without errors.
- Run `pnpm test` if required by your setup to mirror the spec’s final contract.

## Step 10: Document and hand over

- Write a short PR/change log entry summarizing:
    - New file location and name.
    - Tests added and commands run.
    - Runtime import change in `index.mjs`.

```migration-checklist
currentStep: 1
steps:
- [x] 1. Analyze the originals
- [ ] 2. Add a test harness
- [ ] 3. Create the migration subdirectory
- [ ] 4. Redirect tests to the new TypeScript source
- [ ] 5. Compile the migration
- [ ] 6. Build, format, and lint
- [ ] 7. Update runtime references
- [ ] 8. Remove now-unused artifacts
- [ ] 9. Final verification
- [ ] 10. Document and hand over
```
