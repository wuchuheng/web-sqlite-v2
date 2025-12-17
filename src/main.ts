import { OpenDBArgs, SqliteEvent, WorkerOpenDBOptions } from "./types/message";
import { createWorkerBridge } from "./worker-bridge";
import type {
  DBInterface,
  SQLParams,
  PreparedStatement,
  ExecResult,
  ExecParams,
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

  const exec = async (sql: string, params?: SQLParams): Promise<ExecResult> => {
    return await sendMsg<ExecResult, ExecParams>(SqliteEvent.EXECUTE, {
      sql,
      bind: params,
    });
  };

  /**
   * Execute a query and return all rows.
   */
  const query = async <T = unknown>(
    sql: string,
    params?: SQLParams,
  ): Promise<T[]> => {
    // 1. Handle input.
    if (typeof sql !== "string" || sql.trim() === "") {
      throw new Error("SQL query must be a non-empty string");
    }

    return await sendMsg<T[], ExecParams>(SqliteEvent.QUERY, {
      sql,
      bind: params,
    });
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
    query,
    transaction,
    prepare: function <T = unknown>(
      _sql: string,
      _fn: (stmt: PreparedStatement) => Promise<T>,
    ): Promise<T> {
      throw new Error("Function not implemented.");
    },
    close,
  };

  return db;
};

export default openDB;
