import { SqliteEvent } from "./types/message.d";
import { createWorkerBridge } from "./worker-bridge";

type DBState = {
  state: "closed" | "opened";
};

/**
 * Open a SQLite database file.
 *
 * @param args - The arguments for opening the database. Can be a string (file path) or an object with a fileName property.
 * @returns A promise that resolves when the database is successfully opened.
 */
export const openDB = async (
  args: string | { fileName: string }
): Promise<void> => {
  const fileName: string = typeof args === "string" ? args : args.fileName;
  const { sendMsg } = createWorkerBridge();

  await sendMsg<void, string>(SqliteEvent.OPEN, fileName);

  const dbState: DBState = {
    state: "closed",
  };
  dbState.state = "opened";
};

export default openDB;
