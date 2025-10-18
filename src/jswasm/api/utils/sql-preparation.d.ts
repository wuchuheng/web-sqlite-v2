import type { SQLite3CapiWithHelpers, Oo1Util } from "../oo1-db/context.d.ts";
import type { Sqlite3WasmNamespace } from "../../wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts";

/** SQL input accepted by the preparation wrappers. */
export type FlexibleSqlSource =
    | string
    | number
    | Uint8Array
    | Int8Array
    | ArrayBuffer
    | string[];

/** Parameters accepted by the bind helpers. */
export type BindableBlobSource =
    | null
    | number
    | string
    | Uint8Array
    | Int8Array
    | ArrayBuffer
    | ArrayLike<number>;

/** Collection of preparation and bind helpers. */
export interface SqlPreparationHelpers {
    sqlite3_prepare_v3(
        dbPointer: number,
        sql: FlexibleSqlSource,
        sqlLen: number,
        prepFlags: number,
        ppStmt: number,
        pzTail: number | null
    ): number;
    sqlite3_prepare_v2(
        dbPointer: number,
        sql: FlexibleSqlSource,
        sqlLen: number,
        ppStmt: number,
        pzTail: number | null
    ): number;
    sqlite3_bind_text(
        statementPointer: number,
        index: number,
        text: BindableBlobSource,
        textLength: number,
        destructor: number
    ): number;
    sqlite3_bind_blob(
        statementPointer: number,
        index: number,
        blob: BindableBlobSource,
        blobLength: number,
        destructor: number
    ): number;
}

/**
 * Creates SQL preparation and bind helpers mirroring the legacy OO1 behaviour.
 */
export function createSqlPreparation(
    wasm: Sqlite3WasmNamespace,
    capi: SQLite3CapiWithHelpers,
    util: Oo1Util
): SqlPreparationHelpers;
