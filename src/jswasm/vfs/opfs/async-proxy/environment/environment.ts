/**
 * Worker environment utilities for OPFS async proxy operations.
 * Provides global functions for message posting, error handling, environment detection,
 * path resolution, and platform detection.
 */
(() => {
  /**
   * Posts a typed message back to the controller thread.
   * Keeps the historical `{ type, payload }` envelope expected by the consumer.
   *
   * @param type - The message type identifier.
   * @param payload - The data arguments to send with the message.
   */
  const wPost = (
    type: WorkerMessageType,
    ...payload: WorkerMessagePayload
  ): void => {
    // 1. Input handling - parameters are already typed by TypeScript

    // 2. Core processing - create message envelope
    const message = { type, payload };

    // 3. Output handling - post the message
    postMessage(message);
  };

  /**
   * Throws an Error assembled from the provided string fragments.
   *
   * @param parts - Fragments combined into the message.
   * @throws {Error} Always throws an error with the combined message.
   * @returns never
   */
  const toss = (...parts: ReadonlyArray<ErrorPart>): never => {
    // 1. Input handling - ensure we have valid parts to join

    // 2. Core processing - join parts with spaces
    const message = parts.join(" ");

    // 3. Output handling - throw the constructed error
    throw new Error(message);
  };

  /**
   * Detects whether the current platform is missing any OPFS prerequisites.
   *
   * @returns An array of human-friendly error descriptions (empty when OK).
   */
  const detectEnvironmentIssue = (): string[] => {
    // 1. Input handling - no inputs required

    // 2. Core processing - check for required APIs
    const issues: string[] = [];

    if (!globalThis.SharedArrayBuffer) {
      issues.push(
        "Missing SharedArrayBuffer API.",
        "The server must emit the COOP/COEP response headers to enable that.",
      );
    }

    if (!globalThis.Atomics) {
      issues.push(
        "Missing Atomics API.",
        "The server must emit the COOP/COEP response headers to enable that.",
      );
    }

    const haveOpfsApis =
      globalThis.FileSystemHandle &&
      globalThis.FileSystemDirectoryHandle &&
      globalThis.FileSystemFileHandle &&
      "createSyncAccessHandle" in
        (globalThis.FileSystemFileHandle.prototype || {}) &&
      navigator?.storage?.getDirectory;

    if (!haveOpfsApis) {
      issues.push("Missing required OPFS APIs.");
    }

    // 3. Output handling - return detected issues
    return issues;
  };

  /**
   * Normalises an absolute filename into path components.
   *
   * @param filename - Absolute filename.
   * @returns Components without leading/trailing empties.
   */
  const getResolvedPath = (filename: string): string[] => {
    // 1. Input handling - validate filename parameter
    // The original .mjs did not validate, but the TS version should for safety.
    if (typeof filename !== "string") {
      toss("getResolvedPath requires a string filename");
    }

    // 2. Core processing - use URL parsing to normalize the path
    const urlPath = new URL(filename, "file://irrelevant").pathname;
    const pathComponents = urlPath
      .split("/")
      .filter((segment) => segment.length > 0);

    // 3. Output handling - return the filtered path components
    return pathComponents;
  };

  /**
   * Determines native endianness of the running platform.
   *
   * @returns `true` if little-endian.
   */
  const detectLittleEndian = (): boolean => {
    // 1. Input handling - no inputs required

    // 2. Core processing - use ArrayBuffer trick to detect endianness
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true);
    const isLittleEndian = new Int16Array(buffer)[0] === 256;

    // 3. Output handling - return the detected endianness
    return isLittleEndian;
  };

  // Assign to globalThis to maintain compatibility with original .mjs behavior
  globalThis.wPost = wPost;
  globalThis.toss = toss;
  globalThis.detectEnvironmentIssue = detectEnvironmentIssue;
  globalThis.getResolvedPath = getResolvedPath;
  globalThis.detectLittleEndian = detectLittleEndian;
})();
