# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the TypeScript library. Key files include `src/main.ts` (public API), `src/worker.ts` (SQLite WASM worker), `src/worker-bridge.ts`, and shared logic under `src/utils/` and `src/types/`.
- `src/jswasm/` contains the vendored SQLite WASM assets and typings.
- Tests: unit tests live next to code as `*.unit.test.ts` (example: `src/utils/mutex/mutex.unit.test.ts`); E2E tests live in `tests/e2e/*.e2e.test.ts`.
- `docs/` contains the VitePress site and `docs/public/` assets. `samples/` includes runnable HTML examples. `scripts/` has build helpers. `specs/` stores design notes. `dist/` and `coverage/` are build/test outputs.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run build` builds the library to `dist/` (minified).
- `npm run build:watch` builds in watch mode for local development.
- `npm run test` runs build, lint, unit, and E2E suites.
- `npm run test:unit` runs Vitest unit tests with coverage in `coverage/`.
- `npm run test:e2e` runs the Vitest E2E suite via `vitest.e2e.config.ts`.
- `npm run lint` runs ESLint, TypeScript typecheck, and Prettier.
- `npm run format` formats with Prettier.
- `npm run docs:dev` starts the docs site; `npm run docs:build` builds it.
- `npm run http` serves the repo locally on port 8399 (useful for OPFS/worker testing).

## Coding Style & Naming Conventions
- TypeScript (ESM). Indentation is 2 spaces, no tabs, keep lines readable.
- Follow ESLint rules in `eslint.config.ts` (no unused vars unless prefixed `_`, no `any`).
- Format with Prettier via `npm run format`.
- Test filenames: `*.unit.test.ts` for unit, `*.e2e.test.ts` for E2E.
- Keep public API changes isolated to `src/main.ts` and update types in `src/types/`.

## Testing Guidelines
- Unit tests run under Vitest using `vitest.unit.config.ts`.
- E2E tests run with Vitest browser config (`vitest.e2e.config.ts`); install Playwright browsers if prompted.
- Cover both worker and main-thread behavior when touching concurrency or transaction logic.

## Commit & Pull Request Guidelines
- Commit messages follow a Conventional Commit style in history (examples: `feat(build): ...`, `perf(build): ...`, `docs: ...`). Version bumps use `version: x.y.z`.
- PRs should include a clear description, linked issues (if any), and the test commands run. Add screenshots for docs or UI changes.

## Security & Configuration Tips
- SharedArrayBuffer requires COOP/COEP headers: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Ensure your local server sends them when testing OPFS/WASM.
