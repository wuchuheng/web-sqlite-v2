import { Module, wasmExports } from "../sqlite3.mjs";
import { createOpfsSahpoolInitializer } from "../vfs/opfs/opfs-sahpool-vfs.mjs";
import { createInstallOpfsVfsContext } from "../vfs/opfs/install-opfs-vfs.mjs";
import { StructBinderFactory } from "../utils/struct-binder-factory.mjs";
import { createInstallOo1Initializer } from "../api/install-oo1.mjs";
import { createInstallOo1DbApiInitializer } from "../api/install-oo1-db-api.mjs";

export function runSQLite3PostLoadInit(_EmscriptenModule) {
    "use strict";

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
        const config = Object.assign(
            Object.create(null),
            {
                exports: undefined,
                memory: undefined,
                bigIntEnabled: (() => {
                    if ("undefined" !== typeof Module) {
                        if (Module.HEAPU64) return true;
                    }
                    return !!globalThis.BigInt64Array;
                })(),
                debug: console.debug.bind(console),
                warn: console.warn.bind(console),
                error: console.error.bind(console),
                log: console.log.bind(console),
                wasmfsOpfsDir: "/opfs",

                useStdAlloc: false,
            },
            apiConfig || {}
        );

        Object.assign(
            config,
            {
                allocExportName: config.useStdAlloc
                    ? "malloc"
                    : "sqlite3_malloc",
                deallocExportName: config.useStdAlloc ? "free" : "sqlite3_free",
                reallocExportName: config.useStdAlloc
                    ? "realloc"
                    : "sqlite3_realloc",
            },
            config
        );

        ["exports", "memory", "wasmfsOpfsDir"].forEach((k) => {
            if ("function" === typeof config[k]) {
                config[k] = config[k]();
            }
        });

        delete globalThis.sqlite3ApiConfig;
        delete sqlite3ApiBootstrap.defaultConfig;

        const capi = Object.create(null);

        const wasm = Object.create(null);

        const __rcStr = (rc) => {
            return (
                (capi.sqlite3_js_rc_str && capi.sqlite3_js_rc_str(rc)) ||
                "Unknown result code #" + rc
            );
        };

        const __isInt = (n) => "number" === typeof n && n === (n | 0);

        class SQLite3Error extends Error {
            constructor(...args) {
                let rc;
                if (args.length) {
                    if (__isInt(args[0])) {
                        rc = args[0];
                        if (1 === args.length) {
                            super(__rcStr(args[0]));
                        } else {
                            const rcStr = __rcStr(rc);
                            if ("object" === typeof args[1]) {
                                super(rcStr, args[1]);
                            } else {
                                args[0] = rcStr + ":";
                                super(args.join(" "));
                            }
                        }
                    } else {
                        if (2 === args.length && "object" === typeof args[1]) {
                            super(...args);
                        } else {
                            super(args.join(" "));
                        }
                    }
                } else {
                    super();
                }
                this.resultCode = rc || capi.SQLITE_ERROR;
                this.name = "SQLite3Error";
            }
        }

        SQLite3Error.toss = (...args) => {
            throw new SQLite3Error(...args);
        };
        const toss3 = SQLite3Error.toss;

        if (config.wasmfsOpfsDir && !/^\/[^/]+$/.test(config.wasmfsOpfsDir)) {
            toss3(
                "config.wasmfsOpfsDir must be falsy or in the form '/dir-name'."
            );
        }

        const isInt32 = (n) => {
            return (
                "bigint" !== typeof n &&
                !!(n === (n | 0) && n <= 2147483647 && n >= -2147483648)
            );
        };

        const bigIntFits64 = function f(b) {
            if (!f._max) {
                f._max = BigInt("0x7fffffffffffffff");
                f._min = ~f._max;
            }
            return b >= f._min && b <= f._max;
        };

        const bigIntFits32 = (b) => b >= -0x7fffffffn - 1n && b <= 0x7fffffffn;

        const bigIntFitsDouble = function f(b) {
            if (!f._min) {
                f._min = Number.MIN_SAFE_INTEGER;
                f._max = Number.MAX_SAFE_INTEGER;
            }
            return b >= f._min && b <= f._max;
        };

        const isTypedArray = (v) => {
            return v &&
                v.constructor &&
                isInt32(v.constructor.BYTES_PER_ELEMENT)
                ? v
                : false;
        };

        const __SAB =
            "undefined" === typeof SharedArrayBuffer
                ? function () {}
                : SharedArrayBuffer;

        const isSharedTypedArray = (aTypedArray) =>
            aTypedArray.buffer instanceof __SAB;

        const typedArrayPart = (aTypedArray, begin, end) => {
            return isSharedTypedArray(aTypedArray)
                ? aTypedArray.slice(begin, end)
                : aTypedArray.subarray(begin, end);
        };

        const isBindableTypedArray = (v) => {
            return (
                v &&
                (v instanceof Uint8Array ||
                    v instanceof Int8Array ||
                    v instanceof ArrayBuffer)
            );
        };

        const isSQLableTypedArray = (v) => {
            return (
                v &&
                (v instanceof Uint8Array ||
                    v instanceof Int8Array ||
                    v instanceof ArrayBuffer)
            );
        };

        const affirmBindableTypedArray = (v) => {
            return (
                isBindableTypedArray(v) ||
                toss3("Value is not of a supported TypedArray type.")
            );
        };

        const utf8Decoder = new TextDecoder("utf-8");

        const typedArrayToString = function (typedArray, begin, end) {
            return utf8Decoder.decode(typedArrayPart(typedArray, begin, end));
        };

        const flexibleString = function (v) {
            if (isSQLableTypedArray(v)) {
                return typedArrayToString(
                    v instanceof ArrayBuffer ? new Uint8Array(v) : v
                );
            } else if (Array.isArray(v)) return v.join("");
            else if (wasm.isPtr(v)) v = wasm.cstrToJs(v);
            return v;
        };

        class WasmAllocError extends Error {
            constructor(...args) {
                if (2 === args.length && "object" === typeof args[1]) {
                    super(...args);
                } else if (args.length) {
                    super(args.join(" "));
                } else {
                    super("Allocation failed.");
                }
                this.resultCode = capi.SQLITE_NOMEM;
                this.name = "WasmAllocError";
            }
        }

        WasmAllocError.toss = (...args) => {
            throw new WasmAllocError(...args);
        };

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

        const util = {
            affirmBindableTypedArray,
            flexibleString,
            bigIntFits32,
            bigIntFits64,
            bigIntFitsDouble,
            isBindableTypedArray,
            isInt32,
            isSQLableTypedArray,
            isTypedArray,
            typedArrayToString,
            isUIThread: () =>
                globalThis.window === globalThis && !!globalThis.document,

            isSharedTypedArray,
            toss: function (...args) {
                throw new Error(args.join(" "));
            },
            toss3,
            typedArrayPart,

            affirmDbHeader: function (bytes) {
                if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
                const header = "SQLite format 3";
                if (header.length > bytes.byteLength) {
                    toss3("Input does not contain an SQLite3 database header.");
                }
                for (let i = 0; i < header.length; ++i) {
                    if (header.charCodeAt(i) !== bytes[i]) {
                        toss3(
                            "Input does not contain an SQLite3 database header."
                        );
                    }
                }
            },

            affirmIsDb: function (bytes) {
                if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
                const n = bytes.byteLength;
                if (n < 512 || n % 512 !== 0) {
                    toss3(
                        "Byte array size",
                        n,
                        "is invalid for an SQLite3 db."
                    );
                }
                util.affirmDbHeader(bytes);
            },
        };

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

        wasm.allocFromTypedArray = function (srcTypedArray) {
            if (srcTypedArray instanceof ArrayBuffer) {
                srcTypedArray = new Uint8Array(srcTypedArray);
            }
            affirmBindableTypedArray(srcTypedArray);
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
                        ta.set(typedArrayPart(heap, ptr, ptr + j), offset);
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
            const x = flexibleString(sql);
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

    globalThis.sqlite3ApiBootstrap.initializers = [];

    globalThis.sqlite3ApiBootstrap.initializersAsync = [];

    globalThis.sqlite3ApiBootstrap.defaultConfig = Object.create(null);

    globalThis.sqlite3ApiBootstrap.sqlite3 = undefined;

    globalThis.Jaccwabyt = StructBinderFactory;

    globalThis.sqlite3ApiBootstrap.initializers.push(
        createInstallOo1Initializer()
    );

    globalThis.sqlite3ApiBootstrap.initializers.push(function (sqlite3) {
        sqlite3.version = {
            libVersion: "3.50.4",
            libVersionNumber: 3050004,
            sourceId:
                "2025-07-30 19:33:53 4d8adfb30e03f9cf27f800a2c1ba3c48fb4ca1b08b0f5ed59a4d5ecbf45e20a3",
            downloadVersion: 3500400,
        };
    });

    globalThis.sqlite3ApiBootstrap.initializers.push(
        createInstallOo1DbApiInitializer()
    );

    globalThis.sqlite3ApiBootstrap.initializers.push(function (sqlite3) {
        const util = sqlite3.util;
        sqlite3.initWorker1API = function () {
            "use strict";
            const toss = (...args) => {
                throw new Error(args.join(" "));
            };
            if (!(globalThis.WorkerGlobalScope instanceof Function)) {
                toss("initWorker1API() must be run from a Worker thread.");
            }
            const sqlite3 =
                this.sqlite3 || toss("Missing this.sqlite3 object.");
            const DB = sqlite3.oo1.DB;

            const getDbId = function (db) {
                let id = wState.idMap.get(db);
                if (id) return id;
                id = "db#" + ++wState.idSeq + "@" + db.pointer;

                wState.idMap.set(db, id);
                return id;
            };

            const wState = {
                dbList: [],

                idSeq: 0,

                idMap: new WeakMap(),

                xfer: [],
                open: function (opt) {
                    const db = new DB(opt);
                    this.dbs[getDbId(db)] = db;
                    if (this.dbList.indexOf(db) < 0) this.dbList.push(db);
                    return db;
                },
                close: function (db, alsoUnlink) {
                    if (db) {
                        delete this.dbs[getDbId(db)];
                        const filename = db.filename;
                        const pVfs = util.sqlite3__wasm_db_vfs(db.pointer, 0);
                        db.close();
                        const ddNdx = this.dbList.indexOf(db);
                        if (ddNdx >= 0) this.dbList.splice(ddNdx, 1);
                        if (alsoUnlink && filename && pVfs) {
                            util.sqlite3__wasm_vfs_unlink(pVfs, filename);
                        }
                    }
                },

                post: function (msg, xferList) {
                    if (xferList && xferList.length) {
                        globalThis.postMessage(msg, Array.from(xferList));
                        xferList.length = 0;
                    } else {
                        globalThis.postMessage(msg);
                    }
                },

                dbs: Object.create(null),

                getDb: function (id, require = true) {
                    return (
                        this.dbs[id] ||
                        (require
                            ? toss("Unknown (or closed) DB ID:", id)
                            : undefined)
                    );
                },
            };

            const affirmDbOpen = function (db = wState.dbList[0]) {
                return db && db.pointer ? db : toss("DB is not opened.");
            };

            const getMsgDb = function (msgData, affirmExists = true) {
                const db =
                    wState.getDb(msgData.dbId, false) || wState.dbList[0];
                return affirmExists ? affirmDbOpen(db) : db;
            };

            const getDefaultDbId = function () {
                return wState.dbList[0] && getDbId(wState.dbList[0]);
            };

            const wMsgHandler = {
                open: function (ev) {
                    const oargs = Object.create(null),
                        args = ev.args || Object.create(null);
                    if (args.simulateError) {
                        toss("Throwing because of simulateError flag.");
                    }
                    const rc = Object.create(null);
                    oargs.vfs = args.vfs;
                    oargs.filename = args.filename || "";
                    const db = wState.open(oargs);
                    rc.filename = db.filename;
                    rc.persistent = !!sqlite3.capi.sqlite3_js_db_uses_vfs(
                        db.pointer,
                        "opfs"
                    );
                    rc.dbId = getDbId(db);
                    rc.vfs = db.dbVfsName();
                    return rc;
                },

                close: function (ev) {
                    const db = getMsgDb(ev, false);
                    const response = {
                        filename: db && db.filename,
                    };
                    if (db) {
                        const doUnlink =
                            ev.args && "object" === typeof ev.args
                                ? !!ev.args.unlink
                                : false;
                        wState.close(db, doUnlink);
                    }
                    return response;
                },

                exec: function (ev) {
                    const rc =
                        "string" === typeof ev.args
                            ? { sql: ev.args }
                            : ev.args || Object.create(null);
                    if ("stmt" === rc.rowMode) {
                        toss(
                            "Invalid rowMode for 'exec': stmt mode",
                            "does not work in the Worker API."
                        );
                    } else if (!rc.sql) {
                        toss("'exec' requires input SQL.");
                    }
                    const db = getMsgDb(ev);
                    if (rc.callback || Array.isArray(rc.resultRows)) {
                        db._blobXfer = wState.xfer;
                    }
                    const theCallback = rc.callback;
                    let rowNumber = 0;
                    const hadColNames = !!rc.columnNames;
                    if ("string" === typeof theCallback) {
                        if (!hadColNames) rc.columnNames = [];

                        rc.callback = function (row, _stmt) {
                            wState.post(
                                {
                                    type: theCallback,
                                    columnNames: rc.columnNames,
                                    rowNumber: ++rowNumber,
                                    row: row,
                                },
                                wState.xfer
                            );
                        };
                    }
                    try {
                        const changeCount = rc.countChanges
                            ? db.changes(true, 64 === rc.countChanges)
                            : undefined;
                        db.exec(rc);
                        if (undefined !== changeCount) {
                            rc.changeCount =
                                db.changes(true, 64 === rc.countChanges) -
                                changeCount;
                        }
                        const lastInsertRowId = rc.lastInsertRowId
                            ? sqlite3.capi.sqlite3_last_insert_rowid(db)
                            : undefined;
                        if (undefined !== lastInsertRowId) {
                            rc.lastInsertRowId = lastInsertRowId;
                        }
                        if (rc.callback instanceof Function) {
                            rc.callback = theCallback;

                            wState.post({
                                type: theCallback,
                                columnNames: rc.columnNames,
                                rowNumber: null,
                                row: undefined,
                            });
                        }
                    } finally {
                        delete db._blobXfer;
                        if (rc.callback) rc.callback = theCallback;
                    }
                    return rc;
                },

                "config-get": function () {
                    const rc = Object.create(null),
                        src = sqlite3.config;
                    ["bigIntEnabled"].forEach(function (k) {
                        if (Object.getOwnPropertyDescriptor(src, k))
                            rc[k] = src[k];
                    });
                    rc.version = sqlite3.version;
                    rc.vfsList = sqlite3.capi.sqlite3_js_vfs_list();
                    return rc;
                },

                export: function (ev) {
                    const db = getMsgDb(ev);
                    const response = {
                        byteArray: sqlite3.capi.sqlite3_js_db_export(
                            db.pointer
                        ),
                        filename: db.filename,
                        mimetype: "application/x-sqlite3",
                    };
                    wState.xfer.push(response.byteArray.buffer);
                    return response;
                },

                toss: function (_ev) {
                    toss("Testing worker exception");
                },
            };

            globalThis.onmessage = async function (ev) {
                ev = ev.data;
                let result,
                    dbId = ev.dbId,
                    evType = ev.type;
                const arrivalTime = performance.now();
                try {
                    if (
                        Object.prototype.hasOwnProperty.call(
                            wMsgHandler,
                            evType
                        ) &&
                        wMsgHandler[evType] instanceof Function
                    ) {
                        result = await wMsgHandler[evType](ev);
                    } else {
                        toss("Unknown db worker message type:", ev.type);
                    }
                } catch (err) {
                    evType = "error";
                    result = {
                        operation: ev.type,
                        message: err.message,
                        errorClass: err.name,
                        input: ev,
                    };
                    if (err.stack) {
                        result.stack =
                            "string" === typeof err.stack
                                ? err.stack.split(/\n\s*/)
                                : err.stack;
                    }
                }
                if (!dbId) {
                    dbId = result.dbId || getDefaultDbId();
                }

                wState.post(
                    {
                        type: evType,
                        dbId: dbId,
                        messageId: ev.messageId,
                        workerReceivedTime: arrivalTime,
                        workerRespondTime: performance.now(),
                        departureTime: ev.departureTime,

                        result: result,
                    },
                    wState.xfer
                );
            };
            globalThis.postMessage({
                type: "sqlite3-api",
                result: "worker1-ready",
            });
        }.bind({ sqlite3 });
    });

    globalThis.sqlite3ApiBootstrap.initializers.push(function (sqlite3) {
        const wasm = sqlite3.wasm,
            capi = sqlite3.capi,
            toss = sqlite3.util.toss3;
        const vfs = Object.create(null);
        sqlite3.vfs = vfs;

        capi.sqlite3_vfs.prototype.registerVfs = function (asDefault = false) {
            if (!(this instanceof sqlite3.capi.sqlite3_vfs)) {
                toss("Expecting a sqlite3_vfs-type argument.");
            }
            const rc = capi.sqlite3_vfs_register(this, asDefault ? 1 : 0);
            if (rc) {
                toss("sqlite3_vfs_register(", this, ") failed with rc", rc);
            }
            if (this.pointer !== capi.sqlite3_vfs_find(this.$zName)) {
                toss(
                    "BUG: sqlite3_vfs_find(vfs.$zName) failed for just-installed VFS",
                    this
                );
            }
            return this;
        };

        vfs.installVfs = function (opt) {
            let count = 0;
            const propList = ["io", "vfs"];
            for (const key of propList) {
                const o = opt[key];
                if (o) {
                    ++count;
                    o.struct.installMethods(o.methods, !!o.applyArgcCheck);
                    if ("vfs" === key) {
                        if (!o.struct.$zName && "string" === typeof o.name) {
                            o.struct.addOnDispose(
                                (o.struct.$zName = wasm.allocCString(o.name))
                            );
                        }
                        o.struct.registerVfs(!!o.asDefault);
                    }
                }
            }
            if (!count)
                toss(
                    "Misuse: installVfs() options object requires at least",
                    "one of:",
                    propList
                );
            return this;
        };
    });

    globalThis.sqlite3ApiBootstrap.initializers.push(function (sqlite3) {
        if (!sqlite3.wasm.exports.sqlite3_declare_vtab) {
            return;
        }
        const wasm = sqlite3.wasm,
            capi = sqlite3.capi,
            toss = sqlite3.util.toss3;
        const vtab = Object.create(null);
        sqlite3.vtab = vtab;

        const sii = capi.sqlite3_index_info;

        sii.prototype.nthConstraint = function (n, asPtr = false) {
            if (n < 0 || n >= this.$nConstraint) return false;
            const ptr =
                this.$aConstraint +
                sii.sqlite3_index_constraint.structInfo.sizeof * n;
            return asPtr ? ptr : new sii.sqlite3_index_constraint(ptr);
        };

        sii.prototype.nthConstraintUsage = function (n, asPtr = false) {
            if (n < 0 || n >= this.$nConstraint) return false;
            const ptr =
                this.$aConstraintUsage +
                sii.sqlite3_index_constraint_usage.structInfo.sizeof * n;
            return asPtr ? ptr : new sii.sqlite3_index_constraint_usage(ptr);
        };

        sii.prototype.nthOrderBy = function (n, asPtr = false) {
            if (n < 0 || n >= this.$nOrderBy) return false;
            const ptr =
                this.$aOrderBy +
                sii.sqlite3_index_orderby.structInfo.sizeof * n;
            return asPtr ? ptr : new sii.sqlite3_index_orderby(ptr);
        };

        const __xWrapFactory = function (methodName, StructType) {
            return function (ptr, removeMapping = false) {
                if (0 === arguments.length) ptr = new StructType();
                if (ptr instanceof StructType) {
                    this.set(ptr.pointer, ptr);
                    return ptr;
                } else if (!wasm.isPtr(ptr)) {
                    sqlite3.SQLite3Error.toss(
                        "Invalid argument to",
                        methodName + "()"
                    );
                }
                let rc = this.get(ptr);
                if (removeMapping) this.delete(ptr);
                return rc;
            }.bind(new Map());
        };

        const StructPtrMapper = function (name, StructType) {
            const __xWrap = __xWrapFactory(name, StructType);

            return Object.assign(Object.create(null), {
                StructType,

                create: (ppOut) => {
                    const rc = __xWrap();
                    wasm.pokePtr(ppOut, rc.pointer);
                    return rc;
                },

                get: (pCObj) => __xWrap(pCObj),

                unget: (pCObj) => __xWrap(pCObj, true),

                dispose: (pCObj) => {
                    const o = __xWrap(pCObj, true);
                    if (o) o.dispose();
                },
            });
        };

        vtab.xVtab = StructPtrMapper("xVtab", capi.sqlite3_vtab);

        vtab.xCursor = StructPtrMapper("xCursor", capi.sqlite3_vtab_cursor);

        vtab.xIndexInfo = (pIdxInfo) => new capi.sqlite3_index_info(pIdxInfo);

        vtab.xError = function f(methodName, err, defaultRc) {
            if (f.errorReporter instanceof Function) {
                try {
                    f.errorReporter(
                        "sqlite3_module::" + methodName + "(): " + err.message
                    );
                } catch (_e) {}
            }
            let rc;
            if (err instanceof sqlite3.WasmAllocError) rc = capi.SQLITE_NOMEM;
            else if (arguments.length > 2) rc = defaultRc;
            else if (err instanceof sqlite3.SQLite3Error) rc = err.resultCode;
            return rc || capi.SQLITE_ERROR;
        };
        vtab.xError.errorReporter = console.error.bind(console);

        vtab.xRowid = (ppRowid64, value) => wasm.poke(ppRowid64, value, "i64");

        vtab.setupModule = function (opt) {
            let createdMod = false;
            const mod =
                this instanceof capi.sqlite3_module
                    ? this
                    : opt.struct || (createdMod = new capi.sqlite3_module());
            try {
                const methods =
                    opt.methods || toss("Missing 'methods' object.");
                for (const e of Object.entries({
                    xConnect: "xCreate",
                    xDisconnect: "xDestroy",
                })) {
                    const k = e[0],
                        v = e[1];
                    if (true === methods[k]) methods[k] = methods[v];
                    else if (true === methods[v]) methods[v] = methods[k];
                }
                if (opt.catchExceptions) {
                    const fwrap = function (methodName, func) {
                        if (["xConnect", "xCreate"].indexOf(methodName) >= 0) {
                            return function (
                                pDb,
                                pAux,
                                argc,
                                argv,
                                ppVtab,
                                pzErr
                            ) {
                                try {
                                    return func(...arguments) || 0;
                                } catch (e) {
                                    if (
                                        !(e instanceof sqlite3.WasmAllocError)
                                    ) {
                                        wasm.dealloc(wasm.peekPtr(pzErr));
                                        wasm.pokePtr(
                                            pzErr,
                                            wasm.allocCString(e.message)
                                        );
                                    }
                                    return vtab.xError(methodName, e);
                                }
                            };
                        } else {
                            return function (...args) {
                                try {
                                    return func(...args) || 0;
                                } catch (e) {
                                    return vtab.xError(methodName, e);
                                }
                            };
                        }
                    };
                    const mnames = [
                        "xCreate",
                        "xConnect",
                        "xBestIndex",
                        "xDisconnect",
                        "xDestroy",
                        "xOpen",
                        "xClose",
                        "xFilter",
                        "xNext",
                        "xEof",
                        "xColumn",
                        "xRowid",
                        "xUpdate",
                        "xBegin",
                        "xSync",
                        "xCommit",
                        "xRollback",
                        "xFindFunction",
                        "xRename",
                        "xSavepoint",
                        "xRelease",
                        "xRollbackTo",
                        "xShadowName",
                    ];
                    const remethods = Object.create(null);
                    for (const k of mnames) {
                        const m = methods[k];
                        if (!(m instanceof Function)) continue;
                        else if ("xConnect" === k && methods.xCreate === m) {
                            remethods[k] = methods.xCreate;
                        } else if ("xCreate" === k && methods.xConnect === m) {
                            remethods[k] = methods.xConnect;
                        } else {
                            remethods[k] = fwrap(k, m);
                        }
                    }
                    mod.installMethods(remethods, false);
                } else {
                    mod.installMethods(methods, !!opt.applyArgcCheck);
                }
                if (0 === mod.$iVersion) {
                    let v;
                    if ("number" === typeof opt.iVersion) v = opt.iVersion;
                    else if (mod.$xShadowName) v = 3;
                    else if (
                        mod.$xSavePoint ||
                        mod.$xRelease ||
                        mod.$xRollbackTo
                    )
                        v = 2;
                    else v = 1;
                    mod.$iVersion = v;
                }
            } catch (e) {
                if (createdMod) createdMod.dispose();
                throw e;
            }
            return mod;
        };

        capi.sqlite3_module.prototype.setupModule = function (opt) {
            return vtab.setupModule.call(this, opt);
        };
    });

    globalThis.sqlite3ApiBootstrap.initializers.push(function (sqlite3) {
        const { installOpfsVfsInitializer } =
            createInstallOpfsVfsContext(sqlite3);
        globalThis.sqlite3ApiBootstrap.initializersAsync.push(
            installOpfsVfsInitializer
        );
    });

    globalThis.sqlite3ApiBootstrap.initializers.push(
        createOpfsSahpoolInitializer()
    );

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
