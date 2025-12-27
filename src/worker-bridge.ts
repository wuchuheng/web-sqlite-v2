import {
  type SqliteReqMsg,
  type SqliteResMsg,
  SqliteEvent,
} from "./types/message";

type Task<T> = {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

export const createWorkerBridge = (mainUrl: string) => {
  // Use the main entry point URL with a query param to spawn the worker.
  // This avoids duplicating the code (sqlite3.wasm/mjs) in the bundle.
  const workerUrl = new URL(mainUrl);
  workerUrl.searchParams.set("worker-thread", "true");

  const worker = new Worker(workerUrl.toString(), { type: "module" });

  worker.onerror = (e) => {
    console.error("[web-sqlite-js] Worker Error:", e);
  };

  worker.onmessageerror = (e) => {
    console.error("[web-sqlite-js] Worker Message Error:", e);
  };

  const idMapPromise: Map<number, Task<unknown>> = new Map();

  worker.onmessage = (event: MessageEvent<SqliteResMsg<unknown>>) => {
    const { id, success, error, payload } = event.data;
    const task = idMapPromise.get(id);

    if (!task) return;

    if (!success) {
      const newError = new Error(error!.message);
      newError.name = error!.name;
      newError.stack = error!.stack;

      task.reject(newError);
    }

    task.resolve(payload);

    idMapPromise.delete(id);
  };

  /**
   * Generates a unique message ID for each request.
   */
  const getLatestMsgId = (() => {
    let latestId = 0;
    return () => ++latestId;
  })();

  /**
   * Sends a message to the worker and returns a promise that resolves with the response.
   *
   * @template TRes - The type of the expected response.
   * @template TReq - The type of the request payload. Defaults to unknown.
   * @param {SqliteEvent} event - The event type to send.
   * @param {TReq} [payload] - The optional payload to send with the event.
   * @returns {Promise<TRes>} A promise that resolves with the response of type TRes.
   */
  const sendMsg = <TRes, TReq = unknown>(
    event: SqliteEvent,
    payload?: TReq,
  ): Promise<TRes> => {
    const id = getLatestMsgId();
    const msg: SqliteReqMsg<TReq> = {
      id,
      event,
      payload,
    };

    return new Promise<TRes>((resolve, reject) => {
      idMapPromise.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      worker.postMessage(msg);
    });
  };

  /**
   * Terminate the worker.
   */
  const terminate = () => {
    worker.terminate();
    idMapPromise.forEach((task) => {
      task.reject(new Error("Worker terminated"));
    });
    idMapPromise.clear();
  };

  return {
    sendMsg,
    terminate,
  };
};
