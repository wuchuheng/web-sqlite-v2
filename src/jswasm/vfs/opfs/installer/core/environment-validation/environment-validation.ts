/**
 * Validates if current environment supports OPFS.
 *
 * Checks for required browser APIs including SharedArrayBuffer, Atomics,
 * WorkerGlobalScope, and OPFS FileSystem APIs. This function must be called
 * before attempting to initialize the OPFS VFS.
 *
 * @param _globalObj - Global object to check (typically globalThis)
 *                      Parameter currently unused but reserved for future extension
 * @returns Error object with specific message if validation fails, null if all checks pass
 * @see thisThreadHasOPFS For checking only OPFS APIs without worker requirements
 * @see https://sqlite.org/wasm/doc/trunk/persistence.md#coop-coep
 */
export function validateOpfsEnvironment(
  _globalObj: typeof globalThis,
): Error | null {
  // 1. Input handling
  // 1.1 Check SharedArrayBuffer and Atomics
  if (!globalThis.SharedArrayBuffer || !globalThis.Atomics) {
    return new Error(
      "Cannot install OPFS: Missing SharedArrayBuffer and/or Atomics. " +
        "The server must emit the COOP/COEP response headers to enable those. " +
        "See https://sqlite.org/wasm/doc/trunk/persistence.md#coop-coep",
    );
  }

  // 1.2 Check worker environment
  if ("undefined" === typeof WorkerGlobalScope) {
    return new Error(
      "The OPFS sqlite3_vfs cannot run in the main thread " +
        "because it requires Atomics.wait().",
    );
  }

  // 1.3 Check OPFS APIs
  if (
    !globalThis.FileSystemHandle ||
    !globalThis.FileSystemDirectoryHandle ||
    !globalThis.FileSystemFileHandle ||
    !globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle ||
    !globalThis.navigator?.storage?.getDirectory
  ) {
    return new Error("Missing required OPFS APIs.");
  }

  // 3. Output handling
  return null;
}

/**
 * Checks if current thread has OPFS support.
 *
 * Performs a quick check for the presence of OPFS APIs in the current thread.
 * Unlike validateOpfsEnvironment, this does not check for WorkerGlobalScope
 * or SharedArrayBuffer/Atomics support.
 *
 * @returns True if all required OPFS APIs are available
 */
export function thisThreadHasOPFS(): boolean {
  return !!(
    globalThis.FileSystemHandle &&
    globalThis.FileSystemDirectoryHandle &&
    globalThis.FileSystemFileHandle &&
    // @ts-expect-error - createSyncAccessHandle might be undefined or not callable in types
    globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle &&
    globalThis.navigator?.storage?.getDirectory
  );
}
