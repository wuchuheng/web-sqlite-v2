# web-sqlite-js Specification Index

**Project**: web-sqlite-js (web-sqlite-v2 repository)
**Version**: 1.1.0
**Last Updated**: 2025-01-08
**Status**: Stage 1 (Discovery) - Complete

---

## Quick Navigation

### Start Here
1. **[Status Board](./01-status.md)** - Live progress tracking and task states
2. **[Discovery Brief](../01-discovery/01-brief.md)** - Problem, users, solution overview
3. **[Requirements](../01-discovery/02-requirements.md)** - MVP requirements, success criteria, non-goals
4. **[Scope & Glossary](../01-discovery/03-scope.md)** - In/out of scope, boundaries, terminology

### Existing Specifications
- **[Release Versioning System](../../specs/RELEASES.md)** - OPFS-based database migration and versioning
- **[OPFS Explorer Refresh](../../specs/OPFS_REFRESH_AFTER_SQL.md)** - UI synchronization after SQL execution
- Additional specs in `/specs/` directory for specific features

---

## Document Structure

```
docs/
├── 00-control/                    # Control and coordination
│   ├── 00-spec.md              # This file - specification index
│   └── 01-status.md            # Live progress board
│
├── 01-discovery/                  # Stage 1: Problem framing (✓ COMPLETE)
│   ├── 01-brief.md             # Problem statement, users, solution
│   ├── 02-requirements.md      # MVP, success criteria, non-goals, backlog
│   └── 03-scope.md             # Scope boundaries and glossary
│
├── 02-feasibility/                # Stage 2: Options analysis (FUTURE)
│   └── 01-options.md           # Technical options and trade-offs
│
├── 03-hld/                        # Stage 3: High-level design (FUTURE)
│   ├── 01-architecture.md       # System architecture and components
│   └── 02-data-flow.md          # Data flow and interaction patterns
│
├── 04-adr/                        # Stage 4: Architecture decisions (FUTURE)
│   └── *.md                     # Decision records for major choices
│
├── 05-lld/                        # Stage 5: Low-level design (FUTURE)
│   ├── 01-api-contract.md       # API specifications and contracts
│   ├── 02-worker-protocol.md    # Worker message protocol
│   └── 03-opfs-layout.md        # OPFS file structure
│
└── 06-implementation/             # Stage 6: Implementation (FUTURE)
    ├── 01-testing-strategy.md   # Test plans and coverage
    └── 02-verification.md       # Verification and validation
```

---

## Reading Order

### For New Contributors
1. Read **[Brief](../01-discovery/01-brief.md)** to understand the project
2. Read **[Requirements](../01-discovery/02-requirements.md)** for MVP scope
3. Read **[Scope & Glossary](../01-discovery/03-scope.md)** for boundaries and terms
4. Check **[Status Board](./01-status.md)** for current progress

### For Architecture Decisions
1. Start with **[Brief](../01-discovery/01-brief.md)** for context
2. Review **[Release Versioning Spec](../../specs/RELEASES.md)** for core architecture
3. Check **[Scope & Glossary](../01-discovery/03-scope.md)** for boundaries
4. See **[Status Board](./01-status.md)** for implementation stage

### For Feature Implementation
1. Review **[Requirements](../01-discovery/02-requirements.md)** for P0 scope
2. Check **[Non-goals](../01-discovery/02-requirements.md#3-non-goals-explicitly-out-of-scope)** to avoid scope creep
3. Check **[Backlog](../01-discovery/02-requirements.md#4-backlog-future-ideas)** for future considerations
4. Review relevant **[specs/](../../specs/)** for detailed specifications

---

## Project Overview

**web-sqlite-js** is a browser-based SQLite library that provides:

- Full SQLite engine running in WebAssembly (WASM)
- Persistent storage via Origin Private File System (OPFS)
- Non-blocking architecture with Web Worker execution
- Type-safe TypeScript API
- Release versioning system for database migrations
- Dev tooling for testing and rollback

### Current Version
- **Version**: 1.1.0
- **NPM Package**: [web-sqlite-js](https://www.npmjs.com/package/web-sqlite-js)
- **Documentation**: https://web-sqlite-js.wuchuheng.com
- **Repository**: https://github.com/wuchuheng/web-sqlite-js

### Key Technologies
- **SQLite**: Vendored WASM build (sqlite3.wasm)
- **Storage**: OPFS (Origin Private File System)
- **Concurrency**: Mutex-based operation queue
- **Type Safety**: TypeScript with full definitions
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Build**: Vite

---

## Stage Progress

| Stage | Status | Documents | Key Decisions |
|-------|--------|-----------|---------------|
| **1. Discovery** | ✅ COMPLETE | Brief, Requirements, Scope | Problem framed, users identified, MVP defined |
| **2. Feasibility** | ⏳ NOT STARTED | - | Technical options not yet documented |
| **3. HLD** | ⏳ NOT STARTED | - | Architecture not yet formalized |
| **4. ADR** | ⏳ NOT STARTED | - | Decisions in specs/ only |
| **5. LLD** | ⏳ NOT STARTED | - | API contracts in source types only |
| **6. Implementation** | ✅ COMPLETE | Tests, Source code | Core features implemented |

### Notes
- **Stages 2-5 documentation pending**: The project is actively developed and feature-complete for v1.1.0
- **Existing specs**: Detailed specifications exist in `/specs/` for specific features
- **Implementation**: All MVP requirements (P0) are implemented and tested
- **Next steps**: Consider formalizing Stages 2-5 for better maintainability and onboarding

---

## Definition of Done

A task is **DONE** only if:
- ✅ Work completed
- ✅ Evidence provided (commit/PR/test commands/results)
- ✅ Status board updated: [docs/00-control/01-status.md](./01-status.md)
- ✅ This spec index updated if any reading order or stage outputs changed

---

## Change Log

| Date | Change | Impact |
|------|--------|--------|
| 2025-01-08 | Initial Stage 1 Discovery documentation | Created discovery docs, established spec index |
| 2025-01-08 | Created control documents | Set up status tracking and navigation |

---

## Quick Reference

### Critical Paths
- **MVP Requirements**: [docs/01-discovery/02-requirements.md#1-mvp-p0-requirements](../01-discovery/02-requirements.md#1-mvp-p0-requirements)
- **Success Criteria**: [docs/01-discovery/02-requirements.md#2-success-criteria](../01-discovery/02-requirements.md#2-success-criteria)
- **Non-goals**: [docs/01-discovery/02-requirements.md#3-non-goals-explicitly-out-of-scope](../01-discovery/02-requirements.md#3-non-goals-explicitly-out-of-scope)
- **Glossary**: [docs/01-discovery/03-scope.md#4-glossary](../01-discovery/03-scope.md#4-glossary)

### Architecture Key Points
- **Worker-based**: All SQLite operations run in Web Worker
- **OPFS storage**: Databases stored in Origin Private File System
- **Mutex queue**: Operations execute sequentially for consistency
- **Release versioning**: Schema migrations tracked in metadata database
- **Type-safe**: Full TypeScript support with generic query results

### External Dependencies
- **Browser APIs**: OPFS, Web Workers, SharedArrayBuffer
- **HTTP Headers**: COOP/COEP required for SharedArrayBuffer
- **Build Tools**: Vite, TypeScript, Vitest, Playwright

---

**Maintainer**: wuchuheng <root@wuchuheng.com>
**License**: MIT
**Homepage**: https://web-sqlite-js.wuchuheng.com
