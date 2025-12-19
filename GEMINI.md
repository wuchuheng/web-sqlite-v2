# web-sqlite-js

## Project Overview

`web-sqlite-js` is a client-side SQLite library for the browser that provides persistent storage using the Origin Private File System (OPFS). It runs the SQLite engine in a Web Worker to ensure the main thread remains non-blocking and responsive.

**Key Features:**

- **Persistence:** Uses OPFS for robust file storage.
- **Non-Blocking:** Heavy database operations run in a dedicated Web Worker.
- **Concurrency Safe:** A built-in Mutex ensures sequential execution of commands.
- **Type-Safe:** Written in TypeScript with full type definitions.
- **Transactions:** Supports atomic transactions.

## Architecture

The project is structured around a **Main Thread <-> Worker** communication model:

1.  **Main Thread (`src/main.ts`):**
    - Exposes the public API (`openDB`).
    - Manages the `WorkerBridge` to send messages to the worker.
    - Uses a `Mutex` (`src/utils/mutex/mutex.ts`) to queue operations, ensuring that the worker processes one command at a time (crucial for SQLite consistency).
    - Provides high-level abstractions for `query`, `exec`, and `transaction`.

2.  **Web Worker (`src/worker.ts`):**
    - Loads the vendored `sqlite3` WASM module (`src/jswasm/`).
    - Initializes the database connection using `opfs` storage mode.
    - listens for events (`OPEN`, `EXECUTE`, `QUERY`, `CLOSE`) and executes them against the `sqlite3` instance.
    - Returns results or errors back to the main thread.

## Development & Usage

### Prerequisites

- Node.js (v18+ recommended)
- NPM

### Build & Run Commands

| Command               | Description                                        |
| :-------------------- | :------------------------------------------------- |
| `npm install`         | Install dependencies.                              |
| `npm run build`       | Build the library using Vite (outputs to `dist/`). |
| `npm run build:watch` | Build in watch mode for development.               |
| `npm test`            | Run all tests (Unit + E2E), lint, and build.       |
| `npm run test:unit`   | Run unit tests via Vitest.                         |
| `npm run test:e2e`    | Run end-to-end tests via Vitest (browser mode).    |
| `npm run lint`        | Run ESLint and type checking.                      |
| `npm run format`      | Format code using Prettier.                        |
| `npm run docs:dev`    | Start the documentation server.                    |

### Key Files

- `src/main.ts`: Library entry point. Handles API surface and worker communication.
- `src/worker.ts`: The Web Worker script that interacts directly with SQLite WASM.
- `src/jswasm/`: Contains the bundled `sqlite3.wasm` and `sqlite3.mjs` files.
- `src/types/DB.ts`: TypeScript interfaces for the public API (`DBInterface`).
- `src/types/message.ts`: Internal types for Main<->Worker message passing.
- `vite.config.ts`: Build configuration for the library.

## Important Constraints

**COOP/COEP Headers:**
To use `SharedArrayBuffer` (required by the SQLite WASM build), the serving environment **must** send the following HTTP headers:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

Without these, the database will fail to initialize.

## Custom Commands

### `/plan`

**Trigger:** User starts a prompt with `/plan`.
**Action:**

1.  **Analyze** the request.
2.  **Design** a comprehensive specification file (e.g., `specs/FEATURE_NAME.md` or `plan.md`).
    - Include requirements, architecture, data structures, and step-by-step implementation plan.
3.  **DO NOT** write any implementation code (no `.ts`, `.js`, etc.) during this phase.
4.  **Present** the plan for user approval.
