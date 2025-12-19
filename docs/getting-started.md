---
outline: deep
---

# Getting Started

`web-sqlite-js` runs SQLite (WASM) inside a Web Worker and stores the database file in OPFS (Origin Private File System).

## Install

```bash
npm i web-sqlite-js
```

## Critical requirement: COOP & COEP

This library uses the SQLite WASM build backed by `SharedArrayBuffer`. Your app must be cross-origin isolated and serve these headers:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

If these headers are missing, the database will not start.

### Vite example

```ts
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
    server: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
    preview: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
});
```

## Open a database

`openDB("my-database")` creates/opens `my-database.sqlite3` in OPFS.

```ts
import openDB from "web-sqlite-js";

const db = await openDB("my-database");
```

## Execute statements

Use `exec()` for statements like `CREATE`, `INSERT`, `UPDATE`, `DELETE`.

```ts
await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );
`);
```

### Bind parameters

Positional parameters:

```ts
await db.exec("INSERT INTO users (name) VALUES (?)", ["Alice"]);
```

Named parameters:

```ts
await db.exec("INSERT INTO users (name) VALUES ($name)", { $name: "Bob" });
```

## Query rows

Use `query<T>()` for `SELECT` statements.

```ts
type User = { id: number; name: string };

const users = await db.query<User>(
    "SELECT id, name FROM users ORDER BY id DESC",
);
```

## Transactions

Use `transaction()` for atomic sequences. If the callback throws, the transaction rolls back.

```ts
await db.transaction(async (tx) => {
    await tx.exec("INSERT INTO users (name) VALUES (?)", ["Charlie"]);
    await tx.exec("INSERT INTO users (name) VALUES (?)", ["Diana"]);
});
```

## Debug logging

Enable SQL timing logs by passing `{ debug: true }`:

```ts
const db = await openDB("my-database", { debug: true });
```

## Close

```ts
await db.close();
```

## Limitations

- Requires a secure context (HTTPS or `localhost`) and a browser with OPFS + cross-origin isolated `SharedArrayBuffer`.
- Runs in a Web Worker, so it must be used in browser runtime code (not during SSR/build time).
