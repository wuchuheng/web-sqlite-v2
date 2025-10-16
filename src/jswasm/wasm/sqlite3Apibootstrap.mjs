import { Module, wasmExports } from "../sqlite3.mjs";
import { resolveBootstrapConfig } from "./bootstrap/configuration.mjs";
import {
    createResultCodeStringifier,
    createSQLite3Error,
    createWasmAllocError,
} from "./bootstrap/error-utils.mjs";
import { createBootstrapUtil } from "./bootstrap/util-factory.mjs";
import { applyDefaultBootstrapState } from "./bootstrap/default-bootstrap-state.mjs";

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
     * @param {object | undefined} apiConfig Optional configuration overrides
     *        supplied by the embedding application. The object is normalized by
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

        // Many parts of the legacy C API surface still expect these methods to
        // exist. Stub them here so later feature modules can replace them with
        // fully wired implementations without having to guard every reference.
        Object.assign(capi, {
            sqlite3_bind_blob: undefined,

            sqlite3_bind_text: undefined,

            sqlite3_create_function_v2: (
                _pDb,
                _funcName,
                _nArg,
                _eTextRep,
                _pApp,
                _xFunc,
                _xStep,
                _xFinal,
                _xDestroy
            ) => {},

            sqlite3_create_function: (
                _pDb,
                _funcName,
                _nArg,
                _eTextRep,
                _pApp,
                _xFunc,
                _xStep,
                _xFinal
            ) => {},

            sqlite3_create_window_function: (
                _pDb,
                _funcName,
                _nArg,
                _eTextRep,
                _pApp,
                _xStep,
                _xFinal,
                _xValue,
                _xInverse,
                _xDestroy
            ) => {},

            sqlite3_prepare_v3: (
                _dbPtr,
                _sql,
                _sqlByteLen,
                _prepFlags,
                _stmtPtrPtr,
                _strPtrPtr
            ) => {},

            sqlite3_prepare_v2: (
                _dbPtr,
                _sql,
                _sqlByteLen,
                _stmtPtrPtr,
                _strPtrPtr
            ) => {},

            sqlite3_exec: (_pDb, _sql, _callback, _pVoid, _pErrMsg) => {},

            sqlite3_randomness: (_n, _outPtr) => {},
        });

        // Capture the raw WASM exports and allocator symbols. These helpers are
        // used by all higher-level APIs so we fail fast when an expected export
        // is missing.
        Object.assign(wasm, {
            ptrSizeof: config.wasmPtrSizeof || 4,

            ptrIR: config.wasmPtrIR || "i32",

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

            alloc: undefined,

            realloc: undefined,

            dealloc: undefined,
        });

        // Allocate and populate WASM memory from an arbitrary typed array. The
        // helper is reused by blob binding and byte-buffer import utilities.
        wasm.allocFromTypedArray = function (srcTypedArray) {
            if (srcTypedArray instanceof ArrayBuffer) {
                srcTypedArray = new Uint8Array(srcTypedArray);
            }
            util.affirmBindableTypedArray(srcTypedArray);
            const pRet = wasm.alloc(srcTypedArray.byteLength || 1);
            wasm.heapForSize(srcTypedArray.constructor).set(
                srcTypedArray.byteLength ? srcTypedArray : [0],
                pRet
            );
            return pRet;
        };

        {
            const keyAlloc = config.allocExportName,
                keyDealloc = config.deallocExportName,
                keyRealloc = config.reallocExportName;
            for (const key of [keyAlloc, keyDealloc, keyRealloc]) {
                const f = wasm.exports[key];
                if (!(f instanceof Function))
                    toss3("Missing required exports[", key, "] function.");
            }

            wasm.alloc = function f(n) {
                return (
                    f.impl(n) ||
                    WasmAllocError.toss("Failed to allocate", n, " bytes.")
                );
            };
            wasm.alloc.impl = wasm.exports[keyAlloc];
            wasm.realloc = function f(m, n) {
                const m2 = f.impl(m, n);
                return n
                    ? m2 ||
                          WasmAllocError.toss(
                              "Failed to reallocate",
                              n,
                              " bytes."
                          )
                    : 0;
            };
            wasm.realloc.impl = wasm.exports[keyRealloc];
            wasm.dealloc = wasm.exports[keyDealloc];
        }

        wasm.compileOptionUsed = function f(optName) {
            // Lazily builds a cache of compile-time options exposed from the C
            // build so repeated lookups avoid walking the linked list on the
            // WASM boundary.
            if (!arguments.length) {
                if (f._result) return f._result;
                else if (!f._opt) {
                    f._rx = /^([^=]+)=(.+)/;
                    f._rxInt = /^-?\d+$/;
                    f._opt = function (opt, rv) {
                        const m = f._rx.exec(opt);
                        rv[0] = m ? m[1] : opt;
                        rv[1] = m ? (f._rxInt.test(m[2]) ? +m[2] : m[2]) : true;
                    };
                }
                const rc = {},
                    ov = [0, 0];
                let i = 0,
                    k;
                while ((k = capi.sqlite3_compileoption_get(i++))) {
                    f._opt(k, ov);
                    rc[ov[0]] = ov[1];
                }
                return (f._result = rc);
            } else if (Array.isArray(optName)) {
                const rc = {};
                optName.forEach((v) => {
                    rc[v] = capi.sqlite3_compileoption_used(v);
                });
                return rc;
            } else if ("object" === typeof optName) {
                Object.keys(optName).forEach((k) => {
                    optName[k] = capi.sqlite3_compileoption_used(k);
                });
                return optName;
            }
            return "string" === typeof optName
                ? !!capi.sqlite3_compileoption_used(optName)
                : false;
        };

        wasm.pstack = Object.assign(Object.create(null), {
            restore: wasm.exports.sqlite3__wasm_pstack_restore,

            alloc: function (n) {
                if ("string" === typeof n && !(n = wasm.sizeofIR(n))) {
                    WasmAllocError.toss(
                        "Invalid value for pstack.alloc(",
                        arguments[0],
                        ")"
                    );
                }
                return (
                    wasm.exports.sqlite3__wasm_pstack_alloc(n) ||
                    WasmAllocError.toss(
                        "Could not allocate",
                        n,
                        "bytes from the pstack."
                    )
                );
            },

            allocChunks: function (n, sz) {
                if ("string" === typeof sz && !(sz = wasm.sizeofIR(sz))) {
                    WasmAllocError.toss(
                        "Invalid size value for allocChunks(",
                        arguments[1],
                        ")"
                    );
                }
                const mem = wasm.pstack.alloc(n * sz);
                const rc = [];
                let i = 0,
                    offset = 0;
                for (; i < n; ++i, offset += sz) rc.push(mem + offset);
                return rc;
            },

            allocPtr: (n = 1, safePtrSize = true) => {
                return 1 === n
                    ? wasm.pstack.alloc(safePtrSize ? 8 : wasm.ptrSizeof)
                    : wasm.pstack.allocChunks(
                          n,
                          safePtrSize ? 8 : wasm.ptrSizeof
                      );
            },

            call: function (f) {
                const stackPos = wasm.pstack.pointer;
                try {
                    return f(sqlite3);
                } finally {
                    wasm.pstack.restore(stackPos);
                }
            },
        });
        Object.defineProperties(wasm.pstack, {
            pointer: {
                configurable: false,
                iterable: true,
                writeable: false,
                get: wasm.exports.sqlite3__wasm_pstack_ptr,
            },

            quota: {
                configurable: false,
                iterable: true,
                writeable: false,
                get: wasm.exports.sqlite3__wasm_pstack_quota,
            },

            remaining: {
                configurable: false,
                iterable: true,
                writeable: false,
                get: wasm.exports.sqlite3__wasm_pstack_remaining,
            },
        });

        capi.sqlite3_randomness = (...args) => {
            if (
                1 === args.length &&
                util.isTypedArray(args[0]) &&
                1 === args[0].BYTES_PER_ELEMENT
            ) {
                const ta = args[0];
                if (0 === ta.byteLength) {
                    wasm.exports.sqlite3_randomness(0, 0);
                    return ta;
                }
                const stack = wasm.pstack.pointer;
                try {
                    let n = ta.byteLength,
                        offset = 0;
                    const r = wasm.exports.sqlite3_randomness;
                    const heap = wasm.heap8u();
                    const nAlloc = n < 512 ? n : 512;
                    const ptr = wasm.pstack.alloc(nAlloc);
                    do {
                        const j = n > nAlloc ? nAlloc : n;
                        r(j, ptr);
                        ta.set(
                            util.typedArrayPart(heap, ptr, ptr + j),
                            offset
                        );
                        n -= j;
                        offset += j;
                    } while (n > 0);
                } catch (e) {
                    console.error(
                        "Highly unexpected (and ignored!) " +
                            "exception in sqlite3_randomness():",
                        e
                    );
                } finally {
                    wasm.pstack.restore(stack);
                }
                return ta;
            }
            wasm.exports.sqlite3_randomness(...args);
        };

        let __wasmfsOpfsDir = undefined;

        capi.sqlite3_wasmfs_opfs_dir = function () {
            if (undefined !== __wasmfsOpfsDir) return __wasmfsOpfsDir;

            const pdir = config.wasmfsOpfsDir;
            if (
                !pdir ||
                !globalThis.FileSystemHandle ||
                !globalThis.FileSystemDirectoryHandle ||
                !globalThis.FileSystemFileHandle
            ) {
                return (__wasmfsOpfsDir = "");
            }
            try {
                if (
                    pdir &&
                    0 ===
                        wasm.xCallWrapped(
                            "sqlite3__wasm_init_wasmfs",
                            "i32",
                            ["string"],
                            pdir
                        )
                ) {
                    return (__wasmfsOpfsDir = pdir);
                } else {
                    return (__wasmfsOpfsDir = "");
                }
            } catch (_e) {
                return (__wasmfsOpfsDir = "");
            }
        };

        capi.sqlite3_wasmfs_filename_is_persistent = function (name) {
            const p = capi.sqlite3_wasmfs_opfs_dir();
            return p && name ? name.startsWith(p + "/") : false;
        };

        capi.sqlite3_js_db_uses_vfs = function (pDb, vfsName, dbName = 0) {
            try {
                const pK = capi.sqlite3_vfs_find(vfsName);
                if (!pK) return false;
                else if (!pDb) {
                    return pK === capi.sqlite3_vfs_find(0) ? pK : false;
                } else {
                    return pK === capi.sqlite3_js_db_vfs(pDb, dbName)
                        ? pK
                        : false;
                }
            } catch (_e) {
                return false;
            }
        };

        capi.sqlite3_js_vfs_list = function () {
            const rc = [];
            let pVfs = capi.sqlite3_vfs_find(0);
            while (pVfs) {
                const oVfs = new capi.sqlite3_vfs(pVfs);
                rc.push(wasm.cstrToJs(oVfs.$zName));
                pVfs = oVfs.$pNext;
                oVfs.dispose();
            }
            return rc;
        };

        capi.sqlite3_js_db_export = function (pDb, schema = 0) {
            pDb = wasm.xWrap.testConvertArg("sqlite3*", pDb);
            if (!pDb) toss3("Invalid sqlite3* argument.");
            if (!wasm.bigIntEnabled) toss3("BigInt64 support is not enabled.");
            const scope = wasm.scopedAllocPush();
            let pOut;
            try {
                const pSize = wasm.scopedAlloc(8 + wasm.ptrSizeof);
                const ppOut = pSize + 8;

                const zSchema = schema
                    ? wasm.isPtr(schema)
                        ? schema
                        : wasm.scopedAllocCString("" + schema)
                    : 0;
                let rc = wasm.exports.sqlite3__wasm_db_serialize(
                    pDb,
                    zSchema,
                    ppOut,
                    pSize,
                    0
                );
                if (rc) {
                    toss3(
                        "Database serialization failed with code",
                        sqlite3.capi.sqlite3_js_rc_str(rc)
                    );
                }
                pOut = wasm.peekPtr(ppOut);
                const nOut = wasm.peek(pSize, "i64");
                rc = nOut
                    ? wasm.heap8u().slice(pOut, pOut + Number(nOut))
                    : new Uint8Array();
                return rc;
            } finally {
                if (pOut) wasm.exports.sqlite3_free(pOut);
                wasm.scopedAllocPop(scope);
            }
        };

        capi.sqlite3_js_db_vfs = (dbPointer, dbName = 0) =>
            util.sqlite3__wasm_db_vfs(dbPointer, dbName);

        capi.sqlite3_js_aggregate_context = (pCtx, n) => {
            return (
                capi.sqlite3_aggregate_context(pCtx, n) ||
                (n
                    ? WasmAllocError.toss(
                          "Cannot allocate",
                          n,
                          "bytes for sqlite3_aggregate_context()"
                      )
                    : 0)
            );
        };

        capi.sqlite3_js_posix_create_file = function (filename, data, dataLen) {
            let pData;
            if (data && wasm.isPtr(data)) {
                pData = data;
            } else if (
                data instanceof ArrayBuffer ||
                data instanceof Uint8Array
            ) {
                pData = wasm.allocFromTypedArray(data);
                if (
                    arguments.length < 3 ||
                    !util.isInt32(dataLen) ||
                    dataLen < 0
                ) {
                    dataLen = data.byteLength;
                }
            } else {
                SQLite3Error.toss(
                    "Invalid 2nd argument for sqlite3_js_posix_create_file()."
                );
            }
            try {
                if (!util.isInt32(dataLen) || dataLen < 0) {
                    SQLite3Error.toss(
                        "Invalid 3rd argument for sqlite3_js_posix_create_file()."
                    );
                }
                const rc = util.sqlite3__wasm_posix_create_file(
                    filename,
                    pData,
                    dataLen
                );
                if (rc)
                    SQLite3Error.toss(
                        "Creation of file failed with sqlite3 result code",
                        capi.sqlite3_js_rc_str(rc)
                    );
            } finally {
                wasm.dealloc(pData);
            }
        };

        capi.sqlite3_js_vfs_create_file = function (
            vfs,
            filename,
            data,
            dataLen
        ) {
            config.warn(
                "sqlite3_js_vfs_create_file() is deprecated and",
                "should be avoided because it can lead to C-level crashes.",
                "See its documentation for alternative options."
            );
            let pData;
            if (data) {
                if (wasm.isPtr(data)) {
                    pData = data;
                } else if (data instanceof ArrayBuffer) {
                    data = new Uint8Array(data);
                }
                if (data instanceof Uint8Array) {
                    pData = wasm.allocFromTypedArray(data);
                    if (
                        arguments.length < 4 ||
                        !util.isInt32(dataLen) ||
                        dataLen < 0
                    ) {
                        dataLen = data.byteLength;
                    }
                } else {
                    SQLite3Error.toss(
                        "Invalid 3rd argument type for sqlite3_js_vfs_create_file()."
                    );
                }
            } else {
                pData = 0;
            }
            if (!util.isInt32(dataLen) || dataLen < 0) {
                wasm.dealloc(pData);
                SQLite3Error.toss(
                    "Invalid 4th argument for sqlite3_js_vfs_create_file()."
                );
            }
            try {
                const rc = util.sqlite3__wasm_vfs_create_file(
                    vfs,
                    filename,
                    pData,
                    dataLen
                );
                if (rc)
                    SQLite3Error.toss(
                        "Creation of file failed with sqlite3 result code",
                        capi.sqlite3_js_rc_str(rc)
                    );
            } finally {
                wasm.dealloc(pData);
            }
        };

        capi.sqlite3_js_sql_to_string = (sql) => {
            if ("string" === typeof sql) {
                return sql;
            }
            const x = util.flexibleString(sql);
            return x === sql ? undefined : x;
        };

        if (util.isUIThread()) {
            const __kvvfsInfo = function (which) {
                const rc = Object.create(null);
                rc.prefix = "kvvfs-" + which;
                rc.stores = [];
                if ("session" === which || "" === which)
                    rc.stores.push(globalThis.sessionStorage);
                if ("local" === which || "" === which)
                    rc.stores.push(globalThis.localStorage);
                return rc;
            };

            capi.sqlite3_js_kvvfs_clear = function (which = "") {
                let rc = 0;
                const kvinfo = __kvvfsInfo(which);
                kvinfo.stores.forEach((s) => {
                    const toRm = [];
                    let i;
                    for (i = 0; i < s.length; ++i) {
                        const k = s.key(i);
                        if (k.startsWith(kvinfo.prefix)) toRm.push(k);
                    }
                    toRm.forEach((kk) => s.removeItem(kk));
                    rc += toRm.length;
                });
                return rc;
            };

            capi.sqlite3_js_kvvfs_size = function (which = "") {
                let sz = 0;
                const kvinfo = __kvvfsInfo(which);
                kvinfo.stores.forEach((s) => {
                    let i;
                    for (i = 0; i < s.length; ++i) {
                        const k = s.key(i);
                        if (k.startsWith(kvinfo.prefix)) {
                            sz += k.length;
                            sz += s.getItem(k).length;
                        }
                    }
                });
                return sz * 2;
            };
        }

        capi.sqlite3_db_config = function (pDb, op, ...args) {
            switch (op) {
                case capi.SQLITE_DBCONFIG_ENABLE_FKEY:
                case capi.SQLITE_DBCONFIG_ENABLE_TRIGGER:
                case capi.SQLITE_DBCONFIG_ENABLE_FTS3_TOKENIZER:
                case capi.SQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION:
                case capi.SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE:
                case capi.SQLITE_DBCONFIG_ENABLE_QPSG:
                case capi.SQLITE_DBCONFIG_TRIGGER_EQP:
                case capi.SQLITE_DBCONFIG_RESET_DATABASE:
                case capi.SQLITE_DBCONFIG_DEFENSIVE:
                case capi.SQLITE_DBCONFIG_WRITABLE_SCHEMA:
                case capi.SQLITE_DBCONFIG_LEGACY_ALTER_TABLE:
                case capi.SQLITE_DBCONFIG_DQS_DML:
                case capi.SQLITE_DBCONFIG_DQS_DDL:
                case capi.SQLITE_DBCONFIG_ENABLE_VIEW:
                case capi.SQLITE_DBCONFIG_LEGACY_FILE_FORMAT:
                case capi.SQLITE_DBCONFIG_TRUSTED_SCHEMA:
                case capi.SQLITE_DBCONFIG_STMT_SCANSTATUS:
                case capi.SQLITE_DBCONFIG_REVERSE_SCANORDER:
                case capi.SQLITE_DBCONFIG_ENABLE_ATTACH_CREATE:
                case capi.SQLITE_DBCONFIG_ENABLE_ATTACH_WRITE:
                case capi.SQLITE_DBCONFIG_ENABLE_COMMENTS:
                    if (!this.ip) {
                        this.ip = wasm.xWrap(
                            "sqlite3__wasm_db_config_ip",
                            "int",
                            ["sqlite3*", "int", "int", "*"]
                        );
                    }
                    return this.ip(pDb, op, args[0], args[1] || 0);
                case capi.SQLITE_DBCONFIG_LOOKASIDE:
                    if (!this.pii) {
                        this.pii = wasm.xWrap(
                            "sqlite3__wasm_db_config_pii",
                            "int",
                            ["sqlite3*", "int", "*", "int", "int"]
                        );
                    }
                    return this.pii(pDb, op, args[0], args[1], args[2]);
                case capi.SQLITE_DBCONFIG_MAINDBNAME:
                    if (!this.s) {
                        this.s = wasm.xWrap(
                            "sqlite3__wasm_db_config_s",
                            "int",
                            ["sqlite3*", "int", "string:static"]
                        );
                    }
                    return this.s(pDb, op, args[0]);
                default:
                    return capi.SQLITE_MISUSE;
            }
        }.bind(Object.create(null));

        capi.sqlite3_value_to_js = function (
            pVal,
            throwIfCannotConvert = true
        ) {
            let arg;
            const valType = capi.sqlite3_value_type(pVal);
            switch (valType) {
                case capi.SQLITE_INTEGER:
                    if (wasm.bigIntEnabled) {
                        arg = capi.sqlite3_value_int64(pVal);
                        if (util.bigIntFitsDouble(arg)) arg = Number(arg);
                    } else arg = capi.sqlite3_value_double(pVal);
                    break;
                case capi.SQLITE_FLOAT:
                    arg = capi.sqlite3_value_double(pVal);
                    break;
                case capi.SQLITE_TEXT:
                    arg = capi.sqlite3_value_text(pVal);
                    break;
                case capi.SQLITE_BLOB: {
                    const n = capi.sqlite3_value_bytes(pVal);
                    const pBlob = capi.sqlite3_value_blob(pVal);
                    if (n && !pBlob)
                        sqlite3.WasmAllocError.toss(
                            "Cannot allocate memory for blob argument of",
                            n,
                            "byte(s)"
                        );
                    arg = n
                        ? wasm.heap8u().slice(pBlob, pBlob + Number(n))
                        : null;
                    break;
                }
                case capi.SQLITE_NULL:
                    arg = null;
                    break;
                default:
                    if (throwIfCannotConvert) {
                        toss3(
                            capi.SQLITE_MISMATCH,
                            "Unhandled sqlite3_value_type():",
                            valType
                        );
                    }
                    arg = undefined;
            }
            return arg;
        };

        capi.sqlite3_values_to_js = function (
            argc,
            pArgv,
            throwIfCannotConvert = true
        ) {
            let i;
            const tgt = [];
            for (i = 0; i < argc; ++i) {
                tgt.push(
                    capi.sqlite3_value_to_js(
                        wasm.peekPtr(pArgv + wasm.ptrSizeof * i),
                        throwIfCannotConvert
                    )
                );
            }
            return tgt;
        };

        capi.sqlite3_result_error_js = function (pCtx, e) {
            if (e instanceof WasmAllocError) {
                capi.sqlite3_result_error_nomem(pCtx);
            } else {
                capi.sqlite3_result_error(pCtx, "" + e, -1);
            }
        };

        capi.sqlite3_result_js = function (pCtx, val) {
            if (val instanceof Error) {
                capi.sqlite3_result_error_js(pCtx, val);
                return;
            }
            try {
                switch (typeof val) {
                    case "undefined":
                        break;
                    case "boolean":
                        capi.sqlite3_result_int(pCtx, val ? 1 : 0);
                        break;
                    case "bigint":
                        if (util.bigIntFits32(val)) {
                            capi.sqlite3_result_int(pCtx, Number(val));
                        } else if (util.bigIntFitsDouble(val)) {
                            capi.sqlite3_result_double(pCtx, Number(val));
                        } else if (wasm.bigIntEnabled) {
                            if (util.bigIntFits64(val))
                                capi.sqlite3_result_int64(pCtx, val);
                            else
                                toss3(
                                    "BigInt value",
                                    val.toString(),
                                    "is too BigInt for int64."
                                );
                        } else {
                            toss3(
                                "BigInt value",
                                val.toString(),
                                "is too BigInt."
                            );
                        }
                        break;
                    case "number": {
                        let f;
                        if (util.isInt32(val)) {
                            f = capi.sqlite3_result_int;
                        } else if (
                            wasm.bigIntEnabled &&
                            Number.isInteger(val) &&
                            util.bigIntFits64(BigInt(val))
                        ) {
                            f = capi.sqlite3_result_int64;
                        } else {
                            f = capi.sqlite3_result_double;
                        }
                        f(pCtx, val);
                        break;
                    }
                    case "string": {
                        const [p, n] = wasm.allocCString(val, true);
                        capi.sqlite3_result_text(
                            pCtx,
                            p,
                            n,
                            capi.SQLITE_WASM_DEALLOC
                        );
                        break;
                    }
                    case "object":
                        if (null === val) {
                            capi.sqlite3_result_null(pCtx);
                            break;
                        } else if (util.isBindableTypedArray(val)) {
                            const pBlob = wasm.allocFromTypedArray(val);
                            capi.sqlite3_result_blob(
                                pCtx,
                                pBlob,
                                val.byteLength,
                                capi.SQLITE_WASM_DEALLOC
                            );
                            break;
                        }
                        break;

                    default:
                        toss3(
                            "Don't not how to handle this UDF result value:",
                            typeof val,
                            val
                        );
                        break;
                }
            } catch (e) {
                capi.sqlite3_result_error_js(pCtx, e);
            }
        };

        capi.sqlite3_column_js = function (
            pStmt,
            iCol,
            throwIfCannotConvert = true
        ) {
            const v = capi.sqlite3_column_value(pStmt, iCol);
            return 0 === v
                ? undefined
                : capi.sqlite3_value_to_js(v, throwIfCannotConvert);
        };

        const __newOldValue = function (pObj, iCol, impl) {
            impl = capi[impl];
            if (!this.ptr) this.ptr = wasm.allocPtr();
            else wasm.pokePtr(this.ptr, 0);
            const rc = impl(pObj, iCol, this.ptr);
            if (rc)
                return SQLite3Error.toss(
                    rc,
                    arguments[2] + "() failed with code " + rc
                );
            const pv = wasm.peekPtr(this.ptr);
            return pv ? capi.sqlite3_value_to_js(pv, true) : undefined;
        }.bind(Object.create(null));

        capi.sqlite3_preupdate_new_js = (pDb, iCol) =>
            __newOldValue(pDb, iCol, "sqlite3_preupdate_new");

        capi.sqlite3_preupdate_old_js = (pDb, iCol) =>
            __newOldValue(pDb, iCol, "sqlite3_preupdate_old");

        capi.sqlite3changeset_new_js = (pChangesetIter, iCol) =>
            __newOldValue(pChangesetIter, iCol, "sqlite3changeset_new");

        capi.sqlite3changeset_old_js = (pChangesetIter, iCol) =>
            __newOldValue(pChangesetIter, iCol, "sqlite3changeset_old");

        const sqlite3 = {
            WasmAllocError: WasmAllocError,
            SQLite3Error: SQLite3Error,
            capi,
            util,
            wasm,
            config,

            version: Object.create(null),

            client: undefined,

            asyncPostInit: async function ff() {
                if (ff.isReady instanceof Promise) return ff.isReady;
                let lia = sqlite3ApiBootstrap.initializersAsync;
                delete sqlite3ApiBootstrap.initializersAsync;
                const postInit = async () => {
                    if (!sqlite3.__isUnderTest) {
                        delete sqlite3.util;

                        delete sqlite3.StructBinder;
                    }
                    return sqlite3;
                };
                const catcher = (e) => {
                    config.error("an async sqlite3 initializer failed:", e);
                    throw e;
                };
                if (!lia || !lia.length) {
                    return (ff.isReady = postInit().catch(catcher));
                }
                lia = lia.map((f) => {
                    return f instanceof Function ? async (_x) => f(sqlite3) : f;
                });
                lia.push(postInit);
                let p = Promise.resolve(sqlite3);
                while (lia.length) p = p.then(lia.shift());
                return (ff.isReady = p.catch(catcher));
            },

            scriptInfo: undefined,
        };
        try {
            sqlite3ApiBootstrap.initializers.forEach((f) => {
                f(sqlite3);
            });
        } catch (e) {
            console.error("sqlite3 bootstrap initializer threw:", e);
            throw e;
        }
        delete sqlite3ApiBootstrap.initializers;
        sqlite3ApiBootstrap.sqlite3 = sqlite3;
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
