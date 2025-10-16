import type { BootstrapConfig } from "../configuration.d.ts";
import type {
    Sqlite3ErrorConstructor,
    WasmAllocErrorConstructor,
} from "../error-utils.d.ts";
import type { BootstrapUtility } from "../util-factory.d.ts";
import type {
    Sqlite3CapiNamespace,
    CapiHelpers,
    Sqlite3JsValue,
    Sqlite3ResultValue,
    Sqlite3VfsConstructor,
    Sqlite3VfsInstance,
    WasmBridge,
    WasmExports,
} from "./capi-helpers.d.ts";
import type { LegacyCapiStubs, SqliteCallback } from "./legacy-capi-stubs.d.ts";
import type {
    CompileOptionApi,
    WasmExportFunction,
    WasmHost,
    WasmRuntimeExtensions,
} from "./wasm-runtime.d.ts";

/**
 * Numeric pointer value exposed by the compiled sqlite3 WebAssembly module.
 */
export type WasmPointer = number;

/**
 * Primitive scalar types supported by the sqlite3 facade APIs.
 */
export type Sqlite3Primitive = number | bigint | string | boolean;

/**
 * Binary buffers frequently exchanged between JavaScript helpers and the wasm bridge.
 */
export type Sqlite3BinaryValue = Uint8Array | Int8Array | ArrayBuffer;

/**
 * Metadata bag describing bootstrap scripts and runtime parameters.
 */
export interface Sqlite3ScriptInfo {
    readonly [key: string]: string | number;
}

/**
 * Version information injected onto the sqlite3 facade during bootstrap.
 */
export interface Sqlite3VersionInfo extends Sqlite3ScriptInfo {
    libVersion: string;
    libVersionNumber: number;
    sourceId: string;
    downloadVersion: number;
}

/**
 * Runtime debug flag collection maintained by the struct binder helpers.
 */
export interface Sqlite3DebugFlagState {
    getter: boolean;
    setter: boolean;
    alloc: boolean;
    dealloc: boolean;
}

/**
 * Controller used to toggle struct binder debug instrumentation.
 */
export interface Sqlite3DebugFlagController {
    (mask?: number): Sqlite3DebugFlagState;
    readonly __flags: Sqlite3DebugFlagState;
}

/**
 * Describes an individual struct member provided by the WASM metadata tables.
 */
export interface Sqlite3StructMemberDescriptor {
    readonly offset: number;
    readonly sizeof: number;
    readonly signature: string;
    readonly key?: string;
    readonly name?: string;
}

/**
 * Struct layout information used by {@link Sqlite3StructBinder} to produce constructors.
 */
export interface Sqlite3StructDefinition {
    readonly name?: string;
    readonly sizeof: number;
    readonly members: Record<string, Sqlite3StructMemberDescriptor>;
}

/**
 * Cleanup handlers associated with struct instances.
 */
export type Sqlite3StructDisposer =
    | WasmPointer
    | Sqlite3StructInstance
    | (() => void);

/**
 * Runtime instance representing a bound struct from WebAssembly memory.
 */
export interface Sqlite3StructInstance {
    readonly pointer: WasmPointer;
    readonly structInfo: Sqlite3StructDefinition;
    readonly debugFlags: Sqlite3DebugFlagController;
    ondispose?: Sqlite3StructDisposer | Sqlite3StructDisposer[];
    dispose(): void;
}

/**
 * Constructor produced by the struct binder for a given struct definition.
 */
export interface Sqlite3StructConstructor {
    readonly structName: string;
    readonly structInfo: Sqlite3StructDefinition;
    readonly debugFlags: Sqlite3DebugFlagController;
    readonly prototype: Sqlite3StructInstance & {
        installMethod?(
            name: string,
            implementation: (...args: Sqlite3WasmCallArgument[]) => Sqlite3WasmCallResult
        ): void;
        installMethods?(
            methods: Record<string, (...args: Sqlite3WasmCallArgument[]) => Sqlite3WasmCallResult>
        ): void;
    };
    new (pointer?: WasmPointer): Sqlite3StructInstance;
    isA(
        candidate:
            | Sqlite3StructInstance
            | Record<string, Sqlite3JsValue | Sqlite3ResultValue>
            | null
            | undefined
    ): candidate is Sqlite3StructInstance;
    memberKey(memberName: string): string;
    memberKeys(structInfo: Sqlite3StructDefinition): string[];
    methodInfoForKey(memberKey: string): Sqlite3StructMemberDescriptor | undefined;
    allocCString(value: string): WasmPointer;
    hasExternalPointer(candidate: Sqlite3StructInstance): boolean;
}

/**
 * Configuration accepted by {@link Sqlite3StructBinder} to interact with the wasm heap.
 */
export interface Sqlite3StructBinderConfig {
    heap: WebAssembly.Memory | (() => Uint8Array);
    alloc(bytes: number): WasmPointer;
    dealloc(pointer: WasmPointer): void;
    log?(...parts: (string | number | boolean)[]): void;
    memberPrefix?: string;
    memberSuffix?: string;
    bigIntEnabled?: boolean;
    ptrSizeof?: 4 | 8;
    ptrIR?: "i32" | "i64";
}

/**
 * Factory used to create struct constructors for sqlite3 metadata layouts.
 */
export interface Sqlite3StructBinder {
    (definition: Sqlite3StructDefinition | string, info?: Sqlite3StructDefinition): Sqlite3StructConstructor;
    readonly StructType: Sqlite3StructConstructor;
    readonly config: Sqlite3StructBinderConfig;
    readonly debugFlags: Sqlite3DebugFlagController;
    allocCString(value: string): WasmPointer;
}

/**
 * Callback signature used by client namespaces to implement custom behaviour.
 */
export type Sqlite3ClientFunction = (
    ...args: Sqlite3JsValue[]
) => Sqlite3ClientValue | void;

/**
 * Arbitrary namespace reserved for downstream client extensions to the facade.
 */
export interface Sqlite3ClientNamespace {
    readonly [key: string]: Sqlite3ClientValue;
}

/**
 * Values permitted within {@link Sqlite3ClientNamespace}.
 */
export type Sqlite3ClientValue =
    | Sqlite3Primitive
    | Sqlite3BinaryValue
    | Sqlite3JsValue
    | Sqlite3ResultValue
    | Sqlite3ClientFunction
    | Sqlite3ClientNamespace
    | Sqlite3Facade
    | undefined;

/**
 * Call signature describing the sqlite3 C API wrappers exposed on the facade.
 */
export type Sqlite3CapiFunction = (
    ...args: (
        | WasmPointer
        | Sqlite3JsValue
        | Sqlite3ResultValue
        | Sqlite3BinaryValue
        | Sqlite3Primitive
        | SqliteCallback
        | Sqlite3VfsConstructor
        | Sqlite3VfsInstance
        | Sqlite3StructBinder
        | null
        | undefined
    )[]
) =>
    | Sqlite3JsValue
    | Sqlite3ResultValue
    | Sqlite3BinaryValue
    | WasmPointer
    | Sqlite3Primitive
    | void;

/**
 * Aggregated sqlite3 C API namespace populated during bootstrap.
 */
export interface Sqlite3Capi
    extends Sqlite3CapiNamespace,
        LegacyCapiStubs,
        CapiHelpers,
        CompileOptionApi {
    [member: string]:
        | Sqlite3CapiNamespace[keyof Sqlite3CapiNamespace]
        | LegacyCapiStubs[keyof LegacyCapiStubs]
        | CapiHelpers[keyof CapiHelpers]
        | CompileOptionApi[keyof CompileOptionApi]
        | Sqlite3CapiFunction
        | Sqlite3JsValue
        | Sqlite3ResultValue
        | Sqlite3BinaryValue
        | Sqlite3Primitive
        | Sqlite3VfsConstructor
        | Sqlite3VfsInstance
        | undefined;
}

/**
 * Options accepted by the {@link Sqlite3FuncPtrAdapterConstructor} helper.
 */
export interface Sqlite3FuncPtrAdapterOptions {
    readonly name?: string;
    readonly signature: string;
    readonly bindScope?: "singleton" | "context" | "transient";
    readonly contextKey?: (argv: WasmPointer[], index: number) => string | number;
    readonly callProxy?: (
        callback: (...args: Sqlite3JsValue[]) => Sqlite3JsValue | Sqlite3ResultValue | void
    ) => (...args: Sqlite3JsValue[]) => Sqlite3JsValue | Sqlite3ResultValue | void;
}

/**
 * Lightweight descriptor for function-pointer adapters registered with xWrap.
 */
export interface Sqlite3FuncPtrAdapter {
    readonly signature: string;
    readonly bindScope: "singleton" | "context" | "transient";
}

/**
 * Constructor attached to {@link Sqlite3XWrap} for creating function-pointer adapters.
 */
export interface Sqlite3FuncPtrAdapterConstructor {
    new (options: Sqlite3FuncPtrAdapterOptions): Sqlite3FuncPtrAdapter;
    warnOnUse: boolean;
}

/**
 * Parameter types permitted within binding signature tuples.
 */
export type Sqlite3BindingSignatureArgument =
    | string
    | number
    | Sqlite3FuncPtrAdapter
    | Sqlite3FuncPtrAdapterConstructor;

/**
 * Tuple describing a wasm.xWrap binding signature entry.
 */
export type Sqlite3BindingSignature = [
    string,
    string | undefined,
    ...Sqlite3BindingSignatureArgument[]
];

/**
 * Collection of binding signatures augmented with optional convenience groups.
 */
export interface Sqlite3BindingSignatureCollection
    extends Array<Sqlite3BindingSignature> {
    int64?: Sqlite3BindingSignature[];
    wasmInternal?: Sqlite3BindingSignature[];
    [category: string]: Sqlite3BindingSignature[] | Sqlite3BindingSignature | undefined;
}

/**
 * Struct metadata entry parsed from the wasm-generated ctype catalogue.
 */
export interface Sqlite3StructLayout {
    readonly name: string;
    readonly sizeof: number;
    readonly members: Record<string, Sqlite3StructMemberDescriptor>;
}

/**
 * Registry describing available structs and constants exported by sqlite3.wasm.
 */
export interface Sqlite3CTypeRegistry {
    structs: Sqlite3StructLayout[];
    resultCodes: Record<string, number>;
    [group: string]:
        | Sqlite3StructLayout[]
        | Record<string, number | string | boolean>
        | Sqlite3StructLayout
        | undefined;
}

/**
 * Argument types accepted by wasm helper functions.
 */
export type Sqlite3WasmCallArgument =
    | Sqlite3Primitive
    | Sqlite3BinaryValue
    | Sqlite3JsValue
    | Sqlite3ResultValue
    | WasmPointer
    | Sqlite3FuncPtrAdapter
    | Sqlite3FuncPtrAdapterConstructor
    | null
    | undefined;

/**
 * Result values produced by wasm helper functions.
 */
export type Sqlite3WasmCallResult =
    | Sqlite3Primitive
    | Sqlite3BinaryValue
    | Sqlite3JsValue
    | Sqlite3ResultValue
    | WasmPointer
    | void;

/**
 * Extended wrapper function exported by the wasm helper namespace.
 */
export interface Sqlite3XWrap {
    (
        fnName: string,
        resultType: string | undefined,
        ...argTypes: (string | Sqlite3FuncPtrAdapter | Sqlite3FuncPtrAdapterConstructor)[]
    ): (...args: Sqlite3WasmCallArgument[]) => Sqlite3WasmCallResult;
    argAdapter(
        typeName: string,
        adapter?: (value: Sqlite3WasmCallArgument) => Sqlite3WasmCallArgument
    ): (value: Sqlite3WasmCallArgument) => Sqlite3WasmCallArgument;
    resultAdapter(
        typeName: string,
        adapter?: (value: WasmPointer) => Sqlite3WasmCallResult
    ): (value: WasmPointer) => Sqlite3WasmCallResult;
    convertArg(typeName: string, value: WasmPointer): WasmPointer;
    convertResult(typeName: string, value: WasmPointer): WasmPointer;
    testConvertArg(typeName: string, value: WasmPointer): WasmPointer;
    testConvertResult(typeName: string, value: WasmPointer): WasmPointer;
    FuncPtrAdapter: Sqlite3FuncPtrAdapterConstructor;
    doArgcCheck?: boolean;
    [helper: string]:
        | Sqlite3FuncPtrAdapterConstructor
        | ((...args: Sqlite3WasmCallArgument[]) => Sqlite3WasmCallResult)
        | boolean
        | undefined;
}

/**
 * Aggregated WebAssembly helper namespace exposed on the sqlite3 facade.
 */
export interface Sqlite3WasmNamespace
    extends WasmBridge,
        WasmRuntimeExtensions,
        WasmHost {
    exports: WasmExports & Record<string, WasmExportFunction>;
    memory: WebAssembly.Memory;
    ptrIR: "i32" | "i64";
    bindingSignatures?: Sqlite3BindingSignatureCollection;
    ctype?: Sqlite3CTypeRegistry;
    xWrap: Sqlite3XWrap;
    xCall: Record<string, (...args: Sqlite3WasmCallArgument[]) => Sqlite3WasmCallResult>;
    functionEntry(exportIndex: number): number;
    cArgvToJs(argc: number, argvPointer: WasmPointer): (string | number)[];
    scopedAlloc(size: number): WasmPointer;
    scopedAllocPush(): WasmPointer;
    scopedAllocPop(scope: WasmPointer): void;
    allocCString(source: string, retain?: boolean): [WasmPointer, number];
    allocFromTypedArray(buffer: Uint8Array | ArrayBufferView | ArrayBuffer): WasmPointer;
    dealloc(pointer: WasmPointer): void;
    [member: string]:
        | WasmBridge[keyof WasmBridge]
        | WasmRuntimeExtensions[keyof WasmRuntimeExtensions]
        | WasmHost[keyof WasmHost]
        | Sqlite3BindingSignatureCollection
        | Sqlite3CTypeRegistry
        | Sqlite3XWrap
        | Record<string, (...args: Sqlite3WasmCallArgument[]) => Sqlite3WasmCallResult>
        | Sqlite3WasmCallResult
        | Sqlite3BinaryValue
        | Sqlite3Primitive
        | undefined;
}

/**
 * Public interface returned to callers once the bootstrap sequence completes.
 */
export interface Sqlite3Facade {
    WasmAllocError: WasmAllocErrorConstructor;
    SQLite3Error: Sqlite3ErrorConstructor;
    capi: Sqlite3Capi;
    util: BootstrapUtility | undefined;
    wasm: Sqlite3WasmNamespace;
    config: BootstrapConfig;
    version: Sqlite3VersionInfo;
    client: Sqlite3ClientNamespace | undefined;
    asyncPostInit(): Promise<Sqlite3Facade>;
    scriptInfo?: Sqlite3ScriptInfo;
    __isUnderTest?: boolean;
    StructBinder?: Sqlite3StructBinder;
}

/**
 * Dependencies required to construct the sqlite3 facade.
 */
export interface CreateSqlite3FacadeOptions {
    sqlite3ApiBootstrap: Sqlite3BootstrapFunction;
    WasmAllocError: WasmAllocErrorConstructor;
    SQLite3Error: Sqlite3ErrorConstructor;
    capi: Sqlite3Capi;
    util: BootstrapUtility;
    wasm: Sqlite3WasmNamespace;
    config: BootstrapConfig;
}

/**
 * Synchronous bootstrap callback executed immediately after the facade is created.
 */
export type Sqlite3Initializer = (sqlite3: Sqlite3Facade) => void;

/**
 * Asynchronous bootstrap callback executed sequentially after synchronous initialisers.
 */
export type Sqlite3AsyncInitializer = (
    sqlite3: Sqlite3Facade
) => Promise<Sqlite3Facade> | Sqlite3Facade;

/**
 * Callable bootstrap entry point responsible for orchestrating initialisation of the sqlite3 facade.
 */
export interface Sqlite3BootstrapFunction {
    (config?: Partial<BootstrapConfig>): Sqlite3Facade;
    initializers: Sqlite3Initializer[];
    initializersAsync: Sqlite3AsyncInitializer[];
    sqlite3?: Sqlite3Facade;
    defaultConfig?: Partial<BootstrapConfig>;
}

/**
 * Captures the subset of the Emscripten module required by the bootstrap pipeline.
 */
export interface Sqlite3EmscriptenModule {
    asm?: WebAssembly.Exports;
    wasmMemory?: WebAssembly.Memory;
    sqlite3?: Sqlite3Facade;
    runSQLite3PostLoadInit?(module: Sqlite3EmscriptenModule): void;
}

/**
 * Defines the bootstrap-specific fields placed on the global object while initialising.
 */
export interface Sqlite3BootstrapGlobal {
    sqlite3ApiBootstrap: Sqlite3BootstrapFunction;
    sqlite3ApiConfig?: Partial<BootstrapConfig>;
}

/**
 * Convenience type describing the global namespace during bootstrap.
 */
export interface Sqlite3GlobalNamespace extends Sqlite3BootstrapGlobal {
    sqlite3?: Sqlite3Facade;
}
