// sqlite3.worker.ts
import sqlite3InitModule, {
  type Sqlite3,
  Sqlite3DB,
  type BindCollection,
} from "./jswasm/sqlite3";
import {
  SqliteEvent,
  type SqliteReqMsg,
  type SqliteResMsg,
} from "./types/message";

let db: Sqlite3DB | null = null;
let sqlite3: Sqlite3 | null = null;

// Initialize sqlite3 module once
const initPromise = sqlite3InitModule().then((mod) => {
  sqlite3 = mod;
  console.log("SQLite3 module initialized");
});

const handleOpen = (payload: unknown) => {
  if (typeof payload !== "string") {
    throw new Error("Invalid payload for OPEN event: expected filename string");
  }
  let filename = payload;
  if (!filename.endsWith(".sqlite3")) {
    filename += ".sqlite3";
  }

  if (sqlite3!.oo1 && sqlite3!.oo1.OpfsDb) {
    db = new sqlite3!.oo1.OpfsDb(filename, "c");
    console.log(`Opened OPFS database: ${filename}`);
  } else {
    // Fallback logic
    db = new sqlite3!.oo1!.DB(filename, "ct");
    console.log(`Opened transient database: ${filename}`);
  }
};

const handleExecute = (payload: unknown) => {
  if (!db) {
    throw new Error("Database is not open");
  }
  if (typeof payload !== "string") {
    throw new Error("Invalid payload for EXECUTE event: expected SQL string");
  }
  db.exec(payload);
};

const handleRun = (payload: unknown) => {
  if (!db) {
    throw new Error("Database is not open");
  }

  const { sql, bind } = payload as { sql: string; bind?: BindCollection };

  if (typeof sql !== "string") {
    throw new Error("Invalid payload for RUN event: expected { sql: string }");
  }

  db.exec({
    sql,
    bind,
  });

  return {
    changes: db.changes(),
    lastInsertRowid: db.selectValue("SELECT last_insert_rowid()"),
  };
};

const handleClose = () => {
  if (db) {
    db.close();
    db = null;
  }
};

self.onmessage = async (msg: MessageEvent<SqliteReqMsg<unknown>>) => {
  const { id, event, payload } = msg.data;

  try {
    await initPromise;

    let result: unknown = undefined;

    switch (event) {
      case SqliteEvent.OPEN:
        handleOpen(payload);
        break;

      case SqliteEvent.EXECUTE:
        handleExecute(payload);
        break;

      case SqliteEvent.RUN:
        result = handleRun(payload);
        break;

      case SqliteEvent.CLOSE:
        handleClose();
        break;

      default:
        throw new Error(`Unknown event: ${event}`);
    }

    const res: SqliteResMsg<unknown> = {
      id,
      success: true,
      payload: result,
    };
    self.postMessage(res);
  } catch (err) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const res: SqliteResMsg<void> = {
      id,
      success: false,
      error: {
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack,
      } as Error,
    };
    self.postMessage(res);
  }
};
