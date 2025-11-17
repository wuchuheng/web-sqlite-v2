# Project Brief: Web SQLite V2

## Project Name

@wuchuheng/web-sqlite

## Core Purpose

Repackage the official `sqlite3.wasm` distribution into a maintainable module graph for browser and worker hosts.

## Primary Goals

1. **Modular Runtime Architecture** - Extract SQLite WASM functionality into focused, maintainable modules
2. **OPFS Persistence** - Provide reliable browser filesystem persistence across windows and workers
3. **TypeScript Coverage** - Deliver comprehensive type definitions for all runtime facilities
4. **Developer Experience** - Enable seamless SQLite initialization without editing generated amalgamation

## Success Criteria

- Browser and worker hosts can initialize SQLite engine without WASM bundle modifications
- OPFS persistence works consistently across different browser contexts
- Full TypeScript type coverage for runtime, system, and VFS entry points
- Modular structure allows independent evolution of components
- Comprehensive test coverage with automated verification

## Scope

**In Scope:**

- SQLite3 WebAssembly runtime initialization and management
- OPFS (Origin Private File System) integration and persistence
- Memory management and environment detection utilities
- Worker RPC API for cross-context database operations
- TypeScript type definitions and documentation
- Browser-based test harness and verification tools

**Out of Scope:**

- Modifications to upstream SQLite C codebase
- Non-browser SQLite deployments (Node.js, mobile, etc.)
- Database migration tools or schema management
- GUI administration interfaces

## Constraints

- Must maintain compatibility with official SQLite WASM distribution
- ESM module output required for browser consumption
- TypeScript sources must compile to maintainable JavaScript
- COOP/COEP headers required for SharedArrayBuffer support
- Build process must not require Emscripten SDK for consumers

## Stakeholders

- **Developers** - Need reliable SQLite in browser applications
- **Maintainers** - Require modular, testable codebase
- **Upstream SQLite Team** - Compatibility with official distribution
- **Browser Vendors** - Depend on standard Web APIs (OPFS, WebAssembly)

## Timeline Considerations

- Ongoing TypeScript migration from .mjs to .ts sources
- Continuous feature parity with upstream SQLite releases
- Progressive enhancement of OPFS persistence capabilities
