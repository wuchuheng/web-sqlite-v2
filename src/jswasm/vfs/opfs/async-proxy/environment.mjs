"use strict";

/**
 * Worker utility helpers for communicating with the controlling thread
 * and verifying the OPFS runtime prerequisites.
 *
 * @module async-proxy/environment
 */

/**
 * Posts a typed message back to the controller thread.
 *
 * @param {import('./environment.d.ts').WorkerPostMessage} type - Message type
 *   identifier understood by the main thread.
 * @param {...import('./environment.d.ts').WorkerPostPayload} payload - Payload
 *   forwarded to the controller.
 */
export const wPost = (type, ...payload) => postMessage({ type, payload });

/**
 * Throws an Error assembled from the provided string fragments.
 *
 * @param {...import('./environment.d.ts').ErrorPart} parts - Values concatenated
 *   into the error message.
 * @throws {Error}
 */
export const toss = (...parts) => {
    throw new Error(parts.join(" "));
};

/**
 * Detects whether the current platform is missing any OPFS prerequisites.
 *
 * @returns {import('./environment.d.ts').EnvironmentIssue} Diagnostic messages.
 */
export const detectEnvironmentIssue = () => {
    if (!globalThis.SharedArrayBuffer) {
        return [
            "Missing SharedArrayBuffer API.",
            "The server must emit the COOP/COEP response headers to enable that.",
        ];
    }
    if (!globalThis.Atomics) {
        return [
            "Missing Atomics API.",
            "The server must emit the COOP/COEP response headers to enable that.",
        ];
    }
    const haveOpfsApis =
        globalThis.FileSystemHandle &&
        globalThis.FileSystemDirectoryHandle &&
        globalThis.FileSystemFileHandle &&
        globalThis.FileSystemFileHandle.prototype?.createSyncAccessHandle &&
        navigator?.storage?.getDirectory;
    if (!haveOpfsApis) {
        return ["Missing required OPFS APIs."];
    }
    return [];
};

/**
 * Normalises an absolute filename into path components.
 *
 * @param {string} filename - Absolute filename.
 * @returns {string[]} Components without leading/trailing empties.
 */
export const getResolvedPath = (filename) => {
    const urlPath = new URL(filename, "file://irrelevant").pathname;
    return urlPath.split("/").filter((segment) => segment.length > 0);
};

/**
 * Determines native endianness of the running platform.
 *
 * @returns {boolean} `true` if little-endian.
 */
export const detectLittleEndian = () => {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true);
    return new Int16Array(buffer)[0] === 256;
};
