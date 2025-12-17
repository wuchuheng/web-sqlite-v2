// sqlite3.worker.ts
import sqlite3InitModule, { Sqlite3, Sqlite3DB } from "./jswasm/sqlite3";
import { ExecParams } from "./types/DB";
import {
  OpenDBArgs,
  SqliteEvent,
  type SqliteReqMsg,
  type SqliteResMsg,
} from "./types/message";

import { configureLogger, SqlLogInfo } from "./utils/logger";

let db: Sqlite3DB | null = null;
let sqlite3: Sqlite3 | null = null;
let isDebug = false;

// Initial call to set up the logger state (starts disabled)
configureLogger(isDebug);

// sqlite3InitModuleState = Object.assign(sqlite3InitModuleState || {}, {
//   debugModule: (...args: readonly unknown[]) => {
//     console.log("[sIMS Debug]", ...args);
//   },
// } as Partial<Sqlite3InitModuleState>);

const handleOpen = async (payload: OpenDBArgs) => {
  if (typeof payload.filename !== "string") {
    throw new Error("Invalid payload for OPEN event: expected filename string");
  }

  sqlite3 = await sqlite3InitModule();
  console.debug(`Initialized sqlite3 module in worker.`);

  let { filename } = payload;
  if (!filename.endsWith(".sqlite3")) {
    filename += ".sqlite3";
  }

  isDebug = payload.options?.debug === true;
  // Re-configure logger based on the new isDebug state from user options
  configureLogger(isDebug);

  db = new sqlite3!.oo1!.OpfsDb!(filename, "c");
  console.debug(`Opened database: ${filename}`);
};

const handleExecute = (payload: unknown) => {
  if (!db) {
    throw new Error("Database is not open");
  }
  const start = performance.now();
  const { sql, bind } = payload as ExecParams;
  if (typeof sql !== "string") {
    throw new Error(
      "Invalid payload for EXECUTE event: expected SQL string or { sql, bind }",
    );
  }
  db.exec({ sql, bind });
  const end = performance.now();
  const duration = end - start;
  console.debug({ sql, duration, bind } as SqlLogInfo);
  return {
    changes: db.changes(),
    lastInsertRowid: db.selectValue("SELECT last_insert_rowid()"),
  };
};

const handleQuery = (payload: ExecParams) => {
  // 1. Handle input.
  if (!db) {
    throw new Error("Database is not open");
  }

  const { sql, bind } = payload;

  // 2. Handle query.
  // 2.1 Convert the sql and bind into a proper format. then execute the query.
  if (typeof sql !== "string") {
    throw new Error(
      "Invalid payload for QUERY event: expected { sql: string, bind?: any[] }",
    );
  }

  const start = performance.now();
  const rows = db.selectObjects(sql, bind);

  const end = performance.now();
  const duration = end - start;

  console.debug({
    sql,
    duration,
    bind,
  } as SqlLogInfo);

  return rows;
};

const handleClose = () => {
  if (db) {
    db.close();
    sqlite3 = null;
    db = null;
  }
};

self.onmessage = async (msg: MessageEvent<SqliteReqMsg<unknown>>) => {
  const { id, event, payload } = msg.data;

  try {
    if (sqlite3 === null && event !== SqliteEvent.OPEN) {
      throw new Error("Database is not open");
    }

    let result: unknown = undefined;

    switch (event) {
      case SqliteEvent.OPEN:
        await handleOpen(payload as OpenDBArgs);
        break;

      case SqliteEvent.EXECUTE:
        result = handleExecute(payload);
        break;

      case SqliteEvent.QUERY:
        result = handleQuery(payload as ExecParams);
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
