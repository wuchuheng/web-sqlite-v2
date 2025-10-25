export {
  wPost,
  toss,
  detectEnvironmentIssue,
  getResolvedPath,
  detectLittleEndian,
  type WorkerMessageType,
  type WorkerMessageValue,
  type WorkerMessagePayload,
  type WorkerPostFn,
  type ErrorPart,
} from "./environment.d.ts";

export {
  WorkerLogger,
  type WorkerLogLevel,
  type WorkerLogArgument,
} from "./logging.d.ts";

export {
  SerializationBuffer,
  type SerializationBufferOptions,
  type SerializationValue,
  type SerializableError,
} from "./serialization-buffer.d.ts";

export { GetSyncHandleError } from "./sync-handle-error.d.ts";

export {
  createDefaultState,
  type SQLiteErrorCodes,
  type AsyncOpfsFlags,
  type OperationIds,
  type AsyncProxyState,
} from "./state.d.ts";

export {
  AsyncProxyWorker,
  type AsyncProxyOperationName,
  type AsyncOperationArgument,
  type AsyncOperationResult,
  type AsyncOperationImplementation,
  type AsyncFileRecord,
  type WorkerInitOptions,
  type OperationHandlerEntry,
} from "./async-proxy-worker.d.ts";
