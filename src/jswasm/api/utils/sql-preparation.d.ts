import type { SQLite3API } from "../../sqlite3.d.ts";

/**
 * Wrapper functions for preparing SQL statements and binding values using the
 * refactored wasm helpers.
 */
export interface SqlPreparationHelpers {
    /** sqlite3_prepare_v3 with flexible SQL input handling. */
    sqlite3_prepare_v3(
        pDb: number,
        sql: string | ArrayBufferView | ArrayBuffer | number,
        sqlLen: number,
        prepFlags: number,
        ppStmt: number,
        pzTail: number | null
    ): number;
    /** sqlite3_prepare_v2 implemented on top of sqlite3_prepare_v3. */
    sqlite3_prepare_v2(
        pDb: number,
        sql: string | ArrayBufferView | ArrayBuffer | number,
        sqlLen: number,
        ppStmt: number,
        pzTail: number | null
    ): number;
    /** sqlite3_bind_text with support for JS strings and typed arrays. */
    sqlite3_bind_text(
        pStmt: number,
        index: number,
        text: string | ArrayBufferView | ArrayBuffer | number | null,
        byteLength: number,
        destructor: number
    ): number;
    /** sqlite3_bind_blob with support for JS typed arrays. */
    sqlite3_bind_blob(
        pStmt: number,
        index: number,
        blob: ArrayBufferView | ArrayBuffer | number | null,
        byteLength: number,
        destructor: number
    ): number;
}

/**
 * Creates SQL preparation helpers bound to the wasm/capi utility objects.
 */
export declare function createSqlPreparation(
    wasm: SQLite3API["wasm"],
    capi: SQLite3API["capi"],
    util: SQLite3API["util"]
): SqlPreparationHelpers;
