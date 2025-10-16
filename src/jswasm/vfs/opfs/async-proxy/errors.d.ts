export interface SqliteErrorCodes {
    SQLITE_BUSY: number;
    SQLITE_CANTOPEN: number;
}

export interface GetSyncHandleErrorInit {
    cause: DOMException | Error;
}

export type SyncHandleFailure = DOMException | Error | GetSyncHandleError;

export declare class GetSyncHandleError extends Error {
    constructor(cause: GetSyncHandleErrorInit['cause'], ...messageParts: string[]);
    static toSQLiteCode(
        error: SyncHandleFailure,
        fallbackCode: number,
        sqliteCodes: SqliteErrorCodes
    ): number;
}
