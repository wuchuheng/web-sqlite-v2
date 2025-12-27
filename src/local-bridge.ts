import {
  closeSqlite,
  createSqliteContext,
  dispatchSqliteEvent,
} from "./core/sqlite-ops";
import { SqliteEvent } from "./types/message";

/**
 * Creates a bridge that runs SQLite in the local thread.
 */
export const createLocalBridge = () => {
  let context = createSqliteContext();

  /**
   * Mocks sending a message to the worker, but calls the dispatcher directly.
   */
  const sendMsg = async <TRes, TReq = unknown>(
    event: SqliteEvent,
    payload?: TReq,
  ): Promise<TRes> => {
    try {
      const { result, nextContext } = await dispatchSqliteEvent(
        context,
        event,
        payload,
      );
      context = nextContext;
      return result as TRes;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  };

  /**
   * Terminate the "worker" (just close the database).
   */
  const terminate = () => {
    context = closeSqlite(context);
  };

  return {
    sendMsg,
    terminate,
  };
};
