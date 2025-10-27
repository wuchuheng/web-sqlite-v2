import sqlite3InitModule, { type SQLite3API } from "./jswasm/sqlite3";

type AnyObject = Record<string, unknown>;

// Local action codes mirror the declaration-only enum in sqliteWorkder.d.ts.
// Numeric values map as: 0 = Open, 1 = Close, 2 = Sql.
const ActionCodes = {
  Open: 0,
  Close: 1,
  Sql: 2,
} as const;

type ActionName = keyof typeof ActionCodes;
type ActionValue = (typeof ActionCodes)[ActionName];

type RequestMessage<T> = {
  action: ActionValue | ActionName;
  messageId: number;
  payload: T;
};

type ResponseMessage<T> = {
  action: RequestMessage<unknown>["action"];
  messageId: number;
  success: boolean;
  payload?: T;
  error?: string;
  errorStack?: string[];
};

let sqlite: Awaited<ReturnType<typeof sqlite3InitModule>>;
let db: InstanceType<SQLite3API["oo1"]["DB"]> | undefined;
let dbId: string | undefined;

function normalizeAction(
  a: RequestMessage<unknown>["action"],
): ActionValue | null {
  // 1. Input validation
  if (typeof a === "string")
    return (ActionCodes as AnyObject)[a] as ActionValue;
  if (typeof a === "number") return a as ActionValue;

  // 3. Output
  return null;
}

async function ensureSqliteReady() {
  // 1. Input: no params

  // 2. Processing: init on demand
  if (!sqlite) {
    sqlite = await sqlite3InitModule();
  }

  // 3. Output: none
}

function respond<T>(msg: ResponseMessage<T>) {
  // 1. Input validation
  // (Assume basic shape is valid; guarded at call sites.)

  // 2. Processing
  (self as unknown as { postMessage: (d: unknown) => void }).postMessage(msg);

  // 3. Output: none
}

async function handleOpen(req: RequestMessage<string>) {
  // 1. Input validation
  const name = (req?.payload ?? ":memory:") as string;
  if (!name || typeof name !== "string") {
    respond<void>({
      action: req.action,
      messageId: req.messageId,
      success: false,
      error: "Invalid payload for Open: expected non-empty string",
    });
    return;
  }

  const dbName = `file:///${req.payload}?vfs=opfs`;

  try {
    // 2. Processing: init module and open DB
    await ensureSqliteReady();
    db = new sqlite.oo1.DB(dbName);

    respond({
      action: req.action,
      messageId: req.messageId,
      success: true,
      payload: {
        id: dbId,
        filename: db.filename,
        vfs: typeof db.dbVfsName === "function" ? db.dbVfsName() : undefined,
      },
    });
  } catch (err) {
    // 3. Output: error response
    const e = err as Error;
    throw e;
    respond({
      action: req.action,
      messageId: req.messageId,
      success: false,
      error: e.message,
      errorStack:
        typeof e.stack === "string" ? e.stack.split(/\n\s*/) : undefined,
    });
  }
}

async function handleSql(req: RequestMessage<string>) {
  // 1. Input validation
  const sql = req?.payload;
  if (!db) {
    respond({
      action: req.action,
      messageId: req.messageId,
      success: false,
      payload: null as unknown as never,
      error: "No open database. Call Open first.",
    });
    return;
  }
  if (!sql || typeof sql !== "string") {
    respond({
      action: req.action,
      messageId: req.messageId,
      success: false,
      payload: null as unknown as never,
      error: "Invalid payload for Sql: expected SQL string",
    });
    return;
  }

  try {
    // 2. Processing: exec and collect rows
    const rc = db.exec(sql, {
      rowMode: "object",
      returnValue: "resultRows",
      multi: true,
    });
    const rows = (rc && rc.resultRows) || [];

    // 3. Output
    respond({
      action: req.action,
      messageId: req.messageId,
      success: true,
      payload: { rows } as { rows: Record<string, unknown>[] },
    });
  } catch (err) {
    const e = err as Error;
    respond({
      action: req.action,
      messageId: req.messageId,
      success: false,
      payload: null as unknown as never,
      error: e.message,
      errorStack:
        typeof e.stack === "string" ? e.stack.split(/\n\s*/) : undefined,
    });
  }
}

async function handleClose(
  req: RequestMessage<{ unlink?: boolean } | undefined>,
) {
  // 1. Input validation
  const unlink = !!(req?.payload && (req.payload as AnyObject)["unlink"]);
  const filename = db?.filename;

  try {
    // 2. Processing: close and cleanup
    if (db) {
      try {
        db.close();
      } finally {
        db = undefined;
        dbId = undefined;
      }
    }

    // Note: Unlink behavior handled by OPFS wrappers when supported; omitted here.

    // 3. Output
    respond({
      action: req.action,
      messageId: req.messageId,
      success: true,
      payload: { filename, unlinked: unlink },
    });
  } catch (err) {
    const e = err as Error;
    respond({
      action: req.action,
      messageId: req.messageId,
      success: false,
      payload: null as unknown as never,
      error: e.message,
      errorStack:
        typeof e.stack === "string" ? e.stack.split(/\n\s*/) : undefined,
    });
  }
}

self.addEventListener(
  "message",
  (ev: MessageEvent<RequestMessage<unknown>>) => {
    // 1. Input validation
    const data = ev?.data as RequestMessage<unknown>;
    if (!data || typeof data !== "object") return;
    const action = normalizeAction(data.action);
    if (action === null) return;

    // 2. Processing: dispatch
    switch (action) {
      case ActionCodes.Open:
        void handleOpen(data as RequestMessage<string>);
        break;
      case ActionCodes.Sql:
        void handleSql(data as RequestMessage<string>);
        break;
      case ActionCodes.Close:
        void handleClose(
          data as RequestMessage<{ unlink?: boolean } | undefined>,
        );
        break;
      default:
        respond({
          action: data.action,
          messageId: data.messageId,
          success: false,
          payload: null as unknown as never,
          error: `Unknown action: ${String(data.action)}`,
        });
    }

    // 3. Output: handled within action responses
  },
);
