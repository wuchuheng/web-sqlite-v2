import type { BootstrapConfig } from "../configuration.d.ts";
import type { WasmAllocErrorConstructor } from "../error-utils.d.ts";

type WasmPointer = number;

export type NumericTypedArray =
    | Uint8Array
    | Int8Array
    | Uint16Array
    | Int16Array
    | Uint32Array
    | Int32Array
    | Float32Array
    | Float64Array
    | BigInt64Array
    | BigUint64Array;

export interface TypedArrayConstructor<T extends NumericTypedArray> {
    new (
        buffer: ArrayBuffer,
        byteOffset?: number,
        length?: number
    ): T;
    readonly BYTES_PER_ELEMENT: number;
}

export type WasmExportFunction = (
    ...args: (number | string | ArrayBuffer | ArrayBufferView)[]
) => number | void;

export interface WasmHost {
    exports: Record<string, WasmExportFunction>;
    ptrSizeof: number;
    sizeofIR(signature: string): number;
    heapForSize<T extends NumericTypedArray>(
        ctor: TypedArrayConstructor<T>
    ): T;
}

export interface CompileOptionApi {
    sqlite3_compileoption_get(index: number): string | undefined;
    sqlite3_compileoption_used(optionName: string): number;
}

export interface BootstrapUtilForWasm {
    affirmBindableTypedArray(
        value: ArrayBufferView | ArrayBuffer
    ): ArrayBufferView;
}

export interface Sqlite3Facade {
    capi: object;
    wasm: object;
    util: object;
}

export interface CreateWasmRuntimeOptions {
    config: BootstrapConfig;
    wasm: WasmHost;
    WasmAllocError: WasmAllocErrorConstructor;
    toss3: (...messageParts: (string | number | bigint)[]) => never;
    util: BootstrapUtilForWasm;
    capi: CompileOptionApi;
}

export interface WasmRuntimeExtensions {
    allocFromTypedArray(source: ArrayBufferView | ArrayBuffer): WasmPointer;
    alloc(byteCount: number): WasmPointer;
    realloc(pointer: WasmPointer, byteCount: number): WasmPointer;
    dealloc(pointer: WasmPointer): void;
    compileOptionUsed(
        optionName?:
            | string
            | string[]
            | Record<string, boolean>
    ): boolean | Record<string, string | number | boolean>;
    pstack: {
        restore(pointer: WasmPointer): void;
        alloc(byteCount: number | string): WasmPointer;
        allocChunks(
            chunkCount: number,
            chunkSize: number | string
        ): WasmPointer[];
        allocPtr(
            count?: number,
            safePtrSize?: boolean
        ): WasmPointer | WasmPointer[];
        call<T>(callback: (sqlite3: Sqlite3Facade) => T): T;
        readonly pointer: WasmPointer;
        readonly quota: number;
        readonly remaining: number;
    };
}

export interface WasmRuntimeBinding {
    extensions: WasmRuntimeExtensions;
    bindSqlite3(sqlite3: Sqlite3Facade): void;
}

export function createWasmRuntime(
    options: CreateWasmRuntimeOptions
): WasmRuntimeBinding;
