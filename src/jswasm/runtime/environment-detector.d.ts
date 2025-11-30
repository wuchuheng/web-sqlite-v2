/// <reference lib="webworker" />

/** Information about the detected execution environment. */
export interface EnvironmentInfo {
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
export interface FileReaders {
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
export function detectEnvironment(): EnvironmentInfo;

/**
 * Creates synchronous and asynchronous file readers for the active environment.
 *
 * @param ENVIRONMENT_IS_WORKER - Pass true if running in a worker environment to enable synchronous reading.
 * @returns An object containing the constructed reader functions.
 */
export function createFileReaders(ENVIRONMENT_IS_WORKER: boolean): FileReaders;