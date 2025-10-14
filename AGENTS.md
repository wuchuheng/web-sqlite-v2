# Repository Guidelines

## Project Structure & Module Organization
The WebAssembly bridge for SQLite lives in `src/jswasm`, with helper modules (filesystem, WASI bindings, async utilities) colocated beside `sqlite3.mjs` and the bundled `sqlite3.wasm`. Reusable tooling such as the COOP/COEP-enabled dev server sits in `scripts/http-server.ts`. Browser-facing demos and smoke tests reside under `tests` (HTML entry point, worker harness, and CSS assets). Keep large binaries and generated files under `src/jswasm` unless retooling the build.

## Build, Test, and Development Commands
- `pnpm install` - install dependencies; always run after pulling new devDependencies.
- `pnpm test` - launches the header-safe HTTP server and opens `http://127.0.0.1:7411/tests/index.html`; leave the window open to exercise WASM flows.
- `pnpm lint` - runs ESLint across `.ts` and `.mjs`; use before committing to auto-fix style drift.

## Coding Style & Naming Conventions
Follow the repository ESLint config (`eslint.config.mts`) and rely on `pnpm lint` for formatting nudges. Use ECMAScript modules with `.mjs` for browser-delivered code and `.ts` for tooling. Prefer `camelCase` for variables/functions, `PascalCase` for classes, and kebab-case for file names (e.g., `memory-utils.mjs`). Default to spaces with the existing indentation depth in the touched file, and keep imports grouped by platform responsibility.

## Testing Guidelines
Browser-driven tests live in `tests/index.html` and `tests/worker.js`; extend them when adding SQLite features or OPFS flows. Name new fixtures after the scenario they cover (`tests/css/opfs-sync.css`) and document manual steps in `tests/README.md`. When adding automation, ensure the served page logs success without console errors and capture key assertions in the README.

## Commit & Pull Request Guidelines
Follow the existing `<type>: <description>` convention (`refactory:`, `docs:`). Keep messages imperative ("add OPFS sync adapter") and mention impacted modules when possible. Pull requests should summarize behavior changes, link related issues, and include screenshots or console transcripts for UI/worker updates. Confirm `pnpm lint` and `pnpm test` run clean before requesting review.

## Security & Configuration Tips
Serve assets through `scripts/http-server.ts` or an equivalent COOP/COEP-compliant server to preserve `SharedArrayBuffer` support. If you change port or base path, document the new command in the PR and validate that `sqlite3.wasm` loads from the expected origin.
