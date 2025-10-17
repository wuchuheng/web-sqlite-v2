/**
 * Primitive values stored on the wh-wasm helper target.
 */
export type WhWasmPrimitive = string | number | boolean | bigint | symbol | null | undefined;

/**
 * Recursive value hierarchy used by the helper target and cache structures.
 */
export type WhWasmValue =
    | WhWasmPrimitive
    | WhWasmValue[]
    | { [key: string]: WhWasmValue }
    | ((...args: WhWasmValue[]) => WhWasmValue)
    | WebAssembly.Memory
    | WebAssembly.Exports
    | TextEncoder
    | TextDecoder;

/**
 * Mutable target object that receives all wh-wasm helper methods.
 */
export interface WhWasmHelperTarget {
    /** Indicates whether 64-bit heap views should be exposed. */
    bigIntEnabled?: boolean;
    /** WebAssembly instance exposing the low-level exports. */
    instance?: { exports: WebAssembly.Exports };
    /** Direct reference to the module exports (including memory). */
    exports?: WebAssembly.Exports & { memory?: WebAssembly.Memory };
    /** Shared WebAssembly memory used by the runtime. */
    memory?: WebAssembly.Memory;
    /** Pointer intermediate representation used by helper functions. */
    pointerIR?: "i32" | "i64";
    /** Size of a pointer expressed in bytes. */
    ptrSizeof?: 4 | 8;
    /** Container for additional wasm utilities. */
    wasm?: { stackAlloc?: (size: number) => number; [key: string]: WhWasmValue };
    /** High-level utility namespace mirrored from the legacy bundle. */
    util?: { [key: string]: WhWasmValue };
    /** C API namespace emitted by runSQLite3PostLoadInit. */
    capi?: { wasm?: { stackAlloc?: (size: number) => number } };
    /** Allows arbitrary helper metadata to be stored. */
    [key: string]: WhWasmValue;
}

/**
 * Bookkeeping cache maintained by the installer context.
 */
export interface WhWasmInstallerCache {
    /** Size in bytes of the currently cached heap. */
    heapSize: number;
    /** Cached WebAssembly memory instance. */
    memory: WebAssembly.Memory | null;
    /** Function table indexes reserved for free(). */
    freeFuncIndexes: number[];
    /** Scoped allocator stack used by scoped allocation helpers. */
    scopedAlloc: number[][];
    /** UTF-8 decoder shared by the helpers. */
    utf8Decoder: TextDecoder;
    /** UTF-8 encoder shared by the helpers. */
    utf8Encoder: TextEncoder;
    /** Lazy typed-array views into the WebAssembly heap. */
    HEAP8?: Int8Array;
    /** Unsigned 8-bit heap view. */
    HEAP8U?: Uint8Array;
    /** Signed 16-bit heap view. */
    HEAP16?: Int16Array;
    /** Unsigned 16-bit heap view. */
    HEAP16U?: Uint16Array;
    /** Signed 32-bit heap view. */
    HEAP32?: Int32Array;
    /** Unsigned 32-bit heap view. */
    HEAP32U?: Uint32Array;
    /** 32-bit floating point heap view. */
    HEAP32F?: Float32Array;
    /** 64-bit floating point heap view. */
    HEAP64F?: Float64Array;
    /** Signed 64-bit heap view (when big integers are enabled). */
    HEAP64?: BigInt64Array;
    /** Unsigned 64-bit heap view (when big integers are enabled). */
    HEAP64U?: BigUint64Array;
    /** Internal xWrap conversion caches. */
    xWrap: {
        convert: {
            arg: Map<unknown, unknown>;
            result: Map<unknown, unknown>;
        };
    };
}

/**
 * Installer function signature used across the wh-wasm helpers.
 */
export type WhWasmInstaller = (target: WhWasmHelperTarget) => WhWasmHelperTarget;

/**
 * Configuration object accepted by the yawl() loader helper.
 */
export interface YawlLoaderConfig {
    /** WebAssembly URI used when fetching the module. */
    uri: string;
    /** Optional imports object forwarded to instantiate. */
    imports?: WebAssembly.Imports;
    /** Optional loader callback invoked after instantiation. */
    onload?: (
        result: WebAssembly.WebAssemblyInstantiatedSource,
        options: YawlLoaderConfig
    ) => void;
    /** Optional flag or callback disabling instantiateStreaming. */
    noStreaming?: boolean | (() => boolean);
    /** Target object that receives the wh-wasm helpers. */
    wasmUtilTarget?: WhWasmHelperTarget;
}

/**
 * Loader factory produced by the yawl() helper.
 */
export type YawlLoaderFactory = (
    config: Partial<YawlLoaderConfig>
) => () => Promise<WebAssembly.WebAssemblyInstantiatedSource>;
