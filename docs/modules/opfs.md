---
id: DOC-MOD-OPFS
title: OPFS Persistence
summary: Describes the Origin Private File System adapters that provide durable storage for the SQLite WASM runtime.
audience: ["engineering"]
status: verified
owner: Storage Maintainers
updated: 2025-10-18
---

:::tip Status
🟢 **Verified** — Lifecycle suites create, reopen, and assert persistence for OPFS-backed databases.
These checks run inside the worker harness on every test execution.【F:tests/src/suites/database-lifecycle.suite.ts†L1-L96】【F:tests/src/worker.ts†L1-L56】
:::

## Installer Overview

`createInstallOpfsVfsContext` coordinates environment validation, configuration parsing, SharedArrayBuffer serialization, worker messaging, and optional OO1 integration so the OPFS VFS installs with a single call.【F:src/jswasm/vfs/opfs/installer/index.mjs†L64-L260】 The installer was split into focused core, wrapper, and utility modules, making it easier to reason about configuration, logging, and error handling without editing the generated bundle.【F:src/jswasm/vfs/opfs/installer/index.mjs†L10-L58】

## Synchronous VFS Helpers

The synchronous SAH pool adapter provides deterministic sector-aligned I/O on top of OPFS handles. It manages header layouts, per-handle metadata, lock state, and the glue needed to register the VFS with SQLite’s C APIs.【F:src/jswasm/vfs/opfs/opfs-sahpool-vfs.mjs†L6-L200】 Pool mappings track associations between sqlite3 file structures and their backing handles so clean-up, locking, and journaling behave like the desktop build.【F:src/jswasm/vfs/opfs/opfs-sahpool-vfs.mjs†L55-L188】

## Asynchronous Worker Bridge

The async proxy worker boots in its own global scope, loads helper modules, checks for environment issues, and starts the `AsyncProxyWorker` which proxies OPFS calls via structured messages and SharedArrayBuffer coordination.【F:src/jswasm/vfs/opfs/async-proxy/index.mjs†L23-L54】 The installer points at this worker via `proxyUri`, enabling synchronous main-thread APIs to delegate heavy file work without blocking.【F:src/jswasm/vfs/opfs/installer/index.mjs†L120-L178】

## Type Definitions and Consumers

The OPFS helpers publish TypeScript declarations so application code can configure installers with confidence and integrate the resulting VFS into the OO1 database classes.【F:src/jswasm/shared/opfs-vfs-installer.d.ts†L1-L74】【F:src/jswasm/vfs/opfs/opfs-sahpool-vfs.d.ts†L1-L120】 These types mirror the runtime exports and keep the documentation aligned with the actual APIs distributed in `sqlite3.d.ts`.【F:src/jswasm/sqlite3.d.ts†L1-L160】
