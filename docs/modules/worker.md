---
id: DOC-MOD-WORKER
title: Worker Integration
summary: Details how the SQLite WASM distribution exposes a worker-friendly API and how the bundled harness exercises it.
audience: ["engineering"]
status: verified
owner: Runtime Maintainers
updated: 2025-10-18
---

:::tip Status
🟢 **Verified** — The browser harness spawns the module worker and streams suite progress.
It exercises the RPC handlers across CRUD, transaction, and performance flows.【F:tests/src/main.ts†L43-L118】【F:tests/src/worker.ts†L1-L56】
:::

## Bootstrap Initializers

`applyDefaultBootstrapState` registers the worker initializer alongside OO1, OPFS, and version hooks so every build exposes a worker-compatible facade. The worker initializer posts a `worker1-ready` message once listeners are attached, signaling that commands may be dispatched from the host thread.【F:src/jswasm/wasm/bootstrap/default-bootstrap-state.mjs†L1-L57】【F:src/jswasm/wasm/bootstrap/worker1-api-initializer.mjs†L480-L511】

## Worker Harness

The bundled test worker imports `sqlite3InitModule`, instantiates a `TestRunner`, registers suites that cover environment probes, lifecycle flows, CRUD, transactions, and performance checks, and waits for a `run-tests` message before initializing SQLite in the worker context.【F:tests/src/worker.ts†L1-L56】 This mirrors the way applications boot the worker API while providing regression coverage for OPFS-backed databases.【F:tests/src/suites/database-lifecycle.suite.ts†L1-L96】

## Host UI

`TestUIController` manages the browser UI that interacts with the worker. It spins up the module worker, verifies OPFS and SharedArrayBuffer availability, dispatches test runs, and streams progress and logs back to the DOM, offering a reproducible way to evaluate worker behavior across browsers.【F:tests/src/main.ts†L43-L200】 The controller also exposes manual controls so engineers can rerun or inspect suites when extending the worker API.
