export interface Sqlite3ErrorConstructor extends ErrorConstructor {
    new (...args: unknown[]): Error & { resultCode: number };
    toss(...args: unknown[]): never;
}

export interface WasmAllocErrorConstructor extends ErrorConstructor {
    new (...args: unknown[]): Error & { resultCode: number };
    toss(...args: unknown[]): never;
}

export function createResultCodeStringifier(
    capi: { sqlite3_js_rc_str?: (rc: number) => string | undefined }
): (rc: number) => string;

export function createSQLite3Error(
    capi: { SQLITE_ERROR: number },
    rcToString: (rc: number) => string
): Sqlite3ErrorConstructor;

export function createWasmAllocError(
    capi: { SQLITE_NOMEM: number }
): WasmAllocErrorConstructor;
