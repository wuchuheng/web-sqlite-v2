/**
 * @typedef {import("./create-sqlite3-facade.d.ts").CreateSqlite3FacadeOptions} CreateSqlite3FacadeOptions
 * @typedef {import("./create-sqlite3-facade.d.ts").Sqlite3Facade} Sqlite3Facade
 */

/**
 * Constructs the public-facing sqlite3 facade and runs the synchronous
 * bootstrap initialisers. The resulting object mirrors the shape exposed by
 * the upstream distribution but keeps the control flow here explicit.
 *
 * @param {CreateSqlite3FacadeOptions} options
 * @returns {Sqlite3Facade}
 */
export function createSqlite3Facade(options) {
    const {
        sqlite3ApiBootstrap,
        WasmAllocError,
        SQLite3Error,
        capi,
        util,
        wasm,
        config,
    } = options;

    /** @type {Sqlite3Facade} */
    const sqlite3 = {
        WasmAllocError,
        SQLite3Error,
        capi,
        util,
        wasm,
        config,
        version: Object.create(null),
        client: undefined,
        asyncPostInit: async function ff() {
            if (ff.isReady instanceof Promise) {
                return ff.isReady;
            }
            let asyncInitialisers = sqlite3ApiBootstrap.initializersAsync;
            delete sqlite3ApiBootstrap.initializersAsync;
            const finaliser = async () => {
                if (!sqlite3.__isUnderTest) {
                    delete sqlite3.util;
                    delete sqlite3.StructBinder;
                }
                return sqlite3;
            };
            const crashIfRejected = (error) => {
                config.error("An async sqlite3 initializer failed:", error);
                throw error;
            };
            if (!asyncInitialisers || asyncInitialisers.length === 0) {
                ff.isReady = finaliser().catch(crashIfRejected);
                return ff.isReady;
            }
            asyncInitialisers = asyncInitialisers.map((fn) =>
                fn instanceof Function ? async () => fn(sqlite3) : fn
            );
            asyncInitialisers.push(finaliser);
            let chain = Promise.resolve(sqlite3);
            while (asyncInitialisers.length) {
                chain = chain.then(asyncInitialisers.shift());
            }
            ff.isReady = chain.catch(crashIfRejected);
            return ff.isReady;
        },
        scriptInfo: undefined,
    };

    try {
        sqlite3ApiBootstrap.initializers.forEach((initializer) => {
            initializer(sqlite3);
        });
    } catch (error) {
        console.error("sqlite3 bootstrap initializer threw:", error);
        throw error;
    }

    delete sqlite3ApiBootstrap.initializers;
    sqlite3ApiBootstrap.sqlite3 = sqlite3;
    return sqlite3;
}
