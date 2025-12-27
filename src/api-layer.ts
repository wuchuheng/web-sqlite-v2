import {
  DBInterface,
  ExecParams,
  ExecResult,
  SQLParams,
  transactionCallback,
} from "./types/DB";
import { SqliteEvent, SqliteReqMsg, SqliteResMsg } from "./types/message";
import { isSameThreadRequired, WORKER_NAME } from "./env";
import { createSqliteService, SqliteService } from "./service-end";
import { createMutex } from "./utils/mutex/mutex";

/**
 * Internal interface for the messaging implementation.
 */
interface Connection {
  sendMsg<TRes, TReq = unknown>(
    event: SqliteEvent,
    payload?: TReq,
  ): Promise<TRes>;
  terminate(): void;
}

/**
 * Creates a connection to a local SQLite service (Same-Thread).
 */
const createLocalConnection = (service: SqliteService): Connection => ({
  sendMsg: async <TRes>(event: SqliteEvent, payload: unknown) => {
    return (await service(event, payload)) as TRes;
  },
  terminate: () => {},
});

/**
 * Creates a connection to a Worker-based SQLite service.
 * Handles cross-origin URLs (CDNs) by using a Blob wrapper.
 */
const createWorkerConnection = (workerUrl: string): Connection => {
  let finalWorkerUrl = workerUrl;
  let isBlobUrl = false;
  let isTerminated = false;

  // Handle Cross-Origin (CDN) worker loading
  try {
    const targetOrigin = new URL(workerUrl, globalThis.location.href).origin;
    if (targetOrigin !== globalThis.location.origin) {
      // Use a Blob wrapper to bypass same-origin restriction for Workers
      const blobCode = `import "${workerUrl}";`;
      finalWorkerUrl = URL.createObjectURL(
        new Blob([blobCode], { type: "application/javascript" }),
      );
      isBlobUrl = true;
    }
  } catch (_e) {
    // Fallback to original URL if parsing fails
  }

  const worker = new Worker(finalWorkerUrl, {
    type: "module",
    name: WORKER_NAME,
  });

  const tasks = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void } // eslint-disable-line @typescript-eslint/no-explicit-any
  >();
  let msgId = 0;

  worker.onmessage = (e: MessageEvent<SqliteResMsg<unknown>>) => {
    const { id, success, error, payload } = e.data;
    const task = tasks.get(id);
    if (!task) return;

    if (success) {
      task.resolve(payload);
    } else {
      const err = new Error(error?.message || "Unknown error");
      err.name = error?.name || "Error";
      err.stack = error?.stack;
      task.reject(err);
    }
    tasks.delete(id);
  };

  worker.onerror = (e) => {
    console.error("Worker error:", e);
  };

  return {
    sendMsg: <TRes, TReq>(event: SqliteEvent, payload?: TReq) => {
      if (isTerminated) {
        return Promise.reject(new Error("Database is not open"));
      }
      const id = ++msgId;
      return new Promise<TRes>((resolve, reject) => {
        tasks.set(id, { resolve, reject });
        try {
          worker.postMessage({ id, event, payload } as SqliteReqMsg<TReq>);
        } catch (e) {
          tasks.delete(id);
          reject(e as Error);
        }
      });
    },
    terminate: () => {
      isTerminated = true;
      worker.terminate();
      if (isBlobUrl) URL.revokeObjectURL(finalWorkerUrl);
      // Reject all pending tasks
      tasks.forEach((task) => {
        task.reject(new Error("Database is not open"));
      });
      tasks.clear();
    },
  };
};

/**
 * The core API implementation. Handles environment detection and message forwarding.
 */
export const openDB = async (
  filename: string,
  workerUrl: string,
  options?: any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<DBInterface> => {
  const connection = isSameThreadRequired()
    ? createLocalConnection(createSqliteService())
    : createWorkerConnection(workerUrl);

  const runMutex = createMutex();
  const send = connection.sendMsg.bind(connection);

  await send(SqliteEvent.OPEN, { filename, options });

  const _exec = (sql: string, bind?: SQLParams) =>
    send<ExecResult>(SqliteEvent.EXECUTE, { sql, bind } as ExecParams);

  const _query = <T>(sql: string, bind?: SQLParams) => {
    if (!sql?.trim()) throw new Error("SQL query must be a non-empty string");
    return send<T[]>(SqliteEvent.QUERY, { sql, bind } as ExecParams);
  };

  return {
    exec: (sql, params) => runMutex(() => _exec(sql, params)),
    query: (sql, params) => runMutex(() => _query(sql, params)),
    transaction: async <T>(fn: transactionCallback<T>) =>
      runMutex(async () => {
        await _exec("BEGIN");
        try {
          const result = await fn({ exec: _exec, query: _query });
          await _exec("COMMIT");
          return result;
        } catch (e) {
          await _exec("ROLLBACK");
          throw e;
        }
      }),
    close: () =>
      runMutex(async () => {
        try {
          await send(SqliteEvent.CLOSE);
        } finally {
          connection.terminate();
        }
      }),
  };
};
