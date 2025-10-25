---
id: DOC-MOD-PORTFOLIO
title: Module Portfolio
summary: Lists the verified runtime capabilities shipped in the repository and their implementation entry points.
audience: ["engineering", "architecture"]
status: verified
owner: Maintainers
updated: 2025-10-18
---

## Feature Snapshot

The sections below anchor each delivered capability to its implementation module and the regression coverage that exercises it. Follow the links in the sidebar for deeper design notes and open questions.

### Runtime bootstrap — 🟢 Verified

- `sqlite3InitModule` wires environment detection, module configuration, memory management, and filesystem helpers into the exported initializer.【F:src/jswasm/sqlite3.mjs†L70-L155】【F:src/jswasm/runtime/environment-detector.mjs†L8-L85】
- The worker harness initializes the module before running suites across database lifecycles, CRUD flows, and transactions.【F:tests/src/worker.ts†L1-L56】

### OPFS VFS installer — 🟢 Verified

- The installer stitches together environment validation, worker bootstrapping, synchronous wrappers, and optional VFS integration to expose an `opfs` VFS.【F:src/jswasm/vfs/opfs/installer/index.mjs†L64-L260】
- Lifecycle suites create, reopen, and assert persistence for OPFS-backed databases to ensure durability semantics hold.【F:tests/src/suites/database-lifecycle.suite.ts†L1-L96】

### Sector-aligned pool VFS — 🟢 Verified

- The SAH pool maps SQLite file handles to OPFS storage, covering locking, reads, writes, sync, and truncation paths used by the synchronous VFS.【F:src/jswasm/vfs/opfs/opfs-sahpool-vfs.mjs†L55-L188】
- These behaviors are exercised indirectly by the lifecycle, CRUD, and performance suites executed by the worker harness.【F:tests/src/worker.ts†L1-L56】

### Worker RPC API — 🟢 Verified

- `createWorker1ApiInitializer` binds the legacy RPC handlers for open, exec, config, extension loading, and xCall operations inside worker threads.【F:src/jswasm/wasm/bootstrap/worker1-api-initializer.mjs†L24-L213】
- The browser UI spawns a module worker and streams suite progress/results through the RPC channel, providing end-to-end coverage.【F:tests/src/main.ts†L39-L118】【F:tests/src/worker.ts†L1-L56】

### Type definitions — 🟢 Verified

- `sqlite3.d.ts` enumerates result codes, pointer aliases, module configuration, and helper interfaces exposed to downstream TypeScript consumers.【F:src/jswasm/sqlite3.d.ts†L1-L159】
- Root linting delegates to the tests workspace to type-check the harness against those definitions so regressions surface quickly.【F:package.json†L14-L18】

## Status Legend

- **🟢 Verified** – Covered by the regression harness or type checker and aligns with checked-in implementation files.
- **🟡 Implemented** – Shipped in code but missing automated verification; extend tests before promoting.
- **⚪ Proposed** – Planned but not yet merged.

Each module page records follow-up tasks for uncovered edge cases or upcoming migrations.
