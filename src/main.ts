import { OpenDBArgs, SqliteEvent, WorkerOpenDBOptions } from "./types/message";
import { createWorkerBridge } from "./worker-bridge";
import { createMutex } from "./utils/mutex/mutex";
import type {
  DBInterface,
  SQLParams,
  ExecResult,
  ExecParams,
  transactionCallback,
} from "./types/DB";
import { abilityCheck } from "./validations/shareBufferAbiliCheck";
import { createLocalBridge } from "./local-bridge";
import { runWorker } from "./core/worker-runner";

// Auto-run worker if we are in a sub-worker thread
if (
  typeof self !== "undefined" &&
  typeof self.location !== "undefined" &&
  self.location.search.includes("worker-thread")
) {
  runWorker();
}

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
  // 1. Handle input.
  // 1.1 Validate ShareArrayBuffer ability.
  abilityCheck();

  const isWorkerAvailable = typeof Worker !== "undefined";
  const isWindow = typeof window !== "undefined";
  const isAlreadyWorker =
    !isWindow &&
    (typeof globalThis.WorkerGlobalScope !== "undefined" ||
      (typeof self !== "undefined" &&
        typeof (self as unknown as { ServiceWorkerGlobalScope: unknown })
          .ServiceWorkerGlobalScope !== "undefined"));
  // Use worker mode if workers are available and we are not already in a worker context.
  // We prefer worker mode in standard browser windows.
  const useWorkerMode = isWorkerAvailable && !isAlreadyWorker;

  if (!useWorkerMode && options?.debug) {
    console.warn(
      `[web-sqlite-js] ${
        isAlreadyWorker
          ? "Running inside a worker/service-worker."
          : "Worker is not supported."
      } Using same-thread execution.`,
    );
  }

  const { sendMsg, terminate: _terminate } = useWorkerMode
    ? createWorkerBridge(import.meta.url)
    : createLocalBridge();

  const runMutex = createMutex();

  await sendMsg<void, OpenDBArgs>(SqliteEvent.OPEN, { filename, options });

  // Internal helper to send EXECUTE messages without locking (for use inside transaction/lock)
  const _exec = async (
    sql: string,
    params?: SQLParams,
  ): Promise<ExecResult> => {
    return await sendMsg<ExecResult, ExecParams>(SqliteEvent.EXECUTE, {
      sql,
      bind: params,
    });
  };

  // Internal helper to send QUERY messages without locking
  const _query = async <T = unknown>(
    sql: string,
    params?: SQLParams,
  ): Promise<T[]> => {
    if (typeof sql !== "string" || sql.trim() === "") {
      throw new Error("SQL query must be a non-empty string");
    }
    return await sendMsg<T[], ExecParams>(SqliteEvent.QUERY, {
      sql,
      bind: params,
    });
  };

  const exec = async (sql: string, params?: SQLParams): Promise<ExecResult> => {
    return runMutex(() => _exec(sql, params));
  };

  /**
   * Execute a query and return all rows.
   */
  const query = async <T = unknown>(
    sql: string,
    params?: SQLParams,
  ): Promise<T[]> => {
    return runMutex(() => _query<T>(sql, params));
  };

  /**
   * Execute a transaction.
   */
  const transaction = async <T>(fn: transactionCallback<T>): Promise<T> => {
    return runMutex(async () => {
      await _exec("BEGIN");
      try {
        const result = await fn({
          exec: _exec,
          query: _query,
        });
        await _exec("COMMIT");
        return result;
      } catch (error) {
        await _exec("ROLLBACK");
        throw error;
      }
    });
  };

  /**
   * Close the database connection.
   */
  const close = async (): Promise<void> => {
    return runMutex(async () => {
      await sendMsg(SqliteEvent.CLOSE);
      // We don't terminate the worker bridge immediately here as sendMsg might be finishing?
      // Actually sendMsg awaits response.
    });
  };

  const db: DBInterface = {
    exec,
    query,
    transaction,
    close,
  };

  return db;
};

export default openDB;
