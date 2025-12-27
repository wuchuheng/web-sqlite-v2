import sqlite3InitModule, { Sqlite3, Sqlite3DB } from "./jswasm/sqlite3";
import { ExecParams, ExecResult } from "./types/DB";
import {
  OpenDBArgs,
  SqliteEvent,
  SqliteReqMsg,
  SqliteResMsg,
} from "./types/message";
import { configureLogger, SqlLogInfo } from "./utils/logger";

/**
 * Type definition for the SQLite service dispatcher.
 */
export type SqliteService = (
  event: SqliteEvent,
  payload?: unknown,
) => Promise<unknown>;

/**
 * Creates a functional SQLite service instance.
 * Encapsulates the SQLite WASM state and provides handlers for database operations.
 *
 * @returns {SqliteService} A dispatcher function for the service.
 */
export const createSqliteService = (): SqliteService => {
  let db: Sqlite3DB | null = null;
  let sqlite3: Sqlite3 | null = null;

  /**
   * Opens the database.
   */
  const handleOpen = async (payload: OpenDBArgs): Promise<void> => {
    if (typeof payload.filename !== "string") {
      throw new Error("Invalid OPEN payload: expected filename string");
    }
    sqlite3 = await sqlite3InitModule();
    let { filename } = payload;
    if (!filename.endsWith(".sqlite3")) filename += ".sqlite3";
    configureLogger(payload.options?.debug === true);
    db = new sqlite3.oo1!.OpfsDb!(filename, "c");
  };

  /**
   * Executes SQL (non-query).
   */
  const handleExecute = (payload: unknown): ExecResult => {
    if (!db) throw new Error("Database is not open");
    const start = performance.now();
    const { sql, bind } = payload as ExecParams;
    db.exec({ sql, bind });
    const duration = performance.now() - start;
    console.debug({ sql, duration, bind } as SqlLogInfo);
    return {
      changes: db.changes(),
      lastInsertRowid: db.selectValue("SELECT last_insert_rowid()") as
        | number
        | bigint,
    };
  };

  /**
   * Executes SQL Query.
   */
  const handleQuery = (payload: ExecParams): unknown[] => {
    if (!db) throw new Error("Database is not open");
    const start = performance.now();
    const rows = db.selectObjects(payload.sql, payload.bind);
    const duration = performance.now() - start;
    console.debug({
      sql: payload.sql,
      duration,
      bind: payload.bind,
    } as SqlLogInfo);
    return rows;
  };

  /**
   * Closes the database.
   */
  const handleClose = (): void => {
    if (db) {
      db.close();
      sqlite3 = null;
      db = null;
    }
  };

  return async (event: SqliteEvent, payload?: unknown): Promise<unknown> => {
    if (sqlite3 === null && event !== SqliteEvent.OPEN) {
      throw new Error("Database is not open");
    }
    switch (event) {
      case SqliteEvent.OPEN:
        return handleOpen(payload as OpenDBArgs);
      case SqliteEvent.EXECUTE:
        return handleExecute(payload);
      case SqliteEvent.QUERY:
        return handleQuery(payload as ExecParams);
      case SqliteEvent.CLOSE:
        return handleClose();
      default:
        throw new Error(`Unknown event: ${event}`);
    }
  };
};

/**
 * Starts the worker-side listener for the SQLite service.
 */
export const startWorkerServer = (): void => {
  const dispatch = createSqliteService();
  self.onmessage = async (e: MessageEvent<SqliteReqMsg<unknown>>) => {
    const { id, event, payload } = e.data;
    try {
      const result = await dispatch(event, payload);
      self.postMessage({
        id,
        success: true,
        payload: result,
      } as SqliteResMsg<unknown>);
    } catch (err: unknown) {
      const error = err as Error;
      self.postMessage({
        id,
        success: false,
        error: { name: error.name, message: error.message, stack: error.stack },
      } as SqliteResMsg<void>);
    }
  };
};
