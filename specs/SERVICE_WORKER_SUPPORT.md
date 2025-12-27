# Service Worker & Same-Thread Support

## Problem

The current architecture strictly imposes a **Main Thread (Client) <-> Web Worker (Server)** model. This requires `new Worker()` capabilities. However:

1.  **Service Workers** (e.g., Chrome Extensions) cannot easily spawn nested workers.
2.  Bundling the library often leads to code duplication (Main bundle + Inline Worker bundle containing `sqlite3`).

## Goal

1.  Enable "Same-Thread" execution for Service Worker environments.
2.  Maintain a **Single File** output (`dist/index.js`) without 2x size bloat.
3.  Zero-config auto-detection of the environment.

## Implemented Architecture

### 1. Functional Core (`src/core/sqlite-ops.ts`)

Decoupled core SQLite operations into pure functions operating on a `SqliteContext`.

### 2. Self-Reference Worker Pattern

To solve the "Single File" + "No Duplication" constraint, we use a novel worker loading strategy:

- **`src/core/worker-runner.ts`**: Contains the `onmessage` logic. It is exported as `runWorker`.
- **`src/worker-bridge.ts`**: Instead of inlining a separate worker file, it creates a Blob Worker that imports `runWorker` from **the library's own URL** (`import.meta.url`).

```javascript
// Generated Worker Code
import { runWorker } from "${import.meta.url}";
runWorker();
```

This ensures that `dist/index.js` is loaded once by the main thread and once by the worker, but physically exists as only one file, preventing `sqlite3` duplication.

### 3. Local Bridge (`src/local-bridge.ts`)

A bridge that executes `sqlite-ops` directly on the main thread. Used when `Worker` is not defined.

### 4. Zero-Config Auto-Detection (`src/main.ts`)

`openDB` detects `typeof Worker`.

- **True:** Spawns the Self-Reference Worker.
- **False:** Uses Local Bridge (Same-Thread).

## Test Plan

### 1. Unit Tests (`tests/unit/core/sqlite-ops.test.ts`)

Verify the pure functional core logic (`openSqlite`, `executeSqlite`, etc.) independent of transport.

### 2. E2E Tests (`tests/e2e/same-thread.e2e.test.ts`)

Verify `openDB` falls back to `LocalBridge` when `Worker` is undefined.

- **Mock:** `globalThis.Worker = undefined`.
- **Scenario:** Create DB, Table, Insert, Query.

### 3. E2E Tests (`tests/e2e/worker-mode.e2e.test.ts`)

Verify the standard Worker mode still works with the new "Self-Reference" loader.
