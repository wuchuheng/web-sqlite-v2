export function createWasmLoader({
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
}) {
    const dataURIPrefix = "data:application/octet-stream;base64,";

    const isDataURI = (filename) => filename.startsWith(dataURIPrefix);

    let wasmBinaryFile;

    function findWasmBinary() {
        if (Module["locateFile"]) {
            const filename = "sqlite3.wasm";
            if (!isDataURI(filename)) {
                return locateFile(filename);
            }
            return filename;
        }
        return new URL("sqlite3.wasm", import.meta.url).href;
    }

    function getBinarySync(file) {
        if (file === wasmBinaryFile && wasmBinary) {
            return new Uint8Array(wasmBinary);
        }
        if (readBinary) {
            return readBinary(file);
        }
        throw new Error("both async and sync fetching of the wasm failed");
    }

    function getBinaryPromise(binaryFile) {
        if (!wasmBinary) {
            return readAsync(binaryFile).then(
                (response) => new Uint8Array(response),
                () => getBinarySync(binaryFile)
            );
        }

        return Promise.resolve().then(() => getBinarySync(binaryFile));
    }

    function instantiateArrayBuffer(binaryFile, imports, receiver) {
        return getBinaryPromise(binaryFile)
            .then((binary) => WebAssembly.instantiate(binary, imports))
            .then(receiver, (reason) => {
                err?.(`failed to asynchronously prepare wasm: ${reason}`);
                abort(reason);
            });
    }

    function instantiateAsync(binary, binaryFile, imports, callback) {
        if (
            !binary &&
            typeof WebAssembly.instantiateStreaming === "function" &&
            !isDataURI(binaryFile) &&
            typeof fetch === "function"
        ) {
            return fetch(binaryFile, { credentials: "same-origin" }).then(
                (response) => {
                    const result = WebAssembly.instantiateStreaming(
                        response,
                        imports
                    );
                    return result.then(
                        callback,
                        (reason) => {
                            err?.(
                                `wasm streaming compile failed: ${reason}`
                            );
                            err?.(
                                "falling back to ArrayBuffer instantiation"
                            );
                            return instantiateArrayBuffer(
                                binaryFile,
                                imports,
                                callback
                            );
                        }
                    );
                }
            );
        }
        return instantiateArrayBuffer(binaryFile, imports, callback);
    }

    function createWasm() {
        const info = getWasmImports();

        function receiveInstance(instance) {
            const exports = instance.exports;
            addOnInit(exports["__wasm_call_ctors"]);
            removeRunDependency("wasm-instantiate");
            setWasmExports?.(exports);
            return exports;
        }

        addRunDependency("wasm-instantiate");

        function receiveInstantiationResult(result) {
            return receiveInstance(result["instance"]);
        }

        if (Module["instantiateWasm"]) {
            try {
                return Module["instantiateWasm"](info, receiveInstance);
            } catch (e) {
                err?.(
                    `Module.instantiateWasm callback failed with error: ${e}`
                );
                readyPromiseReject?.(e);
            }
        }

        wasmBinaryFile ??= findWasmBinary();

        instantiateAsync(
            wasmBinary,
            wasmBinaryFile,
            info,
            receiveInstantiationResult
        ).catch((reason) => readyPromiseReject?.(reason));

        return {};
    }

    return {
        createWasm,
    };
}
