---
id: DOC-MOD-RUNTIME
title: Runtime Lifecycle
summary: Explains how the authored runtime modules coordinate environment detection, configuration, and WebAssembly startup.
audience: ["engineering", "architecture"]
status: verified
owner: Runtime Maintainers
updated: 2025-10-18
---

:::tip Status
🟢 **Verified** — Exercised by the worker harness before every suite run.
It initializes the module and drives lifecycle coverage before executing the suites.【F:tests/src/worker.ts†L1-L56】
:::

## Responsibilities

The runtime layer replaces portions of the generated Emscripten glue with maintainable modules. It detects the active host environment, configures the Module object, manages heap growth, and exposes lifecycle hooks that mirror the upstream bootstrap sequence.【F:src/jswasm/runtime/environment-detector.mjs†L13-L47】【F:src/jswasm/runtime/module-configurator.mjs†L14-L167】【F:src/jswasm/runtime/memory-manager.mjs†L1-L147】【F:src/jswasm/runtime/lifecycle-manager.mjs†L8-L205】

## Lifecycle Orchestration

`createLifecycleManager` mirrors Emscripten’s pre-run, init, and post-run phases while tracking outstanding run dependencies. It registers callbacks, drives FS and TTY initialization, and exposes the `run()` entry point invoked by `sqlite3InitModule`.【F:src/jswasm/runtime/lifecycle-manager.mjs†L8-L205】 The manager also surfaces helpers for dependency bookkeeping (`addRunDependency`, `removeRunDependency`) so asynchronous resource loading integrates cleanly with WASM startup.【F:src/jswasm/runtime/lifecycle-manager.mjs†L40-L109】【F:src/jswasm/runtime/lifecycle-manager.mjs†L174-L205】

## Environment Detection

`detectEnvironment` distinguishes window, worker, and blob contexts to derive the correct script directory, while `createFileReaders` builds synchronous and asynchronous fetch helpers according to that environment.【F:src/jswasm/runtime/environment-detector.mjs†L13-L85】 These primitives feed the WASM loader so binaries resolve whether the bundle runs on the main thread or inside a worker.【F:src/jswasm/utils/wasm-loader.mjs†L1-L107】

## Module Configuration

`module-configurator.mjs` centralizes locate-file logic, console plumbing, and abort handling. It builds the locateFile shim that points to the bundled `sqlite3.wasm`, wires up print/printErr, and captures user overrides before restoring them after initialization.【F:src/jswasm/runtime/module-configurator.mjs†L14-L189】 The helpers also execute `preInit` callbacks in order, keeping parity with the generated bootstrap.【F:src/jswasm/runtime/module-configurator.mjs†L170-L189】

## Memory Management

`createMemoryManager` updates all typed array views whenever the WASM heap grows and supplies `createResizeHeapFunction` so Emscripten can expand memory with guardrails around maximum sizes. The module exposes getter accessors for the underlying buffers and a `initializeWasmMemory` helper that reuses existing memory when provided.【F:src/jswasm/runtime/memory-manager.mjs†L1-L130】【F:src/jswasm/runtime/memory-manager.mjs†L131-L213】

## Related Utilities

The runtime layer is invoked through `sqlite3InitModule`, which wraps these helpers, installs filesystem shims, and resolves the final API facade that consumers import.【F:src/jswasm/sqlite3.mjs†L85-L118】 Supporting utilities such as `sqlite3-init-wrapper.mjs` and `async-utils` manage loader promises and background tasks that keep the boot sequence aligned with upstream behavior.【F:src/jswasm/utils/sqlite3-init-wrapper.mjs†L1-L146】【F:src/jswasm/utils/async-utils/async-utils.ts†L1-L86】
