import { Module, wasmExports } from "./sqlite3.mjs";
import { createWhWasmUtilInstaller } from "./create-wh-wasm-util-installer.mjs";
import { createOpfsSahpoolInitializer } from "./opfs-sahpool-vfs.mjs";
import { StructBinderFactory } from "./struct-binder-factory.mjs";

const WhWasmUtilInstaller = createWhWasmUtilInstaller();

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

    globalThis.sqlite3ApiBootstrap.initializers.push(function (sqlite3) {
        "use strict";
        const toss = (...args) => {
            throw new Error(args.join(" "));
        };
        const capi = sqlite3.capi,
            wasm = sqlite3.wasm,
            util = sqlite3.util;
        WhWasmUtilInstaller(wasm);

        wasm.bindingSignatures = [
            ["sqlite3_aggregate_context", "void*", "sqlite3_context*", "int"],

            ["sqlite3_bind_double", "int", "sqlite3_stmt*", "int", "f64"],
            ["sqlite3_bind_int", "int", "sqlite3_stmt*", "int", "int"],
            ["sqlite3_bind_null", undefined, "sqlite3_stmt*", "int"],
            ["sqlite3_bind_parameter_count", "int", "sqlite3_stmt*"],
            ["sqlite3_bind_parameter_index", "int", "sqlite3_stmt*", "string"],
            ["sqlite3_bind_parameter_name", "string", "sqlite3_stmt*", "int"],
            [
                "sqlite3_bind_pointer",
                "int",
                "sqlite3_stmt*",
                "int",
                "*",
                "string:static",
                "*",
            ],
            [
                "sqlite3_busy_handler",
                "int",
                [
                    "sqlite3*",
                    new wasm.xWrap.FuncPtrAdapter({
                        signature: "i(pi)",
                        contextKey: (argv, _argIndex) => argv[0],
                    }),
                    "*",
                ],
            ],
            ["sqlite3_busy_timeout", "int", "sqlite3*", "int"],

            ["sqlite3_changes", "int", "sqlite3*"],
            ["sqlite3_clear_bindings", "int", "sqlite3_stmt*"],
            ["sqlite3_collation_needed", "int", "sqlite3*", "*", "*"],
            ["sqlite3_column_blob", "*", "sqlite3_stmt*", "int"],
            ["sqlite3_column_bytes", "int", "sqlite3_stmt*", "int"],
            ["sqlite3_column_count", "int", "sqlite3_stmt*"],
            ["sqlite3_column_decltype", "string", "sqlite3_stmt*", "int"],
            ["sqlite3_column_double", "f64", "sqlite3_stmt*", "int"],
            ["sqlite3_column_int", "int", "sqlite3_stmt*", "int"],
            ["sqlite3_column_name", "string", "sqlite3_stmt*", "int"],
            ["sqlite3_column_text", "string", "sqlite3_stmt*", "int"],
            ["sqlite3_column_type", "int", "sqlite3_stmt*", "int"],
            ["sqlite3_column_value", "sqlite3_value*", "sqlite3_stmt*", "int"],
            [
                "sqlite3_commit_hook",
                "void*",
                [
                    "sqlite3*",
                    new wasm.xWrap.FuncPtrAdapter({
                        name: "sqlite3_commit_hook",
                        signature: "i(p)",
                        contextKey: (argv) => argv[0],
                    }),
                    "*",
                ],
            ],
            ["sqlite3_compileoption_get", "string", "int"],
            ["sqlite3_compileoption_used", "int", "string"],
            ["sqlite3_complete", "int", "string:flexible"],
            ["sqlite3_context_db_handle", "sqlite3*", "sqlite3_context*"],

            ["sqlite3_data_count", "int", "sqlite3_stmt*"],
            ["sqlite3_db_filename", "string", "sqlite3*", "string"],
            ["sqlite3_db_handle", "sqlite3*", "sqlite3_stmt*"],
            ["sqlite3_db_name", "string", "sqlite3*", "int"],
            ["sqlite3_db_readonly", "int", "sqlite3*", "string"],
            ["sqlite3_db_status", "int", "sqlite3*", "int", "*", "*", "int"],
            ["sqlite3_errcode", "int", "sqlite3*"],
            ["sqlite3_errmsg", "string", "sqlite3*"],
            ["sqlite3_error_offset", "int", "sqlite3*"],
            ["sqlite3_errstr", "string", "int"],
            [
                "sqlite3_exec",
                "int",
                [
                    "sqlite3*",
                    "string:flexible",
                    new wasm.xWrap.FuncPtrAdapter({
                        signature: "i(pipp)",
                        bindScope: "transient",
                        callProxy: (callback) => {
                            let aNames;
                            return (pVoid, nCols, pColVals, pColNames) => {
                                try {
                                    const aVals = wasm.cArgvToJs(
                                        nCols,
                                        pColVals
                                    );
                                    if (!aNames)
                                        aNames = wasm.cArgvToJs(
                                            nCols,
                                            pColNames
                                        );
                                    return callback(aVals, aNames) | 0;
                                } catch (e) {
                                    return e.resultCode || capi.SQLITE_ERROR;
                                }
                            };
                        },
                    }),
                    "*",
                    "**",
                ],
            ],
            ["sqlite3_expanded_sql", "string", "sqlite3_stmt*"],
            ["sqlite3_extended_errcode", "int", "sqlite3*"],
            ["sqlite3_extended_result_codes", "int", "sqlite3*", "int"],
            ["sqlite3_file_control", "int", "sqlite3*", "string", "int", "*"],
            ["sqlite3_finalize", "int", "sqlite3_stmt*"],
            ["sqlite3_free", undefined, "*"],
            ["sqlite3_get_autocommit", "int", "sqlite3*"],
            ["sqlite3_get_auxdata", "*", "sqlite3_context*", "int"],
            ["sqlite3_initialize", undefined],
            ["sqlite3_interrupt", undefined, "sqlite3*"],
            ["sqlite3_is_interrupted", "int", "sqlite3*"],
            ["sqlite3_keyword_count", "int"],
            ["sqlite3_keyword_name", "int", ["int", "**", "*"]],
            ["sqlite3_keyword_check", "int", ["string", "int"]],
            ["sqlite3_libversion", "string"],
            ["sqlite3_libversion_number", "int"],
            ["sqlite3_limit", "int", ["sqlite3*", "int", "int"]],
            ["sqlite3_malloc", "*", "int"],
            ["sqlite3_open", "int", "string", "*"],
            ["sqlite3_open_v2", "int", "string", "*", "int", "string"],

            ["sqlite3_realloc", "*", "*", "int"],
            ["sqlite3_reset", "int", "sqlite3_stmt*"],

            [
                "sqlite3_result_blob",
                undefined,
                "sqlite3_context*",
                "*",
                "int",
                "*",
            ],
            ["sqlite3_result_double", undefined, "sqlite3_context*", "f64"],
            [
                "sqlite3_result_error",
                undefined,
                "sqlite3_context*",
                "string",
                "int",
            ],
            ["sqlite3_result_error_code", undefined, "sqlite3_context*", "int"],
            ["sqlite3_result_error_nomem", undefined, "sqlite3_context*"],
            ["sqlite3_result_error_toobig", undefined, "sqlite3_context*"],
            ["sqlite3_result_int", undefined, "sqlite3_context*", "int"],
            ["sqlite3_result_null", undefined, "sqlite3_context*"],
            [
                "sqlite3_result_pointer",
                undefined,
                "sqlite3_context*",
                "*",
                "string:static",
                "*",
            ],
            ["sqlite3_result_subtype", undefined, "sqlite3_value*", "int"],
            [
                "sqlite3_result_text",
                undefined,
                "sqlite3_context*",
                "string",
                "int",
                "*",
            ],
            ["sqlite3_result_zeroblob", undefined, "sqlite3_context*", "int"],
            [
                "sqlite3_rollback_hook",
                "void*",
                [
                    "sqlite3*",
                    new wasm.xWrap.FuncPtrAdapter({
                        name: "sqlite3_rollback_hook",
                        signature: "v(p)",
                        contextKey: (argv) => argv[0],
                    }),
                    "*",
                ],
            ],

            [
                "sqlite3_set_auxdata",
                undefined,
                ["sqlite3_context*", "int", "*", "*"],
            ],
            ["sqlite3_shutdown", undefined],
            ["sqlite3_sourceid", "string"],
            ["sqlite3_sql", "string", "sqlite3_stmt*"],
            ["sqlite3_status", "int", "int", "*", "*", "int"],
            ["sqlite3_step", "int", "sqlite3_stmt*"],
            ["sqlite3_stmt_busy", "int", "sqlite3_stmt*"],
            ["sqlite3_stmt_readonly", "int", "sqlite3_stmt*"],
            ["sqlite3_stmt_status", "int", "sqlite3_stmt*", "int", "int"],
            ["sqlite3_strglob", "int", "string", "string"],
            ["sqlite3_stricmp", "int", "string", "string"],
            ["sqlite3_strlike", "int", "string", "string", "int"],
            ["sqlite3_strnicmp", "int", "string", "string", "int"],
            [
                "sqlite3_table_column_metadata",
                "int",
                "sqlite3*",
                "string",
                "string",
                "string",
                "**",
                "**",
                "*",
                "*",
                "*",
            ],
            ["sqlite3_total_changes", "int", "sqlite3*"],
            [
                "sqlite3_trace_v2",
                "int",
                [
                    "sqlite3*",
                    "int",
                    new wasm.xWrap.FuncPtrAdapter({
                        name: "sqlite3_trace_v2::callback",
                        signature: "i(ippp)",
                        contextKey: (argv, _argIndex) => argv[0],
                    }),
                    "*",
                ],
            ],
            ["sqlite3_txn_state", "int", ["sqlite3*", "string"]],

            ["sqlite3_uri_boolean", "int", "sqlite3_filename", "string", "int"],
            ["sqlite3_uri_key", "string", "sqlite3_filename", "int"],
            ["sqlite3_uri_parameter", "string", "sqlite3_filename", "string"],
            ["sqlite3_user_data", "void*", "sqlite3_context*"],
            ["sqlite3_value_blob", "*", "sqlite3_value*"],
            ["sqlite3_value_bytes", "int", "sqlite3_value*"],
            ["sqlite3_value_double", "f64", "sqlite3_value*"],
            ["sqlite3_value_dup", "sqlite3_value*", "sqlite3_value*"],
            ["sqlite3_value_free", undefined, "sqlite3_value*"],
            ["sqlite3_value_frombind", "int", "sqlite3_value*"],
            ["sqlite3_value_int", "int", "sqlite3_value*"],
            ["sqlite3_value_nochange", "int", "sqlite3_value*"],
            ["sqlite3_value_numeric_type", "int", "sqlite3_value*"],
            ["sqlite3_value_pointer", "*", "sqlite3_value*", "string:static"],
            ["sqlite3_value_subtype", "int", "sqlite3_value*"],
            ["sqlite3_value_text", "string", "sqlite3_value*"],
            ["sqlite3_value_type", "int", "sqlite3_value*"],
            ["sqlite3_vfs_find", "*", "string"],
            ["sqlite3_vfs_register", "int", "sqlite3_vfs*", "int"],
            ["sqlite3_vfs_unregister", "int", "sqlite3_vfs*"],
        ];

        if (wasm.exports.sqlite3_progress_handler) {
            wasm.bindingSignatures.push([
                "sqlite3_progress_handler",
                undefined,
                [
                    "sqlite3*",
                    "int",
                    new wasm.xWrap.FuncPtrAdapter({
                        name: "xProgressHandler",
                        signature: "i(p)",
                        bindScope: "context",
                        contextKey: (argv, _argIndex) => argv[0],
                    }),
                    "*",
                ],
            ]);
        }

        if (wasm.exports.sqlite3_stmt_explain) {
            wasm.bindingSignatures.push(
                ["sqlite3_stmt_explain", "int", "sqlite3_stmt*", "int"],
                ["sqlite3_stmt_isexplain", "int", "sqlite3_stmt*"]
            );
        }

        if (wasm.exports.sqlite3_set_authorizer) {
            wasm.bindingSignatures.push([
                "sqlite3_set_authorizer",
                "int",
                [
                    "sqlite3*",
                    new wasm.xWrap.FuncPtrAdapter({
                        name: "sqlite3_set_authorizer::xAuth",
                        signature: "i(pi" + "ssss)",
                        contextKey: (argv, _argIndex) => argv[0],
                        callProxy: (callback) => {
                            return (pV, iCode, s0, s1, s2, s3) => {
                                try {
                                    s0 = s0 && wasm.cstrToJs(s0);
                                    s1 = s1 && wasm.cstrToJs(s1);
                                    s2 = s2 && wasm.cstrToJs(s2);
                                    s3 = s3 && wasm.cstrToJs(s3);
                                    return (
                                        callback(pV, iCode, s0, s1, s2, s3) || 0
                                    );
                                } catch (e) {
                                    return e.resultCode || capi.SQLITE_ERROR;
                                }
                            };
                        },
                    }),
                    "*",
                ],
            ]);
        }

        // Note: SQLITE_ENABLE_NORMALIZE feature is currently disabled
        // The following code would be used if SQLITE_ENABLE_NORMALIZE was enabled:
        // wasm.bindingSignatures.push([
        //     "sqlite3_normalized_sql",
        //     "string",
        //     "sqlite3_stmt*",
        // ]);

        wasm.bindingSignatures.int64 = [
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

        if (wasm.bigIntEnabled && !!wasm.exports.sqlite3_declare_vtab) {
            wasm.bindingSignatures.int64.push(
                [
                    "sqlite3_create_module",
                    "int",
                    ["sqlite3*", "string", "sqlite3_module*", "*"],
                ],
                [
                    "sqlite3_create_module_v2",
                    "int",
                    ["sqlite3*", "string", "sqlite3_module*", "*", "*"],
                ],
                [
                    "sqlite3_declare_vtab",
                    "int",
                    ["sqlite3*", "string:flexible"],
                ],
                ["sqlite3_drop_modules", "int", ["sqlite3*", "**"]],
                [
                    "sqlite3_vtab_collation",
                    "string",
                    "sqlite3_index_info*",
                    "int",
                ],
                ["sqlite3_vtab_distinct", "int", "sqlite3_index_info*"],
                ["sqlite3_vtab_in", "int", "sqlite3_index_info*", "int", "int"],
                ["sqlite3_vtab_in_first", "int", "sqlite3_value*", "**"],
                ["sqlite3_vtab_in_next", "int", "sqlite3_value*", "**"],

                ["sqlite3_vtab_nochange", "int", "sqlite3_context*"],
                ["sqlite3_vtab_on_conflict", "int", "sqlite3*"],
                [
                    "sqlite3_vtab_rhs_value",
                    "int",
                    "sqlite3_index_info*",
                    "int",
                    "**",
                ]
            );
        }

        if (wasm.bigIntEnabled && !!wasm.exports.sqlite3_preupdate_hook) {
            wasm.bindingSignatures.int64.push(
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

        if (
            wasm.bigIntEnabled &&
            !!wasm.exports.sqlite3changegroup_add &&
            !!wasm.exports.sqlite3session_create &&
            !!wasm.exports.sqlite3_preupdate_hook
        ) {
            const __ipsProxy = {
                signature: "i(ps)",
                callProxy: (callback) => {
                    return (p, s) => {
                        try {
                            return callback(p, wasm.cstrToJs(s)) | 0;
                        } catch (e) {
                            return e.resultCode || capi.SQLITE_ERROR;
                        }
                    };
                },
            };

            wasm.bindingSignatures.int64.push(
                ...[
                    [
                        "sqlite3changegroup_add",
                        "int",
                        ["sqlite3_changegroup*", "int", "void*"],
                    ],
                    [
                        "sqlite3changegroup_add_strm",
                        "int",
                        [
                            "sqlite3_changegroup*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3changegroup_delete",
                        undefined,
                        ["sqlite3_changegroup*"],
                    ],
                    ["sqlite3changegroup_new", "int", ["**"]],
                    [
                        "sqlite3changegroup_output",
                        "int",
                        ["sqlite3_changegroup*", "int*", "**"],
                    ],
                    [
                        "sqlite3changegroup_output_strm",
                        "int",
                        [
                            "sqlite3_changegroup*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xOutput",
                                signature: "i(ppi)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3changeset_apply",
                        "int",
                        [
                            "sqlite3*",
                            "int",
                            "void*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xFilter",
                                bindScope: "transient",
                                ...__ipsProxy,
                            }),
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xConflict",
                                signature: "i(pip)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3changeset_apply_strm",
                        "int",
                        [
                            "sqlite3*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xFilter",
                                bindScope: "transient",
                                ...__ipsProxy,
                            }),
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xConflict",
                                signature: "i(pip)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3changeset_apply_v2",
                        "int",
                        [
                            "sqlite3*",
                            "int",
                            "void*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xFilter",
                                bindScope: "transient",
                                ...__ipsProxy,
                            }),
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xConflict",
                                signature: "i(pip)",
                                bindScope: "transient",
                            }),
                            "void*",
                            "**",
                            "int*",
                            "int",
                        ],
                    ],
                    [
                        "sqlite3changeset_apply_v2_strm",
                        "int",
                        [
                            "sqlite3*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xFilter",
                                bindScope: "transient",
                                ...__ipsProxy,
                            }),
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xConflict",
                                signature: "i(pip)",
                                bindScope: "transient",
                            }),
                            "void*",
                            "**",
                            "int*",
                            "int",
                        ],
                    ],
                    [
                        "sqlite3changeset_concat",
                        "int",
                        ["int", "void*", "int", "void*", "int*", "**"],
                    ],
                    [
                        "sqlite3changeset_concat_strm",
                        "int",
                        [
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInputA",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInputB",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xOutput",
                                signature: "i(ppi)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3changeset_conflict",
                        "int",
                        ["sqlite3_changeset_iter*", "int", "**"],
                    ],
                    [
                        "sqlite3changeset_finalize",
                        "int",
                        ["sqlite3_changeset_iter*"],
                    ],
                    [
                        "sqlite3changeset_fk_conflicts",
                        "int",
                        ["sqlite3_changeset_iter*", "int*"],
                    ],
                    [
                        "sqlite3changeset_invert",
                        "int",
                        ["int", "void*", "int*", "**"],
                    ],
                    [
                        "sqlite3changeset_invert_strm",
                        "int",
                        [
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xOutput",
                                signature: "i(ppi)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3changeset_new",
                        "int",
                        ["sqlite3_changeset_iter*", "int", "**"],
                    ],
                    [
                        "sqlite3changeset_next",
                        "int",
                        ["sqlite3_changeset_iter*"],
                    ],
                    [
                        "sqlite3changeset_old",
                        "int",
                        ["sqlite3_changeset_iter*", "int", "**"],
                    ],
                    [
                        "sqlite3changeset_op",
                        "int",
                        [
                            "sqlite3_changeset_iter*",
                            "**",
                            "int*",
                            "int*",
                            "int*",
                        ],
                    ],
                    [
                        "sqlite3changeset_pk",
                        "int",
                        ["sqlite3_changeset_iter*", "**", "int*"],
                    ],
                    ["sqlite3changeset_start", "int", ["**", "int", "*"]],
                    [
                        "sqlite3changeset_start_strm",
                        "int",
                        [
                            "**",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3changeset_start_v2",
                        "int",
                        ["**", "int", "*", "int"],
                    ],
                    [
                        "sqlite3changeset_start_v2_strm",
                        "int",
                        [
                            "**",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                            "int",
                        ],
                    ],
                    [
                        "sqlite3session_attach",
                        "int",
                        ["sqlite3_session*", "string"],
                    ],
                    [
                        "sqlite3session_changeset",
                        "int",
                        ["sqlite3_session*", "int*", "**"],
                    ],
                    [
                        "sqlite3session_changeset_size",
                        "i64",
                        ["sqlite3_session*"],
                    ],
                    [
                        "sqlite3session_changeset_strm",
                        "int",
                        [
                            "sqlite3_session*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xOutput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    ["sqlite3session_config", "int", ["int", "void*"]],
                    [
                        "sqlite3session_create",
                        "int",
                        ["sqlite3*", "string", "**"],
                    ],

                    [
                        "sqlite3session_diff",
                        "int",
                        ["sqlite3_session*", "string", "string", "**"],
                    ],
                    [
                        "sqlite3session_enable",
                        "int",
                        ["sqlite3_session*", "int"],
                    ],
                    [
                        "sqlite3session_indirect",
                        "int",
                        ["sqlite3_session*", "int"],
                    ],
                    ["sqlite3session_isempty", "int", ["sqlite3_session*"]],
                    ["sqlite3session_memory_used", "i64", ["sqlite3_session*"]],
                    [
                        "sqlite3session_object_config",
                        "int",
                        ["sqlite3_session*", "int", "void*"],
                    ],
                    [
                        "sqlite3session_patchset",
                        "int",
                        ["sqlite3_session*", "*", "**"],
                    ],
                    [
                        "sqlite3session_patchset_strm",
                        "int",
                        [
                            "sqlite3_session*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xOutput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3session_table_filter",
                        undefined,
                        [
                            "sqlite3_session*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xFilter",
                                ...__ipsProxy,
                                contextKey: (argv, _argIndex) => argv[0],
                            }),
                            "*",
                        ],
                    ],
                ]
            );
        }

        wasm.bindingSignatures.wasmInternal = [
            ["sqlite3__wasm_db_reset", "int", "sqlite3*"],
            ["sqlite3__wasm_db_vfs", "sqlite3_vfs*", "sqlite3*", "string"],
            [
                "sqlite3__wasm_vfs_create_file",
                "int",
                "sqlite3_vfs*",
                "string",
                "*",
                "int",
            ],
            ["sqlite3__wasm_posix_create_file", "int", "string", "*", "int"],
            ["sqlite3__wasm_vfs_unlink", "int", "sqlite3_vfs*", "string"],
            ["sqlite3__wasm_qfmt_token", "string:dealloc", "string", "int"],
        ];

        sqlite3.StructBinder = globalThis.Jaccwabyt({
            heap: wasm.heap8u,
            alloc: wasm.alloc,
            dealloc: wasm.dealloc,
            bigIntEnabled: wasm.bigIntEnabled,
            memberPrefix: "$",
        });
        delete globalThis.Jaccwabyt;

        {
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
            wasm.xWrap.argAdapter("sqlite3_filename", __xArgPtr)(
                "sqlite3_context*",
                __xArgPtr
            )("sqlite3_value*", __xArgPtr)("void*", __xArgPtr)(
                "sqlite3_changegroup*",
                __xArgPtr
            )("sqlite3_changeset_iter*", __xArgPtr)(
                "sqlite3_session*",
                __xArgPtr
            )("sqlite3_stmt*", (v) =>
                __xArgPtr(
                    v instanceof (sqlite3?.oo1?.Stmt || nilType) ? v.pointer : v
                )
            )("sqlite3*", (v) =>
                __xArgPtr(
                    v instanceof (sqlite3?.oo1?.DB || nilType) ? v.pointer : v
                )
            )("sqlite3_vfs*", (v) => {
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
                )("sqlite3_module*", (v) =>
                    __xArgPtr(
                        v instanceof (capi.sqlite3_module || nilType)
                            ? v.pointer
                            : v
                    )
                );
            }

            const __xRcPtr = wasm.xWrap.resultAdapter("*");
            wasm.xWrap.resultAdapter("sqlite3*", __xRcPtr)(
                "sqlite3_context*",
                __xRcPtr
            )("sqlite3_stmt*", __xRcPtr)("sqlite3_value*", __xRcPtr)(
                "sqlite3_vfs*",
                __xRcPtr
            )("void*", __xRcPtr);

            if (0 === wasm.exports.sqlite3_step.length) {
                wasm.xWrap.doArgcCheck = false;
                sqlite3.config.warn(
                    "Disabling sqlite3.wasm.xWrap.doArgcCheck due to environmental quirks."
                );
            }
            for (const e of wasm.bindingSignatures) {
                capi[e[0]] = wasm.xWrap.apply(null, e);
            }
            for (const e of wasm.bindingSignatures.wasmInternal) {
                util[e[0]] = wasm.xWrap.apply(null, e);
            }

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

            if (wasm.exports.sqlite3__wasm_db_error) {
                const __db_err = wasm.xWrap(
                    "sqlite3__wasm_db_error",
                    "int",
                    "sqlite3*",
                    "int",
                    "string"
                );

                util.sqlite3__wasm_db_error = function (
                    pDb,
                    resultCode,
                    message
                ) {
                    if (resultCode instanceof sqlite3.WasmAllocError) {
                        resultCode = capi.SQLITE_NOMEM;
                        message = 0;
                    } else if (resultCode instanceof Error) {
                        message = message || "" + resultCode;
                        resultCode = resultCode.resultCode || capi.SQLITE_ERROR;
                    }
                    return pDb
                        ? __db_err(pDb, resultCode, message)
                        : resultCode;
                };
            } else {
                util.sqlite3__wasm_db_error = function (_pDb, errCode, _msg) {
                    console.warn(
                        "sqlite3__wasm_db_error() is not exported.",
                        arguments
                    );
                    return errCode;
                };
            }
        }

        {
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
                    "entry SQLITE_WASM_DEALLOC (==" +
                        capi.SQLITE_WASM_DEALLOC +
                        ")."
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

        const __dbArgcMismatch = (pDb, f, n) => {
            return util.sqlite3__wasm_db_error(
                pDb,
                capi.SQLITE_MISUSE,
                f +
                    "() requires " +
                    n +
                    " argument" +
                    (1 === n ? "" : "s") +
                    "."
            );
        };

        const __errEncoding = (pDb) => {
            return util.sqlite3__wasm_db_error(
                pDb,
                capi.SQLITE_FORMAT,
                "SQLITE_UTF8 is the only supported encoding."
            );
        };

        const __argPDb = (pDb) => wasm.xWrap.argAdapter("sqlite3*")(pDb);
        const __argStr = (str) => (wasm.isPtr(str) ? wasm.cstrToJs(str) : str);
        const __dbCleanupMap = function (pDb, mode) {
            pDb = __argPDb(pDb);
            let m = this.dbMap.get(pDb);
            if (!mode) {
                this.dbMap.delete(pDb);
                return m;
            } else if (!m && mode > 0) {
                this.dbMap.set(pDb, (m = Object.create(null)));
            }
            return m;
        }.bind(
            Object.assign(Object.create(null), {
                dbMap: new Map(),
            })
        );

        __dbCleanupMap.addCollation = function (pDb, name) {
            const m = __dbCleanupMap(pDb, 1);
            if (!m.collation) m.collation = new Set();
            m.collation.add(__argStr(name).toLowerCase());
        };

        __dbCleanupMap._addUDF = function (pDb, name, arity, map) {
            name = __argStr(name).toLowerCase();
            let u = map.get(name);
            if (!u) map.set(name, (u = new Set()));
            u.add(arity < 0 ? -1 : arity);
        };

        __dbCleanupMap.addFunction = function (pDb, name, arity) {
            const m = __dbCleanupMap(pDb, 1);
            if (!m.udf) m.udf = new Map();
            this._addUDF(pDb, name, arity, m.udf);
        };

        if (wasm.exports.sqlite3_create_window_function) {
            __dbCleanupMap.addWindowFunc = function (pDb, name, arity) {
                const m = __dbCleanupMap(pDb, 1);
                if (!m.wudf) m.wudf = new Map();
                this._addUDF(pDb, name, arity, m.wudf);
            };
        }

        __dbCleanupMap.cleanup = function (pDb) {
            pDb = __argPDb(pDb);

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
                    sqlite3.config.warn(
                        "close-time call of",
                        name + "(",
                        closeArgs,
                        ") threw:",
                        e
                    );
                }
            }
            const m = __dbCleanupMap(pDb, 0);
            if (!m) return;
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

        {
            const __sqlite3CloseV2 = wasm.xWrap(
                "sqlite3_close_v2",
                "int",
                "sqlite3*"
            );
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

        if (capi.sqlite3session_create) {
            const __sqlite3SessionDelete = wasm.xWrap(
                "sqlite3session_delete",
                undefined,
                ["sqlite3_session*"]
            );
            capi.sqlite3session_delete = function (pSession) {
                if (1 !== arguments.length) {
                    throw new Error(
                        "sqlite3session_delete() requires 1 argument."
                    );
                } else if (pSession) {
                    capi.sqlite3session_table_filter(pSession, 0, 0);
                }
                __sqlite3SessionDelete(pSession);
            };
        }

        {
            const contextKey = (argv, argIndex) => {
                return (
                    "argv[" +
                    argIndex +
                    "]:" +
                    argv[0] +
                    ":" +
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
                    return __dbArgcMismatch(
                        pDb,
                        "sqlite3_create_collation_v2",
                        6
                    );
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

            capi.sqlite3_create_collation = (
                pDb,
                zName,
                eTextRep,
                pArg,
                xCompare
            ) => {
                return 5 === arguments.length
                    ? capi.sqlite3_create_collation_v2(
                          pDb,
                          zName,
                          eTextRep,
                          pArg,
                          xCompare,
                          0
                      )
                    : __dbArgcMismatch(pDb, "sqlite3_create_collation", 5);
            };
        }

        {
            const contextKey = function (argv, argIndex) {
                return (
                    argv[0] +
                    ":" +
                    (argv[2] < 0 ? -1 : argv[2]) +
                    ":" +
                    argIndex +
                    ":" +
                    wasm.cstrToJs(argv[1]).toLowerCase()
                );
            };

            const __cfProxy = Object.assign(Object.create(null), {
                xInverseAndStep: {
                    signature: "v(pip)",
                    contextKey,
                    callProxy: (callback) => {
                        return (pCtx, argc, pArgv) => {
                            try {
                                callback(
                                    pCtx,
                                    ...capi.sqlite3_values_to_js(argc, pArgv)
                                );
                            } catch (e) {
                                capi.sqlite3_result_error_js(pCtx, e);
                            }
                        };
                    },
                },
                xFinalAndValue: {
                    signature: "v(p)",
                    contextKey,
                    callProxy: (callback) => {
                        return (pCtx) => {
                            try {
                                capi.sqlite3_result_js(pCtx, callback(pCtx));
                            } catch (e) {
                                capi.sqlite3_result_error_js(pCtx, e);
                            }
                        };
                    },
                },
                xFunc: {
                    signature: "v(pip)",
                    contextKey,
                    callProxy: (callback) => {
                        return (pCtx, argc, pArgv) => {
                            try {
                                capi.sqlite3_result_js(
                                    pCtx,
                                    callback(
                                        pCtx,
                                        ...capi.sqlite3_values_to_js(
                                            argc,
                                            pArgv
                                        )
                                    )
                                );
                            } catch (e) {
                                capi.sqlite3_result_error_js(pCtx, e);
                            }
                        };
                    },
                },
                xDestroy: {
                    signature: "v(p)",
                    contextKey,

                    callProxy: (callback) => {
                        return (pVoid) => {
                            try {
                                callback(pVoid);
                            } catch (e) {
                                console.error("UDF xDestroy method threw:", e);
                            }
                        };
                    },
                },
            });

            const __sqlite3CreateFunction = wasm.xWrap(
                "sqlite3_create_function_v2",
                "int",
                [
                    "sqlite3*",
                    "string",
                    "int",
                    "int",
                    "*",
                    new wasm.xWrap.FuncPtrAdapter({
                        name: "xFunc",
                        ...__cfProxy.xFunc,
                    }),
                    new wasm.xWrap.FuncPtrAdapter({
                        name: "xStep",
                        ...__cfProxy.xInverseAndStep,
                    }),
                    new wasm.xWrap.FuncPtrAdapter({
                        name: "xFinal",
                        ...__cfProxy.xFinalAndValue,
                    }),
                    new wasm.xWrap.FuncPtrAdapter({
                        name: "xDestroy",
                        ...__cfProxy.xDestroy,
                    }),
                ]
            );

            const __sqlite3CreateWindowFunction = wasm.exports
                .sqlite3_create_window_function
                ? wasm.xWrap("sqlite3_create_window_function", "int", [
                      "sqlite3*",
                      "string",
                      "int",
                      "int",
                      "*",
                      new wasm.xWrap.FuncPtrAdapter({
                          name: "xStep",
                          ...__cfProxy.xInverseAndStep,
                      }),
                      new wasm.xWrap.FuncPtrAdapter({
                          name: "xFinal",
                          ...__cfProxy.xFinalAndValue,
                      }),
                      new wasm.xWrap.FuncPtrAdapter({
                          name: "xValue",
                          ...__cfProxy.xFinalAndValue,
                      }),
                      new wasm.xWrap.FuncPtrAdapter({
                          name: "xInverse",
                          ...__cfProxy.xInverseAndStep,
                      }),
                      new wasm.xWrap.FuncPtrAdapter({
                          name: "xDestroy",
                          ...__cfProxy.xDestroy,
                      }),
                  ])
                : undefined;

            capi.sqlite3_create_function_v2 = function f(
                pDb,
                funcName,
                nArg,
                eTextRep,
                pApp,
                xFunc,
                xStep,
                xFinal,
                xDestroy
            ) {
                if (f.length !== arguments.length) {
                    return __dbArgcMismatch(
                        pDb,
                        "sqlite3_create_function_v2",
                        f.length
                    );
                } else if (0 === (eTextRep & 0xf)) {
                    eTextRep |= capi.SQLITE_UTF8;
                } else if (capi.SQLITE_UTF8 !== (eTextRep & 0xf)) {
                    return __errEncoding(pDb);
                }
                try {
                    const rc = __sqlite3CreateFunction(
                        pDb,
                        funcName,
                        nArg,
                        eTextRep,
                        pApp,
                        xFunc,
                        xStep,
                        xFinal,
                        xDestroy
                    );
                    if (
                        0 === rc &&
                        (xFunc instanceof Function ||
                            xStep instanceof Function ||
                            xFinal instanceof Function ||
                            xDestroy instanceof Function)
                    ) {
                        __dbCleanupMap.addFunction(pDb, funcName, nArg);
                    }
                    return rc;
                } catch (e) {
                    console.error(
                        "sqlite3_create_function_v2() setup threw:",
                        e
                    );
                    return util.sqlite3__wasm_db_error(
                        pDb,
                        e,
                        "Creation of UDF threw: " + e
                    );
                }
            };

            capi.sqlite3_create_function = function f(
                pDb,
                funcName,
                nArg,
                eTextRep,
                pApp,
                xFunc,
                xStep,
                xFinal
            ) {
                return f.length === arguments.length
                    ? capi.sqlite3_create_function_v2(
                          pDb,
                          funcName,
                          nArg,
                          eTextRep,
                          pApp,
                          xFunc,
                          xStep,
                          xFinal,
                          0
                      )
                    : __dbArgcMismatch(
                          pDb,
                          "sqlite3_create_function",
                          f.length
                      );
            };

            if (__sqlite3CreateWindowFunction) {
                capi.sqlite3_create_window_function = function f(
                    pDb,
                    funcName,
                    nArg,
                    eTextRep,
                    pApp,
                    xStep,
                    xFinal,
                    xValue,
                    xInverse,
                    xDestroy
                ) {
                    if (f.length !== arguments.length) {
                        return __dbArgcMismatch(
                            pDb,
                            "sqlite3_create_window_function",
                            f.length
                        );
                    } else if (0 === (eTextRep & 0xf)) {
                        eTextRep |= capi.SQLITE_UTF8;
                    } else if (capi.SQLITE_UTF8 !== (eTextRep & 0xf)) {
                        return __errEncoding(pDb);
                    }
                    try {
                        const rc = __sqlite3CreateWindowFunction(
                            pDb,
                            funcName,
                            nArg,
                            eTextRep,
                            pApp,
                            xStep,
                            xFinal,
                            xValue,
                            xInverse,
                            xDestroy
                        );
                        if (
                            0 === rc &&
                            (xStep instanceof Function ||
                                xFinal instanceof Function ||
                                xValue instanceof Function ||
                                xInverse instanceof Function ||
                                xDestroy instanceof Function)
                        ) {
                            __dbCleanupMap.addWindowFunc(pDb, funcName, nArg);
                        }
                        return rc;
                    } catch (e) {
                        console.error(
                            "sqlite3_create_window_function() setup threw:",
                            e
                        );
                        return util.sqlite3__wasm_db_error(
                            pDb,
                            e,
                            "Creation of UDF threw: " + e
                        );
                    }
                };
            } else {
                delete capi.sqlite3_create_window_function;
            }

            capi.sqlite3_create_function_v2.udfSetResult =
                capi.sqlite3_create_function.udfSetResult =
                    capi.sqlite3_result_js;
            if (capi.sqlite3_create_window_function) {
                capi.sqlite3_create_window_function.udfSetResult =
                    capi.sqlite3_result_js;
            }

            capi.sqlite3_create_function_v2.udfConvertArgs =
                capi.sqlite3_create_function.udfConvertArgs =
                    capi.sqlite3_values_to_js;
            if (capi.sqlite3_create_window_function) {
                capi.sqlite3_create_window_function.udfConvertArgs =
                    capi.sqlite3_values_to_js;
            }

            capi.sqlite3_create_function_v2.udfSetError =
                capi.sqlite3_create_function.udfSetError =
                    capi.sqlite3_result_error_js;
            if (capi.sqlite3_create_window_function) {
                capi.sqlite3_create_window_function.udfSetError =
                    capi.sqlite3_result_error_js;
            }
        }

        {
            const __flexiString = (v, n) => {
                if ("string" === typeof v) {
                    n = -1;
                } else if (util.isSQLableTypedArray(v)) {
                    n = v.byteLength;
                    v = util.typedArrayToString(
                        v instanceof ArrayBuffer ? new Uint8Array(v) : v
                    );
                } else if (Array.isArray(v)) {
                    v = v.join("");
                    n = -1;
                }
                return [v, n];
            };

            const __prepare = {
                basic: wasm.xWrap("sqlite3_prepare_v3", "int", [
                    "sqlite3*",
                    "string",
                    "int",
                    "int",
                    "**",
                    "**",
                ]),

                full: wasm.xWrap("sqlite3_prepare_v3", "int", [
                    "sqlite3*",
                    "*",
                    "int",
                    "int",
                    "**",
                    "**",
                ]),
            };

            capi.sqlite3_prepare_v3 = function f(
                pDb,
                sql,
                sqlLen,
                prepFlags,
                ppStmt,
                pzTail
            ) {
                if (f.length !== arguments.length) {
                    return __dbArgcMismatch(
                        pDb,
                        "sqlite3_prepare_v3",
                        f.length
                    );
                }
                const [xSql, xSqlLen] = __flexiString(sql, sqlLen);
                switch (typeof xSql) {
                    case "string":
                        return __prepare.basic(
                            pDb,
                            xSql,
                            xSqlLen,
                            prepFlags,
                            ppStmt,
                            null
                        );
                    case "number":
                        return __prepare.full(
                            pDb,
                            xSql,
                            xSqlLen,
                            prepFlags,
                            ppStmt,
                            pzTail
                        );
                    default:
                        return util.sqlite3__wasm_db_error(
                            pDb,
                            capi.SQLITE_MISUSE,
                            "Invalid SQL argument type for sqlite3_prepare_v2/v3()."
                        );
                }
            };

            capi.sqlite3_prepare_v2 = function f(
                pDb,
                sql,
                sqlLen,
                ppStmt,
                pzTail
            ) {
                return f.length === arguments.length
                    ? capi.sqlite3_prepare_v3(
                          pDb,
                          sql,
                          sqlLen,
                          0,
                          ppStmt,
                          pzTail
                      )
                    : __dbArgcMismatch(pDb, "sqlite3_prepare_v2", f.length);
            };
        }

        {
            const __bindText = wasm.xWrap("sqlite3_bind_text", "int", [
                "sqlite3_stmt*",
                "int",
                "string",
                "int",
                "*",
            ]);
            const __bindBlob = wasm.xWrap("sqlite3_bind_blob", "int", [
                "sqlite3_stmt*",
                "int",
                "*",
                "int",
                "*",
            ]);

            capi.sqlite3_bind_text = function f(
                pStmt,
                iCol,
                text,
                nText,
                xDestroy
            ) {
                if (f.length !== arguments.length) {
                    return __dbArgcMismatch(
                        capi.sqlite3_db_handle(pStmt),
                        "sqlite3_bind_text",
                        f.length
                    );
                } else if (wasm.isPtr(text) || null === text) {
                    return __bindText(pStmt, iCol, text, nText, xDestroy);
                } else if (text instanceof ArrayBuffer) {
                    text = new Uint8Array(text);
                } else if (Array.isArray(text)) {
                    text = text.join("");
                }
                let p, n;
                try {
                    if (util.isSQLableTypedArray(text)) {
                        p = wasm.allocFromTypedArray(text);
                        n = text.byteLength;
                    } else if ("string" === typeof text) {
                        [p, n] = wasm.allocCString(text);
                    } else {
                        return util.sqlite3__wasm_db_error(
                            capi.sqlite3_db_handle(pStmt),
                            capi.SQLITE_MISUSE,
                            "Invalid 3rd argument type for sqlite3_bind_text()."
                        );
                    }
                    return __bindText(
                        pStmt,
                        iCol,
                        p,
                        n,
                        capi.SQLITE_WASM_DEALLOC
                    );
                } catch (e) {
                    wasm.dealloc(p);
                    return util.sqlite3__wasm_db_error(
                        capi.sqlite3_db_handle(pStmt),
                        e
                    );
                }
            };

            capi.sqlite3_bind_blob = function f(
                pStmt,
                iCol,
                pMem,
                nMem,
                xDestroy
            ) {
                if (f.length !== arguments.length) {
                    return __dbArgcMismatch(
                        capi.sqlite3_db_handle(pStmt),
                        "sqlite3_bind_blob",
                        f.length
                    );
                } else if (wasm.isPtr(pMem) || null === pMem) {
                    return __bindBlob(pStmt, iCol, pMem, nMem, xDestroy);
                } else if (pMem instanceof ArrayBuffer) {
                    pMem = new Uint8Array(pMem);
                } else if (Array.isArray(pMem)) {
                    pMem = pMem.join("");
                }
                let p, n;
                try {
                    if (util.isBindableTypedArray(pMem)) {
                        p = wasm.allocFromTypedArray(pMem);
                        n = nMem >= 0 ? nMem : pMem.byteLength;
                    } else if ("string" === typeof pMem) {
                        [p, n] = wasm.allocCString(pMem);
                    } else {
                        return util.sqlite3__wasm_db_error(
                            capi.sqlite3_db_handle(pStmt),
                            capi.SQLITE_MISUSE,
                            "Invalid 3rd argument type for sqlite3_bind_blob()."
                        );
                    }
                    return __bindBlob(
                        pStmt,
                        iCol,
                        p,
                        n,
                        capi.SQLITE_WASM_DEALLOC
                    );
                } catch (e) {
                    wasm.dealloc(p);
                    return util.sqlite3__wasm_db_error(
                        capi.sqlite3_db_handle(pStmt),
                        e
                    );
                }
            };
        }

        {
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
                        return wasm.exports.sqlite3__wasm_config_ii(
                            op,
                            args[0],
                            args[1]
                        );
                    case capi.SQLITE_CONFIG_MEMDB_MAXSIZE:
                        return wasm.exports.sqlite3__wasm_config_j(op, args[0]);
                    case capi.SQLITE_CONFIG_GETMALLOC:
                    case capi.SQLITE_CONFIG_GETMUTEX:
                    case capi.SQLITE_CONFIG_GETPCACHE2:
                    case capi.SQLITE_CONFIG_GETPCACHE:
                    case capi.SQLITE_CONFIG_HEAP:
                    case capi.SQLITE_CONFIG_LOG:
                    case capi.SQLITE_CONFIG_MALLOC:
                    case capi.SQLITE_CONFIG_MMAP_SIZE:
                    case capi.SQLITE_CONFIG_MULTITHREAD:
                    case capi.SQLITE_CONFIG_MUTEX:
                    case capi.SQLITE_CONFIG_PAGECACHE:
                    case capi.SQLITE_CONFIG_PCACHE2:
                    case capi.SQLITE_CONFIG_PCACHE:
                    case capi.SQLITE_CONFIG_PCACHE_HDRSZ:
                    case capi.SQLITE_CONFIG_PMASZ:
                    case capi.SQLITE_CONFIG_SERIALIZED:
                    case capi.SQLITE_CONFIG_SINGLETHREAD:
                    case capi.SQLITE_CONFIG_SQLLOG:
                    case capi.SQLITE_CONFIG_WIN32_HEAPSIZE:
                    default:
                        return capi.SQLITE_NOTFOUND;
                }
            };
        }

        {
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
                if (!fPtr || 1 !== arguments.length || !wasm.isPtr(fPtr))
                    return 0;
                return wasm.exports.sqlite3_cancel_auto_extension(fPtr);
            };

            capi.sqlite3_reset_auto_extension = function () {
                wasm.exports.sqlite3_reset_auto_extension();
                for (const fp of __autoExtFptr) wasm.uninstallFunction(fp);
                __autoExtFptr.clear();
            };
        }

        const pKvvfs = capi.sqlite3_vfs_find("kvvfs");
        if (pKvvfs) {
            if (util.isUIThread()) {
                const kvvfsMethods = new capi.sqlite3_kvvfs_methods(
                    wasm.exports.sqlite3__wasm_kvvfs_methods()
                );
                delete capi.sqlite3_kvvfs_methods;

                const kvvfsMakeKey =
                        wasm.exports.sqlite3__wasm_kvvfsMakeKeyOnPstack,
                    pstack = wasm.pstack;

                const kvvfsStorage = (zClass) =>
                    115 === wasm.peek(zClass) ? sessionStorage : localStorage;

                const kvvfsImpls = {
                    xRead: (zClass, zKey, zBuf, nBuf) => {
                        const stack = pstack.pointer,
                            astack = wasm.scopedAllocPush();
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
                            kvvfsStorage(zClass).setItem(
                                jKey,
                                wasm.cstrToJs(zData)
                            );
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
                            kvvfsStorage(zClass).removeItem(
                                wasm.cstrToJs(zXKey)
                            );
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
                    kvvfsMethods[kvvfsMethods.memberKey(k)] =
                        wasm.installFunction(
                            kvvfsMethods.memberSignature(k),
                            kvvfsImpls[k]
                        );
                }
            } else {
                capi.sqlite3_vfs_unregister(pKvvfs);
            }
        }

        wasm.xWrap.FuncPtrAdapter.warnOnUse = true;

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
                toss(
                    "Usage error: expecting a Function or WASM pointer to one."
                );
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
                                tgt.structInfo.name +
                                    "::" +
                                    funcName +
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
                    toss(
                        "Pointer",
                        fProxy,
                        "is not a WASM function table entry."
                    );
                }
                tgt[memKey] = fProxy;
            } else {
                const pFunc = wasm.installFunction(
                    fProxy,
                    tgt.memberSignature(name, true)
                );
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
    });

    globalThis.sqlite3ApiBootstrap.initializers.push(function (sqlite3) {
        sqlite3.version = {
            libVersion: "3.50.4",
            libVersionNumber: 3050004,
            sourceId:
                "2025-07-30 19:33:53 4d8adfb30e03f9cf27f800a2c1ba3c48fb4ca1b08b0f5ed59a4d5ecbf45e20a3",
            downloadVersion: 3500400,
        };
    });

    globalThis.sqlite3ApiBootstrap.initializers.push(function (sqlite3) {
        const toss3 = (...args) => {
            throw new sqlite3.SQLite3Error(...args);
        };

        const capi = sqlite3.capi,
            wasm = sqlite3.wasm,
            util = sqlite3.util;

        const __ptrMap = new WeakMap();

        const __stmtMap = new WeakMap();

        const getOwnOption = (opts, p, dflt) => {
            const d = Object.getOwnPropertyDescriptor(opts, p);
            return d ? d.value : dflt;
        };

        const checkSqlite3Rc = function (dbPtr, sqliteResultCode) {
            if (sqliteResultCode) {
                if (dbPtr instanceof DB) dbPtr = dbPtr.pointer;
                toss3(
                    sqliteResultCode,
                    "sqlite3 result code",
                    sqliteResultCode + ":",
                    dbPtr
                        ? capi.sqlite3_errmsg(dbPtr)
                        : capi.sqlite3_errstr(sqliteResultCode)
                );
            }
            return arguments[0];
        };

        const __dbTraceToConsole = wasm.installFunction(
            "i(ippp)",
            function (t, c, p, x) {
                if (capi.SQLITE_TRACE_STMT === t) {
                    console.log(
                        "SQL TRACE #" +
                            ++this.counter +
                            " via sqlite3@" +
                            c +
                            ":",
                        wasm.cstrToJs(x)
                    );
                }
            }.bind({ counter: 0 })
        );

        const __vfsPostOpenCallback = Object.create(null);

        const dbCtorHelper = function ctor(...args) {
            if (!ctor._name2vfs) {
                ctor._name2vfs = Object.create(null);
                const isWorkerThread =
                    "function" === typeof importScripts
                        ? (n) =>
                              toss3(
                                  "The VFS for",
                                  n,
                                  "is only available in the main window thread."
                              )
                        : false;
                ctor._name2vfs[":localStorage:"] = {
                    vfs: "kvvfs",
                    filename: isWorkerThread || (() => "local"),
                };
                ctor._name2vfs[":sessionStorage:"] = {
                    vfs: "kvvfs",
                    filename: isWorkerThread || (() => "session"),
                };
            }
            const opt = ctor.normalizeArgs(...args);
            let fn = opt.filename,
                vfsName = opt.vfs,
                flagsStr = opt.flags;
            if (
                ("string" !== typeof fn && "number" !== typeof fn) ||
                "string" !== typeof flagsStr ||
                (vfsName &&
                    "string" !== typeof vfsName &&
                    "number" !== typeof vfsName)
            ) {
                sqlite3.config.error("Invalid DB ctor args", opt, arguments);
                toss3("Invalid arguments for DB constructor.");
            }
            let fnJs = "number" === typeof fn ? wasm.cstrToJs(fn) : fn;
            const vfsCheck = ctor._name2vfs[fnJs];
            if (vfsCheck) {
                vfsName = vfsCheck.vfs;
                fn = fnJs = vfsCheck.filename(fnJs);
            }
            let pDb,
                oflags = 0;
            if (flagsStr.indexOf("c") >= 0) {
                oflags |= capi.SQLITE_OPEN_CREATE | capi.SQLITE_OPEN_READWRITE;
            }
            if (flagsStr.indexOf("w") >= 0)
                oflags |= capi.SQLITE_OPEN_READWRITE;
            if (0 === oflags) oflags |= capi.SQLITE_OPEN_READONLY;
            oflags |= capi.SQLITE_OPEN_EXRESCODE;
            const stack = wasm.pstack.pointer;
            try {
                const pPtr = wasm.pstack.allocPtr();
                let rc = capi.sqlite3_open_v2(fn, pPtr, oflags, vfsName || 0);
                pDb = wasm.peekPtr(pPtr);
                checkSqlite3Rc(pDb, rc);
                capi.sqlite3_extended_result_codes(pDb, 1);
                if (flagsStr.indexOf("t") >= 0) {
                    capi.sqlite3_trace_v2(
                        pDb,
                        capi.SQLITE_TRACE_STMT,
                        __dbTraceToConsole,
                        pDb
                    );
                }
            } catch (e) {
                if (pDb) capi.sqlite3_close_v2(pDb);
                throw e;
            } finally {
                wasm.pstack.restore(stack);
            }
            this.filename = fnJs;
            __ptrMap.set(this, pDb);
            __stmtMap.set(this, Object.create(null));
            try {
                const pVfs =
                    capi.sqlite3_js_db_vfs(pDb) ||
                    toss3("Internal error: cannot get VFS for new db handle.");
                const postInitSql = __vfsPostOpenCallback[pVfs];
                if (postInitSql) {
                    if (postInitSql instanceof Function) {
                        postInitSql(this, sqlite3);
                    } else {
                        checkSqlite3Rc(
                            pDb,
                            capi.sqlite3_exec(pDb, postInitSql, 0, 0, 0)
                        );
                    }
                }
            } catch (e) {
                this.close();
                throw e;
            }
        };

        dbCtorHelper.setVfsPostOpenCallback = function (pVfs, callback) {
            if (!(callback instanceof Function)) {
                toss3(
                    "dbCtorHelper.setVfsPostOpenCallback() should not be used with " +
                        "a non-function argument.",
                    arguments
                );
            }
            __vfsPostOpenCallback[pVfs] = callback;
        };

        dbCtorHelper.normalizeArgs = function (
            filename = ":memory:",
            flags = "c",
            vfs = null
        ) {
            const arg = {};
            if (
                1 === arguments.length &&
                arguments[0] &&
                "object" === typeof arguments[0]
            ) {
                Object.assign(arg, arguments[0]);
                if (undefined === arg.flags) arg.flags = "c";
                if (undefined === arg.vfs) arg.vfs = null;
                if (undefined === arg.filename) arg.filename = ":memory:";
            } else {
                arg.filename = filename;
                arg.flags = flags;
                arg.vfs = vfs;
            }
            return arg;
        };

        const DB = function (...args) {
            dbCtorHelper.apply(this, args);
        };
        DB.dbCtorHelper = dbCtorHelper;

        const BindTypes = {
            null: 1,
            number: 2,
            string: 3,
            boolean: 4,
            blob: 5,
        };
        BindTypes["undefined"] = BindTypes.null;
        if (wasm.bigIntEnabled) {
            BindTypes.bigint = BindTypes.number;
        }

        const Stmt = function () {
            if (BindTypes !== arguments[2]) {
                toss3(
                    capi.SQLITE_MISUSE,
                    "Do not call the Stmt constructor directly. Use DB.prepare()."
                );
            }
            this.db = arguments[0];
            __ptrMap.set(this, arguments[1]);
            this.parameterCount = capi.sqlite3_bind_parameter_count(
                this.pointer
            );
        };

        const affirmDbOpen = function (db) {
            if (!db.pointer) toss3("DB has been closed.");
            return db;
        };

        const affirmColIndex = function (stmt, ndx) {
            if (ndx !== (ndx | 0) || ndx < 0 || ndx >= stmt.columnCount) {
                toss3("Column index", ndx, "is out of range.");
            }
            return stmt;
        };

        const parseExecArgs = function (db, args) {
            const out = Object.create(null);
            out.opt = Object.create(null);
            switch (args.length) {
                case 1:
                    if (
                        "string" === typeof args[0] ||
                        util.isSQLableTypedArray(args[0])
                    ) {
                        out.sql = args[0];
                    } else if (Array.isArray(args[0])) {
                        out.sql = args[0];
                    } else if (args[0] && "object" === typeof args[0]) {
                        out.opt = args[0];
                        out.sql = out.opt.sql;
                    }
                    break;
                case 2:
                    out.sql = args[0];
                    out.opt = args[1];
                    break;
                default:
                    toss3("Invalid argument count for exec().");
            }
            out.sql = util.flexibleString(out.sql);
            if ("string" !== typeof out.sql) {
                toss3("Missing SQL argument or unsupported SQL value type.");
            }
            const opt = out.opt;
            switch (opt.returnValue) {
                case "resultRows":
                    if (!opt.resultRows) opt.resultRows = [];
                    out.returnVal = () => opt.resultRows;
                    break;
                case "saveSql":
                    if (!opt.saveSql) opt.saveSql = [];
                    out.returnVal = () => opt.saveSql;
                    break;
                case undefined:
                case "this":
                    out.returnVal = () => db;
                    break;
                default:
                    toss3("Invalid returnValue value:", opt.returnValue);
            }
            if (
                !opt.callback &&
                !opt.returnValue &&
                undefined !== opt.rowMode
            ) {
                if (!opt.resultRows) opt.resultRows = [];
                out.returnVal = () => opt.resultRows;
            }
            if (opt.callback || opt.resultRows) {
                switch (undefined === opt.rowMode ? "array" : opt.rowMode) {
                    case "object":
                        out.cbArg = (stmt, cache) => {
                            if (!cache.columnNames)
                                cache.columnNames = stmt.getColumnNames([]);

                            const row = stmt.get([]);
                            const rv = Object.create(null);
                            for (const i in cache.columnNames)
                                rv[cache.columnNames[i]] = row[i];
                            return rv;
                        };
                        break;
                    case "array":
                        out.cbArg = (stmt) => stmt.get([]);
                        break;
                    case "stmt":
                        if (Array.isArray(opt.resultRows)) {
                            toss3(
                                "exec(): invalid rowMode for a resultRows array: must",
                                "be one of 'array', 'object',",
                                "a result column number, or column name reference."
                            );
                        }
                        out.cbArg = (stmt) => stmt;
                        break;
                    default:
                        if (util.isInt32(opt.rowMode)) {
                            out.cbArg = (stmt) => stmt.get(opt.rowMode);
                            break;
                        } else if (
                            "string" === typeof opt.rowMode &&
                            opt.rowMode.length > 1 &&
                            "$" === opt.rowMode[0]
                        ) {
                            const $colName = opt.rowMode.substr(1);
                            out.cbArg = (stmt) => {
                                const rc = stmt.get(Object.create(null))[
                                    $colName
                                ];
                                return undefined === rc
                                    ? toss3(
                                          capi.SQLITE_NOTFOUND,
                                          "exec(): unknown result column:",
                                          $colName
                                      )
                                    : rc;
                            };
                            break;
                        }
                        toss3("Invalid rowMode:", opt.rowMode);
                }
            }
            return out;
        };

        const __selectFirstRow = (db, sql, bind, ...getArgs) => {
            const stmt = db.prepare(sql);
            try {
                const rc = stmt.bind(bind).step()
                    ? stmt.get(...getArgs)
                    : undefined;
                stmt.reset();
                return rc;
            } finally {
                stmt.finalize();
            }
        };

        const __selectAll = (db, sql, bind, rowMode) =>
            db.exec({
                sql,
                bind,
                rowMode,
                returnValue: "resultRows",
            });

        DB.checkRc = (db, resultCode) => checkSqlite3Rc(db, resultCode);

        DB.prototype = {
            isOpen: function () {
                return !!this.pointer;
            },

            affirmOpen: function () {
                return affirmDbOpen(this);
            },

            close: function () {
                if (this.pointer) {
                    if (
                        this.onclose &&
                        this.onclose.before instanceof Function
                    ) {
                        try {
                            this.onclose.before(this);
                        } catch (_e) {}
                    }
                    const pDb = this.pointer;
                    Object.keys(__stmtMap.get(this)).forEach((k, s) => {
                        if (s && s.pointer) {
                            try {
                                s.finalize();
                            } catch (_e) {}
                        }
                    });
                    __ptrMap.delete(this);
                    __stmtMap.delete(this);
                    capi.sqlite3_close_v2(pDb);
                    if (
                        this.onclose &&
                        this.onclose.after instanceof Function
                    ) {
                        try {
                            this.onclose.after(this);
                        } catch (_e) {}
                    }
                    delete this.filename;
                }
            },

            changes: function (total = false, sixtyFour = false) {
                const p = affirmDbOpen(this).pointer;
                if (total) {
                    return sixtyFour
                        ? capi.sqlite3_total_changes64(p)
                        : capi.sqlite3_total_changes(p);
                } else {
                    return sixtyFour
                        ? capi.sqlite3_changes64(p)
                        : capi.sqlite3_changes(p);
                }
            },

            dbFilename: function (dbName = "main") {
                return capi.sqlite3_db_filename(
                    affirmDbOpen(this).pointer,
                    dbName
                );
            },

            dbName: function (dbNumber = 0) {
                return capi.sqlite3_db_name(
                    affirmDbOpen(this).pointer,
                    dbNumber
                );
            },

            dbVfsName: function (dbName = 0) {
                let rc;
                const pVfs = capi.sqlite3_js_db_vfs(
                    affirmDbOpen(this).pointer,
                    dbName
                );
                if (pVfs) {
                    const v = new capi.sqlite3_vfs(pVfs);
                    try {
                        rc = wasm.cstrToJs(v.$zName);
                    } finally {
                        v.dispose();
                    }
                }
                return rc;
            },

            prepare: function (sql) {
                affirmDbOpen(this);
                const stack = wasm.pstack.pointer;
                let ppStmt, pStmt;
                try {
                    ppStmt = wasm.pstack.alloc(8);
                    DB.checkRc(
                        this,
                        capi.sqlite3_prepare_v2(
                            this.pointer,
                            sql,
                            -1,
                            ppStmt,
                            null
                        )
                    );
                    pStmt = wasm.peekPtr(ppStmt);
                } finally {
                    wasm.pstack.restore(stack);
                }
                if (!pStmt) toss3("Cannot prepare empty SQL.");
                const stmt = new Stmt(this, pStmt, BindTypes);
                __stmtMap.get(this)[pStmt] = stmt;
                return stmt;
            },

            exec: function () {
                affirmDbOpen(this);
                const arg = parseExecArgs(this, arguments);
                if (!arg.sql) {
                    return toss3("exec() requires an SQL string.");
                }
                const opt = arg.opt;
                const callback = opt.callback;
                const resultRows = Array.isArray(opt.resultRows)
                    ? opt.resultRows
                    : undefined;
                let stmt;
                let bind = opt.bind;
                let evalFirstResult = !!(
                    arg.cbArg ||
                    opt.columnNames ||
                    resultRows
                );
                const stack = wasm.scopedAllocPush();
                const saveSql = Array.isArray(opt.saveSql)
                    ? opt.saveSql
                    : undefined;
                try {
                    const isTA = util.isSQLableTypedArray(arg.sql);
                    let sqlByteLen = isTA
                        ? arg.sql.byteLength
                        : wasm.jstrlen(arg.sql);
                    const ppStmt = wasm.scopedAlloc(
                        2 * wasm.ptrSizeof + (sqlByteLen + 1)
                    );
                    const pzTail = ppStmt + wasm.ptrSizeof;
                    let pSql = pzTail + wasm.ptrSizeof;
                    const pSqlEnd = pSql + sqlByteLen;
                    if (isTA) wasm.heap8().set(arg.sql, pSql);
                    else
                        wasm.jstrcpy(
                            arg.sql,
                            wasm.heap8(),
                            pSql,
                            sqlByteLen,
                            false
                        );
                    wasm.poke(pSql + sqlByteLen, 0);
                    while (pSql && wasm.peek(pSql, "i8")) {
                        wasm.pokePtr([ppStmt, pzTail], 0);
                        DB.checkRc(
                            this,
                            capi.sqlite3_prepare_v3(
                                this.pointer,
                                pSql,
                                sqlByteLen,
                                0,
                                ppStmt,
                                pzTail
                            )
                        );
                        const pStmt = wasm.peekPtr(ppStmt);
                        pSql = wasm.peekPtr(pzTail);
                        sqlByteLen = pSqlEnd - pSql;
                        if (!pStmt) continue;
                        if (saveSql)
                            saveSql.push(capi.sqlite3_sql(pStmt).trim());
                        stmt = new Stmt(this, pStmt, BindTypes);
                        if (bind && stmt.parameterCount) {
                            stmt.bind(bind);
                            bind = null;
                        }
                        if (evalFirstResult && stmt.columnCount) {
                            let gotColNames = Array.isArray(opt.columnNames)
                                ? 0
                                : 1;
                            evalFirstResult = false;
                            if (arg.cbArg || resultRows) {
                                const cbArgCache = Object.create(null);
                                for (
                                    ;
                                    stmt.step();
                                    stmt._lockedByExec = false
                                ) {
                                    if (0 === gotColNames++) {
                                        stmt.getColumnNames(
                                            (cbArgCache.columnNames =
                                                opt.columnNames || [])
                                        );
                                    }
                                    stmt._lockedByExec = true;
                                    const row = arg.cbArg(stmt, cbArgCache);
                                    if (resultRows) resultRows.push(row);
                                    if (
                                        callback &&
                                        false === callback.call(opt, row, stmt)
                                    ) {
                                        break;
                                    }
                                }
                                stmt._lockedByExec = false;
                            }
                            if (0 === gotColNames) {
                                stmt.getColumnNames(opt.columnNames);
                            }
                        } else {
                            stmt.step();
                        }
                        stmt.reset().finalize();
                        stmt = null;
                    }
                } finally {
                    wasm.scopedAllocPop(stack);
                    if (stmt) {
                        delete stmt._lockedByExec;
                        stmt.finalize();
                    }
                }
                return arg.returnVal();
            },

            createFunction: function f(name, xFunc, opt) {
                const isFunc = (f) => f instanceof Function;
                switch (arguments.length) {
                    case 1:
                        opt = name;
                        name = opt.name;
                        xFunc = opt.xFunc || 0;
                        break;
                    case 2:
                        if (!isFunc(xFunc)) {
                            opt = xFunc;
                            xFunc = opt.xFunc || 0;
                        }
                        break;
                    case 3:
                        break;
                    default:
                        break;
                }
                if (!opt) opt = {};
                if ("string" !== typeof name) {
                    toss3("Invalid arguments: missing function name.");
                }
                let xStep = opt.xStep || 0;
                let xFinal = opt.xFinal || 0;
                const xValue = opt.xValue || 0;
                const xInverse = opt.xInverse || 0;
                let isWindow = undefined;
                if (isFunc(xFunc)) {
                    isWindow = false;
                    if (isFunc(xStep) || isFunc(xFinal)) {
                        toss3("Ambiguous arguments: scalar or aggregate?");
                    }
                    xStep = xFinal = null;
                } else if (isFunc(xStep)) {
                    if (!isFunc(xFinal)) {
                        toss3(
                            "Missing xFinal() callback for aggregate or window UDF."
                        );
                    }
                    xFunc = null;
                } else if (isFunc(xFinal)) {
                    toss3(
                        "Missing xStep() callback for aggregate or window UDF."
                    );
                } else {
                    toss3("Missing function-type properties.");
                }
                if (false === isWindow) {
                    if (isFunc(xValue) || isFunc(xInverse)) {
                        toss3(
                            "xValue and xInverse are not permitted for non-window UDFs."
                        );
                    }
                } else if (isFunc(xValue)) {
                    if (!isFunc(xInverse)) {
                        toss3("xInverse must be provided if xValue is.");
                    }
                    isWindow = true;
                } else if (isFunc(xInverse)) {
                    toss3("xValue must be provided if xInverse is.");
                }
                const pApp = opt.pApp;
                if (
                    undefined !== pApp &&
                    null !== pApp &&
                    ("number" !== typeof pApp || !util.isInt32(pApp))
                ) {
                    toss3(
                        "Invalid value for pApp property. Must be a legal WASM pointer value."
                    );
                }
                const xDestroy = opt.xDestroy || 0;
                if (xDestroy && !isFunc(xDestroy)) {
                    toss3("xDestroy property must be a function.");
                }
                let fFlags = 0;
                if (getOwnOption(opt, "deterministic"))
                    fFlags |= capi.SQLITE_DETERMINISTIC;
                if (getOwnOption(opt, "directOnly"))
                    fFlags |= capi.SQLITE_DIRECTONLY;
                if (getOwnOption(opt, "innocuous"))
                    fFlags |= capi.SQLITE_INNOCUOUS;
                name = name.toLowerCase();
                const xArity = xFunc || xStep;
                const arity = getOwnOption(opt, "arity");
                const arityArg =
                    "number" === typeof arity
                        ? arity
                        : xArity.length
                        ? xArity.length - 1
                        : 0;
                let rc;
                if (isWindow) {
                    rc = capi.sqlite3_create_window_function(
                        this.pointer,
                        name,
                        arityArg,
                        capi.SQLITE_UTF8 | fFlags,
                        pApp || 0,
                        xStep,
                        xFinal,
                        xValue,
                        xInverse,
                        xDestroy
                    );
                } else {
                    rc = capi.sqlite3_create_function_v2(
                        this.pointer,
                        name,
                        arityArg,
                        capi.SQLITE_UTF8 | fFlags,
                        pApp || 0,
                        xFunc,
                        xStep,
                        xFinal,
                        xDestroy
                    );
                }
                DB.checkRc(this, rc);
                return this;
            },

            selectValue: function (sql, bind, asType) {
                return __selectFirstRow(this, sql, bind, 0, asType);
            },

            selectValues: function (sql, bind, asType) {
                const stmt = this.prepare(sql),
                    rc = [];
                try {
                    stmt.bind(bind);
                    while (stmt.step()) rc.push(stmt.get(0, asType));
                    stmt.reset();
                } finally {
                    stmt.finalize();
                }
                return rc;
            },

            selectArray: function (sql, bind) {
                return __selectFirstRow(this, sql, bind, []);
            },

            selectObject: function (sql, bind) {
                return __selectFirstRow(this, sql, bind, {});
            },

            selectArrays: function (sql, bind) {
                return __selectAll(this, sql, bind, "array");
            },

            selectObjects: function (sql, bind) {
                return __selectAll(this, sql, bind, "object");
            },

            openStatementCount: function () {
                return this.pointer
                    ? Object.keys(__stmtMap.get(this)).length
                    : 0;
            },

            transaction: function (callback) {
                let opener = "BEGIN";
                if (arguments.length > 1) {
                    if (/[^a-zA-Z]/.test(arguments[0])) {
                        toss3(
                            capi.SQLITE_MISUSE,
                            "Invalid argument for BEGIN qualifier."
                        );
                    }
                    opener += " " + arguments[0];
                    callback = arguments[1];
                }
                affirmDbOpen(this).exec(opener);
                try {
                    const rc = callback(this);
                    this.exec("COMMIT");
                    return rc;
                } catch (e) {
                    this.exec("ROLLBACK");
                    throw e;
                }
            },

            savepoint: function (callback) {
                affirmDbOpen(this).exec("SAVEPOINT oo1");
                try {
                    const rc = callback(this);
                    this.exec("RELEASE oo1");
                    return rc;
                } catch (e) {
                    this.exec(
                        "ROLLBACK to SAVEPOINT oo1; RELEASE SAVEPOINT oo1"
                    );
                    throw e;
                }
            },

            checkRc: function (resultCode) {
                return checkSqlite3Rc(this, resultCode);
            },
        };

        const affirmStmtOpen = function (stmt) {
            if (!stmt.pointer) toss3("Stmt has been closed.");
            return stmt;
        };

        const isSupportedBindType = function (v) {
            let t =
                BindTypes[null === v || undefined === v ? "null" : typeof v];
            switch (t) {
                case BindTypes.boolean:
                case BindTypes.null:
                case BindTypes.number:
                case BindTypes.string:
                    return t;
                case BindTypes.bigint:
                    if (wasm.bigIntEnabled) return t;
                    break;

                default:
                    return util.isBindableTypedArray(v)
                        ? BindTypes.blob
                        : undefined;
            }
        };

        const affirmSupportedBindType = function (v) {
            return (
                isSupportedBindType(v) ||
                toss3("Unsupported bind() argument type:", typeof v)
            );
        };

        const affirmParamIndex = function (stmt, key) {
            const n =
                "number" === typeof key
                    ? key
                    : capi.sqlite3_bind_parameter_index(stmt.pointer, key);
            if (0 === n || !util.isInt32(n)) {
                toss3("Invalid bind() parameter name: " + key);
            } else if (n < 1 || n > stmt.parameterCount)
                toss3("Bind index", key, "is out of range.");
            return n;
        };

        const affirmNotLockedByExec = function (stmt, currentOpName) {
            if (stmt._lockedByExec) {
                toss3(
                    "Operation is illegal when statement is locked:",
                    currentOpName
                );
            }
            return stmt;
        };

        const bindOne = function f(stmt, ndx, bindType, val) {
            affirmNotLockedByExec(affirmStmtOpen(stmt), "bind()");
            if (!f._) {
                f._tooBigInt = (v) =>
                    toss3(
                        "BigInt value is too big to store without precision loss:",
                        v
                    );
                f._ = {
                    string: function (stmt, ndx, val, asBlob) {
                        const [pStr, n] = wasm.allocCString(val, true);
                        const f = asBlob
                            ? capi.sqlite3_bind_blob
                            : capi.sqlite3_bind_text;
                        return f(
                            stmt.pointer,
                            ndx,
                            pStr,
                            n,
                            capi.SQLITE_WASM_DEALLOC
                        );
                    },
                };
            }
            affirmSupportedBindType(val);
            ndx = affirmParamIndex(stmt, ndx);
            let rc = 0;
            switch (
                null === val || undefined === val ? BindTypes.null : bindType
            ) {
                case BindTypes.null:
                    rc = capi.sqlite3_bind_null(stmt.pointer, ndx);
                    break;
                case BindTypes.string:
                    rc = f._.string(stmt, ndx, val, false);
                    break;
                case BindTypes.number: {
                    let m;
                    if (util.isInt32(val)) m = capi.sqlite3_bind_int;
                    else if ("bigint" === typeof val) {
                        if (!util.bigIntFits64(val)) {
                            f._tooBigInt(val);
                        } else if (wasm.bigIntEnabled) {
                            m = capi.sqlite3_bind_int64;
                        } else if (util.bigIntFitsDouble(val)) {
                            val = Number(val);
                            m = capi.sqlite3_bind_double;
                        } else {
                            f._tooBigInt(val);
                        }
                    } else {
                        val = Number(val);
                        if (wasm.bigIntEnabled && Number.isInteger(val)) {
                            m = capi.sqlite3_bind_int64;
                        } else {
                            m = capi.sqlite3_bind_double;
                        }
                    }
                    rc = m(stmt.pointer, ndx, val);
                    break;
                }
                case BindTypes.boolean:
                    rc = capi.sqlite3_bind_int(stmt.pointer, ndx, val ? 1 : 0);
                    break;
                case BindTypes.blob: {
                    if ("string" === typeof val) {
                        rc = f._.string(stmt, ndx, val, true);
                        break;
                    } else if (val instanceof ArrayBuffer) {
                        val = new Uint8Array(val);
                    } else if (!util.isBindableTypedArray(val)) {
                        toss3(
                            "Binding a value as a blob requires",
                            "that it be a string, Uint8Array, Int8Array, or ArrayBuffer."
                        );
                    }
                    const pBlob = wasm.alloc(val.byteLength || 1);
                    wasm.heap8().set(val.byteLength ? val : [0], pBlob);
                    rc = capi.sqlite3_bind_blob(
                        stmt.pointer,
                        ndx,
                        pBlob,
                        val.byteLength,
                        capi.SQLITE_WASM_DEALLOC
                    );
                    break;
                }
                default:
                    sqlite3.config.warn(
                        "Unsupported bind() argument type:",
                        val
                    );
                    toss3("Unsupported bind() argument type: " + typeof val);
            }
            if (rc) DB.checkRc(stmt.db.pointer, rc);
            stmt._mayGet = false;
            return stmt;
        };

        Stmt.prototype = {
            finalize: function () {
                if (this.pointer) {
                    affirmNotLockedByExec(this, "finalize()");
                    const rc = capi.sqlite3_finalize(this.pointer);
                    delete __stmtMap.get(this.db)[this.pointer];
                    __ptrMap.delete(this);
                    delete this._mayGet;
                    delete this.parameterCount;
                    delete this._lockedByExec;
                    delete this.db;
                    return rc;
                }
            },

            clearBindings: function () {
                affirmNotLockedByExec(affirmStmtOpen(this), "clearBindings()");
                capi.sqlite3_clear_bindings(this.pointer);
                this._mayGet = false;
                return this;
            },

            reset: function (alsoClearBinds) {
                affirmNotLockedByExec(this, "reset()");
                if (alsoClearBinds) this.clearBindings();
                const rc = capi.sqlite3_reset(affirmStmtOpen(this).pointer);
                this._mayGet = false;
                checkSqlite3Rc(this.db, rc);
                return this;
            },

            bind: function () {
                affirmStmtOpen(this);
                let ndx, arg;
                switch (arguments.length) {
                    case 1:
                        ndx = 1;
                        arg = arguments[0];
                        break;
                    case 2:
                        ndx = arguments[0];
                        arg = arguments[1];
                        break;
                    default:
                        toss3("Invalid bind() arguments.");
                }
                if (undefined === arg) {
                    return this;
                } else if (!this.parameterCount) {
                    toss3("This statement has no bindable parameters.");
                }
                this._mayGet = false;
                if (null === arg) {
                    return bindOne(this, ndx, BindTypes.null, arg);
                } else if (Array.isArray(arg)) {
                    if (1 !== arguments.length) {
                        toss3(
                            "When binding an array, an index argument is not permitted."
                        );
                    }
                    arg.forEach((v, i) =>
                        bindOne(this, i + 1, affirmSupportedBindType(v), v)
                    );
                    return this;
                } else if (arg instanceof ArrayBuffer) {
                    arg = new Uint8Array(arg);
                }
                if (
                    "object" === typeof arg &&
                    !util.isBindableTypedArray(arg)
                ) {
                    if (1 !== arguments.length) {
                        toss3(
                            "When binding an object, an index argument is not permitted."
                        );
                    }
                    Object.keys(arg).forEach((k) =>
                        bindOne(
                            this,
                            k,
                            affirmSupportedBindType(arg[k]),
                            arg[k]
                        )
                    );
                    return this;
                } else {
                    return bindOne(
                        this,
                        ndx,
                        affirmSupportedBindType(arg),
                        arg
                    );
                }
            },

            bindAsBlob: function (ndx, arg) {
                affirmStmtOpen(this);
                if (1 === arguments.length) {
                    arg = ndx;
                    ndx = 1;
                }
                const t = affirmSupportedBindType(arg);
                if (
                    BindTypes.string !== t &&
                    BindTypes.blob !== t &&
                    BindTypes.null !== t
                ) {
                    toss3("Invalid value type for bindAsBlob()");
                }
                return bindOne(this, ndx, BindTypes.blob, arg);
            },

            step: function () {
                affirmNotLockedByExec(this, "step()");
                const rc = capi.sqlite3_step(affirmStmtOpen(this).pointer);
                switch (rc) {
                    case capi.SQLITE_DONE:
                        return (this._mayGet = false);
                    case capi.SQLITE_ROW:
                        return (this._mayGet = true);
                    default:
                        this._mayGet = false;
                        sqlite3.config.warn(
                            "sqlite3_step() rc=",
                            rc,
                            capi.sqlite3_js_rc_str(rc),
                            "SQL =",
                            capi.sqlite3_sql(this.pointer)
                        );
                        DB.checkRc(this.db.pointer, rc);
                }
            },

            stepReset: function () {
                this.step();
                return this.reset();
            },

            stepFinalize: function () {
                try {
                    const rc = this.step();
                    this.reset();
                    return rc;
                } finally {
                    try {
                        this.finalize();
                    } catch (_e) {}
                }
            },

            get: function (ndx, asType) {
                if (!affirmStmtOpen(this)._mayGet) {
                    toss3("Stmt.step() has not (recently) returned true.");
                }
                if (Array.isArray(ndx)) {
                    let i = 0;
                    const n = this.columnCount;
                    while (i < n) {
                        ndx[i] = this.get(i++);
                    }
                    return ndx;
                } else if (ndx && "object" === typeof ndx) {
                    let i = 0;
                    const n = this.columnCount;
                    while (i < n) {
                        ndx[capi.sqlite3_column_name(this.pointer, i)] =
                            this.get(i++);
                    }
                    return ndx;
                }
                affirmColIndex(this, ndx);
                switch (
                    undefined === asType
                        ? capi.sqlite3_column_type(this.pointer, ndx)
                        : asType
                ) {
                    case capi.SQLITE_NULL:
                        return null;
                    case capi.SQLITE_INTEGER: {
                        if (wasm.bigIntEnabled) {
                            const rc = capi.sqlite3_column_int64(
                                this.pointer,
                                ndx
                            );
                            if (
                                rc >= Number.MIN_SAFE_INTEGER &&
                                rc <= Number.MAX_SAFE_INTEGER
                            ) {
                                return Number(rc).valueOf();
                            }
                            return rc;
                        } else {
                            const rc = capi.sqlite3_column_double(
                                this.pointer,
                                ndx
                            );
                            if (
                                rc > Number.MAX_SAFE_INTEGER ||
                                rc < Number.MIN_SAFE_INTEGER
                            ) {
                                toss3(
                                    "Integer is out of range for JS integer range: " +
                                        rc
                                );
                            }

                            return util.isInt32(rc) ? rc | 0 : rc;
                        }
                    }
                    case capi.SQLITE_FLOAT:
                        return capi.sqlite3_column_double(this.pointer, ndx);
                    case capi.SQLITE_TEXT:
                        return capi.sqlite3_column_text(this.pointer, ndx);
                    case capi.SQLITE_BLOB: {
                        const n = capi.sqlite3_column_bytes(this.pointer, ndx),
                            ptr = capi.sqlite3_column_blob(this.pointer, ndx),
                            rc = new Uint8Array(n);

                        if (n) rc.set(wasm.heap8u().slice(ptr, ptr + n), 0);

                        if (n && this.db._blobXfer instanceof Array) {
                            this.db._blobXfer.push(rc.buffer);
                        }
                        return rc;
                    }
                    default:
                        toss3(
                            "Don't know how to translate",
                            "type of result column #" + ndx + "."
                        );
                }
                toss3("Not reached.");
            },

            getInt: function (ndx) {
                return this.get(ndx, capi.SQLITE_INTEGER);
            },

            getFloat: function (ndx) {
                return this.get(ndx, capi.SQLITE_FLOAT);
            },

            getString: function (ndx) {
                return this.get(ndx, capi.SQLITE_TEXT);
            },

            getBlob: function (ndx) {
                return this.get(ndx, capi.SQLITE_BLOB);
            },

            getJSON: function (ndx) {
                const s = this.get(ndx, capi.SQLITE_STRING);
                return null === s ? s : JSON.parse(s);
            },

            getColumnName: function (ndx) {
                return capi.sqlite3_column_name(
                    affirmColIndex(affirmStmtOpen(this), ndx).pointer,
                    ndx
                );
            },

            getColumnNames: function (tgt = []) {
                affirmColIndex(affirmStmtOpen(this), 0);
                const n = this.columnCount;
                for (let i = 0; i < n; ++i) {
                    tgt.push(capi.sqlite3_column_name(this.pointer, i));
                }
                return tgt;
            },

            getParamIndex: function (name) {
                return affirmStmtOpen(this).parameterCount
                    ? capi.sqlite3_bind_parameter_index(this.pointer, name)
                    : undefined;
            },

            getParamName: function (ndx) {
                return affirmStmtOpen(this).parameterCount
                    ? capi.sqlite3_bind_parameter_name(this.pointer, ndx)
                    : undefined;
            },

            isBusy: function () {
                return 0 !== capi.sqlite3_stmt_busy(affirmStmtOpen(this));
            },

            isReadOnly: function () {
                return 0 !== capi.sqlite3_stmt_readonly(affirmStmtOpen(this));
            },
        };

        {
            const prop = {
                enumerable: true,
                get: function () {
                    return __ptrMap.get(this);
                },
                set: () => toss3("The pointer property is read-only."),
            };
            Object.defineProperty(Stmt.prototype, "pointer", prop);
            Object.defineProperty(DB.prototype, "pointer", prop);
        }

        Object.defineProperty(Stmt.prototype, "columnCount", {
            enumerable: false,
            get: function () {
                return capi.sqlite3_column_count(this.pointer);
            },
            set: () => {
                toss3("The columnCount property is read-only.");
            },
        });

        sqlite3.oo1 = {
            DB,
            Stmt,
        };

        if (util.isUIThread()) {
            sqlite3.oo1.JsStorageDb = function (storageName = "session") {
                const opt = dbCtorHelper.normalizeArgs(...arguments);
                storageName = opt.filename;
                if ("session" !== storageName && "local" !== storageName) {
                    toss3(
                        "JsStorageDb db name must be one of 'session' or 'local'."
                    );
                }
                opt.vfs = "kvvfs";
                dbCtorHelper.call(this, opt);
            };
            const jdb = sqlite3.oo1.JsStorageDb;
            jdb.prototype = Object.create(DB.prototype);

            jdb.clearStorage = capi.sqlite3_js_kvvfs_clear;

            jdb.prototype.clearStorage = function () {
                return jdb.clearStorage(affirmDbOpen(this).filename);
            };

            jdb.storageSize = capi.sqlite3_js_kvvfs_size;

            jdb.prototype.storageSize = function () {
                return jdb.storageSize(affirmDbOpen(this).filename);
            };
        }
    });

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
        const installOpfsVfs = function callee(options) {
            if (!globalThis.SharedArrayBuffer || !globalThis.Atomics) {
                return Promise.reject(
                    new Error(
                        "Cannot install OPFS: Missing SharedArrayBuffer and/or Atomics. " +
                            "The server must emit the COOP/COEP response headers to enable those. " +
                            "See https://sqlite.org/wasm/doc/trunk/persistence.md#coop-coep"
                    )
                );
            } else if ("undefined" === typeof WorkerGlobalScope) {
                return Promise.reject(
                    new Error(
                        "The OPFS sqlite3_vfs cannot run in the main thread " +
                            "because it requires Atomics.wait()."
                    )
                );
            } else if (
                !globalThis.FileSystemHandle ||
                !globalThis.FileSystemDirectoryHandle ||
                !globalThis.FileSystemFileHandle ||
                !globalThis.FileSystemFileHandle.prototype
                    .createSyncAccessHandle ||
                !navigator?.storage?.getDirectory
            ) {
                return Promise.reject(new Error("Missing required OPFS APIs."));
            }
            if (!options || "object" !== typeof options) {
                options = Object.create(null);
            }
            const urlParams = new URL(globalThis.location.href).searchParams;
            if (urlParams.has("opfs-disable")) {
                return Promise.resolve(sqlite3);
            }
            if (undefined === options.verbose) {
                options.verbose = urlParams.has("opfs-verbose")
                    ? +urlParams.get("opfs-verbose") || 2
                    : 1;
            }
            if (undefined === options.sanityChecks) {
                options.sanityChecks = urlParams.has("opfs-sanity-check");
            }
            if (undefined === options.proxyUri) {
                options.proxyUri = callee.defaultProxyUri;
            }

            if ("function" === typeof options.proxyUri) {
                options.proxyUri = options.proxyUri();
            }
            const thePromise = new Promise(function (
                promiseResolve_,
                promiseReject_
            ) {
                const loggers = [
                    sqlite3.config.error,
                    sqlite3.config.warn,
                    sqlite3.config.log,
                ];
                const logImpl = (level, ...args) => {
                    if (options.verbose > level)
                        loggers[level]("OPFS syncer:", ...args);
                };
                const log = (...args) => logImpl(2, ...args);
                const warn = (...args) => logImpl(1, ...args);
                const error = (...args) => logImpl(0, ...args);
                const toss = sqlite3.util.toss;
                const capi = sqlite3.capi;
                const util = sqlite3.util;
                const wasm = sqlite3.wasm;
                const sqlite3_vfs = capi.sqlite3_vfs;
                const sqlite3_file = capi.sqlite3_file;
                const sqlite3_io_methods = capi.sqlite3_io_methods;

                const opfsUtil = Object.create(null);

                const thisThreadHasOPFS = () => {
                    return (
                        globalThis.FileSystemHandle &&
                        globalThis.FileSystemDirectoryHandle &&
                        globalThis.FileSystemFileHandle &&
                        globalThis.FileSystemFileHandle.prototype
                            .createSyncAccessHandle &&
                        navigator?.storage?.getDirectory
                    );
                };

                opfsUtil.metrics = {
                    dump: function () {
                        let k,
                            n = 0,
                            t = 0,
                            w = 0;
                        for (k in state.opIds) {
                            const m = metrics[k];
                            n += m.count;
                            t += m.time;
                            w += m.wait;
                            m.avgTime =
                                m.count && m.time ? m.time / m.count : 0;
                            m.avgWait =
                                m.count && m.wait ? m.wait / m.count : 0;
                        }
                        sqlite3.config.log(
                            globalThis.location.href,
                            "metrics for",
                            globalThis.location.href,
                            ":",
                            metrics,
                            "\nTotal of",
                            n,
                            "op(s) for",
                            t,
                            "ms (incl. " +
                                w +
                                " ms of waiting on the async side)"
                        );
                        sqlite3.config.log(
                            "Serialization metrics:",
                            metrics.s11n
                        );
                        W.postMessage({ type: "opfs-async-metrics" });
                    },
                    reset: function () {
                        let k;
                        const r = (m) => (m.count = m.time = m.wait = 0);
                        for (k in state.opIds) {
                            r((metrics[k] = Object.create(null)));
                        }
                        let s = (metrics.s11n = Object.create(null));
                        s = s.serialize = Object.create(null);
                        s.count = s.time = 0;
                        s = metrics.s11n.deserialize = Object.create(null);
                        s.count = s.time = 0;
                    },
                };
                const opfsIoMethods = new sqlite3_io_methods();
                const opfsVfs = new sqlite3_vfs().addOnDispose(() =>
                    opfsIoMethods.dispose()
                );
                let promiseWasRejected = undefined;
                const promiseReject = (err) => {
                    promiseWasRejected = true;
                    opfsVfs.dispose();
                    return promiseReject_(err);
                };
                const promiseResolve = () => {
                    promiseWasRejected = false;
                    return promiseResolve_(sqlite3);
                };
                const W = new Worker(
                    new URL(options.proxyUri, import.meta.url)
                );
                setTimeout(() => {
                    if (undefined === promiseWasRejected) {
                        promiseReject(
                            new Error(
                                "Timeout while waiting for OPFS async proxy worker."
                            )
                        );
                    }
                }, 4000);
                W._originalOnError = W.onerror;
                W.onerror = function (err) {
                    error("Error initializing OPFS asyncer:", err);
                    promiseReject(
                        new Error(
                            "Loading OPFS async Worker failed for unknown reasons."
                        )
                    );
                };
                const pDVfs = capi.sqlite3_vfs_find(null);
                const dVfs = pDVfs ? new sqlite3_vfs(pDVfs) : null;
                opfsIoMethods.$iVersion = 1;
                opfsVfs.$iVersion = 2;
                opfsVfs.$szOsFile = capi.sqlite3_file.structInfo.sizeof;
                opfsVfs.$mxPathname = 1024;
                opfsVfs.$zName = wasm.allocCString("opfs");

                opfsVfs.$xDlOpen =
                    opfsVfs.$xDlError =
                    opfsVfs.$xDlSym =
                    opfsVfs.$xDlClose =
                        null;
                opfsVfs.addOnDispose(
                    "$zName",
                    opfsVfs.$zName,
                    "cleanup default VFS wrapper",
                    () => (dVfs ? dVfs.dispose() : null)
                );

                const state = Object.create(null);
                state.verbose = options.verbose;
                state.littleEndian = (() => {
                    const buffer = new ArrayBuffer(2);
                    new DataView(buffer).setInt16(0, 256, true);

                    return new Int16Array(buffer)[0] === 256;
                })();

                state.asyncIdleWaitTime = 150;

                state.asyncS11nExceptions = 1;

                state.fileBufferSize = 1024 * 64;
                state.sabS11nOffset = state.fileBufferSize;

                state.sabS11nSize = opfsVfs.$mxPathname * 2;

                state.sabIO = new SharedArrayBuffer(
                    state.fileBufferSize + state.sabS11nSize
                );
                state.opIds = Object.create(null);
                const metrics = Object.create(null);
                {
                    let i = 0;

                    state.opIds.whichOp = i++;

                    state.opIds.rc = i++;

                    state.opIds.xAccess = i++;
                    state.opIds.xClose = i++;
                    state.opIds.xDelete = i++;
                    state.opIds.xDeleteNoWait = i++;
                    state.opIds.xFileSize = i++;
                    state.opIds.xLock = i++;
                    state.opIds.xOpen = i++;
                    state.opIds.xRead = i++;
                    state.opIds.xSleep = i++;
                    state.opIds.xSync = i++;
                    state.opIds.xTruncate = i++;
                    state.opIds.xUnlock = i++;
                    state.opIds.xWrite = i++;
                    state.opIds.mkdir = i++;
                    state.opIds["opfs-async-metrics"] = i++;
                    state.opIds["opfs-async-shutdown"] = i++;

                    state.opIds.retry = i++;
                    state.sabOP = new SharedArrayBuffer(i * 4);
                    opfsUtil.metrics.reset();
                }

                state.sq3Codes = Object.create(null);
                [
                    "SQLITE_ACCESS_EXISTS",
                    "SQLITE_ACCESS_READWRITE",
                    "SQLITE_BUSY",
                    "SQLITE_CANTOPEN",
                    "SQLITE_ERROR",
                    "SQLITE_IOERR",
                    "SQLITE_IOERR_ACCESS",
                    "SQLITE_IOERR_CLOSE",
                    "SQLITE_IOERR_DELETE",
                    "SQLITE_IOERR_FSYNC",
                    "SQLITE_IOERR_LOCK",
                    "SQLITE_IOERR_READ",
                    "SQLITE_IOERR_SHORT_READ",
                    "SQLITE_IOERR_TRUNCATE",
                    "SQLITE_IOERR_UNLOCK",
                    "SQLITE_IOERR_WRITE",
                    "SQLITE_LOCK_EXCLUSIVE",
                    "SQLITE_LOCK_NONE",
                    "SQLITE_LOCK_PENDING",
                    "SQLITE_LOCK_RESERVED",
                    "SQLITE_LOCK_SHARED",
                    "SQLITE_LOCKED",
                    "SQLITE_MISUSE",
                    "SQLITE_NOTFOUND",
                    "SQLITE_OPEN_CREATE",
                    "SQLITE_OPEN_DELETEONCLOSE",
                    "SQLITE_OPEN_MAIN_DB",
                    "SQLITE_OPEN_READONLY",
                ].forEach((k) => {
                    if (undefined === (state.sq3Codes[k] = capi[k])) {
                        toss("Maintenance required: not found:", k);
                    }
                });
                state.opfsFlags = Object.assign(Object.create(null), {
                    OPFS_UNLOCK_ASAP: 0x01,

                    OPFS_UNLINK_BEFORE_OPEN: 0x02,

                    defaultUnlockAsap: false,
                });

                const opRun = (op, ...args) => {
                    const opNdx = state.opIds[op] || toss("Invalid op ID:", op);
                    state.s11n.serialize(...args);
                    Atomics.store(state.sabOPView, state.opIds.rc, -1);
                    Atomics.store(state.sabOPView, state.opIds.whichOp, opNdx);
                    Atomics.notify(state.sabOPView, state.opIds.whichOp);
                    const t = performance.now();
                    while (
                        "not-equal" !==
                        Atomics.wait(state.sabOPView, state.opIds.rc, -1)
                    ) {
                        // Intentionally empty - busy wait for atomic operation
                    }

                    const rc = Atomics.load(state.sabOPView, state.opIds.rc);
                    metrics[op].wait += performance.now() - t;
                    if (rc && state.asyncS11nExceptions) {
                        const err = state.s11n.deserialize();
                        if (err) error(op + "() async error:", ...err);
                    }
                    return rc;
                };

                opfsUtil.debug = {
                    asyncShutdown: () => {
                        warn(
                            "Shutting down OPFS async listener. The OPFS VFS will no longer work."
                        );
                        opRun("opfs-async-shutdown");
                    },
                    asyncRestart: () => {
                        warn(
                            "Attempting to restart OPFS VFS async listener. Might work, might not."
                        );
                        W.postMessage({ type: "opfs-async-restart" });
                    },
                };

                const initS11n = () => {
                    if (state.s11n) return state.s11n;
                    const textDecoder = new TextDecoder(),
                        textEncoder = new TextEncoder("utf-8"),
                        viewU8 = new Uint8Array(
                            state.sabIO,
                            state.sabS11nOffset,
                            state.sabS11nSize
                        ),
                        viewDV = new DataView(
                            state.sabIO,
                            state.sabS11nOffset,
                            state.sabS11nSize
                        );
                    state.s11n = Object.create(null);

                    const TypeIds = Object.create(null);
                    TypeIds.number = {
                        id: 1,
                        size: 8,
                        getter: "getFloat64",
                        setter: "setFloat64",
                    };
                    TypeIds.bigint = {
                        id: 2,
                        size: 8,
                        getter: "getBigInt64",
                        setter: "setBigInt64",
                    };
                    TypeIds.boolean = {
                        id: 3,
                        size: 4,
                        getter: "getInt32",
                        setter: "setInt32",
                    };
                    TypeIds.string = { id: 4 };

                    const getTypeId = (v) =>
                        TypeIds[typeof v] ||
                        toss(
                            "Maintenance required: this value type cannot be serialized.",
                            v
                        );
                    const getTypeIdById = (tid) => {
                        switch (tid) {
                            case TypeIds.number.id:
                                return TypeIds.number;
                            case TypeIds.bigint.id:
                                return TypeIds.bigint;
                            case TypeIds.boolean.id:
                                return TypeIds.boolean;
                            case TypeIds.string.id:
                                return TypeIds.string;
                            default:
                                toss("Invalid type ID:", tid);
                        }
                    };

                    state.s11n.deserialize = function (clear = false) {
                        ++metrics.s11n.deserialize.count;
                        const t = performance.now();
                        const argc = viewU8[0];
                        const rc = argc ? [] : null;
                        if (argc) {
                            const typeIds = [];
                            let offset = 1,
                                i,
                                n,
                                v;
                            for (i = 0; i < argc; ++i, ++offset) {
                                typeIds.push(getTypeIdById(viewU8[offset]));
                            }
                            for (i = 0; i < argc; ++i) {
                                const t = typeIds[i];
                                if (t.getter) {
                                    v = viewDV[t.getter](
                                        offset,
                                        state.littleEndian
                                    );
                                    offset += t.size;
                                } else {
                                    n = viewDV.getInt32(
                                        offset,
                                        state.littleEndian
                                    );
                                    offset += 4;
                                    v = textDecoder.decode(
                                        viewU8.slice(offset, offset + n)
                                    );
                                    offset += n;
                                }
                                rc.push(v);
                            }
                        }
                        if (clear) viewU8[0] = 0;

                        metrics.s11n.deserialize.time += performance.now() - t;
                        return rc;
                    };

                    state.s11n.serialize = function (...args) {
                        const t = performance.now();
                        ++metrics.s11n.serialize.count;
                        if (args.length) {
                            const typeIds = [];
                            let i = 0,
                                offset = 1;
                            viewU8[0] = args.length & 0xff;
                            for (; i < args.length; ++i, ++offset) {
                                typeIds.push(getTypeId(args[i]));
                                viewU8[offset] = typeIds[i].id;
                            }
                            for (i = 0; i < args.length; ++i) {
                                const t = typeIds[i];
                                if (t.setter) {
                                    viewDV[t.setter](
                                        offset,
                                        args[i],
                                        state.littleEndian
                                    );
                                    offset += t.size;
                                } else {
                                    const s = textEncoder.encode(args[i]);
                                    viewDV.setInt32(
                                        offset,
                                        s.byteLength,
                                        state.littleEndian
                                    );
                                    offset += 4;
                                    viewU8.set(s, offset);
                                    offset += s.byteLength;
                                }
                            }
                        } else {
                            viewU8[0] = 0;
                        }
                        metrics.s11n.serialize.time += performance.now() - t;
                    };
                    return state.s11n;
                };

                const randomFilename = function f(len = 16) {
                    if (!f._chars) {
                        f._chars =
                            "abcdefghijklmnopqrstuvwxyz" +
                            "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                            "012346789";
                        f._n = f._chars.length;
                    }
                    const a = [];
                    let i = 0;
                    for (; i < len; ++i) {
                        const ndx = (Math.random() * (f._n * 64)) % f._n | 0;
                        a[i] = f._chars[ndx];
                    }
                    return a.join("");
                };

                const __openFiles = Object.create(null);

                const opTimer = Object.create(null);
                opTimer.op = undefined;
                opTimer.start = undefined;
                const mTimeStart = (op) => {
                    opTimer.start = performance.now();
                    opTimer.op = op;
                    ++metrics[op].count;
                };
                const mTimeEnd = () =>
                    (metrics[opTimer.op].time +=
                        performance.now() - opTimer.start);

                const ioSyncWrappers = {
                    xCheckReservedLock: function (pFile, pOut) {
                        wasm.poke(pOut, 0, "i32");
                        return 0;
                    },
                    xClose: function (pFile) {
                        mTimeStart("xClose");
                        let rc = 0;
                        const f = __openFiles[pFile];
                        if (f) {
                            delete __openFiles[pFile];
                            rc = opRun("xClose", pFile);
                            if (f.sq3File) f.sq3File.dispose();
                        }
                        mTimeEnd();
                        return rc;
                    },
                    xDeviceCharacteristics: function (_pFile) {
                        return capi.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN;
                    },
                    xFileControl: function (_pFile, _opId, _pArg) {
                        return capi.SQLITE_NOTFOUND;
                    },
                    xFileSize: function (pFile, pSz64) {
                        mTimeStart("xFileSize");
                        let rc = opRun("xFileSize", pFile);
                        if (0 == rc) {
                            try {
                                const sz = state.s11n.deserialize()[0];
                                wasm.poke(pSz64, sz, "i64");
                            } catch (e) {
                                error(
                                    "Unexpected error reading xFileSize() result:",
                                    e
                                );
                                rc = state.sq3Codes.SQLITE_IOERR;
                            }
                        }
                        mTimeEnd();
                        return rc;
                    },
                    xLock: function (pFile, lockType) {
                        mTimeStart("xLock");
                        const f = __openFiles[pFile];
                        let rc = 0;

                        if (!f.lockType) {
                            rc = opRun("xLock", pFile, lockType);
                            if (0 === rc) f.lockType = lockType;
                        } else {
                            f.lockType = lockType;
                        }
                        mTimeEnd();
                        return rc;
                    },
                    xRead: function (pFile, pDest, n, offset64) {
                        mTimeStart("xRead");
                        const f = __openFiles[pFile];
                        let rc;
                        try {
                            rc = opRun("xRead", pFile, n, Number(offset64));
                            if (
                                0 === rc ||
                                capi.SQLITE_IOERR_SHORT_READ === rc
                            ) {
                                wasm.heap8u().set(
                                    f.sabView.subarray(0, n),
                                    pDest
                                );
                            }
                        } catch (e) {
                            error("xRead(", arguments, ") failed:", e, f);
                            rc = capi.SQLITE_IOERR_READ;
                        }
                        mTimeEnd();
                        return rc;
                    },
                    xSync: function (pFile, flags) {
                        mTimeStart("xSync");
                        ++metrics.xSync.count;
                        const rc = opRun("xSync", pFile, flags);
                        mTimeEnd();
                        return rc;
                    },
                    xTruncate: function (pFile, sz64) {
                        mTimeStart("xTruncate");
                        const rc = opRun("xTruncate", pFile, Number(sz64));
                        mTimeEnd();
                        return rc;
                    },
                    xUnlock: function (pFile, lockType) {
                        mTimeStart("xUnlock");
                        const f = __openFiles[pFile];
                        let rc = 0;
                        if (capi.SQLITE_LOCK_NONE === lockType && f.lockType) {
                            rc = opRun("xUnlock", pFile, lockType);
                        }
                        if (0 === rc) f.lockType = lockType;
                        mTimeEnd();
                        return rc;
                    },
                    xWrite: function (pFile, pSrc, n, offset64) {
                        mTimeStart("xWrite");
                        const f = __openFiles[pFile];
                        let rc;
                        try {
                            f.sabView.set(
                                wasm.heap8u().subarray(pSrc, pSrc + n)
                            );
                            rc = opRun("xWrite", pFile, n, Number(offset64));
                        } catch (e) {
                            error("xWrite(", arguments, ") failed:", e, f);
                            rc = capi.SQLITE_IOERR_WRITE;
                        }
                        mTimeEnd();
                        return rc;
                    },
                };

                const vfsSyncWrappers = {
                    xAccess: function (pVfs, zName, flags, pOut) {
                        mTimeStart("xAccess");
                        const rc = opRun("xAccess", wasm.cstrToJs(zName));
                        wasm.poke(pOut, rc ? 0 : 1, "i32");
                        mTimeEnd();
                        return 0;
                    },
                    xCurrentTime: function (pVfs, pOut) {
                        wasm.poke(
                            pOut,
                            2440587.5 + new Date().getTime() / 86400000,
                            "double"
                        );
                        return 0;
                    },
                    xCurrentTimeInt64: function (pVfs, pOut) {
                        wasm.poke(
                            pOut,
                            2440587.5 * 86400000 + new Date().getTime(),
                            "i64"
                        );
                        return 0;
                    },
                    xDelete: function (pVfs, zName, doSyncDir) {
                        mTimeStart("xDelete");
                        const rc = opRun(
                            "xDelete",
                            wasm.cstrToJs(zName),
                            doSyncDir,
                            false
                        );
                        mTimeEnd();
                        return rc;
                    },
                    xFullPathname: function (pVfs, zName, nOut, pOut) {
                        const i = wasm.cstrncpy(pOut, zName, nOut);
                        return i < nOut ? 0 : capi.SQLITE_CANTOPEN;
                    },
                    xGetLastError: function (_pVfs, _nOut, _pOut) {
                        warn(
                            "OPFS xGetLastError() has nothing sensible to return."
                        );
                        return 0;
                    },

                    xOpen: function f(pVfs, zName, pFile, flags, pOutFlags) {
                        mTimeStart("xOpen");
                        let opfsFlags = 0;
                        if (0 === zName) {
                            zName = randomFilename();
                        } else if (wasm.isPtr(zName)) {
                            if (
                                capi.sqlite3_uri_boolean(
                                    zName,
                                    "opfs-unlock-asap",
                                    0
                                )
                            ) {
                                opfsFlags |= state.opfsFlags.OPFS_UNLOCK_ASAP;
                            }
                            if (
                                capi.sqlite3_uri_boolean(
                                    zName,
                                    "delete-before-open",
                                    0
                                )
                            ) {
                                opfsFlags |=
                                    state.opfsFlags.OPFS_UNLINK_BEFORE_OPEN;
                            }
                            zName = wasm.cstrToJs(zName);
                        }
                        const fh = Object.create(null);
                        fh.fid = pFile;
                        fh.filename = zName;
                        fh.sab = new SharedArrayBuffer(state.fileBufferSize);
                        fh.flags = flags;
                        fh.readOnly =
                            !(sqlite3.SQLITE_OPEN_CREATE & flags) &&
                            !!(flags & capi.SQLITE_OPEN_READONLY);
                        const rc = opRun(
                            "xOpen",
                            pFile,
                            zName,
                            flags,
                            opfsFlags
                        );
                        if (!rc) {
                            if (fh.readOnly) {
                                wasm.poke(
                                    pOutFlags,
                                    capi.SQLITE_OPEN_READONLY,
                                    "i32"
                                );
                            }
                            __openFiles[pFile] = fh;
                            fh.sabView = state.sabFileBufView;
                            fh.sq3File = new sqlite3_file(pFile);
                            fh.sq3File.$pMethods = opfsIoMethods.pointer;
                            fh.lockType = capi.SQLITE_LOCK_NONE;
                        }
                        mTimeEnd();
                        return rc;
                    },
                };

                if (dVfs) {
                    opfsVfs.$xRandomness = dVfs.$xRandomness;
                    opfsVfs.$xSleep = dVfs.$xSleep;
                }
                if (!opfsVfs.$xRandomness) {
                    vfsSyncWrappers.xRandomness = function (pVfs, nOut, pOut) {
                        const heap = wasm.heap8u();
                        let i = 0;
                        for (; i < nOut; ++i)
                            heap[pOut + i] = (Math.random() * 255000) & 0xff;
                        return i;
                    };
                }
                if (!opfsVfs.$xSleep) {
                    vfsSyncWrappers.xSleep = function (pVfs, ms) {
                        Atomics.wait(
                            state.sabOPView,
                            state.opIds.xSleep,
                            0,
                            ms
                        );
                        return 0;
                    };
                }

                opfsUtil.getResolvedPath = function (filename, splitIt) {
                    const p = new URL(filename, "file://irrelevant").pathname;
                    return splitIt ? p.split("/").filter((v) => !!v) : p;
                };

                opfsUtil.getDirForFilename = async function f(
                    absFilename,
                    createDirs = false
                ) {
                    const path = opfsUtil.getResolvedPath(absFilename, true);
                    const filename = path.pop();
                    let dh = opfsUtil.rootDirectory;
                    for (const dirName of path) {
                        if (dirName) {
                            dh = await dh.getDirectoryHandle(dirName, {
                                create: !!createDirs,
                            });
                        }
                    }
                    return [dh, filename];
                };

                opfsUtil.mkdir = async function (absDirName) {
                    try {
                        await opfsUtil.getDirForFilename(
                            absDirName + "/filepart",
                            true
                        );
                        return true;
                    } catch (_e) {
                        return false;
                    }
                };

                opfsUtil.entryExists = async function (fsEntryName) {
                    try {
                        const [dh, fn] = await opfsUtil.getDirForFilename(
                            fsEntryName
                        );
                        await dh.getFileHandle(fn);
                        return true;
                    } catch (_e) {
                        return false;
                    }
                };

                opfsUtil.randomFilename = randomFilename;

                opfsUtil.treeList = async function () {
                    const doDir = async function callee(dirHandle, tgt) {
                        tgt.name = dirHandle.name;
                        tgt.dirs = [];
                        tgt.files = [];
                        for await (const handle of dirHandle.values()) {
                            if ("directory" === handle.kind) {
                                const subDir = Object.create(null);
                                tgt.dirs.push(subDir);
                                await callee(handle, subDir);
                            } else {
                                tgt.files.push(handle.name);
                            }
                        }
                    };
                    const root = Object.create(null);
                    await doDir(opfsUtil.rootDirectory, root);
                    return root;
                };

                opfsUtil.rmfr = async function () {
                    const dir = opfsUtil.rootDirectory,
                        opt = { recurse: true };
                    for await (const handle of dir.values()) {
                        dir.removeEntry(handle.name, opt);
                    }
                };

                opfsUtil.unlink = async function (
                    fsEntryName,
                    recursive = false,
                    throwOnError = false
                ) {
                    try {
                        const [hDir, filenamePart] =
                            await opfsUtil.getDirForFilename(
                                fsEntryName,
                                false
                            );
                        await hDir.removeEntry(filenamePart, {
                            recursive,
                        });
                        return true;
                    } catch (e) {
                        if (throwOnError) {
                            throw new Error(
                                "unlink(",
                                arguments[0],
                                ") failed: " + e.message,
                                {
                                    cause: e,
                                }
                            );
                        }
                        return false;
                    }
                };

                opfsUtil.traverse = async function (opt) {
                    const defaultOpt = {
                        recursive: true,
                        directory: opfsUtil.rootDirectory,
                    };
                    if ("function" === typeof opt) {
                        opt = { callback: opt };
                    }
                    opt = Object.assign(defaultOpt, opt || {});
                    const doDir = async function callee(dirHandle, depth) {
                        for await (const handle of dirHandle.values()) {
                            if (
                                false === opt.callback(handle, dirHandle, depth)
                            )
                                return false;
                            else if (
                                opt.recursive &&
                                "directory" === handle.kind
                            ) {
                                if (false === (await callee(handle, depth + 1)))
                                    break;
                            }
                        }
                    };
                    doDir(opt.directory, 0);
                };

                const importDbChunked = async function (filename, callback) {
                    const [hDir, fnamePart] = await opfsUtil.getDirForFilename(
                        filename,
                        true
                    );
                    const hFile = await hDir.getFileHandle(fnamePart, {
                        create: true,
                    });
                    let sah = await hFile.createSyncAccessHandle();
                    let nWrote = 0,
                        chunk,
                        checkedHeader = false;
                    try {
                        sah.truncate(0);
                        while (undefined !== (chunk = await callback())) {
                            if (chunk instanceof ArrayBuffer)
                                chunk = new Uint8Array(chunk);
                            if (0 === nWrote && chunk.byteLength >= 15) {
                                util.affirmDbHeader(chunk);
                                checkedHeader = true;
                            }
                            sah.write(chunk, { at: nWrote });
                            nWrote += chunk.byteLength;
                        }
                        if (nWrote < 512 || 0 !== nWrote % 512) {
                            toss(
                                "Input size",
                                nWrote,
                                "is not correct for an SQLite database."
                            );
                        }
                        if (!checkedHeader) {
                            const header = new Uint8Array(20);
                            sah.read(header, { at: 0 });
                            util.affirmDbHeader(header);
                        }
                        sah.write(new Uint8Array([1, 1]), { at: 18 });
                        return nWrote;
                    } catch (e) {
                        await sah.close();
                        sah = undefined;
                        await hDir.removeEntry(fnamePart).catch(() => {});
                        throw e;
                    } finally {
                        if (sah) await sah.close();
                    }
                };

                opfsUtil.importDb = async function (filename, bytes) {
                    if (bytes instanceof Function) {
                        return importDbChunked(filename, bytes);
                    }
                    if (bytes instanceof ArrayBuffer)
                        bytes = new Uint8Array(bytes);
                    util.affirmIsDb(bytes);
                    const n = bytes.byteLength;
                    const [hDir, fnamePart] = await opfsUtil.getDirForFilename(
                        filename,
                        true
                    );
                    let sah,
                        nWrote = 0;
                    try {
                        const hFile = await hDir.getFileHandle(fnamePart, {
                            create: true,
                        });
                        sah = await hFile.createSyncAccessHandle();
                        sah.truncate(0);
                        nWrote = sah.write(bytes, { at: 0 });
                        if (nWrote != n) {
                            toss(
                                "Expected to write " +
                                    n +
                                    " bytes but wrote " +
                                    nWrote +
                                    "."
                            );
                        }
                        sah.write(new Uint8Array([1, 1]), { at: 18 });
                        return nWrote;
                    } catch (e) {
                        if (sah) {
                            await sah.close();
                            sah = undefined;
                        }
                        await hDir.removeEntry(fnamePart).catch(() => {});
                        throw e;
                    } finally {
                        if (sah) await sah.close();
                    }
                };

                if (sqlite3.oo1) {
                    const OpfsDb = function (...args) {
                        const opt = sqlite3.oo1.DB.dbCtorHelper.normalizeArgs(
                            ...args
                        );
                        opt.vfs = opfsVfs.$zName;
                        sqlite3.oo1.DB.dbCtorHelper.call(this, opt);
                    };
                    OpfsDb.prototype = Object.create(sqlite3.oo1.DB.prototype);
                    sqlite3.oo1.OpfsDb = OpfsDb;
                    OpfsDb.importDb = opfsUtil.importDb;
                    sqlite3.oo1.DB.dbCtorHelper.setVfsPostOpenCallback(
                        opfsVfs.pointer,
                        function (oo1Db, sqlite3) {
                            sqlite3.capi.sqlite3_busy_timeout(oo1Db, 10000);
                        }
                    );
                }

                const sanityCheck = function () {
                    const scope = wasm.scopedAllocPush();
                    const sq3File = new sqlite3_file();
                    try {
                        const fid = sq3File.pointer;
                        const openFlags =
                            capi.SQLITE_OPEN_CREATE |
                            capi.SQLITE_OPEN_READWRITE |
                            capi.SQLITE_OPEN_MAIN_DB;
                        const pOut = wasm.scopedAlloc(8);
                        const dbFile = "/sanity/check/file" + randomFilename(8);
                        const zDbFile = wasm.scopedAllocCString(dbFile);
                        let rc;
                        state.s11n.serialize("This is ä string.");
                        rc = state.s11n.deserialize();
                        log("deserialize() says:", rc);
                        if ("This is ä string." !== rc[0])
                            toss("String d13n error.");
                        vfsSyncWrappers.xAccess(
                            opfsVfs.pointer,
                            zDbFile,
                            0,
                            pOut
                        );
                        rc = wasm.peek(pOut, "i32");
                        log("xAccess(", dbFile, ") exists ?=", rc);
                        rc = vfsSyncWrappers.xOpen(
                            opfsVfs.pointer,
                            zDbFile,
                            fid,
                            openFlags,
                            pOut
                        );
                        log(
                            "open rc =",
                            rc,
                            "state.sabOPView[xOpen] =",
                            state.sabOPView[state.opIds.xOpen]
                        );
                        if (0 !== rc) {
                            error("open failed with code", rc);
                            return;
                        }
                        vfsSyncWrappers.xAccess(
                            opfsVfs.pointer,
                            zDbFile,
                            0,
                            pOut
                        );
                        rc = wasm.peek(pOut, "i32");
                        if (!rc) toss("xAccess() failed to detect file.");
                        rc = ioSyncWrappers.xSync(sq3File.pointer, 0);
                        if (rc) toss("sync failed w/ rc", rc);
                        rc = ioSyncWrappers.xTruncate(sq3File.pointer, 1024);
                        if (rc) toss("truncate failed w/ rc", rc);
                        wasm.poke(pOut, 0, "i64");
                        rc = ioSyncWrappers.xFileSize(sq3File.pointer, pOut);
                        if (rc) toss("xFileSize failed w/ rc", rc);
                        log("xFileSize says:", wasm.peek(pOut, "i64"));
                        rc = ioSyncWrappers.xWrite(
                            sq3File.pointer,
                            zDbFile,
                            10,
                            1
                        );
                        if (rc) toss("xWrite() failed!");
                        const readBuf = wasm.scopedAlloc(16);
                        rc = ioSyncWrappers.xRead(
                            sq3File.pointer,
                            readBuf,
                            6,
                            2
                        );
                        wasm.poke(readBuf + 6, 0);
                        let jRead = wasm.cstrToJs(readBuf);
                        log("xRead() got:", jRead);
                        if ("sanity" !== jRead)
                            toss("Unexpected xRead() value.");
                        if (vfsSyncWrappers.xSleep) {
                            log("xSleep()ing before close()ing...");
                            vfsSyncWrappers.xSleep(opfsVfs.pointer, 2000);
                            log("waking up from xSleep()");
                        }
                        rc = ioSyncWrappers.xClose(fid);
                        log("xClose rc =", rc, "sabOPView =", state.sabOPView);
                        log("Deleting file:", dbFile);
                        vfsSyncWrappers.xDelete(
                            opfsVfs.pointer,
                            zDbFile,
                            0x1234
                        );
                        vfsSyncWrappers.xAccess(
                            opfsVfs.pointer,
                            zDbFile,
                            0,
                            pOut
                        );
                        rc = wasm.peek(pOut, "i32");
                        if (rc)
                            toss(
                                "Expecting 0 from xAccess(",
                                dbFile,
                                ") after xDelete()."
                            );
                        warn("End of OPFS sanity checks.");
                    } finally {
                        sq3File.dispose();
                        wasm.scopedAllocPop(scope);
                    }
                };

                W.onmessage = function ({ data }) {
                    switch (data.type) {
                        case "opfs-unavailable":
                            promiseReject(new Error(data.payload.join(" ")));
                            break;
                        case "opfs-async-loaded":
                            W.postMessage({
                                type: "opfs-async-init",
                                args: state,
                            });
                            break;
                        case "opfs-async-inited": {
                            if (true === promiseWasRejected) {
                                break;
                            }
                            try {
                                sqlite3.vfs.installVfs({
                                    io: {
                                        struct: opfsIoMethods,
                                        methods: ioSyncWrappers,
                                    },
                                    vfs: {
                                        struct: opfsVfs,
                                        methods: vfsSyncWrappers,
                                    },
                                });
                                state.sabOPView = new Int32Array(state.sabOP);
                                state.sabFileBufView = new Uint8Array(
                                    state.sabIO,
                                    0,
                                    state.fileBufferSize
                                );
                                state.sabS11nView = new Uint8Array(
                                    state.sabIO,
                                    state.sabS11nOffset,
                                    state.sabS11nSize
                                );
                                initS11n();
                                if (options.sanityChecks) {
                                    warn(
                                        "Running sanity checks because of opfs-sanity-check URL arg..."
                                    );
                                    sanityCheck();
                                }
                                if (thisThreadHasOPFS()) {
                                    navigator.storage
                                        .getDirectory()
                                        .then((d) => {
                                            W.onerror = W._originalOnError;
                                            delete W._originalOnError;
                                            sqlite3.opfs = opfsUtil;
                                            opfsUtil.rootDirectory = d;
                                            log(
                                                "End of OPFS sqlite3_vfs setup.",
                                                opfsVfs
                                            );
                                            promiseResolve();
                                        })
                                        .catch(promiseReject);
                                } else {
                                    promiseResolve();
                                }
                            } catch (e) {
                                error(e);
                                promiseReject(e);
                            }
                            break;
                        }
                        default: {
                            const errMsg =
                                "Unexpected message from the OPFS async worker: " +
                                JSON.stringify(data);
                            error(errMsg);
                            promiseReject(new Error(errMsg));
                            break;
                        }
                    }
                };
            });
            return thePromise;
        };
        installOpfsVfs.defaultProxyUri = "sqlite3-opfs-async-proxy.js";
        globalThis.sqlite3ApiBootstrap.initializersAsync.push(
            async (sqlite3) => {
                try {
                    let proxyJs = installOpfsVfs.defaultProxyUri;
                    if (sqlite3.scriptInfo.sqlite3Dir) {
                        installOpfsVfs.defaultProxyUri =
                            sqlite3.scriptInfo.sqlite3Dir + proxyJs;
                    }
                    return installOpfsVfs().catch((e) => {
                        sqlite3.config.warn(
                            "Ignoring inability to install OPFS sqlite3_vfs:",
                            e.message
                        );
                    });
                } catch (e) {
                    sqlite3.config.error("installOpfsVfs() exception:", e);
                    return Promise.reject(e);
                }
            }
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
