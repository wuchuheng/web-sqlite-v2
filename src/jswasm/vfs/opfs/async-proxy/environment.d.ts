/**
 * Represents a single value that can be sent via the worker messaging system.
 * Supports primitive types and objects compatible with the structured clone algorithm.
 */
export type WorkerMessageValue =
  | string
  | number
  | bigint
  | boolean
  | symbol
  | object;

/**
 * A readonly array of values forming the payload of a worker message.
 */
export type WorkerMessagePayload = ReadonlyArray<WorkerMessageValue>;

/**
 * The string identifier for a worker message type (e.g., "opfs-async-loaded").
 */
export type WorkerMessageType = string;

/**
 * Function signature for posting messages from the worker to the main thread.
 *
 * @param type - The message type identifier.
 * @param payload - The data arguments to send with the message.
 */
export type WorkerPostFn = (
  type: WorkerMessageType,
  ...payload: WorkerMessagePayload
) => void;
