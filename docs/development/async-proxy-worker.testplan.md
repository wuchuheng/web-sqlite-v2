# Async Proxy Worker Baseline Test Plan

## Scope

- Validate `AsyncProxyWorker` from `src/jswasm/vfs/opfs/async-proxy/async-proxy-worker.mjs`.

## Cases

- After loading the module, `globalThis.AsyncProxyWorker` exists and is constructible.
- Constructor sets `state`, `logger`, `openFiles`, `implicitLocks`, `serialization`.
- `createOperationImplementations()` returns all required operation keys.
- `buildOperationRouting()` succeeds with default `opIds` and maps at least one handler id (0).
- `storeAndNotify()` writes to `sabOPView` using `opIds.rc` without throwing (smoke test using default empty buffer).
- Do not call `start()` in Node tests; OPFS APIs are not available.
