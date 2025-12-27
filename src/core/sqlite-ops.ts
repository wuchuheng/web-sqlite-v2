/**
 * Core SQLite operations.
 * This module provides functional operations for interacting with SQLite WASM,
 * maintaining an immutable-like context for database state.
 */

import sqlite3InitModule, { Sqlite3, Sqlite3DB } from "../jswasm/sqlite3";
import { ExecParams, ExecResult } from "../types/DB";
import { OpenDBArgs, SqliteEvent } from "../types/message";
import { configureLogger, SqlLogInfo } from "../utils/logger";
import wasmGzUrl from "../jswasm/sqlite3.wasm.gz?url";

export interface SqliteContext {
  db: Sqlite3DB | null;
  sqlite3: Sqlite3 | null;
  isDebug: boolean;
}

/**
 * Creates an initial SQLite context.
 */
export const createSqliteContext = (): SqliteContext => {
  configureLogger(false);
  return {
    db: null,
    sqlite3: null,
    isDebug: false,
  };
};

/**
 * Custom WASM loader to handle runtime decompression.
 */
const instantiateDecompressedWasm = async (
  imports: WebAssembly.Imports,
  onSuccess: (
    instance: WebAssembly.Instance,
    module: WebAssembly.Module,
  ) => void,
) => {
  const response = await fetch(wasmGzUrl);
  if (!response.body)
    throw new Error("Failed to fetch WASM: Response body is null");

  const decompressedStream = response.body.pipeThrough(
    new DecompressionStream("gzip"),
  );
  const buffer = await new Response(decompressedStream).arrayBuffer();

  const { instance, module } = await WebAssembly.instantiate(buffer, imports);
  onSuccess(instance, module);
};

/**
 * Opens a SQLite database.
 */
export const openSqlite = async (
  context: SqliteContext,
  payload: OpenDBArgs,
): Promise<SqliteContext> => {
  if (context.db) throw new Error("Database is already open");
  if (typeof payload.filename !== "string") {
    throw new Error("Invalid payload: filename must be a string");
  }

  const sqlite3 = await sqlite3InitModule({
    instantiateWasm: instantiateDecompressedWasm,
  });

  let { filename } = payload;
  if (filename !== ":memory:" && !filename.endsWith(".sqlite3")) {
    filename += ".sqlite3";
  }

  const isDebug = !!payload.options?.debug;
  configureLogger(isDebug);

  const isOpfsSupported = !!sqlite3.oo1?.OpfsDb;
  const useOpfs = isOpfsSupported && filename !== ":memory:";

  const db = useOpfs
    ? new sqlite3.oo1!.OpfsDb!(filename, "c")
    : new sqlite3.oo1!.DB!(filename, "c");

  console.debug(
    `Opened database: ${filename} (mode: ${useOpfs ? "OPFS" : "Memory/Standard"})`,
  );

  return { sqlite3, db, isDebug };
};

/**
 * Executes a SQL statement.
 */
export const executeSqlite = (
  context: SqliteContext,
  { sql, bind }: ExecParams,
): ExecResult => {
  if (!context.db) throw new Error("Database is not open");

  const start = performance.now();
  context.db.exec({ sql, bind });

  console.debug({
    sql,
    duration: performance.now() - start,
    bind,
  } as SqlLogInfo);

  return {
    changes: context.db.changes(),
    lastInsertRowid: context.db.selectValue(
      "SELECT last_insert_rowid()",
    ) as ExecResult["lastInsertRowid"],
  };
};

/**
 * Executes a SQL query and returns rows.
 */
export const querySqlite = <T = unknown>(
  context: SqliteContext,
  { sql, bind }: ExecParams,
): T[] => {
  if (!context.db) throw new Error("Database is not open");

  const start = performance.now();
  const rows = context.db.selectObjects(sql, bind) as T[];

  console.debug({
    sql,
    duration: performance.now() - start,
    bind,
  } as SqlLogInfo);

  return rows;
};

/**
 * Closes the database connection.
 */
export const closeSqlite = (context: SqliteContext): SqliteContext => {
  context.db?.close();
  return { ...context, db: null, sqlite3: null };
};

/**
 * Checks if the database is open.
 */
export const isSqliteReady = (context: SqliteContext): boolean => {
  return !!context.sqlite3 && !!context.db;
};

/**
 * Dispatches a SQLite event to the appropriate handler.
 */
export const dispatchSqliteEvent = async (
  context: SqliteContext,
  event: SqliteEvent,
  payload: unknown,
): Promise<{ result: unknown; nextContext: SqliteContext }> => {
  if (!isSqliteReady(context) && event !== SqliteEvent.OPEN) {
    throw new Error(`Cannot handle ${event}: Database is not open`);
  }

  let result: unknown;
  let nextContext = context;

  switch (event) {
    case SqliteEvent.OPEN:
      nextContext = await openSqlite(context, payload as OpenDBArgs);
      break;
    case SqliteEvent.EXECUTE:
      result = executeSqlite(context, payload as ExecParams);
      break;
    case SqliteEvent.QUERY:
      result = querySqlite(context, payload as ExecParams);
      break;
    case SqliteEvent.CLOSE:
      nextContext = closeSqlite(context);
      break;
    default:
      throw new Error(`Unknown event: ${event}`);
  }

  return { result, nextContext };
};
