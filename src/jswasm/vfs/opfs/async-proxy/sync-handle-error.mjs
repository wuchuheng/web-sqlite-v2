"use strict";

/** @typedef {import("./state.d.ts").SQLiteErrorCodes} SQLiteErrorCodes */

/**
 * Error wrapper signalling repeated failures while requesting a sync access handle.
 */
class GetSyncHandleError extends Error {
    /**
     * @param {DOMException | Error} cause - Underlying failure from the OPFS API.
     * @param {...string} messageParts - Fragments describing the failed operation.
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
     * @param {Error | DOMException | GetSyncHandleError} error - Error to inspect.
     * @param {number} fallbackCode - Error code used when no specific mapping exists.
     * @param {SQLiteErrorCodes} sqliteCodes - Mapping of sqlite error codes.
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
globalThis.GetSyncHandleError = GetSyncHandleError;
