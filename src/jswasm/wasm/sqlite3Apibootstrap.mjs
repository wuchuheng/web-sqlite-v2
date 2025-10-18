import { Module, wasmExports } from "../sqlite3.mjs";
import { resolveBootstrapConfig } from "./bootstrap/configuration.mjs";
import {
    createResultCodeStringifier,
    createSQLite3Error,
    createWasmAllocError,
} from "./bootstrap/error-utils.mjs";
import { createBootstrapUtil } from "./bootstrap/util-factory.mjs";
import { applyDefaultBootstrapState } from "./bootstrap/default-bootstrap-state.mjs";
import { createLegacyCapiStubs } from "./bootstrap/runtime/legacy-capi-stubs.mjs";
import { createWasmRuntime } from "./bootstrap/runtime/wasm-runtime.mjs";
import { createCapiHelpers } from "./bootstrap/runtime/capi-helpers.mjs";
import { createSqlite3Facade } from "./bootstrap/runtime/create-sqlite3-facade.mjs";

/**
 * @typedef {import("./bootstrap/configuration.d.ts").BootstrapConfig} BootstrapConfig
 */

/**
 * Applies post-load initialization hooks to the compiled SQLite3 module. This
 * function wires the high-level JavaScript bridge after the WebAssembly module
 * becomes available.
 *
 * @param {unknown} _EmscriptenModule The instantiated Emscripten module. The
 * parameter is accepted for compatibility with upstream entry points but is not
 * used directly in the browser integration.
 */
export function runSQLite3PostLoadInit(_EmscriptenModule) {
    "use strict";

    /**
     * Initializes the SQLite3 JavaScript bindings and caches the resulting API
     * instance on the bootstrapper. Subsequent invocations return the cached
     * instance to prevent reconfiguration.
     *
     * @param {Partial<BootstrapConfig> | undefined} apiConfig Optional configuration
     *        overrides supplied by the embedding application. The object is normalized by
     *        {@link resolveBootstrapConfig} before use.
     */
    globalThis.sqlite3ApiBootstrap = function sqlite3ApiBootstrap(
        apiConfig = globalThis.sqlite3ApiConfig ||
            sqlite3ApiBootstrap.defaultConfig
    ) {
        if (sqlite3ApiBootstrap.sqlite3) {
            (sqlite3ApiBootstrap.sqlite3.config || console).warn(
                "sqlite3ApiBootstrap() called multiple times.",
                "Config and external initializers are ignored on calls after the first."
            );
            return sqlite3ApiBootstrap.sqlite3;
        }
        // Normalize configuration once so the rest of the bootstrapper can rely
        // on a predictable shape regardless of how the host page provided the
        // overrides.
        const config = resolveBootstrapConfig(apiConfig, {
            moduleRef: Module,
        });

        delete globalThis.sqlite3ApiConfig;
        delete sqlite3ApiBootstrap.defaultConfig;

        /** @type {import("../sqlite3.d.ts").Sqlite3CAPI} */
        const capi = Object.create(null);
        const wasm = Object.create(null);

        // Error helpers are configured first so subsequent initialization steps
        // can surface actionable feedback when required exports are missing or
        // inputs are malformed.
        const rcToString = createResultCodeStringifier(capi);
        const SQLite3Error = createSQLite3Error(capi, rcToString);
        const toss3 = SQLite3Error.toss;
        const WasmAllocError = createWasmAllocError(capi);

        if (config.wasmfsOpfsDir && !/^\/[^/]+$/.test(config.wasmfsOpfsDir)) {
            toss3(
                "config.wasmfsOpfsDir must be falsy or in the form '/dir-name'."
            );
        }

        // Provide the frequently used wasm/typed-array helpers up front. The
        // bootstrapper mutates the returned `wasm` object with additional
        // methods in subsequent sections.
        const { util } = createBootstrapUtil({ toss3 }, wasm);

        // Seed the wasm namespace with the low-level exports provided by the build.
        Object.assign(wasm, {
            /** @type {import("../sqlite3.d.ts").SQLite3Wasm["ptrSizeof"]} */
            ptrSizeof: config.wasmPtrSizeof || 4,
            /** @type {import("../sqlite3.d.ts").SQLite3Wasm["ptrIR"]} */
            ptrIR: config.wasmPtrIR || "i32",
            /** @type {import("../sqlite3.d.ts").SQLite3Wasm["bigIntEnabled"]} */
            bigIntEnabled: !!config.bigIntEnabled,
            exports:
                config.exports ||
                toss3("Missing API config.exports (WASM module exports)."),
            memory:
                config.memory ||
                config.exports["memory"] ||
                toss3(
                    "API config object requires a WebAssembly.Memory object",
                    "in either config.exports.memory (exported)",
                    "or config.memory (imported)."
                ),
        });

        // Install the legacy capi stubs before the real bindings are wired in.
        Object.assign(capi, createLegacyCapiStubs());

        const wasmRuntime = createWasmRuntime({
            config,
            wasm,
            WasmAllocError,
            toss3,
            util,
            capi,
        });
        Object.assign(wasm, wasmRuntime.extensions);

        Object.assign(
            capi,
            createCapiHelpers({
                capi,
                wasm,
                util,
                config,
                SQLite3Error,
                WasmAllocError,
                toss3,
            })
        );

        // Build the public facade and run any synchronous bootstrap hooks.
        const sqlite3 = createSqlite3Facade({
            sqlite3ApiBootstrap,
            WasmAllocError,
            SQLite3Error,
            capi,
            util,
            wasm,
            config,
        });

        wasmRuntime.bindSqlite3(sqlite3);
        return sqlite3;
    };

    applyDefaultBootstrapState(globalThis.sqlite3ApiBootstrap);

    if ("undefined" !== typeof Module) {
        const SABC = Object.assign(
            Object.create(null),
            {
                exports:
                    "undefined" === typeof wasmExports
                        ? Module["asm"]
                        : wasmExports,
                memory: Module.wasmMemory,
            },
            globalThis.sqlite3ApiConfig || {}
        );

        globalThis.sqlite3ApiConfig = SABC;
        let sqlite3;
        try {
            sqlite3 = globalThis.sqlite3ApiBootstrap();
        } catch (e) {
            console.error("sqlite3ApiBootstrap() error:", e);
            throw e;
        } finally {
            delete globalThis.sqlite3ApiBootstrap;
            delete globalThis.sqlite3ApiConfig;
        }

        Module.sqlite3 = sqlite3;
    } else {
        console.warn(
            "This is not running in an Emscripten module context, so",
            "globalThis.sqlite3ApiBootstrap() is _not_ being called due to lack",
            "of config info for the WASM environment.",
            "It must be called manually."
        );
    }
}
