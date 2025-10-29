```ts
/**
 * Minimal, friendly SQLite worker interface.
 * Interface-only; an adapter may run on the main thread or in a Worker.
 */
export interface SqliteWorker {
    /**
     * Stable instance identity.
     * - Maps to a worker dbId in Worker adapters.
     * - Useful for logging and multiplexing multiple DBs.
     */
    readonly id: string;

    /**
     * Execute a read query and return typed rows.
     * - Intended for SELECT or CTE statements.
     * - Generic T is the row shape when consuming as objects.
     * - Rejects on SQL errors.
     * - Some adapters may accept non-SELECT statements and resolve to [] for mutations; prefer
     *   transaction() when grouping changes.
     *
     * @typeParam T - Row shape (e.g., { id: number; name: string })
     * @param query SQL string to execute
     * @returns Promise resolving to the result rows
     */
    sql<T>(query: string): Promise<T[]>;

    /**
     * Run a function within a transaction boundary.
     * - Begins a transaction, runs `fn`, and commits on resolve.
     * - Rolls back if `fn` throws or rejects.
     * - Returns the value resolved by `fn`.
     *
     * @typeParam T - Return type of the callback
     * @param fn Callback receiving this SqliteWorker instance
     * @returns Promise resolving to the callback's return value
     */
    transaction<T>(fn: (db: SqliteWorker) => Promise<T> | T): Promise<T>;

    /**
     * Export the current database contents as a byte array.
     * - Useful for backups, downloads, or migrations.
     *
     * @returns Promise with database bytes (SQLite file format)
     */
    export(): Promise<Uint8Array>;

    /**
     * Import database bytes, replacing current contents.
     * - Implementations may require the DB to be newly opened or idle.
     *
     * @param bytes SQLite database bytes to load
     * @returns Promise that resolves when import completes
     */
    import(bytes: ArrayBufferView | ArrayBuffer): Promise<void>;

    /**
     * Close the database connection.
     * - When `unlink` is true and the VFS supports it (e.g., OPFS), the underlying file is removed.
     *
     * @param options.unlink Delete persistent storage after close if supported
     * @returns Promise that resolves when closed
     */
    close(options?: { unlink?: boolean }): Promise<void>;

    /**
     * Subscribe to lifecycle and diagnostic events.
     * - "ready"  → adapter is initialized
     * - "open"   → database opened
     * - "close"  → database closed
     * - "error"  → error occurred (handler receives Error or message)
     * - "row"    → row streamed (handler may receive row and index)
     * - "log"    → diagnostic message (handler receives string or payload)
     *
     * @param event Event name
     * @param handler Listener function
     */
    on(
        event: "ready" | "open" | "close" | "error" | "row" | "log",
        handler: (...args: unknown[]) => void,
    ): void;
}
```

Example usage

```ts
// Adapter-provided open() should return SqliteWorker
const db = await open("users.db");
const users = await db.sql<{ id: number; name: string }>(
    "SELECT id, name FROM users",
);
await db.close();
```

Transaction example

```ts
await db.transaction(async (tx) => {
    // Create table and insert within the same atomic block
    await tx.sql(
        "CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY, title TEXT)",
    );
    await tx.sql("INSERT INTO todos (title) VALUES ('Learn SQLite WASM')");

    // Read rows inside the transaction
    const rows = await tx.sql<{ id: number; title: string }>(
        "SELECT id, title FROM todos ORDER BY id DESC",
    );
    console.log("Rows:", rows.length);
});
```

Events example

```ts
db.on("log", (msg) => console.log("[db]", msg));
db.on("error", (err) => console.error("DB error:", err));
```
