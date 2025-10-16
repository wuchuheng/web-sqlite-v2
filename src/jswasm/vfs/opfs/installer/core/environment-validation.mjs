/**
 * Validates if current environment supports OPFS.
 * @param {import('./environment-validation.d.ts').GlobalWithOPFS} globalObj - Global object to check (globalThis)
 * @returns {Error | undefined} Error if OPFS unsupported, undefined if supported
 */
export function validateOpfsEnvironment(globalObj) {
    const root = globalObj ?? globalThis;
    // 1. Input handling
    // 1.1 Check SharedArrayBuffer and Atomics
    if (!root.SharedArrayBuffer || !root.Atomics) {
        return new Error(
            "Cannot install OPFS: Missing SharedArrayBuffer and/or Atomics. " +
                "The server must emit the COOP/COEP response headers to enable those. " +
                "See https://sqlite.org/wasm/doc/trunk/persistence.md#coop-coep"
        );
    }

    // 1.2 Check worker environment
    if ("undefined" === typeof root.WorkerGlobalScope) {
        return new Error(
            "The OPFS sqlite3_vfs cannot run in the main thread " +
                "because it requires Atomics.wait()."
        );
    }

    // 1.3 Check OPFS APIs
    if (
        !root.FileSystemHandle ||
        !root.FileSystemDirectoryHandle ||
        !root.FileSystemFileHandle ||
        !root.FileSystemFileHandle.prototype.createSyncAccessHandle ||
        !root.navigator?.storage?.getDirectory
    ) {
        return new Error("Missing required OPFS APIs.");
    }

    // 3. Output handling
    return undefined;
}

/**
 * Checks if current thread has OPFS support.
 * @returns {boolean} True if OPFS is available
 */
export function thisThreadHasOPFS() {
    return (
        globalThis.FileSystemHandle &&
        globalThis.FileSystemDirectoryHandle &&
        globalThis.FileSystemFileHandle &&
        globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle &&
        globalThis.navigator?.storage?.getDirectory
    );
}
