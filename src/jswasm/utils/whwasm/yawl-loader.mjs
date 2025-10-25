/**
 * @fileoverview Implements the yawl() loader helper used by the wh-wasm installer.
 */

/**
 * Builds a loader helper that mirrors the original yawl() helper while using
 * the refactored installer implementation under the hood.
 *
 * @param {import("./installer-context.d.ts").WhWasmInstaller} install - Installer returned by createWhWasmUtilInstaller.
 * @returns {import("./yawl-loader.d.ts").YawlLoaderFactory} Factory returning a function that loads and instantiates the WASM module.
 */
export function createYawlLoader(install) {
    return function yawl(config) {
        const options = config && typeof config === "object" ? config : {};
        const fetchWasm = () =>
            fetch(options.uri, { credentials: "same-origin" });

        const finalize = (result) => {
            if (options.wasmUtilTarget) {
                const target = options.wasmUtilTarget;
                const toss = (...args) => {
                    throw new Error(args.join(" "));
                };
                target.module = result.module;
                target.instance = result.instance;

                if (!target.instance.exports.memory) {
                    target.memory =
                        (options.imports &&
                            options.imports.env &&
                            options.imports.env.memory) ||
                        toss("Missing 'memory' object!");
                }
                if (!target.alloc && result.instance.exports.malloc) {
                    const wasmExports = result.instance.exports;
                    target.alloc = (n) =>
                        wasmExports.malloc(n) ||
                        toss("Allocation of", n, "bytes failed.");
                    target.dealloc = (ptr) => wasmExports.free(ptr);
                }
                install(target);
            }
            if (options.onload) {
                options.onload(result, options);
            }
            return result;
        };

        const instantiate = () => {
            if (
                typeof WebAssembly.instantiateStreaming === "function" &&
                !(options.noStreaming instanceof Function
                    ? options.noStreaming()
                    : options.noStreaming)
            ) {
                return WebAssembly.instantiateStreaming(
                    fetchWasm(),
                    options.imports || {},
                ).then(finalize);
            }
            return fetchWasm()
                .then((response) => response.arrayBuffer())
                .then((bytes) =>
                    WebAssembly.instantiate(bytes, options.imports || {}),
                )
                .then(finalize);
        };

        return instantiate;
    };
}
