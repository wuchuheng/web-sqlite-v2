# Async Proxy State Baseline Test Plan

## Scope

- Validate `createDefaultState()` from `src/jswasm/vfs/opfs/async-proxy/state.mjs`.

## Cases

- Function exists on `globalThis` after module load.
- Returns object shaped as `AsyncProxyState`.
- `verbose === 1`.
- `sabOP`, `sabIO` are `SharedArrayBuffer` with `byteLength === 0`.
- `sabOPView` is `Int32Array`, `sabFileBufView` and `sabS11nView` are `Uint8Array`.
- `sq3Codes` keys exist and equal `0`.
- `opfsFlags` numeric fields `0`, `defaultUnlockAsap === false`.
- `opIds` contains all operation keys, including `"opfs-async-shutdown"`, all `0`.
- Timing and sizing defaults: `asyncIdleWaitTime === 150`, `asyncS11nExceptions === 1`, `fileBufferSize === 0`, `sabS11nOffset === 0`, `sabS11nSize === 0`.
- `littleEndian === detectLittleEndian()`.
- `serialization instanceof globalThis.SerializationBuffer`.
