import { OpenDBArgs, SqliteEvent, WorkerOpenDBOptions } from "./types/message";
import { createWorkerBridge } from "./worker-bridge";
import type {
  DBInterface,
  SQLParams,
  PreparedStatement,
  ExecResult,
} from "./types/DB";

/**
 * Opens a SQLite database connection.
 *
 * @param filename - The path to the SQLite database file to open.
 * @param options - Optional configuration options for opening the database.
 * @returns A promise that resolves to a DBInterface object providing methods to interact with the database.
 *
 * @example
 * ```typescript
 * const db = await openDB('./mydata.db');
 * const results = await db.query('SELECT * FROM users');
 * await db.close();
 * ```
 */
export const openDB = async (
  filename: string,
  options?: WorkerOpenDBOptions,
): Promise<DBInterface> => {
  const { sendMsg, terminate: _terminate } = createWorkerBridge();

  await sendMsg<void, OpenDBArgs>(SqliteEvent.OPEN, { filename, options });

  const exec = async (sql: string): Promise<void> => {
    await sendMsg<void, string>(SqliteEvent.EXECUTE, sql);
  };

  /**
   * Run a SQL statement (INSERT, UPDATE, DELETE, etc.).
   * @param _sql
   * @param _params
   * @returns
   */
  const run = async (
    _sql: string,
    _params?: SQLParams,
  ): Promise<ExecResult> => {
    return await sendMsg<ExecResult, { sql: string; bind?: SQLParams }>(
      SqliteEvent.RUN,
      { sql: _sql, bind: _params },
    );
  };
  /**
   * Execute a query and return all rows.
   */
  const query = async <T = unknown>(
    _sql: string,
    _params?: SQLParams,
  ): Promise<T[]> => {
    // TODO: Implement transaction logic
    throw new Error("Method not implemented.");
  };

  /**
   * Execute a query and return the first row.
   */
  const get = <T = unknown>(
    _sql: string,
    _params?: SQLParams,
  ): Promise<T | undefined> => {
    // TODO: Implement transaction logic
    throw new Error("Method not implemented.");
  };
  const prepare = <T = unknown>(
    _sql: string,
    _fn?: (stmt: PreparedStatement) => Promise<T>,
  ): Promise<PreparedStatement | T> => {
    // TODO: Implement transaction logic
    throw new Error("Method not implemented.");
  };

  /**
   * Execute a transaction.
   */
  const transaction = async <T>(
    _fn: (db: DBInterface) => Promise<T>,
  ): Promise<T> => {
    // TODO: Implement transaction logic
    throw new Error("Method not implemented.");
  };

  /**
   * Close the database connection.
   */
  const close = async (): Promise<void> => {
    await sendMsg(SqliteEvent.CLOSE);
  };
  const db: DBInterface = {
    exec,
    run,
    query,
    get,
    prepare,
    transaction,
    close,
  };

  return db;
};

export default openDB;
