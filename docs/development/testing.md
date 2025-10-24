---
id: DOC-DEV-TESTING
title: Testing Harness
summary: Documents how to launch, lint, and extend the bundled worker-based verification suites.
audience: ["engineering"]
status: implemented
owner: QA Maintainers
updated: 2025-10-18
---

## Workspace Layout

The root package delegates testing to the `@wuchuheng/web-sqlite-tests` workspace, which hosts the browser UI, worker entry point, and suite definitions used to validate the runtime.【F:package.json†L15-L19】【F:tests/package.json†L1-L35】 The harness boots a JetBrains-style console in the browser, communicates with a dedicated worker, and surfaces environment checks alongside suite progress.【F:tests/src/main.ts†L43-L200】

## Running the Test Runner

```bash
pnpm test
```

`pnpm test` starts the tests workspace in development mode via Vite, automatically opening the harness so suites execute against a live worker.【F:package.json†L15-L19】 When iterating inside the tests workspace directly, use `pnpm --filter @wuchuheng/web-sqlite-tests dev` for the same behavior or `pnpm run test` to open a fresh browser window from that package.【F:tests/package.json†L6-L13】

## Linting and Type Checking

```bash
pnpm lint
```

The root lint script runs ESLint across `.ts`, `.js`, and `.mjs` files, then delegates to the tests workspace lint task so UI and worker sources stay in sync.【F:package.json†L16-L18】 Inside the tests workspace, `pnpm run lint` chains ESLint with the local `typeCheck` command to ensure TypeScript declarations remain accurate.【F:tests/package.json†L6-L13】

## Extending Test Coverage

New suites can register with the `TestRunner` in `tests/src/worker.ts`; they automatically appear in the UI tree and inherit logging, timing, and summary reporting.【F:tests/src/worker.ts†L1-L56】 Use the utilities in `tests/src/suites` for common database setup and assertions when adding OPFS-specific cases such as persistence, locking, or concurrency behavior.【F:tests/src/suites/database-lifecycle.suite.ts†L1-L96】 Document any manual steps in the suite description so future maintainers can reason about failure modes quickly.
