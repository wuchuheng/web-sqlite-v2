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
 * Shared context passed to each wh-wasm helper installer.
 */
export class WhWasmInstallerContext {
    /**
     * Creates a new installer context bound to the specified target.
     */
    constructor(target: WhWasmHelperTarget);

    /** Mutable target exposing the helper API. */
    target: WhWasmHelperTarget;
    /** Bookkeeping cache reused across helpers. */
    cache: WhWasmInstallerCache;
    /** Pointer intermediate representation (i32 or i64). */
    ptrIR: "i32" | "i64";
    /** Size in bytes for the active pointer representation. */
    ptrSizeof: 4 | 8;
    /** Internal helper for installing functions into the table. */
    installFunctionInternal:
        | ((fn: (...args: WhWasmValue[]) => WhWasmValue, sig: string, scoped: boolean) => number)
        | null;
    /** Internal CString allocator provided by the string helpers. */
    allocCStringInternal:
        | ((
              value: string,
              nulTerminate: boolean,
              stackAlloc: (size: number) => number,
              signature: string
          ) => number | [number, number] | null)
        | null;

    /** Throws an error with the provided message fragments. */
    toss(...args: unknown[]): never;
    /** Resolves the active WebAssembly memory backing the target. */
    resolveMemory(): WebAssembly.Memory;
    /** Returns the cached heap views, refreshing them when needed. */
    getHeapViews(): WhWasmInstallerCache;
}
