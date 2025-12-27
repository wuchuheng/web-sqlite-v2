# Specification: Same-Thread Support and Single-File Architecture (Functional)

## 1. Introduction

This document outlines the refactoring of `web-sqlite-js` to support execution in the same thread (specifically for Chrome Extension Service Workers) and to produce a single-file distribution (`dist/index.js`) under 750KB. The implementation follows a **Functional Programming Pattern**.

## 2. Goals

- **Single-File Output**: Exactly one `.js` file for the entire library (including engine and bridge).
- **Environment Detection**: Automatic fallback to same-thread if running in a Service Worker or if `Worker` is unavailable.
- **Zero Code Duplication**: Avoid Base64 worker inlining; use self-referencing scripts.
- **Functional Pattern**: Use factory functions and closures instead of classes.
- **Size Constraint**: Final bundle must be < 750KB.

## 3. Architecture

### 3.1 The Functional Engine (`src/engine.ts`)

A factory function that encapsulates the SQLite WASM state and returns a dispatcher.

```typescript
export type SqliteDispatcher = (
    event: SqliteEvent,
    payload: any,
) => Promise<any>;

export const createSqliteEngine = (): SqliteDispatcher => {
    let db: Sqlite3DB | null = null;
    let sqlite3: Sqlite3 | null = null;

    // Private helper functions for handles (OPEN, EXECUTE, QUERY, CLOSE)
    // ...

    return async (event, payload) => {
        // Dispatch to internal handlers
    };
};
```

### 3.2 The Self-Bootstrapping Entry Point (`src/main.ts`)

The single bundle will identify its environment upon execution.

1.  **Worker Role**: If `isDedicatedWorker()`, it initializes `createSqliteEngine()` and sets up `self.onmessage`.
2.  **Library Role**: Exports `openDB()`.

```typescript
// src/main.ts

// Detection
if (isDedicatedWorker()) {
    bootstrapWorker(createSqliteEngine());
}

export const openDB = async (filename, options) => {
    if (shouldRunSameThread()) {
        // Local Bridge Path
        const dispatch = createSqliteEngine();
        return createBridge(dispatch);
    } else {
        // Spawning Path
        const worker = new Worker(import.meta.url, { type: "module" });
        return createBridge(worker);
    }
};
```

### 3.3 The Unified Bridge (`src/bridge.ts`)

A generic bridge that can communicate with either a local function (same-thread) or a `Worker` instance using the same interface.

## 4. Bundling Strategy

### 4.1 Avoiding Duplication

- **Remove `?worker&inline`**: This stops Vite from embedding a Base64-encoded string of the worker logic inside the main script.
- **Self-Referencing**: `new Worker(import.meta.url)` allows the browser to re-use the already loaded script file as a worker thread.

### 4.2 Vite Configuration

- `inlineDynamicImports: true`: Forces all code (including dynamic imports of `sqlite3.mjs`) into `index.js`.
- `minify: 'terser'`: Ensures smallest possible size.

## 5. Implementation Steps

1.  **Extract logic** from `worker.ts` to `engine.ts` using functional patterns.
2.  **Create generic bridge** in `bridge.ts`.
3.  **Refactor `main.ts`** for dual-role execution (Self-Bootstrapping).
4.  **Update `vite.config.ts`** for single-file rollup.
5.  **Clean up** redundant files (`worker.ts`, `worker-bridge.ts`).
