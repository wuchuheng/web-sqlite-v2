/**
 * Module configuration utilities for Emscripten WebAssembly initialization.
 * Handles file location, script directory setup, and module option overrides.
 *
 * @module runtime/module-configurator
 */

/**
 * Creates a locateFile function for resolving WebAssembly file paths.
 *
 * @param {string} importMetaUrl - The import.meta.url value
 * @returns {(path: string, prefix: string) => string} File location resolver function
 */
export function createLocateFile(importMetaUrl) {
    /**
     * Resolves the full path for a WebAssembly file.
     *
     * @param {string} path - The file path to resolve
     * @param {string} _prefix - The prefix (unused)
     * @returns {string} The resolved file URL
     */
    return function locateFile(path, _prefix) {
        // 1. Handle special case for sqlite3.wasm
        if (path === "sqlite3.wasm") {
            return new URL("./wasm/sqlite3.wasm", importMetaUrl).href;
        }

        // 2. Resolve relative to import.meta.url
        return new URL(path, importMetaUrl).href;
    };
}

/**
 * Creates the locateFile wrapper function for use in Module configuration.
 *
 * @param {Object} Module - The Emscripten module object
 * @param {string} importMetaUrl - The import.meta.url value
 */
export function setupModuleLocateFile(Module, importMetaUrl) {
    // 1. Get sqlite3InitModuleState from globalThis
    const sqlite3InitModuleState =
        globalThis.sqlite3InitModuleState ||
        Object.assign(Object.create(null), {
            debugModule: () => {},
        });

    // 2. Clean up global state
    delete globalThis.sqlite3InitModuleState;

    // 3. Debug log location
    sqlite3InitModuleState.debugModule(
        "globalThis.location =",
        globalThis.location
    );

    // 4. Set up Module's locateFile function
    Module["locateFile"] = createLocateFile(importMetaUrl).bind(sqlite3InitModuleState);
}

/**
 * Creates a locateFile function that uses Module's locateFile if available.
 *
 * @param {Object} Module - The Emscripten module object
 * @param {string} scriptDirectory - The base script directory
 * @returns {(path: string) => string} File location function
 */
export function createModuleLocateFile(Module, scriptDirectory) {
    /**
     * Locates a file using Module's locateFile if available, otherwise uses scriptDirectory.
     *
     * @param {string} path - The file path to locate
     * @returns {string} The resolved file path
     */
    return function locateFile(path) {
        // 1. Use Module's locateFile if available
        if (Module["locateFile"]) {
            return Module["locateFile"](path, scriptDirectory);
        }

        // 2. Fall back to scriptDirectory
        return scriptDirectory + path;
    };
}

/**
 * Configures console output functions for the module.
 *
 * @param {Object} Module - The Emscripten module object
 * @returns {{
 *   out: (...args: any[]) => void,
 *   err: (...args: any[]) => void
 * }} Output and error logging functions
 */
export function setupConsoleOutput(Module) {
    // 1. Set up standard output function
    const out = Module["print"] || console.log.bind(console);

    // 2. Set up error output function
    const err = Module["printErr"] || console.error.bind(console);

    // 3. Return output functions
    return { out, err };
}

/**
 * Creates an abort function for handling fatal errors.
 *
 * @param {Object} Module - The Emscripten module object
 * @param {(...args: any[]) => void} err - Error logging function
 * @param {Function} readyPromiseReject - Promise rejection function
 * @returns {(what: any) => never} Abort function
 */
export function createAbortFunction(Module, err, readyPromiseReject) {
    /**
     * Aborts the WebAssembly module with an error message.
     *
     * @param {any} what - The error or reason for aborting
     * @throws {WebAssembly.RuntimeError} Always throws a runtime error
     */
    return function abort(what) {
        // 1. Call Module's onAbort hook if present
        Module["onAbort"]?.(what);

        // 2. Format error message
        what = "Aborted(" + what + ")";
        err(what);

        // 3. Set abort flag
        Module.ABORT = true;

        // 4. Enhance error message
        what += ". Build with -sASSERTIONS for more info.";

        // 5. Create and throw runtime error
        const e = new WebAssembly.RuntimeError(what);
        readyPromiseReject(e);
        throw e;
    };
}

/**
 * Initializes the module with configuration overrides.
 *
 * @param {Object} Module - The Emscripten module object
 * @param {Object} moduleArg - User-provided module configuration
 * @returns {Object} Module overrides that were applied
 */
export function initializeModule(Module, moduleArg) {
    // 1. Copy all properties from moduleArg to Module
    Object.assign(Module, moduleArg);

    // 2. Save overrides for later restoration
    const moduleOverrides = Object.assign({}, Module);

    // 3. Return overrides
    return moduleOverrides;
}

/**
 * Applies saved module overrides.
 *
 * @param {Object} Module - The Emscripten module object
 * @param {Object} moduleOverrides - Previously saved module overrides
 */
export function applyModuleOverrides(Module, moduleOverrides) {
    // 1. Apply all saved overrides
    Object.assign(Module, moduleOverrides);
}

/**
 * Executes Module's preInit callbacks.
 *
 * @param {Object} Module - The Emscripten module object
 */
export function runPreInitCallbacks(Module) {
    // 1. Check if preInit exists
    if (!Module["preInit"]) {
        return;
    }

    // 2. Convert single function to array
    if (typeof Module["preInit"] === "function") {
        Module["preInit"] = [Module["preInit"]];
    }

    // 3. Execute all preInit callbacks in reverse order
    while (Module["preInit"].length > 0) {
        Module["preInit"].pop()();
    }
}
