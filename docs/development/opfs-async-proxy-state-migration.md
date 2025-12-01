# OPFS Async Proxy State Migration

- Original module: `src/jswasm/vfs/opfs/async-proxy/state.mjs`
- Original declarations: `src/jswasm/vfs/opfs/async-proxy/state.d.ts`
- New TS source: `src/jswasm/vfs/opfs/async-proxy/state/state.ts`
- Compiled runtime import: `src/jswasm/vfs/opfs/async-proxy/index.mjs` now loads `state/state.js`
- Global API preserved: `globalThis.createDefaultState` still provided, identical behaviour

## Commands

- `npm run test:unit` (baseline and post-migration) — all pass
- `npm run build:migration && npm run format && npm run lint` — clean
- `npm run test` — browser app serves without console errors

## Notes

- `state.d.ts` kept and adjusted to avoid problematic re-export of `SerializationBuffer` types; the TS source uses a global constructor type for compatibility.
- `state.mjs` now defers to compiled TS via side-effect import to maintain historical importScripts ordering.
