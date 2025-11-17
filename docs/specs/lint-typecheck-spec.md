# Lint & Typecheck Workflow Spec

## Context

- `npm run lint` now drives the full checks for the repository, encompassing:
  1. `eslint` over `.ts|.js|.mjs` sources, ignoring generated artifacts via the project-level configs.
 2. `pnpm run typecheck` (added to the root lint script) which executes `tsc --noEmit --pretty` using `tsconfig.json` and the `node` typings, ensuring compiler errors (like the `process` global or module inference issues) fail fast.
 3. A `tests` workspace lint/typecheck pass (`pnpm run test:lint`), allowing the package’s dedicated ESLint config to cover the browser/worker fixtures.

## Key Configuration Changes

| Area | Description |
| --- | --- |
| `eslint.config.mts` | Added typed config export (`ReturnType<typeof defineConfig>`), introduced `ignores` for generated directories (`dist`, docs cache, `tests`/`test2` outputs), and pointed `@typescript-eslint` parser options at `tsconfig.eslint.json` and `test2/tsconfig.json`. |
| `tests/eslint.config.mts` | Mirrors the typed export fix and only lints source files, skipping the tests dist/node_modules output via `ignores`. |
| `package.json` | `lint` now runs ESLint, the root `tsc` typecheck, and the workspace lint/typecheck; added `typecheck` helper script to keep the workflow explicit. |
| `tsconfig.eslint.json` | A specialized tsconfig for ESLint, extending the root config and covering `src`, tooling files, and the ESLint config itself so type-aware linting works without pulling in build artifacts. |

## Supporting Changes

- Added `vitest` to the root dev dependencies so tests compile under `tsc --noEmit`.
- Adjusted tests (memory utils, sqlite3 init wrapper) and runtime helpers (sqlite worker) so the typechecker sees safe APIs (typed mocks, optional asyncPostInit, safe `globalThis` handling, null-safe stack traces).
- Documented the workflow in this spec so future contributors understand how lint/typecheck flows and where to update when adding new TypeScript roots or generated outputs.
