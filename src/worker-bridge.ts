import Sqlite3Worker from "./worker?worker&inline";
import {
  type SqliteReqMsg,
  type SqliteResMsg,
  SqliteEvent,
} from "./types/message.d";

const getLatestMsgId = (() => {
  let latestId = 0;
  return () => ++latestId;
})();

type Task<T> = {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const idMapPromise: Map<number, Task<unknown>> = new Map();

/**
 * The worker instance used for communication with the SQLite3 worker thread.
 */
const worker = new Sqlite3Worker();

/**
 * Handles the message event from the worker.
 *
 * @param event - The message event containing the response from the worker.
 * @returns void
 */
worker.onmessage = (event: MessageEvent<SqliteResMsg<unknown>>) => {
  const { id, success, error, payload } = event.data;
  const task = idMapPromise.get(id);

  if (!task) return;

  // 2. Core processing
  if (success) {
    task.resolve(payload);
  } else {
    throw error;
  }

  // 3. Output
  idMapPromise.delete(id);
};

/**
 * Sends a message to the worker and returns a promise that resolves with the response.
 *
 * @template TRes - The type of the expected response.
 * @template TReq - The type of the request payload. Defaults to unknown.
 * @param {SqliteEvent} event - The event type to send.
 * @param {TReq} [payload] - The optional payload to send with the event.
 * @returns {Promise<TRes>} A promise that resolves with the response of type TRes.
 */
export const sendMsg = <TRes, TReq = unknown>(
  event: SqliteEvent,
  payload?: TReq
): Promise<TRes> => {
  // 1. Input handling
  const id = getLatestMsgId();
  const msg: SqliteReqMsg<TReq> = {
    id,
    event,
    payload,
  };

  // 2. Core processing
  // 3. Output
  return new Promise<TRes>((resolve, reject) => {
    idMapPromise.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    worker.postMessage(msg);
  });
};
