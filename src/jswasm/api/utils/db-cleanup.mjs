/**
 * @fileoverview Database cleanup utilities for tracking and cleaning up database resources
 *
 * This module manages cleanup of database resources including:
 * - User-defined functions (UDFs)
 * - Window functions
 * - Collations
 * - Hooks (commit, rollback, update, etc.)
 *
 * The cleanup map tracks all resources that need to be released when a database is closed.
 */

/**
 * Creates a database cleanup manager.
 *
 * @param {import("../../wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts").Sqlite3WasmNamespace} wasm
 *        Wasm helper namespace.
 * @param {import("../oo1-db/context.d.ts").SQLite3CapiWithHelpers} capi C API namespace with helpers.
 * @returns {import("./db-cleanup.d.ts").DbCleanupMap} Database cleanup utilities
 */
export function createDbCleanup(wasm, capi) {
    /**
     * Converts a pointer or other value to a standardized DB pointer.
     *
     * @param {number|Object} pDb - Database pointer or object
     * @returns {number} Database pointer
     */
    const __argPDb = (pDb) => wasm.xWrap.argAdapter("sqlite3*")(pDb);

    /**
     * Converts a pointer or string to a JavaScript string.
     *
     * @param {number|string} str - Pointer to string or string
     * @returns {string} JavaScript string
     */
    const __argStr = (str) => (wasm.isPtr(str) ? wasm.cstrToJs(str) : str);

    /**
     * Manages cleanup resources for open databases.
     * Maps database pointer to cleanup metadata.
     */
    const __dbCleanupMap = function (pDb, mode) {
        // 1. Get database pointer
        pDb = __argPDb(pDb);
        let m = this.dbMap.get(pDb);

        // 2. Handle different modes
        if (!mode) {
            // Mode 0: Remove and return metadata
            this.dbMap.delete(pDb);
            return m;
        } else if (!m && mode > 0) {
            // Mode > 0: Create new metadata if doesn't exist
            this.dbMap.set(pDb, (m = Object.create(null)));
        }

        // 3. Return metadata
        return m;
    }.bind(
        Object.assign(Object.create(null), {
            dbMap: new Map(),
        })
    );

    /**
     * Adds a collation to the cleanup tracker.
     *
     * @param {number} pDb - Database pointer
     * @param {string|number} name - Collation name
     */
    __dbCleanupMap.addCollation = function (pDb, name) {
        // 1. Get or create metadata
        const m = __dbCleanupMap(pDb, 1);

        // 2. Initialize collation set if needed
        if (!m.collation) m.collation = new Set();

        // 3. Add collation name (normalized to lowercase)
        m.collation.add(__argStr(name).toLowerCase());
    };

    /**
     * Internal helper to add a UDF to a map.
     *
     * @param {number} pDb - Database pointer (unused but kept for consistency)
     * @param {string|number} name - Function name
     * @param {number} arity - Function arity (-1 for variadic)
     * @param {Map} map - Map to add to (udf or wudf)
     * @private
     */
    __dbCleanupMap._addUDF = function (_pDb, name, arity, map) {
        // 1. Normalize name to lowercase
        name = __argStr(name).toLowerCase();

        // 2. Get or create arity set for this function name
        let u = map.get(name);
        if (!u) map.set(name, (u = new Set()));

        // 3. Add arity (use -1 for variadic)
        u.add(arity < 0 ? -1 : arity);
    };

    /**
     * Adds a user-defined function to the cleanup tracker.
     *
     * @param {number} pDb - Database pointer
     * @param {string|number} name - Function name
     * @param {number} arity - Function arity (-1 for variadic)
     */
    __dbCleanupMap.addFunction = function (pDb, name, arity) {
        // 1. Get or create metadata
        const m = __dbCleanupMap(pDb, 1);

        // 2. Initialize UDF map if needed
        if (!m.udf) m.udf = new Map();

        // 3. Add function
        this._addUDF(pDb, name, arity, m.udf);
    };

    /**
     * Adds a window function to the cleanup tracker.
     *
     * @param {number} pDb - Database pointer
     * @param {string|number} name - Function name
     * @param {number} arity - Function arity (-1 for variadic)
     */
    if (wasm.exports.sqlite3_create_window_function) {
        __dbCleanupMap.addWindowFunc = function (pDb, name, arity) {
            // 1. Get or create metadata
            const m = __dbCleanupMap(pDb, 1);

            // 2. Initialize window UDF map if needed
            if (!m.wudf) m.wudf = new Map();

            // 3. Add window function
            this._addUDF(pDb, name, arity, m.wudf);
        };
    }

    /**
     * Cleans up all resources associated with a database.
     *
     * @param {number} pDb - Database pointer
     */
    __dbCleanupMap.cleanup = function (pDb) {
        // 1. Get database pointer
        pDb = __argPDb(pDb);

        // 2. Clear all hooks
        const closeArgs = [pDb];
        for (const name of [
            "sqlite3_busy_handler",
            "sqlite3_commit_hook",
            "sqlite3_preupdate_hook",
            "sqlite3_progress_handler",
            "sqlite3_rollback_hook",
            "sqlite3_set_authorizer",
            "sqlite3_trace_v2",
            "sqlite3_update_hook",
        ]) {
            const x = wasm.exports[name];
            if (!x) {
                continue;
            }
            closeArgs.length = x.length;
            try {
                capi[name](...closeArgs);
            } catch (e) {
                console.warn(
                    "close-time call of",
                    name + "(",
                    closeArgs,
                    ") threw:",
                    e
                );
            }
        }

        // 3. Get cleanup metadata
        const m = __dbCleanupMap(pDb, 0);
        if (!m) return;

        // 4. Clean up collations
        if (m.collation) {
            for (const name of m.collation) {
                try {
                    capi.sqlite3_create_collation_v2(
                        pDb,
                        name,
                        capi.SQLITE_UTF8,
                        0,
                        0,
                        0
                    );
                } catch (_e) {}
            }
            delete m.collation;
        }

        // 5. Clean up UDFs and window functions
        let i;
        for (i = 0; i < 2; ++i) {
            const fmap = i ? m.wudf : m.udf;
            if (!fmap) continue;
            const func = i
                ? capi.sqlite3_create_window_function
                : capi.sqlite3_create_function_v2;
            for (const e of fmap) {
                const name = e[0],
                    arities = e[1];
                const fargs = [
                    pDb,
                    name,
                    0,
                    capi.SQLITE_UTF8,
                    0,
                    0,
                    0,
                    0,
                    0,
                ];
                if (i) fargs.push(0);
                for (const arity of arities) {
                    try {
                        fargs[2] = arity;
                        func.apply(null, fargs);
                    } catch (_e) {}
                }
                arities.clear();
            }
            fmap.clear();
        }
        delete m.udf;
        delete m.wudf;
    };

    return __dbCleanupMap;
}
