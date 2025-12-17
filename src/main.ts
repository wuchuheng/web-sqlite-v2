import { OpenDBArgs, SqliteEvent, WorkerOpenDBOptions } from "./types/message";
import { createWorkerBridge } from "./worker-bridge";
import type {
  DBInterface,
  SQLParams,
  PreparedStatement,
  ExecResult,
} from "./types/DB";

/**
 * Open a SQLite database file.
 *
 * @param filename - The arguments for opening the database. Can be a string (file path) or an object with a fileName property.
 * @returns A promise that resolves to a DBInterface instance.
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
  const run = async (
    _sql: string,
    _params?: SQLParams,
  ): Promise<ExecResult> => {
    return await sendMsg<ExecResult, { sql: string; bind?: SQLParams }>(
      SqliteEvent.RUN,
      { sql: _sql, bind: _params },
    );
  };
  const query = async <T = unknown>(
    _sql: string,
    _params?: SQLParams,
  ): Promise<T[]> => {
    throw new Error("Method not implemented.");
  };
  const get = <T = unknown>(
    _sql: string,
    _params?: SQLParams,
  ): Promise<T | undefined> => {
    throw new Error("Method not implemented.");
  };
  const prepare = <T = unknown>(
    _sql: string,
    _fn?: (stmt: PreparedStatement) => Promise<T>,
  ): Promise<PreparedStatement | T> => {
    throw new Error("Method not implemented.");
  };
  const transaction = async <T>(
    _fn: (db: DBInterface) => Promise<T>,
  ): Promise<T> => {
    throw new Error("Method not implemented.");
  };
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
