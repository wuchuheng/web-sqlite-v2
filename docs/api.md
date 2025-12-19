---
outline: deep
---

# API Reference

## `openDB(filename, options?)`

Opens a database connection (stored in OPFS) and returns a Promise resolving to a `DBInterface`.

```ts
import openDB from "web-sqlite-js";

const db = await openDB("my-database", { debug: false });
```

### `filename: string`

If the filename does not end with `.sqlite3`, the extension is appended automatically.

### `options?: { debug?: boolean }`

- `debug`: Enables worker-side SQL timing logs via `console.debug`.

## `DBInterface`

The object returned by `openDB()`:

### `db.exec(sql, params?)`

Executes a SQL statement (or script) without returning rows.

```ts
const result = await db.exec("INSERT INTO users (name) VALUES (?)", ["Alice"]);
// result: { changes?: number | bigint; lastInsertRowid?: number | bigint }
```

### `db.query<T>(sql, params?)`

Executes a `SELECT` query and returns all rows as an array of objects.

```ts
type User = { id: number; name: string };
const users = await db.query<User>("SELECT id, name FROM users");
```

### `db.transaction(fn)`

Runs `fn` inside a transaction (`BEGIN` / `COMMIT`), and rolls back on error.

```ts
await db.transaction(async (tx) => {
    await tx.exec("INSERT INTO users (name) VALUES (?)", ["Alice"]);
    const rows = await tx.query<{ count: number }>(
        "SELECT COUNT(*) as count FROM users",
    );
    return rows[0]?.count ?? 0;
});
```

### `db.close()`

Closes the database connection.

```ts
await db.close();
```

## SQL parameters

Both `exec()` and `query()` accept:

- Positional parameters: `SqlValue[]`
- Named parameters: `Record<string, SqlValue>`

Supported `SqlValue` types:

- `null`, `number`, `string`, `boolean`, `bigint`
- `Uint8Array`, `ArrayBuffer`

## Errors

All methods reject with an `Error` coming from the worker, including `name`, `message`, and `stack` when available.
