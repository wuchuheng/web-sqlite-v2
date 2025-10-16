export interface Sqlite3WasmNamespace {
    exports: Record<string, (...args: unknown[]) => unknown>;
    allocCString(value: string): number;
    poke(ptr: number, value: unknown, signature: string): void;
    pokePtr(ptr: number, value: number): void;
    isPtr(candidate: unknown): boolean;
    heapForSize(byteLength: number): ArrayBufferView;
    pstack: {
        pointer: number;
        restore(pointer: number): void;
    };
    ptrSizeof: number;
    xWrap: Sqlite3XWrap;
    xCall: Sqlite3XCall;
}

export interface Sqlite3XWrap {
    (
        fnName: string,
        resultType: string,
        argTypes: string[]
    ): (...args: unknown[]) => unknown;
    convertArg(value: unknown, ...signature: string[]): unknown;
    convertResult(value: unknown, ...signature: string[]): unknown;
}

export interface Sqlite3XCall {
    flex(
        fnName: string,
        flexResult: unknown[],
        ...args: unknown[]
    ): unknown;
}

export interface Sqlite3UtilNamespace {
    toss3(message?: unknown, ...optionalParams: unknown[]): never;
    sqlite3__wasm_db_vfs(dbPointer: number, flags: number): number;
    sqlite3__wasm_vfs_unlink(vfsPointer: number, filename: string): void;
    typedArrayPart(
        view: ArrayBufferView,
        start: number,
        end: number
    ): ArrayBufferView;
    typedArrayToArray(view: ArrayBufferView): Array<unknown>;
}

export type Sqlite3ModuleConstructor = new (
    ...args: unknown[]
) => Sqlite3ModuleInstance;

export type Sqlite3VfsConstructor = new (
    ...args: unknown[]
) => Sqlite3VfsInstance;

export type Sqlite3IndexInfoConstructor = new (
    ...args: unknown[]
) => Sqlite3IndexInfoInstance;

export type Sqlite3IndexConstraintConstructor = new (
    ...args: unknown[]
) => Sqlite3IndexConstraintInstance;

export type Sqlite3IndexConstraintUsageConstructor = new (
    ...args: unknown[]
) => Sqlite3IndexConstraintUsageInstance;

export type Sqlite3IndexOrderByConstructor = new (
    ...args: unknown[]
) => Sqlite3IndexOrderByInstance;

export interface Sqlite3ModuleNamespace {
    sqlite3_module: Sqlite3ModuleConstructor;
    sqlite3_vfs: Sqlite3VfsConstructor & { prototype: Sqlite3VfsPrototype };
    sqlite3_index_info: Sqlite3IndexInfoConstructor;
    sqlite3_index_constraint: Sqlite3IndexConstraintConstructor;
    sqlite3_index_constraint_usage: Sqlite3IndexConstraintUsageConstructor;
    sqlite3_index_orderby: Sqlite3IndexOrderByConstructor;
    sqlite3_vfs_register(
        vfs: Sqlite3VfsInstance,
        makeDefault: number
    ): number;
    sqlite3_vfs_find(name: string): number;
    sqlite3_js_db_uses_vfs(dbPointer: number, vfsName: string): number;
    sqlite3_wasm_config_set(...args: unknown[]): Sqlite3StatusObject;
    sqlite3_wasm_config_get(): Sqlite3StatusObject | number;
    sqlite3_js_rc_str(resultCode: number): string;
    sqlite3_create_function_v2(fnConfig: Sqlite3FunctionConfig): number;
}

export interface Sqlite3VfsPrototype {
    registerVfs(asDefault?: boolean): Sqlite3VfsInstance;
}

export interface Sqlite3VfsInstance {
    pointer: number;
    $zName?: string;
    addOnDispose?: (...args: unknown[]) => void;
}

export interface Sqlite3IndexInfoInstance {
    $nConstraint: number;
    $aConstraint: number;
    $aConstraintUsage: number;
    $nOrderBy: number;
    $aOrderBy: number;
    sqlite3_index_constraint: { sizeof: number };
    sqlite3_index_constraint_usage: { sizeof: number };
    sqlite3_index_orderby: { sizeof: number };
}

export interface Sqlite3IndexConstraintInstance {
    pointer: number;
}

export interface Sqlite3IndexConstraintUsageInstance {
    pointer: number;
}

export interface Sqlite3IndexOrderByInstance {
    pointer: number;
}

export interface Sqlite3ModuleInstance {
    pointer: number;
}

export interface Sqlite3StatusObject {
    result: number;
    message?: string;
}

export interface Sqlite3FunctionConfig {
    name: string;
    arity?: number;
    callback?: (
        context: unknown,
        values: unknown[]
    ) => unknown;
}

export interface Sqlite3DatabaseHandle {
    filename: string;
    pointer: number;
    changes(preserveRowid?: boolean, useI64?: boolean): number;
    createFunction(config: Sqlite3FunctionConfig): number | Sqlite3StatusObject;
    close(): void;
    dbVfsName(): string;
    loadExtension(filename: string, entryPoint?: string): void;
    _blobXfer?: unknown[];
}

export interface Sqlite3Facade {
    wasm: Sqlite3WasmNamespace;
    capi: Sqlite3ModuleNamespace;
    util: Sqlite3UtilNamespace;
    oo1: { DB: new (...args: unknown[]) => Sqlite3DatabaseHandle };
    SQLite3Error(message: string): Error & { resultCode: number };
    SQLite3ErrorResult?: Sqlite3StatusObject & { errorClass?: string };
    version?: {
        libVersion: string;
        libVersionNumber: number;
        sourceId: string;
        downloadVersion: number;
    };
}

export type Sqlite3Initializer = (sqlite3: Sqlite3Facade) => void;

export interface Sqlite3BootstrapFunction {
    (config?: Record<string, unknown>): Sqlite3Facade;
    initializers: Sqlite3Initializer[];
    initializersAsync: Sqlite3Initializer[];
    defaultConfig: Record<string, unknown>;
    sqlite3?: Sqlite3Facade;
}

export interface WorkerFunctionInvocation {
    fn: string;
    args: unknown[];
    converters?: {
        args?: (true | string | unknown[])[];
        result?: true | string[];
    };
    xCall?: "flex" | "wrapped";
    flexResult?: unknown[];
    resultType?: string;
    resultSize?: number;
}

export interface WorkerExecOptions {
    sql: string;
    rowMode?: "array" | "object" | "stmt";
    callback?: (row: unknown[]) => void | string;
    resultRows?: unknown[][];
    columnNames?: string[];
    countChanges?: boolean | number;
}

export interface Sqlite3WorkerMessage {
    type: "sqlite3";
    messageId?: string;
    dbId?: string;
    departureTime?: number;
    args?: WorkerExecOptions | Record<string, unknown> | string;
    fn?: string;
    flexResult?: unknown[];
    resultType?: string;
    resultSize?: number;
    converters?: WorkerFunctionInvocation["converters"];
    xCall?: WorkerFunctionInvocation["xCall"];
}

export interface WorkerOpenResponse {
    filename: string;
    persistent: boolean;
    dbId: string;
    vfs: string;
}

export interface WorkerCloseResponse {
    filename?: string;
}

export interface WorkerExecResult {
    sql: string;
    resultRows?: unknown[][];
    columnNames?: string[];
    callback?: (row: unknown[]) => void | string;
    changeCount?: number;
    countChanges?: boolean | number;
    rowMode?: "array" | "object";
}

export interface WorkerConfigResponse {
    result: number;
    message: string;
}

export interface WorkerExtensionResponse {
    filename: string;
}

export interface WorkerRuntimeState {
    dbList: Sqlite3DatabaseHandle[];
    idSeq: number;
    idMap: WeakMap<Sqlite3DatabaseHandle, string>;
    xfer: unknown[];
    dbs: Record<string, Sqlite3DatabaseHandle>;
    open(options: Record<string, unknown>): Sqlite3DatabaseHandle;
    close(db: Sqlite3DatabaseHandle, alsoUnlink?: boolean): void;
    post(
        message: Sqlite3WorkerMessage,
        transfer?: Iterable<unknown>
    ): void;
    getDb(
        id: string,
        require?: boolean
    ): Sqlite3DatabaseHandle | undefined;
}
