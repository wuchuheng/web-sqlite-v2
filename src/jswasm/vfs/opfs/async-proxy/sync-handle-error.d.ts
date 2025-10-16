import type { SQLiteErrorCodes } from "./state.d.ts";

export declare class GetSyncHandleError extends Error {
    constructor(cause: DOMException | Error, ...messageParts: ReadonlyArray<string>);
    static toSQLiteCode(
        error: Error | DOMException | GetSyncHandleError,
        fallbackCode: number,
        sqliteCodes: SQLiteErrorCodes
    ): number;
}
