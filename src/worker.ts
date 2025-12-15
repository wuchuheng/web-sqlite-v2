// sqlite3.worker.ts
import sqlite3InitModule from "./sqlite3";

type RpcReq =
  | { id: number; type: "init" }
  | { id: number; type: "open"; filename?: string }
  | { id: number; type: "exec"; sql: string; bind?: unknown }
  | { id: number; type: "query"; sql: string; bind?: unknown };

type RpcRes =
  | { id: number; ok: true; data?: unknown }
  | {
      id: number;
      ok: false;
      error: { name: string; message: string; stack?: string };
    };

let sqlite3: Awaited<ReturnType<typeof sqlite3InitModule>> | null = null;
let db: InstanceType<
  NonNullable<NonNullable<typeof sqlite3>["oo1"]>["DB"]
> | null = null;

function serializeError(e: unknown): RpcRes["error"] {
  if (e instanceof Error)
    return { name: e.name, message: e.message, stack: e.stack };
  return { name: "Error", message: String(e) };
}

self.onmessage = async (ev: MessageEvent<RpcReq>) => {
  const req = ev.data;

  try {
    if (req.type === "init") {
      sqlite3 = await sqlite3InitModule();
      await sqlite3.asyncPostInit(); // important: finishes async pieces (vfs/opfs/etc.)
      console.log("init sqlite3");
      return;
    }

    if (!sqlite3)
      throw new Error("Worker not initialized. Call {type:'init'} first.");

    if (req.type === "open") {
      db = new sqlite3.oo1!.DB("file:///test.db?vfs=opfs", "c");
      debugger;
    }

    if (!db) throw new Error("DB not opened. Call {type:'open'} first.");

    if (req.type === "exec") {
      // exec is great for DDL / inserts / updates
      db.exec({ sql: req.sql, bind: req.bind as unknown });
      (self as DedicatedWorkerGlobalScope).postMessage({
        id: req.id,
        ok: true,
      } satisfies RpcRes);
      return;
    }

    if (req.type === "query") {
      // collect rows as objects
      const rows = db.exec<{ [k: string]: unknown }>({
        sql: req.sql,
        bind: req.bind as unknown,
        rowMode: "object",
        returnValue: "resultRows",
      });
      (self as DedicatedWorkerGlobalScope).postMessage({
        id: req.id,
        ok: true,
        data: rows,
      } satisfies RpcRes);
      return;
    }

    throw new Error(`Unknown request type: ${(req as { type?: string }).type}`);
  } catch (e) {
    (self as DedicatedWorkerGlobalScope).postMessage({
      id: req.id,
      ok: false,
      error: serializeError(e),
    } satisfies RpcRes);
  }
};
