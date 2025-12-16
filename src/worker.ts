// sqlite3.worker.ts
import sqlite3InitModule, { Sqlite3DB } from "./jswasm/sqlite3";
import {
  SqliteEvent,
  type SqliteReqMsg,
  type SqliteResMsg,
} from "./types/message.d";

self.onmessage = async (msg: MessageEvent<SqliteReqMsg<unknown>>) => {
  let db: Sqlite3DB | null = null;
  const sqlite3 = await sqlite3InitModule();
  console.log(`Warder receive: `, msg.data);

  // 2.1 Handle OPEN event.
  if (msg.data.event === SqliteEvent.OPEN) {
    if (!msg.data.payload || typeof msg.data.payload !== "string") {
      throw new Error("Invalid payload for OPEN event");
    }
    let filename = msg.data.payload;
    // if the suffix is not ".sqlite3", append it.
    if (!filename.endsWith(".sqlite3")) {
      filename += ".sqlite3";
    }

    // Use OpfsDb if available, otherwise fallback to transient/memory
    db = new sqlite3!.oo1!.OpfsDb!(filename, "c");

    const res: SqliteResMsg<void> = {
      id: msg.data.id,
    };

    self.postMessage(res);
    return;
  }

  if (db === undefined) {
    throw new Error("Database is not opened");
  }
  console.log("Database state:", db!.state);
  if (db!.state !== "open") {
    throw new Error("Database is not opened");
  }

  // 2.2 Handle Execute event.
  if (msg.data.event === SqliteEvent.EXECUTE) {
    if (!msg.data.payload || typeof msg.data.payload !== "string") {
      throw new Error("Invalid payload for EXECUTE event");
    }
    const sql = msg.data.payload;

    db!.exec(sql);
  }

  // Create test table
  // db.exec(
  //   "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)",
  // );

  // if (sqlite3.opfs) {
  //   db = new sqlite3.opfs.OpfsDb(filename);
  //   console.log(`Opened OPFS database: ${filename}`);
  // } else {
  //   db = new sqlite3.oo1.DB(filename, "ct");
  //   console.log(`Opened transient database: ${filename}`);
  // }
  // self.postMessage({ id: req.id, type: "success", result: filename });
  //   } else if (req.type === "exec") {
  //     if (!db) throw new Error("db not opened");
  //     db.exec({ sql: req.sql, bind: req.bind });
  //     self.postMessage({ id: req.id, type: "success" });
  //   } else if (req.type === "query") {
  //     if (!db) throw new Error("db not opened");
  //     const rows: any[] = [];
  //     db.exec({
  //       sql: req.sql,
  //       bind: req.bind,
  //       rowMode: "object",
  //       callback: (row: any) => rows.push(row),
  //     });
  //     self.postMessage({ id: req.id, type: "success", result: rows });
  //   }
  // } catch (err: any) {
  //   console.error("Worker error:", err);
  //   self.postMessage({ id: req.id, type: "error", error: err.message });
  // }
};
