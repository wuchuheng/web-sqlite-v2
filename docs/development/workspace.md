---
id: DOC-DEV-WORKSPACE
title: Workspace Scripts
summary: Summarizes package outputs, TypeScript configuration, and the commands available to contributors.
audience: ["engineering"]
status: implemented
owner: Maintainers
updated: 2025-10-18
---

## Package Outputs

The published entry point exports the authored `sqlite3.mjs` module and the companion type declarations, mirroring the structure expected by downstream bundlers.【F:package.json†L2-L18】 Consumers import from the package root and receive the typed facade defined in `sqlite3.d.ts`, which enumerates result codes, pointer aliases, and binding helpers for the WASM runtime.【F:src/jswasm/sqlite3.d.ts†L1-L120】

## TypeScript Configuration

The repository ships a focused `tsconfig.json` that targets ES2020 modules, enables strict type checking, and allows `.mts` authoring so future conversions can emit `.mjs` without losing type safety.【F:tsconfig.json†L1-L14】 During the migration, declaration files in `src/jswasm` remain the source of truth for API surfaces while `.mts` modules are incrementally introduced alongside `.mjs` equivalents.

## Documentation Tooling

Run `pnpm docs:dev` to launch VitePress locally and preview the documentation structure defined in this folder.【F:package.json†L15-L19】 The command uses the shared workspace environment, so any changes to Markdown or sidebar configuration hot-reload during editing.
