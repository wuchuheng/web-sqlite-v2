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

/**
 * A component of an error message, which can be a string or a primitive value.
 * Used when constructing error messages via the `toss` utility.
 */
export type ErrorPart = string | number | bigint | boolean | symbol;

declare global {
  /**
   * Global function to post messages from the worker to the main thread.
   * This is typically bound to the worker's `postMessage` or a wrapper around it.
   */
  var wPost: WorkerPostFn;

  /**
   * Throws an Error constructed by joining the provided parts with spaces.
   * Used for concise error throwing in the worker.
   *
   * @param parts - Segments of the error message.
   * @throws {Error} Always throws an error.
   */
  function toss(...parts: ReadonlyArray<ErrorPart>): never;

  /**
   * Checks the current environment for missing requirements (e.g., SharedArrayBuffer, Atomics, OPFS).
   *
   * @returns An array of error message strings describing missing features. Returns an empty array if the environment is valid.
   */
  function detectEnvironmentIssue(): string[];

  /**
   * Normalises a filename path into an array of directory components.
   *
   * @param filename - The absolute filename path.
   * @returns An array of path segments, excluding empty segments.
   */
  function getResolvedPath(filename: string): string[];

  /**
   * Detects the endianness of the system.
   *
   * @returns `true` if the system is little-endian, `false` otherwise.
   */
  function detectLittleEndian(): boolean;
}
