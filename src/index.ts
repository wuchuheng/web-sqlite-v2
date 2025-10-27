import type { SqliteWorkerI } from "./sqliteWorker.d";
import SqliteWorker from "./sqliteWorker?worker&inline";

// Local copy of message protocol identifiers for runtime use.
// Mirrors src/sqliteWorkder.d.ts but avoids importing .d.ts at runtime.
const Actions = {
  Open: 0,
  Close: 1,
  Sql: 2,
} as const;

type ActionCode = (typeof Actions)[keyof typeof Actions];

type RequestMessage<T> = {
  action: ActionCode;
  messageId: number;
  payload: T;
};

type ResponseMessage<T> = {
  action: ActionCode;
  messageId: number;
  success: boolean;
  payload: T;
  error?: string;
  errorStack?: string[];
};

/**
 * Open a SQLite database and return a SqliteWorker-compatible adapter.
 * Implementations may create or connect to a database stored in OPFS or
 * memory, and may run on the main thread or in a Worker.
 *
 * Example
 * ```ts
 * const db = await open("users.db");
 * const users = await db.sql<{ id: number; name: string }>(
 *   "SELECT id, name FROM users",
 * );
 * await db.close();
 * ```
 *
 * Transaction example
 * ```ts
 * await db.transaction(async (tx) => {
 *   await tx.sql("CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY, title TEXT)");
 *   await tx.sql("INSERT INTO todos (title) VALUES ('Learn SQLite WASM')");
 *   const rows = await tx.sql<{ id: number; title: string }>(
 *     "SELECT id, title FROM todos ORDER BY id DESC",
 *   );
 *   console.log("Rows:", rows.length);
 * });
 * ```
 *
 * Events example
 * ```ts
 * db.on("log", (msg) => console.log("[db]", msg));
 * db.on("error", (err) => console.error("DB error:", err));
 * ```
 *
 * @param dbName - Database name or path, adapter dependent
 * @returns Promise resolving to a {@link SqliteWorkerI} instance
 */
const open = async (dbName: string): Promise<SqliteWorkerI> => {
  const sqliteWorker = new SqliteWorker();

  sqliteWorker.onmessage = (event) => {
    const message = event.data as ResponseMessage<unknown>;
    console.log("Received message from worker:", message);
  };

  let latestMessageId = 0;

  const requestArgs: RequestMessage<string> = {
    action: Actions.Open,
    messageId: ++latestMessageId,
    payload: dbName,
  };

  sqliteWorker.postMessage(requestArgs);

  // placeholder second post to exercise handler safety in dev
  sqliteWorker.postMessage({});

  await sleep(60 * 1000);
  throw new Error("Not implemented: open()");
};

export default open;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
