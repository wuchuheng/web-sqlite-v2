"use strict";

/** @typedef {import("./environment.d.ts").WorkerMessageType} WorkerMessageType */
/** @typedef {import("./environment.d.ts").WorkerMessageValue} WorkerMessageValue */
/** @typedef {import("./environment.d.ts").WorkerMessagePayload} WorkerMessagePayload */
/** @typedef {import("./environment.d.ts").WorkerPostFn} WorkerPostFn */

/**
 * Posts a typed message back to the controller thread.
 * Keeps the historical `{ type, payload }` envelope expected by the consumer.
 *
 * @type {WorkerPostFn}
 */
const wPost = (type, ...payload) => postMessage({ type, payload });
globalThis.wPost = wPost;

/**
 * Throws an Error assembled from the provided string fragments.
 *
 * @param {...import("./environment.d.ts").ErrorPart} parts - Fragments combined into the message.
 * @returns {never}
 */
const toss = (...parts) => {
    throw new Error(parts.join(" "));
};
globalThis.toss = toss;

/**
 * Detects whether the current platform is missing any OPFS prerequisites.
 *
 * @returns {string[]} An array of human-friendly error descriptions (empty when OK).
 */
const detectEnvironmentIssue = () => {
    /** @type {string[]} */
    const issues = [];
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
        globalThis.FileSystemFileHandle.prototype?.createSyncAccessHandle &&
        navigator?.storage?.getDirectory;
    if (!haveOpfsApis) {
        issues.push("Missing required OPFS APIs.");
    }
    return issues;
};
globalThis.detectEnvironmentIssue = detectEnvironmentIssue;

/**
 * Normalises an absolute filename into path components.
 *
 * @param {string} filename - Absolute filename.
 * @returns {string[]} Components without leading/trailing empties.
 */
const getResolvedPath = (filename) => {
    const urlPath = new URL(filename, "file://irrelevant").pathname;
    return urlPath.split("/").filter((segment) => segment.length > 0);
};
globalThis.getResolvedPath = getResolvedPath;

/**
 * Determines native endianness of the running platform.
 *
 * @returns {boolean} `true` if little-endian.
 */
const detectLittleEndian = () => {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true);
    return new Int16Array(buffer)[0] === 256;
};
globalThis.detectLittleEndian = detectLittleEndian;
