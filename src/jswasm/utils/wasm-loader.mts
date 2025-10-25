import type { WasmLoader, WasmLoaderConfig } from "./wasm-loader.d.ts";

const DATA_URI_PREFIX = "data:application/octet-stream;base64,";

const isDataURI = (filename: string): boolean =>
    filename.startsWith(DATA_URI_PREFIX);

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
        if (typeof Module.locateFile === "function") {
            const filename = "sqlite3.wasm";
            if (!isDataURI(filename)) {
                return locateFile(filename);
            }
            return filename;
        }

        return new URL("sqlite3.wasm", import.meta.url).href;
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
    ): Promise<WebAssembly.Exports> =>
        getBinaryPromise(binaryFile)
            .then((binary) => WebAssembly.instantiate(binary, imports))
            .then(
                (result) =>
                    receiver(
                        result as unknown as WebAssembly.WebAssemblyInstantiatedSource,
                    ),
                (reason) => {
                    err?.(`failed to asynchronously prepare wasm: ${reason}`);
                    abort(reason as Error);
                    return Promise.reject(reason);
                },
            );

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
                (response) =>
                    WebAssembly.instantiateStreaming(response, imports).then(
                        (result) => callback(result),
                        (reason) => {
                            err?.(`wasm streaming compile failed: ${reason}`);
                            err?.("falling back to ArrayBuffer instantiation");
                            return instantiateArrayBuffer(
                                binaryFile,
                                imports,
                                callback,
                            );
                        },
                    ),
            );
        }

        return instantiateArrayBuffer(binaryFile, imports, callback);
    };

    const createWasm = (): WebAssembly.Exports | Record<string, never> => {
        const info = getWasmImports();

        const receiveInstance = (
            instance: WebAssembly.Instance,
        ): WebAssembly.Exports => {
            const exports = instance.exports;
            const ctor = exports["__wasm_call_ctors"] as
                | (() => void)
                | undefined;
            if (ctor) {
                addOnInit(ctor);
            }
            removeRunDependency("wasm-instantiate");
            setWasmExports?.(exports);
            return exports;
        };

        addRunDependency("wasm-instantiate");

        const receiveInstantiationResult = (
            result: WebAssembly.WebAssemblyInstantiatedSource,
        ): WebAssembly.Exports => receiveInstance(result.instance);

        if (typeof Module.instantiateWasm === "function") {
            try {
                const instantiated = Module.instantiateWasm(
                    info,
                    receiveInstance,
                );
                return instantiated ?? {};
            } catch (error) {
                err?.(
                    `Module.instantiateWasm callback failed with error: ${error}`,
                );
                readyPromiseReject?.(error as Error);
            }
        }

        wasmBinaryFile ??= findWasmBinary();

        instantiateAsync(
            wasmBinary,
            wasmBinaryFile,
            info,
            receiveInstantiationResult,
        ).catch((reason) => readyPromiseReject?.(reason as Error));

        return {};
    };

    return { createWasm };
}
