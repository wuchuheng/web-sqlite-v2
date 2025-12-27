import { isLibraryWorker } from "./env";
import { startWorkerServer } from "./service-end";
import { openDB as apiOpenDB } from "./api-layer";
import { DBInterface } from "./types/DB";
import { WorkerOpenDBOptions } from "./types/message";
import { abilityCheck } from "./validations/shareBufferAbiliCheck";

/**
 * SELF-BOOTSTRAPPING
 * Only start the worker server if this script was explicitly
 * spawned by the library as a dedicated database worker.
 */
if (isLibraryWorker()) {
  startWorkerServer();
}

/**
 * PUBLIC API (Client End)
 * Opens a SQLite database connection.
 */
export const openDB = async (
  filename: string,
  options?: WorkerOpenDBOptions,
): Promise<DBInterface> => {
  abilityCheck();
  return apiOpenDB(filename, import.meta.url, options);
};

export default openDB;
export { openDB as open };
