type ModulePrimitive = string | number | boolean | null | undefined | bigint;

type ModuleLeaf = ModulePrimitive | WebAssembly.Memory | WebAssembly.Table;

type ModuleCallable = (...args: ModuleValue[]) => ModuleValue;

export type ModuleValue =
  | ModuleLeaf
  | ModuleCallable
  | ModuleValue[]
  | { [key: string]: ModuleValue }
  | WebAssembly.Exports;

export type LoaderError = Error | string;

export interface WasmModuleLike extends Record<string, unknown> {
  locateFile?: (path: string, prefix?: string) => string;
  instantiateWasm?: (
    imports: WebAssembly.Imports,
    receiveInstance: (instance: WebAssembly.Instance) => WebAssembly.Exports,
  ) => WebAssembly.Exports | undefined;
}

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

export interface WasmLoader {
  /** Instantiates the WASM module and returns its exports. */
  createWasm: () => WebAssembly.Exports | Record<string, never>;
}

const dataURIPrefix = "data:application/octet-stream;base64,";
const wasmFileName = "sqlite3.wasm";

const isDataURI = (filename: string): boolean =>
  filename.startsWith(dataURIPrefix);

export function createWasmLoader(config: WasmLoaderConfig): WasmLoader {
  const {
    Module,
    wasmBinary,
    locateFile,
    readAsync,
    readBinary,
    addRunDependency,
    removeRunDependency,
    readyPromiseReject,
    addOnInit,
    abort,
    err,
    getWasmImports,
    setWasmExports,
  } = config;

  let wasmBinaryFile: string | undefined;

  const findWasmBinary = (): string => {
    if (Module.locateFile) {
      if (!isDataURI(wasmFileName)) {
        return locateFile(wasmFileName);
      }
      return wasmFileName;
    }

    return new URL(wasmFileName, import.meta.url).href;
  };

  const getBinarySync = (file: string): Uint8Array => {
    if (file === wasmBinaryFile && wasmBinary) {
      return new Uint8Array(wasmBinary);
    }

    if (readBinary) {
      return readBinary(file);
    }

    throw new Error("both async and sync fetching of the wasm failed");
  };

  const getBinaryPromise = (binaryFile: string): Promise<Uint8Array> => {
    if (!wasmBinary) {
      return readAsync(binaryFile).then(
        (response) => new Uint8Array(response),
        () => getBinarySync(binaryFile),
      );
    }

    return Promise.resolve().then(() => getBinarySync(binaryFile));
  };

  const instantiateArrayBuffer = (
    binaryFile: string,
    imports: WebAssembly.Imports,
    receiver: (
      result: WebAssembly.WebAssemblyInstantiatedSource,
    ) => WebAssembly.Exports,
  ): Promise<WebAssembly.Exports> => {
    return getBinaryPromise(binaryFile)
      .then(
        (binary) =>
          WebAssembly.instantiate(
            binary,
            imports,
          ) as unknown as Promise<WebAssembly.WebAssemblyInstantiatedSource>,
      )
      .then(receiver, (reason) => {
        err?.(`failed to asynchronously prepare wasm: ${reason}`);
        abort(reason);
        throw reason;
      });
  };

  const instantiateAsync = (
    binary: ArrayBuffer | undefined,
    binaryFile: string,
    imports: WebAssembly.Imports,
    callback: (
      result: WebAssembly.WebAssemblyInstantiatedSource,
    ) => WebAssembly.Exports,
  ): Promise<WebAssembly.Exports> => {
    if (
      !binary &&
      typeof WebAssembly.instantiateStreaming === "function" &&
      !isDataURI(binaryFile) &&
      typeof fetch === "function"
    ) {
      return fetch(binaryFile, { credentials: "same-origin" }).then(
        (response) => {
          const result = WebAssembly.instantiateStreaming(response, imports);
          return result.then(callback, (reason) => {
            err?.(`wasm streaming compile failed: ${reason}`);
            err?.("falling back to ArrayBuffer instantiation");
            return instantiateArrayBuffer(binaryFile, imports, callback);
          });
        },
      );
    }

    return instantiateArrayBuffer(binaryFile, imports, callback);
  };

  function createWasm(): WebAssembly.Exports | Record<string, never> {
    // 1. Prepare imports and dependency tracking
    const info = getWasmImports();

    // 2. Core instantiation logic
    const receiveInstance = (
      instance: WebAssembly.Instance,
    ): WebAssembly.Exports => {
      const exports = instance.exports;
      addOnInit(exports["__wasm_call_ctors"] as () => void);
      removeRunDependency("wasm-instantiate");
      setWasmExports?.(exports);
      return exports;
    };

    addRunDependency("wasm-instantiate");
    const receiveInstantiationResult = (
      result: WebAssembly.WebAssemblyInstantiatedSource,
    ): WebAssembly.Exports => receiveInstance(result.instance);

    const wasmHook = Module.instantiateWasm;
    if (wasmHook) {
      try {
        const wasmHookResult = wasmHook(info, receiveInstance);
        if (wasmHookResult) {
          return wasmHookResult;
        }
        return {};
      } catch (error) {
        err?.(`Module.instantiateWasm callback failed with error: ${error}`);
        readyPromiseReject?.(
          (error ?? "Module.instantiateWasm failed") as LoaderError,
        );
        return {};
      }
    }

    wasmBinaryFile ??= findWasmBinary();
    instantiateAsync(
      wasmBinary,
      wasmBinaryFile,
      info,
      receiveInstantiationResult,
    ).catch((reason) => readyPromiseReject?.(reason as LoaderError));

    // 3. Return a placeholder until the async instantiation completes
    return {};
  }

  const loader: WasmLoader = {
    createWasm,
  };

  return loader;
}
