// sqlite3.worker.ts
import sqlite3InitModule, { type Sqlite3, Sqlite3DB } from "./sqlite3";

type RpcReq =
  | { id: number; type: "init" }
  | { id: number; type: "open"; filename?: string }
  | { id: number; type: "exec"; sql: string; bind?: unknown }
  | { id: number; type: "query"; sql: string; bind?: unknown };

let sqlite3: Sqlite3;
let db: Sqlite3DB;

self.onmessage = async (_: MessageEvent<RpcReq>) => {
  sqlite3 = await sqlite3InitModule();
  // await sqlite3.asyncPostInit(); // important: finishes async pieces (vfs/opfs/etc.)

  const filename = "db.sqlite3";
  // Use OpfsDb if available, otherwise fallback to transient/memory
  db = new sqlite3!.oo1!.OpfsDb!(filename, "c");

  // Create test table
  db.exec(
    "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)",
  );

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
