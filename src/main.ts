import Sqlite3Worker from "./worker?worker&inline";
import {
  SqliteEvent,
  type SqliteReqMsg,
  type SqliteResMsg,
} from "./types/message.d";

type DBState = {
  state: "closed" | "opened";
};

const getLatestMsgId = (() => {
  let latestId = 0;
  return () => ++latestId;
})();

const idMapPromise: Map<number, () => Promise<void>> = new Map();

type OpenDBArgs = string | { fileName: string };

export const openDB = async (args: OpenDBArgs): Promise<void> => {
  const fileName: string = typeof args === "string" ? args : args.fileName;

  const dbState: DBState = {
    state: "closed",
  };

  const worker = new Sqlite3Worker();

  worker.onmessage = (event: MessageEvent<SqliteResMsg<unknown>>) => {
    const callback = idMapPromise.get(event.data.id);
    if (!callback) return;
    callback!();
  };

  return new Promise<void>((resolve) => {
    const id = getLatestMsgId();
    idMapPromise.set(id, async () => {
      dbState.state = "opened";

      resolve();
    });

    const openDBMsg: SqliteReqMsg<string> = {
      id,
      event: SqliteEvent.OPEN,
      payload: fileName,
    };
    worker.postMessage(openDBMsg);
  });
};

export default openDB;
