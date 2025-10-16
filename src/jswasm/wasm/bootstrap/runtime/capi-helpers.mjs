/**
 * @typedef {import("./capi-helpers.d.ts").CreateCapiHelpersOptions} CreateCapiHelpersOptions
 * @typedef {import("./capi-helpers.d.ts").CapiHelpers} CapiHelpers
 */

/**
 * Assembles the JavaScript-friendly helpers that sit on top of the raw C API
 * exports. Keeping these helpers separate from the main bootstrap logic makes
 * the control flow easier to follow and highlights the responsibilities of each
 * subsection.
 *
 * @param {CreateCapiHelpersOptions} options
 * @returns {CapiHelpers}
 */
export function createCapiHelpers(options) {
    const { capi, wasm, util, config, SQLite3Error, WasmAllocError, toss3 } =
        options;

    const helpers = Object.create(null);

    helpers.sqlite3_randomness = (...args) => {
        if (
            args.length === 1 &&
            util.isTypedArray(args[0]) &&
            args[0].BYTES_PER_ELEMENT === 1
        ) {
            const target = args[0];
            if (target.byteLength === 0) {
                wasm.exports.sqlite3_randomness(0, 0);
                return target;
            }
            const stackPointer = wasm.pstack.pointer;
            try {
                const randomFn = wasm.exports.sqlite3_randomness;
                const heap = wasm.heap8u();
                const chunkSize = target.byteLength < 512 ? target.byteLength : 512;
                const tempPtr = wasm.pstack.alloc(chunkSize);
                let remaining = target.byteLength;
                let offset = 0;
                while (remaining > 0) {
                    const request = remaining > chunkSize ? chunkSize : remaining;
                    randomFn(request, tempPtr);
                    target.set(
                        util.typedArrayPart(heap, tempPtr, tempPtr + request),
                        offset
                    );
                    remaining -= request;
                    offset += request;
                }
            } catch (error) {
                console.error(
                    "Unexpected exception in sqlite3_randomness():",
                    error
                );
            } finally {
                wasm.pstack.restore(stackPointer);
            }
            return target;
        }
        wasm.exports.sqlite3_randomness(...args);
        return undefined;
    };

    let wasmfsOpfsDirCache;
    helpers.sqlite3_wasmfs_opfs_dir = () => {
        if (typeof wasmfsOpfsDirCache === "string") {
            return wasmfsOpfsDirCache;
        }

        const configuredDir = config.wasmfsOpfsDir;
        if (
            !configuredDir ||
            !globalThis.FileSystemHandle ||
            !globalThis.FileSystemDirectoryHandle ||
            !globalThis.FileSystemFileHandle
        ) {
            wasmfsOpfsDirCache = "";
            return wasmfsOpfsDirCache;
        }
        try {
            const initResult = wasm.xCallWrapped(
                "sqlite3__wasm_init_wasmfs",
                "i32",
                ["string"],
                configuredDir
            );
            wasmfsOpfsDirCache =
                configuredDir && initResult === 0 ? configuredDir : "";
        } catch (error) {
            console.warn("OPFS initialisation failed:", error);
            wasmfsOpfsDirCache = "";
        }
        return wasmfsOpfsDirCache;
    };

    helpers.sqlite3_wasmfs_filename_is_persistent = (name) => {
        const opfsDir = helpers.sqlite3_wasmfs_opfs_dir();
        return opfsDir && name ? name.startsWith(opfsDir + "/") : false;
    };

    helpers.sqlite3_js_db_uses_vfs = (pDb, vfsName, dbName = 0) => {
        try {
            const vfsPointer = capi.sqlite3_vfs_find(vfsName);
            if (!vfsPointer) return false;
            if (!pDb) {
                return vfsPointer === capi.sqlite3_vfs_find(0) ? vfsPointer : false;
            }
            return vfsPointer === capi.sqlite3_js_db_vfs(pDb, dbName)
                ? vfsPointer
                : false;
        } catch (_error) {
            return false;
        }
    };

    helpers.sqlite3_js_vfs_list = () => {
        const result = [];
        let vfsPointer = capi.sqlite3_vfs_find(0);
        while (vfsPointer) {
            const vfs = new capi.sqlite3_vfs(vfsPointer);
            result.push(wasm.cstrToJs(vfs.$zName));
            vfsPointer = vfs.$pNext;
            vfs.dispose();
        }
        return result;
    };

    helpers.sqlite3_js_db_export = (pDb, schema = 0) => {
        const dbPointer = wasm.xWrap.testConvertArg("sqlite3*", pDb);
        if (!dbPointer) {
            toss3("Invalid sqlite3* argument.");
        }
        if (!wasm.bigIntEnabled) {
            toss3("BigInt64 support is not enabled.");
        }
        const scope = wasm.scopedAllocPush();
        let pOut = 0;
        try {
            const pSize = wasm.scopedAlloc(8 + wasm.ptrSizeof);
            const ppOut = pSize + 8;
            const schemaPointer = schema
                ? wasm.isPtr(schema)
                    ? schema
                    : wasm.scopedAllocCString(String(schema))
                : 0;
            const rc = wasm.exports.sqlite3__wasm_db_serialize(
                dbPointer,
                schemaPointer,
                ppOut,
                pSize,
                0
            );
            if (rc) {
                toss3(
                    "Database serialization failed with code",
                    capi.sqlite3_js_rc_str(rc)
                );
            }
            pOut = wasm.peekPtr(ppOut);
            const nOut = wasm.peek(pSize, "i64");
            return nOut
                ? wasm.heap8u().slice(pOut, pOut + Number(nOut))
                : new Uint8Array();
        } finally {
            if (pOut) wasm.exports.sqlite3_free(pOut);
            wasm.scopedAllocPop(scope);
        }
    };

    helpers.sqlite3_js_db_vfs = (dbPointer, dbName = 0) =>
        util.sqlite3__wasm_db_vfs(dbPointer, dbName);

    helpers.sqlite3_js_aggregate_context = (pCtx, n) =>
        capi.sqlite3_aggregate_context(pCtx, n) ||
        (n
            ? WasmAllocError.toss(
                  "Cannot allocate",
                  n,
                  "bytes for sqlite3_aggregate_context()"
              )
            : 0);

    helpers.sqlite3_js_posix_create_file = (filename, data, dataLen) => {
        let pData = 0;
        if (data && wasm.isPtr(data)) {
            pData = data;
        } else if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
            const buffer =
                data instanceof ArrayBuffer ? new Uint8Array(data) : data;
            pData = wasm.allocFromTypedArray(buffer);
            if (
                arguments.length < 3 ||
                !util.isInt32(dataLen) ||
                dataLen < 0
            ) {
                dataLen = buffer.byteLength;
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
            if (rc) {
                SQLite3Error.toss(
                    "Creation of file failed with sqlite3 result code",
                    capi.sqlite3_js_rc_str(rc)
                );
            }
        } finally {
            if (pData) {
                wasm.dealloc(pData);
            }
        }
    };

    helpers.sqlite3_js_vfs_create_file = (vfs, filename, data, dataLen) => {
        config.warn(
            "sqlite3_js_vfs_create_file() is deprecated and should be avoided.",
            "See its documentation for alternative options."
        );
        let pData = 0;
        if (data) {
            let buffer = data;
            if (wasm.isPtr(buffer)) {
                pData = buffer;
            } else if (buffer instanceof ArrayBuffer) {
                buffer = new Uint8Array(buffer);
            }
            if (buffer instanceof Uint8Array) {
                pData = wasm.allocFromTypedArray(buffer);
                if (
                    arguments.length < 4 ||
                    !util.isInt32(dataLen) ||
                    dataLen < 0
                ) {
                    dataLen = buffer.byteLength;
                }
            } else {
                SQLite3Error.toss(
                    "Invalid 3rd argument type for sqlite3_js_vfs_create_file()."
                );
            }
        }
        if (!util.isInt32(dataLen) || dataLen < 0) {
            if (pData) wasm.dealloc(pData);
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
            if (rc) {
                SQLite3Error.toss(
                    "Creation of file failed with sqlite3 result code",
                    capi.sqlite3_js_rc_str(rc)
                );
            }
        } finally {
            if (pData) wasm.dealloc(pData);
        }
    };

    helpers.sqlite3_js_sql_to_string = (sql) => {
        if (typeof sql === "string") {
            return sql;
        }
        const result = util.flexibleString(sql);
        return result === sql ? undefined : result;
    };

    if (util.isUIThread()) {
        const kvvfsInfo = (which) => {
            const info = Object.create(null);
            info.prefix = "kvvfs-" + which;
            info.stores = [];
            if (which === "session" || which === "") {
                info.stores.push(globalThis.sessionStorage);
            }
            if (which === "local" || which === "") {
                info.stores.push(globalThis.localStorage);
            }
            return info;
        };

        helpers.sqlite3_js_kvvfs_clear = (which = "") => {
            let cleared = 0;
            const info = kvvfsInfo(which);
            info.stores.forEach((store) => {
                const keysToRemove = [];
                for (let i = 0; i < store.length; ++i) {
                    const key = store.key(i);
                    if (key.startsWith(info.prefix)) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach((key) => store.removeItem(key));
                cleared += keysToRemove.length;
            });
            return cleared;
        };

        helpers.sqlite3_js_kvvfs_size = (which = "") => {
            let totalSize = 0;
            const info = kvvfsInfo(which);
            info.stores.forEach((store) => {
                for (let i = 0; i < store.length; ++i) {
                    const key = store.key(i);
                    if (key.startsWith(info.prefix)) {
                        totalSize += key.length;
                        totalSize += store.getItem(key).length;
                    }
                }
            });
            return totalSize * 2;
        };
    }

    helpers.sqlite3_db_config = function (pDb, op, ...args) {
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

    helpers.sqlite3_value_to_js = (pVal, throwIfCannotConvert = true) => {
        let result;
        const valType = capi.sqlite3_value_type(pVal);
        switch (valType) {
            case capi.SQLITE_INTEGER:
                if (wasm.bigIntEnabled) {
                    result = capi.sqlite3_value_int64(pVal);
                    if (util.bigIntFitsDouble(result)) {
                        result = Number(result);
                    }
                } else {
                    result = capi.sqlite3_value_double(pVal);
                }
                break;
            case capi.SQLITE_FLOAT:
                result = capi.sqlite3_value_double(pVal);
                break;
            case capi.SQLITE_TEXT:
                result = capi.sqlite3_value_text(pVal);
                break;
            case capi.SQLITE_BLOB: {
                const n = capi.sqlite3_value_bytes(pVal);
                const pBlob = capi.sqlite3_value_blob(pVal);
                if (n && !pBlob) {
                    WasmAllocError.toss(
                        "Cannot allocate memory for blob argument of",
                        n,
                        "byte(s)"
                    );
                }
                result =
                    n && pBlob
                        ? wasm.heap8u().slice(pBlob, pBlob + Number(n))
                        : null;
                break;
            }
            case capi.SQLITE_NULL:
                result = null;
                break;
            default:
                if (throwIfCannotConvert) {
                    toss3(
                        capi.SQLITE_MISMATCH,
                        "Unhandled sqlite3_value_type():",
                        valType
                    );
                }
                result = undefined;
        }
        return result;
    };

    helpers.sqlite3_values_to_js = (argc, pArgv, throwIfCannotConvert = true) =>
        Array.from({ length: argc }, (_v, idx) =>
            helpers.sqlite3_value_to_js(
                wasm.peekPtr(pArgv + wasm.ptrSizeof * idx),
                throwIfCannotConvert
            )
        );

    helpers.sqlite3_result_error_js = (pCtx, error) => {
        if (error instanceof WasmAllocError) {
            capi.sqlite3_result_error_nomem(pCtx);
        } else {
            capi.sqlite3_result_error(pCtx, String(error), -1);
        }
    };

    helpers.sqlite3_result_js = (pCtx, value) => {
        if (value instanceof Error) {
            helpers.sqlite3_result_error_js(pCtx, value);
            return;
        }
        try {
            switch (typeof value) {
                case "undefined":
                    break;
                case "boolean":
                    capi.sqlite3_result_int(pCtx, value ? 1 : 0);
                    break;
                case "bigint":
                    if (util.bigIntFits32(value)) {
                        capi.sqlite3_result_int(pCtx, Number(value));
                    } else if (util.bigIntFitsDouble(value)) {
                        capi.sqlite3_result_double(pCtx, Number(value));
                    } else if (wasm.bigIntEnabled) {
                        if (util.bigIntFits64(value)) {
                            capi.sqlite3_result_int64(pCtx, value);
                        } else {
                            toss3(
                                "BigInt value",
                                value.toString(),
                                "is too large for int64."
                            );
                        }
                    } else {
                        toss3(
                            "BigInt value",
                            value.toString(),
                            "is too large."
                        );
                    }
                    break;
                case "number": {
                    let fn = capi.sqlite3_result_double;
                    if (util.isInt32(value)) {
                        fn = capi.sqlite3_result_int;
                    } else if (
                        wasm.bigIntEnabled &&
                        Number.isInteger(value) &&
                        util.bigIntFits64(BigInt(value))
                    ) {
                        fn = capi.sqlite3_result_int64;
                    }
                    fn(pCtx, value);
                    break;
                }
                case "string": {
                    const [ptr, len] = wasm.allocCString(value, true);
                    capi.sqlite3_result_text(
                        pCtx,
                        ptr,
                        len,
                        capi.SQLITE_WASM_DEALLOC
                    );
                    break;
                }
                case "object":
                    if (value === null) {
                        capi.sqlite3_result_null(pCtx);
                    } else if (util.isBindableTypedArray(value)) {
                        const pBlob = wasm.allocFromTypedArray(value);
                        capi.sqlite3_result_blob(
                            pCtx,
                            pBlob,
                            value.byteLength,
                            capi.SQLITE_WASM_DEALLOC
                        );
                    }
                    break;
                default:
                    toss3(
                        "Do not know how to handle this UDF result value:",
                        typeof value,
                        value
                    );
            }
        } catch (error) {
            helpers.sqlite3_result_error_js(pCtx, error);
        }
    };

    helpers.sqlite3_column_js = (pStmt, iCol, throwIfCannotConvert = true) => {
        const valuePtr = capi.sqlite3_column_value(pStmt, iCol);
        return valuePtr
            ? helpers.sqlite3_value_to_js(valuePtr, throwIfCannotConvert)
            : undefined;
    };

    const newOldValueHelper = function (pObj, iCol, implName) {
        const impl = capi[implName];
        if (!this.ptr) {
            this.ptr = wasm.allocPtr();
        } else {
            wasm.pokePtr(this.ptr, 0);
        }
        const rc = impl(pObj, iCol, this.ptr);
        if (rc) {
            return SQLite3Error.toss(
                rc,
                implName + "() failed with code " + rc
            );
        }
        const valuePtr = wasm.peekPtr(this.ptr);
        return valuePtr
            ? helpers.sqlite3_value_to_js(valuePtr, true)
            : undefined;
    }.bind(Object.create(null));

    helpers.sqlite3_preupdate_new_js = (pDb, iCol) =>
        newOldValueHelper(pDb, iCol, "sqlite3_preupdate_new");

    helpers.sqlite3_preupdate_old_js = (pDb, iCol) =>
        newOldValueHelper(pDb, iCol, "sqlite3_preupdate_old");

    helpers.sqlite3changeset_new_js = (pIter, iCol) =>
        newOldValueHelper(pIter, iCol, "sqlite3changeset_new");

    helpers.sqlite3changeset_old_js = (pIter, iCol) =>
        newOldValueHelper(pIter, iCol, "sqlite3changeset_old");

    return helpers;
}
