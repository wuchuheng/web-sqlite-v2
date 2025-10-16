"use strict";

/**
 * Error types used across the OPFS async proxy.
 *
 * @module async-proxy/errors
 */

/**
 * Error wrapper signalling repeated failures while requesting a sync access
 * handle.
 */
export class GetSyncHandleError extends Error {
    /**
     * @param {import('./errors.d.ts').GetSyncHandleErrorInit['cause']} cause -
     *   Underlying failure from the OPFS API.
     * @param {...string} messageParts - Fragments describing the failed
     *   operation.
     */
    constructor(cause, ...messageParts) {
        super([messageParts.join(" "), ": ", cause.name, ": ", cause.message].join(""), {
            cause,
        });
        this.name = "GetSyncHandleError";
    }

    /**
     * Converts an error into the appropriate SQLite error code.
     *
     * @param {import('./errors.d.ts').SyncHandleFailure} error - Error to inspect.
     * @param {number} fallbackCode - Error code used when no specific mapping
     *   exists.
     * @param {import('./errors.d.ts').SqliteErrorCodes} sqliteCodes - Mapping of
     *   sqlite error codes.
     * @returns {number} SQLite-compatible error code.
     */
    static toSQLiteCode(error, fallbackCode, sqliteCodes) {
        if (error instanceof GetSyncHandleError) {
            const cause = error.cause;
            if (
                cause?.name === "NoModificationAllowedError" ||
                (cause?.name === "DOMException" &&
                    cause?.message?.startsWith("Access Handles cannot"))
            ) {
                return sqliteCodes.SQLITE_BUSY;
            }
            if (cause?.name === "NotFoundError") {
                return sqliteCodes.SQLITE_CANTOPEN;
            }
        } else if (error && typeof error === "object" && error.name === "NotFoundError") {
            return sqliteCodes.SQLITE_CANTOPEN;
        }
        return fallbackCode;
    }
}
