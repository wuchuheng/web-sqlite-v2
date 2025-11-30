/* eslint-disable @typescript-eslint/no-explicit-any */
// Type definitions for global variables
// This file defines properties attached to globalThis across the application.

// Now handled by tsconfig.json's lib array: /// <reference lib="webworker" />

import type {
  Sqlite3InitModuleState,
  WrappedInitModule,
} from "../jswasm/utils/sqlite3-init-wrapper/sqlite3-init-wrapper";
import type { StructBinderFactory } from "../jswasm/utils/struct-binder/struct-binder-factory/struct-binder-factory";

declare global {
  // -------------------------------------------------------------------------
  // SQLite3 / Emscripten Module Hooks
  // -------------------------------------------------------------------------

  /**
   * The Emscripten-generated module initializer.
   * Can be the raw one or the wrapped one.
   */
  var sqlite3InitModule: WrappedInitModule | undefined;

  /**
   * State metadata captured during initialization.
   */
  var sqlite3InitModuleState: Sqlite3InitModuleState | undefined;

  /**
   * Configuration object for the SQLite3 API bootstrap.
   * Used as a fallback if arguments aren't passed to sqlite3ApiBootstrap.
   */
  var sqlite3ApiConfig: Record<string, any> | undefined;

  /**
   * The main bootstrap function for the SQLite3 high-level API.
   */
  var sqlite3ApiBootstrap: {
    (apiConfig?: any): any;
    defaultConfig: any;
    sqlite3?: any;
    initializers: ((sqlite3: any) => void)[];
    initializersAsync: ((sqlite3: any) => Promise<void>)[];
  } | undefined;


  // -------------------------------------------------------------------------
  // OPFS / VFS / Worker Utilities
  // -------------------------------------------------------------------------

  /**
   * The AsyncProxyWorker class constructor.
   * Defined in `src/jswasm/vfs/opfs/async-proxy/async-proxy-worker.mjs`.
   */
  var AsyncProxyWorker: {
    new (postFn: (type: string, ...payload: any[]) => void): any;
  } | undefined;

  /**
   * Represents a single value that can be sent via the worker messaging system.
   * Supports primitive types and objects compatible with the structured clone algorithm.
   */
  type WorkerMessageValue =
    | string
    | number
    | bigint
    | boolean
    | symbol
    | object;

  /**
   * A readonly array of values forming the payload of a worker message.
   */
  type WorkerMessagePayload = ReadonlyArray<WorkerMessageValue>;

  /**
   * The string identifier for a worker message type (e.g., "opfs-async-loaded").
   */
  type WorkerMessageType = string;

  /**
   * Function signature for posting messages from the worker to the main thread.
   *
   * @param type - The message type identifier.
   * @param payload - The data arguments to send with the message.
   */
  type WorkerPostFn = (
    type: WorkerMessageType,
    ...payload: WorkerMessagePayload
  ) => void;

  /**
   * A component of an error message, which can be a string or a primitive value.
   * Used when constructing error messages via the `toss` utility.
   */
  type ErrorPart = string | number | bigint | boolean | symbol;

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

  /** Information about the detected execution environment. */
  interface EnvironmentInfo {
    /**
     * Indicates if the code is running in a standard web browser context (main thread).
     */
    ENVIRONMENT_IS_WEB: boolean;

    /**
     * Indicates if the code is running within a Web Worker environment.
     */
    ENVIRONMENT_IS_WORKER: boolean;

    /**
     * The directory URL where the executing script is located.
     * Useful for resolving relative paths for asset loading.
     */
    scriptDirectory: string;
  }

  /** Utility methods for loading resources in the current environment. */
  interface FileReaders {
    /**
     * Asynchronously reads a file from a URL.
     *
     * @param url - The URL of the file to read.
     * @returns A promise that resolves to the file's content as an ArrayBuffer.
     */
    readAsync: (url: string) => Promise<ArrayBuffer>;

    /**
     * Synchronously reads a file from a URL.
     * Only available in Worker environments where synchronous XHR is permitted.
     *
     * @param url - The URL of the file to read.
     * @returns The file's content as a Uint8Array.
     */
    readBinary?: (url: string) => Uint8Array;
  }

  /**
   * Detects whether the module is executing in a browser, worker, or other host.
   *
   * @returns An object containing boolean flags for the detected environment and the script directory.
   */
  function detectEnvironment(): EnvironmentInfo;

  /**
   * Creates synchronous and asynchronous file readers for the active environment.
   *
   * @param ENVIRONMENT_IS_WORKER - Pass true if running in a worker environment to enable synchronous reading.
   * @returns An object containing the constructed reader functions.
   */
  function createFileReaders(ENVIRONMENT_IS_WORKER: boolean): FileReaders;


  // -------------------------------------------------------------------------
  // Application Helpers
  // -------------------------------------------------------------------------

  /**
   * StructBinderFactory exposed globally as `Jaccwabyt`.
   */
  var Jaccwabyt: typeof StructBinderFactory | undefined;


  // -------------------------------------------------------------------------
  // Browser / Environment Features (Polyfills or Checks)
  // -------------------------------------------------------------------------

  // These might be present in standard libs but sometimes accessed safely via globalThis
  // or checked for existence. They are removed from here to avoid conflicts with lib.dom.d.ts.

  // eslint-disable-next-line no-var
  var SharedArrayBuffer: SharedArrayBufferConstructor | undefined;
  // eslint-disable-next-line no-var
  var Atomics: Atomics | undefined;
}

export {};
