---
id: DOC-OVERVIEW
title: Web SQLite V2 Overview
summary: Summarizes the modular SQLite WASM runtime, OPFS persistence helpers, and supporting tooling that ship in this repository.
audience: ["engineering", "architecture"]
status: implemented
owner: Maintainers
updated: 2025-10-18
---

## Project Intent

Web SQLite V2 repackages the official `sqlite3.wasm` distribution into a maintainable module graph so browser and worker hosts can initialize the engine without editing the generated amalgamation.【F:src/jswasm/sqlite3.mjs†L35-L118】 Responsibilities such as module configuration, WASM loading, memory orchestration, and environment detection live in focused utilities that can evolve independently of the upstream build.【F:src/jswasm/utils/wasm-loader.mjs†L1-L107】【F:src/jswasm/runtime/module-configurator.mjs†L1-L156】【F:src/jswasm/runtime/environment-detector.mjs†L1-L86】【F:src/jswasm/runtime/memory-manager.mjs†L1-L147】

The git history shows three repeating themes:

1. **Runtime modularization** – the early commits extract filesystem, loader, and bootstrap helpers into authored modules so maintainers can patch behavior without regenerating the WASM bundle.【F:src/jswasm/utils/sqlite3-init-wrapper.mjs†L1-L146】【F:src/jswasm/utils/async-utils/async-utils.ts†L1-L86】
2. **Persistent storage** – OPFS installers, async proxies, and sector-aligned pooling make the browser filesystem behave consistently across windows and workers.【F:src/jswasm/vfs/opfs/opfs-sahpool-vfs.mjs†L1-L160】【F:src/jswasm/vfs/opfs/async-proxy/index.mjs†L1-L120】
3. **Type coverage** – successive passes expand `.d.ts` coverage so TypeScript consumers get accurate signatures for runtime, system, and VFS entry points.【F:src/jswasm/sqlite3.d.ts†L1-L160】【F:src/jswasm/shared/opfs-vfs-installer.d.ts†L1-L74】

## What Ships Today

- **Runtime initialization** – `sqlite3InitModule` wires together environment detection, module configuration, memory management, and WASM instantiation so callers receive a fully bootstrapped SQLite interface.【F:src/jswasm/sqlite3.mjs†L85-L120】【F:src/jswasm/runtime/lifecycle-manager.mjs†L1-L148】
- **Memory and path utilities** – Helpers align allocations, zero buffers, and resolve filesystem paths for both worker and window contexts, encapsulating Emscripten requirements.【F:src/jswasm/utils/memory-utils.mjs†L1-L86】【F:src/jswasm/utils/path.mjs†L1-L160】
- **OPFS persistence** – The repository bundles synchronous and asynchronous OPFS VFS installers, sector-aligned pool management, and worker bridges for cross-context file access.【F:src/jswasm/vfs/opfs/opfs-sahpool-vfs.mjs†L55-L188】【F:src/jswasm/vfs/opfs/installer/index.mjs†L64-L260】
- **Worker RPC API** – The bootstrap initializer attaches message handlers for opening databases, executing SQL, configuring options, and managing extensions inside workers.【F:src/jswasm/wasm/bootstrap/worker1-api-initializer.mjs†L24-L213】
- **Type definitions** – Consumers receive enums, pointer aliases, and module configuration interfaces that mirror the runtime facilities emitted by the WASM build.【F:src/jswasm/sqlite3.d.ts†L1-L159】【F:src/jswasm/wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts†L1-L120】
- **Interactive verification harness** – A browser-based test runner spins up a worker, registers suites that exercise OPFS persistence, CRUD flows, transactions, and performance probes, and streams live telemetry to the UI.【F:tests/src/main.ts†L43-L118】【F:tests/src/suites/database-lifecycle.suite.ts†L1-L96】

## Documentation Map

- The **Runtime Modules** section highlights the portfolio overview, then drills into environment detection, lifecycle management, and OPFS helpers.
- The **API Reference** section mirrors the upstream SQLite documentation with TypeScript-oriented notes.
- The **Development** section captures the scripts and test harness that validate the distribution.
- The **History** page distills notable milestones so future work items have context.

## Next Steps

Open issues revolve around completing the TypeScript migration (replacing authored `.mjs` files while keeping ESM output), tightening automated verification in CI, and documenting remaining VFS edge cases surfaced by the test suites. These tasks build on the modular structure described above and align with the existing commit narrative of “extract, type, verify.”
