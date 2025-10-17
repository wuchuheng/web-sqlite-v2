/**
 * Partial representation of the Emscripten module object used during WASM bootstrapping.
 */
export type ModulePrimitive = string | number | boolean | null | undefined | bigint;

export type ModuleLeaf =
    | ModulePrimitive
    | WebAssembly.Memory
    | WebAssembly.Table;

export type ModuleCallable = (
    ...args: ModuleValue[]
) => ModuleValue;

export type ModuleValue =
    | ModuleLeaf
    | ModuleCallable
    | ModuleValue[]
    | { [key: string]: ModuleValue };

export type LoaderError = Error | string;

export interface WasmModuleLike {
    locateFile?: (path: string, prefix?: string) => string;
    instantiateWasm?: (
        imports: WebAssembly.Imports,
        receiveInstance: (instance: WebAssembly.Instance) => WebAssembly.Exports
    ) => WebAssembly.Exports | undefined;
    [key: string]: ModuleValue;
}

/**
 * Methods required to orchestrate WASM instantiation.
 */
export interface WasmLoaderConfig {
    Module: WasmModuleLike;
    wasmBinary?: ArrayBuffer;
    locateFile: (path: string) => string;
    readAsync: (path: string) => Promise<ArrayBuffer>;
    readBinary?: (path: string) => Uint8Array;
    addRunDependency: (id: string) => void;
    removeRunDependency: (id: string) => void;
    readyPromiseReject?: (reason: LoaderError) => void;
    addOnInit: (callback: () => void) => void;
    abort: (reason?: LoaderError) => void;
    err?: (message: string) => void;
    getWasmImports: () => WebAssembly.Imports;
    setWasmExports?: (exports: WebAssembly.Exports) => void;
}

/**
 * Loader interface that exposes the wasm instantiation hook.
 */
export interface WasmLoader {
    /** Instantiates the WASM module and returns its exports. */
    createWasm: () => WebAssembly.Exports | Record<string, never>;
}

/**
 * Constructs the loader responsible for instantiating sqlite3.wasm.
 */
export declare function createWasmLoader(config: WasmLoaderConfig): WasmLoader;
