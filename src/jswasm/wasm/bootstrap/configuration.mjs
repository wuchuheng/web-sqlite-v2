/**
 * @typedef {object} BootstrapConfig
 * @property {WebAssembly.Exports | undefined} exports
 * @property {WebAssembly.Memory | undefined} memory
 * @property {boolean} bigIntEnabled
 * @property {(message?: any, ...optionalParams: any[]) => void} debug
 * @property {(message?: any, ...optionalParams: any[]) => void} warn
 * @property {(message?: any, ...optionalParams: any[]) => void} error
 * @property {(message?: any, ...optionalParams: any[]) => void} log
 * @property {string | undefined} wasmfsOpfsDir
 * @property {boolean} useStdAlloc
 * @property {string} allocExportName
 * @property {string} deallocExportName
 * @property {string} reallocExportName
 * @property {number | undefined} wasmPtrSizeof
 * @property {"i32" | "i64" | undefined} wasmPtrIR
 */

/**
 * Derives the effective bootstrap configuration by merging user overrides with
 * library defaults and post-processing functional values.
 *
 * @param {Partial<BootstrapConfig> | undefined} apiConfig Configuration provided
 * by the embedding application or a cached global.
 * @param {{ moduleRef?: any, globalObject?: typeof globalThis }} [options] Optional
 * handles to the Emscripten module and global scope. The module reference is
 * only inspected for available typed-array views during BigInt detection.
 * @returns {BootstrapConfig}
 */
export function resolveBootstrapConfig(apiConfig, options = {}) {
    const { moduleRef = undefined, globalObject = globalThis } = options;

    // Start from a clean object to avoid mutating caller-provided configuration
    // and to keep property lookup prototypes predictable.
    const defaults = Object.assign(Object.create(null), {
        exports: undefined,
        memory: undefined,
        bigIntEnabled: Boolean(
            moduleRef && moduleRef.HEAPU64
                ? true
                : globalObject && typeof globalObject.BigInt64Array !== "undefined"
        ),
        debug: console.debug.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        log: console.log.bind(console),
        wasmfsOpfsDir: "/opfs",
        useStdAlloc: false,
    });

    const config = Object.assign(Object.create(null), defaults);
    if (apiConfig) {
        Object.assign(config, apiConfig);
    }

    // Derived defaults are layered on top of the caller supplied overrides so
    // that toggling {@link BootstrapConfig.useStdAlloc} consistently updates the
    // bound allocator symbol names even when no explicit values were provided.
    const derivedDefaults = {
        allocExportName: config.useStdAlloc ? "malloc" : "sqlite3_malloc",
        deallocExportName: config.useStdAlloc ? "free" : "sqlite3_free",
        reallocExportName: config.useStdAlloc ? "realloc" : "sqlite3_realloc",
    };

    Object.assign(config, derivedDefaults);
    if (apiConfig) {
        Object.assign(config, apiConfig);
    }

    // Lazy resolve configuration entries that might have been provided as
    // thunks by build tooling to avoid eagerly touching the WASM exports before
    // the bootstrapper is ready.
    ["exports", "memory", "wasmfsOpfsDir"].forEach((key) => {
        if (typeof config[key] === "function") {
            config[key] = config[key]();
        }
    });

    return config;
}
