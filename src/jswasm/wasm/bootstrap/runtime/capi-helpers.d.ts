import type { BootstrapConfig } from "../configuration.d.ts";
import type {
    Sqlite3ErrorConstructor,
    WasmAllocErrorConstructor,
} from "../error-utils.d.ts";

type WasmPointer = number | bigint;

export interface Sqlite3VfsInstance {
    $zName: WasmPointer;
    $pNext: WasmPointer;
    dispose(): void;
}

export interface Sqlite3VfsConstructor {
    new (pointer: WasmPointer): Sqlite3VfsInstance;
}

export interface Sqlite3CapiNamespace {
    SQLITE_DBCONFIG_ENABLE_FKEY: number;
    SQLITE_DBCONFIG_ENABLE_TRIGGER: number;
    SQLITE_DBCONFIG_ENABLE_FTS3_TOKENIZER: number;
    SQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION: number;
    SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE: number;
    SQLITE_DBCONFIG_ENABLE_QPSG: number;
    SQLITE_DBCONFIG_TRIGGER_EQP: number;
    SQLITE_DBCONFIG_RESET_DATABASE: number;
    SQLITE_DBCONFIG_DEFENSIVE: number;
    SQLITE_DBCONFIG_WRITABLE_SCHEMA: number;
    SQLITE_DBCONFIG_LEGACY_ALTER_TABLE: number;
    SQLITE_DBCONFIG_DQS_DML: number;
    SQLITE_DBCONFIG_DQS_DDL: number;
    SQLITE_DBCONFIG_ENABLE_VIEW: number;
    SQLITE_DBCONFIG_LEGACY_FILE_FORMAT: number;
    SQLITE_DBCONFIG_TRUSTED_SCHEMA: number;
    SQLITE_DBCONFIG_STMT_SCANSTATUS: number;
    SQLITE_DBCONFIG_REVERSE_SCANORDER: number;
    SQLITE_DBCONFIG_ENABLE_ATTACH_CREATE: number;
    SQLITE_DBCONFIG_ENABLE_ATTACH_WRITE: number;
    SQLITE_DBCONFIG_ENABLE_COMMENTS: number;
    SQLITE_MISUSE: number;
    SQLITE_MISMATCH: number;
    SQLITE_NULL: number;
    SQLITE_INTEGER: number;
    SQLITE_FLOAT: number;
    SQLITE_BLOB: number;
    SQLITE_WASM_DEALLOC: number;
    sqlite3_vfs_find(name: string | number): WasmPointer;
    sqlite3_vfs: Sqlite3VfsConstructor;
    sqlite3_js_rc_str(code: number): string;
    sqlite3_js_db_vfs(dbPointer: WasmPointer, dbName?: number): WasmPointer;
    sqlite3_js_vfs_create_file(
        ...args: (string | number | Uint8Array)[]
    ): number;
    sqlite3_js_db_export(
        ...args: (string | number | Uint8Array)[]
    ): Uint8Array;
    sqlite3_aggregate_context(pCtx: WasmPointer, n: number): WasmPointer;
    sqlite3_result_error_nomem(context: WasmPointer): void;
    sqlite3_result_error(
        context: WasmPointer,
        message: string,
        nBytes: number
    ): void;
    sqlite3_result_int(context: WasmPointer, value: number): void;
    sqlite3_result_double(context: WasmPointer, value: number): void;
    sqlite3_result_int64(context: WasmPointer, value: bigint): void;
    sqlite3_result_text(
        context: WasmPointer,
        textPointer: WasmPointer,
        nBytes: number,
        destructor: WasmPointer
    ): void;
    sqlite3_result_blob(
        context: WasmPointer,
        blobPointer: WasmPointer,
        nBytes: number,
        destructor: WasmPointer
    ): void;
    sqlite3_result_null(context: WasmPointer): void;
    sqlite3_column_value(statement: WasmPointer, column: number): WasmPointer;
    sqlite3_value_type(valuePtr: WasmPointer): number;
    sqlite3_value_int64(valuePtr: WasmPointer): bigint;
    sqlite3_value_double(valuePtr: WasmPointer): number;
    sqlite3_value_text(valuePtr: WasmPointer): string;
    sqlite3_value_bytes(valuePtr: WasmPointer): number;
    sqlite3_value_blob(valuePtr: WasmPointer): WasmPointer;
    sqlite3_preupdate_new(
        pDb: WasmPointer,
        iCol: number,
        ppValue: WasmPointer
    ): number;
    sqlite3_preupdate_old(
        pDb: WasmPointer,
        iCol: number,
        ppValue: WasmPointer
    ): number;
    sqlite3changeset_new(
        iterator: WasmPointer,
        iCol: number,
        ppValue: WasmPointer
    ): number;
    sqlite3changeset_old(
        iterator: WasmPointer,
        iCol: number,
        ppValue: WasmPointer
    ): number;
}

export interface WasmExports {
    sqlite3_randomness(size: number, pointer: WasmPointer): void;
    sqlite3__wasm_init_wasmfs(
        directoryPointer: WasmPointer
    ): number;
    sqlite3__wasm_db_serialize(
        dbPointer: WasmPointer,
        schemaPointer: WasmPointer,
        ppOut: WasmPointer,
        pSize: WasmPointer,
        flags: number
    ): number;
    sqlite3_free(ptr: WasmPointer): void;
}

export interface WasmBridge {
    exports: WasmExports;
    bigIntEnabled: boolean;
    ptrSizeof: number;
    isPtr(candidate: number | bigint | string | ArrayBuffer | ArrayBufferView | null): candidate is WasmPointer;
    heap8u(): Uint8Array;
    allocCString(source: string, retain?: boolean): [WasmPointer, number];
    allocFromTypedArray(buffer: Uint8Array | ArrayBufferView): WasmPointer;
    dealloc(pointer: WasmPointer): void;
    scopedAlloc(byteCount: number): WasmPointer;
    scopedAllocPush(): unknown;
    scopedAllocPop(scope?: unknown): void;
    scopedAllocCString(value: string): WasmPointer;
    peek(pointer: WasmPointer, signature: "i64"): bigint;
    peekPtr(pointer: WasmPointer): WasmPointer;
    allocPtr(): WasmPointer;
    pokePtr(pointer: WasmPointer, value: WasmPointer): void;
    xWrap: {
        (
            fnName: string,
            resultType: string,
            argTypes: string[]
        ): (...args: (number | string | Uint8Array)[]) => number;
        testConvertArg(signature: string, value: WasmPointer): WasmPointer;
    };
    xCallWrapped(
        fnName: string,
        resultType: string,
        argTypes: string[],
        ...args: (string | number | Uint8Array)[]
    ): number;
    pstack: {
        pointer: WasmPointer;
        alloc(byteCount: number): WasmPointer;
        restore(pointer: WasmPointer): void;
    };
    cstrToJs(ptr: WasmPointer): string;
}

export interface BootstrapUtilForCapi {
    isTypedArray(value: ArrayBuffer | ArrayBufferView | number | string | boolean | null): value is Uint8Array;
    typedArrayPart(
        view: Uint8Array,
        start: number,
        end: number
    ): Uint8Array;
    sqlite3__wasm_db_vfs(dbPointer: WasmPointer, dbName: number): WasmPointer;
    isInt32(value: number | bigint | string | null): value is number;
    sqlite3__wasm_posix_create_file(
        filename: string,
        dataPointer: WasmPointer,
        bytes: number
    ): number;
    sqlite3__wasm_vfs_create_file(
        vfs: string,
        filename: string,
        dataPointer: WasmPointer,
        bytes: number
    ): number;
    flexibleString(value: Sqlite3SqlLike): Sqlite3SqlLike;
    isBindableTypedArray(
        value: ArrayBuffer | ArrayBufferView | null
    ): value is Uint8Array | Int8Array | ArrayBuffer;
    isUIThread(): boolean;
    bigIntFits32(value: bigint): boolean;
    bigIntFits64(value: bigint): boolean;
    bigIntFitsDouble(value: bigint | number): boolean;
}

export type Sqlite3JsValue =
    | number
    | bigint
    | string
    | Uint8Array
    | null
    | undefined;

export type Sqlite3ResultValue =
    | Sqlite3JsValue
    | boolean
    | ArrayBuffer
    | Int8Array;

export type Sqlite3SqlLike =
    | string
    | number
    | ArrayBuffer
    | ArrayBufferView
    | string[];

export interface CapiHelpers {
    sqlite3_randomness(target: Uint8Array): Uint8Array;
    sqlite3_randomness(size: number, target: WasmPointer): void;
    sqlite3_wasmfs_opfs_dir(): string;
    sqlite3_wasmfs_filename_is_persistent(name: string): boolean;
    sqlite3_js_db_uses_vfs(
        dbPointer: WasmPointer,
        vfsName: string,
        dbName?: number
    ): WasmPointer | false;
    sqlite3_js_vfs_list(): string[];
    sqlite3_js_db_export(
        dbPointer: WasmPointer,
        schema?: number | string
    ): Uint8Array;
    sqlite3_js_db_vfs(dbPointer: WasmPointer, dbName?: number): WasmPointer;
    sqlite3_js_aggregate_context(
        contextPointer: WasmPointer,
        byteCount: number
    ): WasmPointer;
    sqlite3_js_posix_create_file(
        filename: string,
        data: ArrayBuffer | Uint8Array | WasmPointer,
        byteCount?: number
    ): void;
    sqlite3_js_vfs_create_file(
        vfs: string,
        filename: string,
        data: ArrayBuffer | Uint8Array | WasmPointer,
        byteCount?: number
    ): void;
    sqlite3_js_sql_to_string(value: Sqlite3SqlLike): string | undefined;
    sqlite3_js_kvvfs_clear?(which?: string): number;
    sqlite3_js_kvvfs_size?(which?: string): number;
    sqlite3_db_config(
        dbPointer: WasmPointer,
        op: number,
        ...args: (number | string | WasmPointer)[]
    ): number;
    sqlite3_value_to_js(
        valuePointer: WasmPointer,
        throwIfCannotConvert?: boolean
    ): Sqlite3JsValue;
    sqlite3_values_to_js(
        argc: number,
        argvPointer: WasmPointer,
        throwIfCannotConvert?: boolean
    ): Sqlite3JsValue[];
    sqlite3_result_error_js(
        context: WasmPointer,
        error: Error | string | number
    ): void;
    sqlite3_result_js(context: WasmPointer, value: Sqlite3ResultValue): void;
    sqlite3_column_js(
        statementPointer: WasmPointer,
        column: number,
        throwIfCannotConvert?: boolean
    ): Sqlite3JsValue;
    sqlite3_preupdate_new_js(
        dbPointer: WasmPointer,
        column: number
    ): Sqlite3JsValue;
    sqlite3_preupdate_old_js(
        dbPointer: WasmPointer,
        column: number
    ): Sqlite3JsValue;
    sqlite3changeset_new_js(
        iteratorPointer: WasmPointer,
        column: number
    ): Sqlite3JsValue;
    sqlite3changeset_old_js(
        iteratorPointer: WasmPointer,
        column: number
    ): Sqlite3JsValue;
}

export interface CreateCapiHelpersOptions {
    capi: Sqlite3CapiNamespace;
    wasm: WasmBridge;
    util: BootstrapUtilForCapi;
    config: BootstrapConfig;
    SQLite3Error: Sqlite3ErrorConstructor;
    WasmAllocError: WasmAllocErrorConstructor;
    toss3: (...messageParts: (string | number | bigint)[]) => never;
}

export function createCapiHelpers(
    options: CreateCapiHelpersOptions
): CapiHelpers;
