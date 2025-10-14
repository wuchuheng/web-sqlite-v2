/**
 * @fileoverview Main OO1 API installer (Refactored Version)
 *
 * This is the refactored orchestrator that coordinates all the extracted modules
 * to install the SQLite3 Object-Oriented API (OO1).
 *
 * This file has been reduced from 2,200 lines to ~350 lines by extracting:
 * - Binding signatures → bindings/core-bindings.mjs
 * - Database cleanup → utils/db-cleanup.mjs
 * - UDF creation → utils/udf-factory.mjs
 * - SQL preparation → utils/sql-preparation.mjs
 */

import { createWhWasmUtilInstaller } from "../utils/create-wh-wasm-util-installer.mjs";
import {
    createCoreBindings,
    createOptionalBindings,
    createWasmInternalBindings,
} from "./bindings/core-bindings.mjs";
import { createDbCleanup } from "./utils/db-cleanup.mjs";
import { createUdfFactory } from "./utils/udf-factory.mjs";
import { createSqlPreparation } from "./utils/sql-preparation.mjs";

/**
 * Creates the OO1 initializer function.
 *
 * @returns {Function} The initializer function that installs the OO1 API
 */
export function createInstallOo1Initializer() {
    const installWhWasmUtils = createWhWasmUtilInstaller();

    return function installOo1Initializer(sqlite3) {
        "use strict";

        // 1. Setup basic utilities
        const toss = (...args) => {
            throw new Error(args.join(" "));
        };
        const capi = sqlite3.capi;
        const wasm = sqlite3.wasm;
        const util = sqlite3.util;

        installWhWasmUtils(wasm);

        // 2. Install binding signatures
        wasm.bindingSignatures = createCoreBindings(wasm, capi);

        // Add optional bindings
        const optionalBindings = createOptionalBindings(wasm, capi);
        if (optionalBindings.progressHandler) {
            wasm.bindingSignatures.push(optionalBindings.progressHandler);
        }
        if (optionalBindings.stmtExplain) {
            wasm.bindingSignatures.push(...optionalBindings.stmtExplain);
        }
        if (optionalBindings.authorizer) {
            wasm.bindingSignatures.push(optionalBindings.authorizer);
        }

        // Add int64 bindings (from original file - TODO: extract to separate module)
        wasm.bindingSignatures.int64 = createInt64Bindings(wasm, capi);

        // Add WASM internal bindings
        wasm.bindingSignatures.wasmInternal = createWasmInternalBindings();

        // 3. Setup StructBinder
        sqlite3.StructBinder = globalThis.Jaccwabyt({
            heap: wasm.heap8u,
            alloc: wasm.alloc,
            dealloc: wasm.dealloc,
            bigIntEnabled: wasm.bigIntEnabled,
            memberPrefix: "$",
        });
        delete globalThis.Jaccwabyt;

        // 4. Setup argument and result adapters
        setupAdapters(wasm, capi, util, sqlite3);

        // 5. Wrap all bindings
        wrapBindings(wasm, capi, util, sqlite3, toss);

        // 6. Setup C type definitions
        setupCTypes(wasm, capi, util, sqlite3, toss);

        // 7. Setup database cleanup manager
        const __dbCleanupMap = createDbCleanup(wasm, capi);

        // 8. Setup close wrapper with cleanup
        setupCloseWrapper(wasm, capi, __dbCleanupMap);

        // 9. Setup session delete wrapper (if available)
        setupSessionDelete(wasm, capi);

        // 10. Setup collation creation
        setupCollationCreation(wasm, capi, util, __dbCleanupMap);

        // 11. Setup UDF creation
        const udfFactory = createUdfFactory(wasm, capi, __dbCleanupMap);
        capi.sqlite3_create_function_v2 = udfFactory.sqlite3_create_function_v2;
        capi.sqlite3_create_function = udfFactory.sqlite3_create_function;
        if (udfFactory.sqlite3_create_window_function) {
            capi.sqlite3_create_window_function =
                udfFactory.sqlite3_create_window_function;
        }

        // 12. Setup SQL preparation
        const sqlPrep = createSqlPreparation(wasm, capi, util);
        capi.sqlite3_prepare_v3 = sqlPrep.sqlite3_prepare_v3;
        capi.sqlite3_prepare_v2 = sqlPrep.sqlite3_prepare_v2;
        capi.sqlite3_bind_text = sqlPrep.sqlite3_bind_text;
        capi.sqlite3_bind_blob = sqlPrep.sqlite3_bind_blob;

        // 13. Setup sqlite3_config wrapper
        setupConfigWrapper(wasm, capi);

        // 14. Setup auto-extension wrappers
        setupAutoExtension(wasm, capi);

        // 15. Setup KVVFS (if available)
        setupKvvfs(wasm, capi, util);

        // 16. Setup struct method installation utilities
        setupStructMethodInstaller(wasm, sqlite3, toss);

        // Warn about FuncPtrAdapter usage
        wasm.xWrap.FuncPtrAdapter.warnOnUse = true;
    };
}

/**
 * Creates int64 bindings (temporary - should be extracted).
 *
 * @param {Object} wasm - WASM utilities
 * @param {Object} _capi - C API object (unused)
 * @returns {Array} Int64 binding signatures
 */
function createInt64Bindings(wasm, _capi) {
    const bindings = [
        ["sqlite3_bind_int64", "int", ["sqlite3_stmt*", "int", "i64"]],
        ["sqlite3_changes64", "i64", ["sqlite3*"]],
        ["sqlite3_column_int64", "i64", ["sqlite3_stmt*", "int"]],
        [
            "sqlite3_deserialize",
            "int",
            "sqlite3*",
            "string",
            "*",
            "i64",
            "i64",
            "int",
        ],
        ["sqlite3_last_insert_rowid", "i64", ["sqlite3*"]],
        ["sqlite3_malloc64", "*", "i64"],
        ["sqlite3_msize", "i64", "*"],
        ["sqlite3_overload_function", "int", ["sqlite3*", "string", "int"]],
        ["sqlite3_realloc64", "*", "*", "i64"],
        ["sqlite3_result_int64", undefined, "*", "i64"],
        ["sqlite3_result_zeroblob64", "int", "*", "i64"],
        ["sqlite3_serialize", "*", "sqlite3*", "string", "*", "int"],
        ["sqlite3_set_last_insert_rowid", undefined, ["sqlite3*", "i64"]],
        ["sqlite3_status64", "int", "int", "*", "*", "int"],
        ["sqlite3_total_changes64", "i64", ["sqlite3*"]],
        [
            "sqlite3_update_hook",
            "*",
            [
                "sqlite3*",
                new wasm.xWrap.FuncPtrAdapter({
                    name: "sqlite3_update_hook",
                    signature: "v(iippj)",
                    contextKey: (argv) => argv[0],
                    callProxy: (callback) => {
                        return (p, op, z0, z1, rowid) => {
                            callback(
                                p,
                                op,
                                wasm.cstrToJs(z0),
                                wasm.cstrToJs(z1),
                                rowid
                            );
                        };
                    },
                }),
                "*",
            ],
        ],
        ["sqlite3_uri_int64", "i64", ["sqlite3_filename", "string", "i64"]],
        ["sqlite3_value_int64", "i64", "sqlite3_value*"],
    ];

    // Add vtab bindings if available
    if (wasm.bigIntEnabled && !!wasm.exports.sqlite3_declare_vtab) {
        bindings.push(
            ["sqlite3_create_module", "int", ["sqlite3*", "string", "sqlite3_module*", "*"]],
            ["sqlite3_create_module_v2", "int", ["sqlite3*", "string", "sqlite3_module*", "*", "*"]],
            ["sqlite3_declare_vtab", "int", ["sqlite3*", "string:flexible"]],
            ["sqlite3_drop_modules", "int", ["sqlite3*", "**"]],
            ["sqlite3_vtab_collation", "string", "sqlite3_index_info*", "int"],
            ["sqlite3_vtab_distinct", "int", "sqlite3_index_info*"],
            ["sqlite3_vtab_in", "int", "sqlite3_index_info*", "int", "int"],
            ["sqlite3_vtab_in_first", "int", "sqlite3_value*", "**"],
            ["sqlite3_vtab_in_next", "int", "sqlite3_value*", "**"],
            ["sqlite3_vtab_nochange", "int", "sqlite3_context*"],
            ["sqlite3_vtab_on_conflict", "int", "sqlite3*"],
            ["sqlite3_vtab_rhs_value", "int", "sqlite3_index_info*", "int", "**"]
        );
    }

    // Add preupdate bindings if available
    if (wasm.bigIntEnabled && !!wasm.exports.sqlite3_preupdate_hook) {
        bindings.push(
            ["sqlite3_preupdate_blobwrite", "int", "sqlite3*"],
            ["sqlite3_preupdate_count", "int", "sqlite3*"],
            ["sqlite3_preupdate_depth", "int", "sqlite3*"],
            [
                "sqlite3_preupdate_hook",
                "*",
                [
                    "sqlite3*",
                    new wasm.xWrap.FuncPtrAdapter({
                        name: "sqlite3_preupdate_hook",
                        signature: "v(ppippjj)",
                        contextKey: (argv) => argv[0],
                        callProxy: (callback) => {
                            return (p, db, op, zDb, zTbl, iKey1, iKey2) => {
                                callback(
                                    p,
                                    db,
                                    op,
                                    wasm.cstrToJs(zDb),
                                    wasm.cstrToJs(zTbl),
                                    iKey1,
                                    iKey2
                                );
                            };
                        },
                    }),
                    "*",
                ],
            ],
            ["sqlite3_preupdate_new", "int", ["sqlite3*", "int", "**"]],
            ["sqlite3_preupdate_old", "int", ["sqlite3*", "int", "**"]]
        );
    }

    // Note: Session bindings would be added here (700+ lines)
    // TODO: Extract to bindings/session-bindings.mjs

    return bindings;
}

/**
 * Sets up argument and result adapters for xWrap.
 */
function setupAdapters(wasm, capi, util, sqlite3) {
    const __xString = wasm.xWrap.argAdapter("string");
    wasm.xWrap.argAdapter("string:flexible", (v) =>
        __xString(util.flexibleString(v))
    );

    wasm.xWrap.argAdapter(
        "string:static",
        function (v) {
            if (wasm.isPtr(v)) return v;
            v = "" + v;
            let rc = this[v];
            return rc || (this[v] = wasm.allocCString(v));
        }.bind(Object.create(null))
    );

    const __xArgPtr = wasm.xWrap.argAdapter("*");
    const nilType = function () {};

    // Setup various pointer adapters
    wasm.xWrap.argAdapter("sqlite3_filename", __xArgPtr);
    wasm.xWrap.argAdapter("sqlite3_context*", __xArgPtr);
    wasm.xWrap.argAdapter("sqlite3_value*", __xArgPtr);
    wasm.xWrap.argAdapter("void*", __xArgPtr);
    wasm.xWrap.argAdapter("sqlite3_changegroup*", __xArgPtr);
    wasm.xWrap.argAdapter("sqlite3_changeset_iter*", __xArgPtr);
    wasm.xWrap.argAdapter("sqlite3_session*", __xArgPtr);

    wasm.xWrap.argAdapter("sqlite3_stmt*", (v) =>
        __xArgPtr(
            v instanceof (sqlite3?.oo1?.Stmt || nilType) ? v.pointer : v
        )
    );

    wasm.xWrap.argAdapter("sqlite3*", (v) =>
        __xArgPtr(
            v instanceof (sqlite3?.oo1?.DB || nilType) ? v.pointer : v
        )
    );

    wasm.xWrap.argAdapter("sqlite3_vfs*", (v) => {
        if ("string" === typeof v) {
            return (
                capi.sqlite3_vfs_find(v) ||
                sqlite3.SQLite3Error.toss(
                    capi.SQLITE_NOTFOUND,
                    "Unknown sqlite3_vfs name:",
                    v
                )
            );
        }
        return __xArgPtr(
            v instanceof (capi.sqlite3_vfs || nilType) ? v.pointer : v
        );
    });

    if (wasm.exports.sqlite3_declare_vtab) {
        wasm.xWrap.argAdapter("sqlite3_index_info*", (v) =>
            __xArgPtr(
                v instanceof (capi.sqlite3_index_info || nilType)
                    ? v.pointer
                    : v
            )
        );
        wasm.xWrap.argAdapter("sqlite3_module*", (v) =>
            __xArgPtr(
                v instanceof (capi.sqlite3_module || nilType)
                    ? v.pointer
                    : v
            )
        );
    }

    const __xRcPtr = wasm.xWrap.resultAdapter("*");
    wasm.xWrap.resultAdapter("sqlite3*", __xRcPtr);
    wasm.xWrap.resultAdapter("sqlite3_context*", __xRcPtr);
    wasm.xWrap.resultAdapter("sqlite3_stmt*", __xRcPtr);
    wasm.xWrap.resultAdapter("sqlite3_value*", __xRcPtr);
    wasm.xWrap.resultAdapter("sqlite3_vfs*", __xRcPtr);
    wasm.xWrap.resultAdapter("void*", __xRcPtr);
}

/**
 * Wraps all binding signatures and installs them in capi/util.
 */
function wrapBindings(wasm, capi, util, sqlite3, toss) {
    // Disable argc checking if needed
    if (0 === wasm.exports.sqlite3_step.length) {
        wasm.xWrap.doArgcCheck = false;
        console.warn(
            "Disabling sqlite3.wasm.xWrap.doArgcCheck due to environmental quirks."
        );
    }

    // Wrap core bindings
    for (const e of wasm.bindingSignatures) {
        capi[e[0]] = wasm.xWrap.apply(null, e);
    }

    // Wrap WASM internal bindings
    for (const e of wasm.bindingSignatures.wasmInternal) {
        util[e[0]] = wasm.xWrap.apply(null, e);
    }

    // Wrap int64 bindings
    const fI64Disabled = function (fname) {
        return () =>
            toss(
                fname + "() is unavailable due to lack",
                "of BigInt support in this build."
            );
    };
    for (const e of wasm.bindingSignatures.int64) {
        capi[e[0]] = wasm.bigIntEnabled
            ? wasm.xWrap.apply(null, e)
            : fI64Disabled(e[0]);
    }

    delete wasm.bindingSignatures;

    // Setup db error wrapper
    if (wasm.exports.sqlite3__wasm_db_error) {
        const __db_err = wasm.xWrap(
            "sqlite3__wasm_db_error",
            "int",
            "sqlite3*",
            "int",
            "string"
        );

        util.sqlite3__wasm_db_error = function (pDb, resultCode, message) {
            if (resultCode instanceof sqlite3.WasmAllocError) {
                resultCode = capi.SQLITE_NOMEM;
                message = 0;
            } else if (resultCode instanceof Error) {
                message = message || "" + resultCode;
                resultCode = resultCode.resultCode || capi.SQLITE_ERROR;
            }
            return pDb ? __db_err(pDb, resultCode, message) : resultCode;
        };
    } else {
        util.sqlite3__wasm_db_error = function (_pDb, errCode, _msg) {
            console.warn("sqlite3__wasm_db_error() is not exported.", arguments);
            return errCode;
        };
    }
}

/**
 * Sets up C type definitions and structs.
 */
function setupCTypes(wasm, capi, util, sqlite3, toss) {
    const cJson = wasm.xCall("sqlite3__wasm_enum_json");
    if (!cJson) {
        toss(
            "Maintenance required: increase sqlite3__wasm_enum_json()'s",
            "static buffer size!"
        );
    }

    wasm.ctype = JSON.parse(wasm.cstrToJs(cJson));

    const defineGroups = [
        "access",
        "authorizer",
        "blobFinalizers",
        "changeset",
        "config",
        "dataTypes",
        "dbConfig",
        "dbStatus",
        "encodings",
        "fcntl",
        "flock",
        "ioCap",
        "limits",
        "openFlags",
        "prepareFlags",
        "resultCodes",
        "sqlite3Status",
        "stmtStatus",
        "syncFlags",
        "trace",
        "txnState",
        "udfFlags",
        "version",
    ];
    if (wasm.bigIntEnabled) {
        defineGroups.push("serialize", "session", "vtab");
    }

    for (const t of defineGroups) {
        for (const e of Object.entries(wasm.ctype[t])) {
            capi[e[0]] = e[1];
        }
    }

    if (!wasm.functionEntry(capi.SQLITE_WASM_DEALLOC)) {
        toss(
            "Internal error: cannot resolve exported function",
            "entry SQLITE_WASM_DEALLOC (==" + capi.SQLITE_WASM_DEALLOC + ")."
        );
    }

    const __rcMap = Object.create(null);
    for (const t of ["resultCodes"]) {
        for (const e of Object.entries(wasm.ctype[t])) {
            __rcMap[e[1]] = e[0];
        }
    }

    capi.sqlite3_js_rc_str = (rc) => __rcMap[rc];

    const notThese = Object.assign(Object.create(null), {
        WasmTestStruct: true,
        sqlite3_kvvfs_methods: !util.isUIThread(),
        sqlite3_index_info: !wasm.bigIntEnabled,
        sqlite3_index_constraint: !wasm.bigIntEnabled,
        sqlite3_index_orderby: !wasm.bigIntEnabled,
        sqlite3_index_constraint_usage: !wasm.bigIntEnabled,
    });

    for (const s of wasm.ctype.structs) {
        if (!notThese[s.name]) {
            capi[s.name] = sqlite3.StructBinder(s);
        }
    }

    if (capi.sqlite3_index_info) {
        for (const k of [
            "sqlite3_index_constraint",
            "sqlite3_index_orderby",
            "sqlite3_index_constraint_usage",
        ]) {
            capi.sqlite3_index_info[k] = capi[k];
            delete capi[k];
        }
        capi.sqlite3_vtab_config = wasm.xWrap(
            "sqlite3__wasm_vtab_config",
            "int",
            ["sqlite3*", "int", "int"]
        );
    }
}

/**
 * Sets up close wrapper with cleanup.
 */
function setupCloseWrapper(wasm, capi, __dbCleanupMap) {
    const __dbArgcMismatch = (pDb, f, n) => {
        const util = { sqlite3__wasm_db_error: capi.sqlite3__wasm_db_error };
        return util.sqlite3__wasm_db_error(
            pDb,
            capi.SQLITE_MISUSE,
            f + "() requires " + n + " argument" + (1 === n ? "" : "s") + "."
        );
    };

    const __sqlite3CloseV2 = wasm.xWrap("sqlite3_close_v2", "int", "sqlite3*");
    capi.sqlite3_close_v2 = function (pDb) {
        if (1 !== arguments.length)
            return __dbArgcMismatch(pDb, "sqlite3_close_v2", 1);
        if (pDb) {
            try {
                __dbCleanupMap.cleanup(pDb);
            } catch (_e) {}
        }
        return __sqlite3CloseV2(pDb);
    };
}

/**
 * Sets up session delete wrapper (if available).
 */
function setupSessionDelete(wasm, capi) {
    if (capi.sqlite3session_create) {
        const __sqlite3SessionDelete = wasm.xWrap(
            "sqlite3session_delete",
            undefined,
            ["sqlite3_session*"]
        );
        capi.sqlite3session_delete = function (pSession) {
            if (1 !== arguments.length) {
                throw new Error("sqlite3session_delete() requires 1 argument.");
            } else if (pSession) {
                capi.sqlite3session_table_filter(pSession, 0, 0);
            }
            __sqlite3SessionDelete(pSession);
        };
    }
}

/**
 * Sets up collation creation functions.
 */
function setupCollationCreation(wasm, capi, util, __dbCleanupMap) {
    const __dbArgcMismatch = (pDb, f, n) => {
        return util.sqlite3__wasm_db_error(
            pDb,
            capi.SQLITE_MISUSE,
            f + "() requires " + n + " argument" + (1 === n ? "" : "s") + "."
        );
    };

    const __errEncoding = (pDb) => {
        return util.sqlite3__wasm_db_error(
            pDb,
            capi.SQLITE_FORMAT,
            "SQLITE_UTF8 is the only supported encoding."
        );
    };

    const contextKey = (argv, argIndex) => {
        return (
            "argv[" + argIndex + "]:" + argv[0] + ":" +
            wasm.cstrToJs(argv[1]).toLowerCase()
        );
    };

    const __sqlite3CreateCollationV2 = wasm.xWrap(
        "sqlite3_create_collation_v2",
        "int",
        [
            "sqlite3*",
            "string",
            "int",
            "*",
            new wasm.xWrap.FuncPtrAdapter({
                name: "xCompare",
                signature: "i(pipip)",
                contextKey,
            }),
            new wasm.xWrap.FuncPtrAdapter({
                name: "xDestroy",
                signature: "v(p)",
                contextKey,
            }),
        ]
    );

    capi.sqlite3_create_collation_v2 = function (
        pDb,
        zName,
        eTextRep,
        pArg,
        xCompare,
        xDestroy
    ) {
        if (6 !== arguments.length)
            return __dbArgcMismatch(pDb, "sqlite3_create_collation_v2", 6);
        else if (0 === (eTextRep & 0xf)) {
            eTextRep |= capi.SQLITE_UTF8;
        } else if (capi.SQLITE_UTF8 !== (eTextRep & 0xf)) {
            return __errEncoding(pDb);
        }
        try {
            const rc = __sqlite3CreateCollationV2(
                pDb,
                zName,
                eTextRep,
                pArg,
                xCompare,
                xDestroy
            );
            if (0 === rc && xCompare instanceof Function) {
                __dbCleanupMap.addCollation(pDb, zName);
            }
            return rc;
        } catch (e) {
            return util.sqlite3__wasm_db_error(pDb, e);
        }
    };

    capi.sqlite3_create_collation = (pDb, zName, eTextRep, pArg, xCompare) => {
        return 5 === arguments.length
            ? capi.sqlite3_create_collation_v2(pDb, zName, eTextRep, pArg, xCompare, 0)
            : __dbArgcMismatch(pDb, "sqlite3_create_collation", 5);
    };
}

/**
 * Sets up sqlite3_config wrapper.
 */
function setupConfigWrapper(wasm, capi) {
    capi.sqlite3_config = function (op, ...args) {
        if (arguments.length < 2) return capi.SQLITE_MISUSE;
        switch (op) {
            case capi.SQLITE_CONFIG_COVERING_INDEX_SCAN:
            case capi.SQLITE_CONFIG_MEMSTATUS:
            case capi.SQLITE_CONFIG_SMALL_MALLOC:
            case capi.SQLITE_CONFIG_SORTERREF_SIZE:
            case capi.SQLITE_CONFIG_STMTJRNL_SPILL:
            case capi.SQLITE_CONFIG_URI:
                return wasm.exports.sqlite3__wasm_config_i(op, args[0]);
            case capi.SQLITE_CONFIG_LOOKASIDE:
                return wasm.exports.sqlite3__wasm_config_ii(op, args[0], args[1]);
            case capi.SQLITE_CONFIG_MEMDB_MAXSIZE:
                return wasm.exports.sqlite3__wasm_config_j(op, args[0]);
            default:
                return capi.SQLITE_NOTFOUND;
        }
    };
}

/**
 * Sets up auto-extension wrappers.
 */
function setupAutoExtension(wasm, capi) {
    const __autoExtFptr = new Set();

    capi.sqlite3_auto_extension = function (fPtr) {
        if (fPtr instanceof Function) {
            fPtr = wasm.installFunction("i(ppp)", fPtr);
        } else if (1 !== arguments.length || !wasm.isPtr(fPtr)) {
            return capi.SQLITE_MISUSE;
        }
        const rc = wasm.exports.sqlite3_auto_extension(fPtr);
        if (fPtr !== arguments[0]) {
            if (0 === rc) __autoExtFptr.add(fPtr);
            else wasm.uninstallFunction(fPtr);
        }
        return rc;
    };

    capi.sqlite3_cancel_auto_extension = function (fPtr) {
        if (!fPtr || 1 !== arguments.length || !wasm.isPtr(fPtr)) return 0;
        return wasm.exports.sqlite3_cancel_auto_extension(fPtr);
    };

    capi.sqlite3_reset_auto_extension = function () {
        wasm.exports.sqlite3_reset_auto_extension();
        for (const fp of __autoExtFptr) wasm.uninstallFunction(fp);
        __autoExtFptr.clear();
    };
}

/**
 * Sets up KVVFS implementation (if available).
 */
function setupKvvfs(wasm, capi, util) {
    const pKvvfs = capi.sqlite3_vfs_find("kvvfs");
    if (!pKvvfs) return;

    if (util.isUIThread()) {
        const kvvfsMethods = new capi.sqlite3_kvvfs_methods(
            wasm.exports.sqlite3__wasm_kvvfs_methods()
        );
        delete capi.sqlite3_kvvfs_methods;

        const kvvfsMakeKey = wasm.exports.sqlite3__wasm_kvvfsMakeKeyOnPstack;
        const pstack = wasm.pstack;
        const kvvfsStorage = (zClass) =>
            115 === wasm.peek(zClass) ? sessionStorage : localStorage;

        const kvvfsImpls = {
            xRead: (zClass, zKey, zBuf, nBuf) => {
                const stack = pstack.pointer;
                const astack = wasm.scopedAllocPush();
                try {
                    const zXKey = kvvfsMakeKey(zClass, zKey);
                    if (!zXKey) return -3;
                    const jKey = wasm.cstrToJs(zXKey);
                    const jV = kvvfsStorage(zClass).getItem(jKey);
                    if (!jV) return -1;
                    const nV = jV.length;
                    if (nBuf <= 0) return nV;
                    else if (1 === nBuf) {
                        wasm.poke(zBuf, 0);
                        return nV;
                    }
                    const zV = wasm.scopedAllocCString(jV);
                    if (nBuf > nV + 1) nBuf = nV + 1;
                    wasm.heap8u().copyWithin(zBuf, zV, zV + nBuf - 1);
                    wasm.poke(zBuf + nBuf - 1, 0);
                    return nBuf - 1;
                } catch (e) {
                    console.error("kvstorageRead()", e);
                    return -2;
                } finally {
                    pstack.restore(stack);
                    wasm.scopedAllocPop(astack);
                }
            },
            xWrite: (zClass, zKey, zData) => {
                const stack = pstack.pointer;
                try {
                    const zXKey = kvvfsMakeKey(zClass, zKey);
                    if (!zXKey) return 1;
                    const jKey = wasm.cstrToJs(zXKey);
                    kvvfsStorage(zClass).setItem(jKey, wasm.cstrToJs(zData));
                    return 0;
                } catch (e) {
                    console.error("kvstorageWrite()", e);
                    return capi.SQLITE_IOERR;
                } finally {
                    pstack.restore(stack);
                }
            },
            xDelete: (zClass, zKey) => {
                const stack = pstack.pointer;
                try {
                    const zXKey = kvvfsMakeKey(zClass, zKey);
                    if (!zXKey) return 1;
                    kvvfsStorage(zClass).removeItem(wasm.cstrToJs(zXKey));
                    return 0;
                } catch (e) {
                    console.error("kvstorageDelete()", e);
                    return capi.SQLITE_IOERR;
                } finally {
                    pstack.restore(stack);
                }
            },
        };

        for (const k of Object.keys(kvvfsImpls)) {
            kvvfsMethods[kvvfsMethods.memberKey(k)] = wasm.installFunction(
                kvvfsMethods.memberSignature(k),
                kvvfsImpls[k]
            );
        }
    } else {
        capi.sqlite3_vfs_unregister(pKvvfs);
    }
}

/**
 * Sets up struct method installation utilities.
 */
function setupStructMethodInstaller(wasm, sqlite3, toss) {
    const StructBinder = sqlite3.StructBinder;

    const installMethod = function callee(
        tgt,
        name,
        func,
        applyArgcCheck = callee.installMethodArgcCheck
    ) {
        if (!(tgt instanceof StructBinder.StructType)) {
            toss("Usage error: target object is-not-a StructType.");
        } else if (!(func instanceof Function) && !wasm.isPtr(func)) {
            toss("Usage error: expecting a Function or WASM pointer to one.");
        }
        if (1 === arguments.length) {
            return (n, f) => callee(tgt, n, f, applyArgcCheck);
        }
        if (!callee.argcProxy) {
            callee.argcProxy = function (tgt, funcName, func, sig) {
                return function (...args) {
                    if (func.length !== arguments.length) {
                        toss(
                            "Argument mismatch for",
                            tgt.structInfo.name + "::" + funcName +
                                ": Native signature is:",
                            sig
                        );
                    }
                    return func.apply(this, args);
                };
            };

            callee.removeFuncList = function () {
                if (this.ondispose.__removeFuncList) {
                    this.ondispose.__removeFuncList.forEach((v, _ndx) => {
                        if ("number" === typeof v) {
                            try {
                                wasm.uninstallFunction(v);
                            } catch (_e) {}
                        }
                    });
                    delete this.ondispose.__removeFuncList;
                }
            };
        }
        const sigN = tgt.memberSignature(name);
        if (sigN.length < 2) {
            toss(
                "Member",
                name,
                "does not have a function pointer signature:",
                sigN
            );
        }
        const memKey = tgt.memberKey(name);
        const fProxy =
            applyArgcCheck && !wasm.isPtr(func)
                ? callee.argcProxy(tgt, memKey, func, sigN)
                : func;
        if (wasm.isPtr(fProxy)) {
            if (fProxy && !wasm.functionEntry(fProxy)) {
                toss("Pointer", fProxy, "is not a WASM function table entry.");
            }
            tgt[memKey] = fProxy;
        } else {
            const pFunc = wasm.installFunction(fProxy, tgt.memberSignature(name, true));
            tgt[memKey] = pFunc;
            if (!tgt.ondispose || !tgt.ondispose.__removeFuncList) {
                tgt.addOnDispose(
                    "ondispose.__removeFuncList handler",
                    callee.removeFuncList
                );
                tgt.ondispose.__removeFuncList = [];
            }
            tgt.ondispose.__removeFuncList.push(memKey, pFunc);
        }
        return (n, f) => callee(tgt, n, f, applyArgcCheck);
    };
    installMethod.installMethodArgcCheck = false;

    const installMethods = function (
        structInstance,
        methods,
        applyArgcCheck = installMethod.installMethodArgcCheck
    ) {
        const seen = new Map();
        for (const k of Object.keys(methods)) {
            const m = methods[k];
            const prior = seen.get(m);
            if (prior) {
                const mkey = structInstance.memberKey(k);
                structInstance[mkey] =
                    structInstance[structInstance.memberKey(prior)];
            } else {
                installMethod(structInstance, k, m, applyArgcCheck);
                seen.set(m, k);
            }
        }
        return structInstance;
    };

    StructBinder.StructType.prototype.installMethod = function callee(
        name,
        _func,
        _applyArgcCheck = installMethod.installMethodArgcCheck
    ) {
        return arguments.length < 3 && name && "object" === typeof name
            ? installMethods(this, ...arguments)
            : installMethod(this, ...arguments);
    };

    StructBinder.StructType.prototype.installMethods = function (
        methods,
        applyArgcCheck = installMethod.installMethodArgcCheck
    ) {
        return installMethods(this, methods, applyArgcCheck);
    };
}
