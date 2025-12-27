import { createSqliteContext, dispatchSqliteEvent } from "./sqlite-ops";
import { type SqliteReqMsg, type SqliteResMsg } from "../types/message";

/**
 * Entry point for the SQLite Web Worker.
 */
export const runWorker = () => {
  let context = createSqliteContext();

  self.onmessage = async (msg: MessageEvent<SqliteReqMsg<unknown>>) => {
    const { id, event, payload } = msg.data;

    try {
      const { result, nextContext } = await dispatchSqliteEvent(
        context,
        event,
        payload,
      );
      context = nextContext;

      const res: SqliteResMsg<unknown> = {
        id,
        success: true,
        payload: result,
      };
      self.postMessage(res);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      const res: SqliteResMsg<void> = {
        id,
        success: false,
        error: {
          name: errorObj.name,
          message: errorObj.message,
          stack: errorObj.stack,
        } as Error,
      };
      self.postMessage(res);
    }
  };
};
