/**
 * @fileoverview Parameter binding utilities for prepared statements.
 */

/**
 * Creates binding helper functions for statement parameter binding.
 *
 * @param {import("../context.d.ts").Oo1Context} context Shared runtime context.
 * @param {import("./validation.d.ts").StatementValidators} validators Validation helper functions.
 * @returns {import("./binding.d.ts").BindHelpers} Binding helper functions.
 */
export function createBindingHelpers(context, validators) {
    const { sqlite3, capi, wasm, util, toss } = context;
    const {
        pointerOf,
        ensureStmtOpen,
        ensureNotLockedByExec,
        resolveParameterIndex,
    } = validators;

    /** Enumeration of supported bind types. */
    const BindTypes = {
        null: 1,
        number: 2,
        string: 3,
        boolean: 4,
        blob: 5,
    };
    BindTypes.undefined = BindTypes.null;
    if (wasm.bigIntEnabled) {
        BindTypes.bigint = BindTypes.number;
    }

    /**
     * Determines the bind type for a given value.
     *
     * @param {import("@wuchuheng/web-sqlite").BindValue} value - Value to classify.
     * @returns {number|undefined} BindTypes constant or undefined.
     */
    const determineBindType = (value) => {
        const kind =
            BindTypes[
                value === null || value === undefined ? "null" : typeof value
            ];
        switch (kind) {
            case BindTypes.boolean:
            case BindTypes.null:
            case BindTypes.number:
            case BindTypes.string:
                return kind;
            case BindTypes.bigint:
                if (wasm.bigIntEnabled) return kind;
                break;
            default:
                return util.isBindableTypedArray(value)
                    ? BindTypes.blob
                    : undefined;
        }
        return undefined;
    };

    /**
     * Ensures a value can be bound, throwing if unsupported.
     *
     * @param {import("@wuchuheng/web-sqlite").BindValue} value - Value to check.
     * @returns {number} BindTypes constant.
     */
    const ensureSupportedBindType = (value) => {
        const kind = determineBindType(value);
        if (kind === undefined) {
            toss("Unsupported bind() argument type:", typeof value);
        }
        return kind;
    };

    /**
     * Binds a string or blob to a statement parameter.
     *
     * @param {number} stmtPointer - Native statement pointer.
     * @param {number} index - 1-based parameter index.
     * @param {string} value - String to bind.
     * @param {boolean} asBlob - Whether to bind as BLOB.
     * @returns {number} SQLite result code.
     */
    const bindString = (stmtPointer, index, value, asBlob) => {
        const [strPtr, length] = wasm.allocCString(value, true);
        const binder = asBlob ? capi.sqlite3_bind_blob : capi.sqlite3_bind_text;
        return binder(
            stmtPointer,
            index,
            strPtr,
            length,
            capi.SQLITE_WASM_DEALLOC,
        );
    };

    /**
     * Binds a single value to a statement parameter.
     *
     * @param {import("@wuchuheng/web-sqlite").Stmt} stmt - Statement instance.
     * @param {number|string} index - Parameter index or name.
     * @param {number} bindType - BindTypes constant.
     * @param {import("@wuchuheng/web-sqlite").BindValue} value - Value to bind.
     * @returns {import("@wuchuheng/web-sqlite").Stmt} The statement for chaining.
     */
    const bindSingleValue = (stmt, index, bindType, value) => {
        // 1. Input handling
        ensureNotLockedByExec(ensureStmtOpen(stmt), "bind()");
        const stmtPointer = pointerOf(stmt);
        const resolvedIndex = resolveParameterIndex(stmt, index);
        let rc = 0;

        // 2. Core processing
        switch (
            value === null || value === undefined ? BindTypes.null : bindType
        ) {
            case BindTypes.null:
                rc = capi.sqlite3_bind_null(stmtPointer, resolvedIndex);
                break;
            case BindTypes.string:
                rc = bindString(stmtPointer, resolvedIndex, value, false);
                break;
            case BindTypes.number: {
                let binder;
                if (util.isInt32(value)) {
                    binder = capi.sqlite3_bind_int;
                } else if (typeof value === "bigint") {
                    if (!util.bigIntFits64(value)) {
                        toss(
                            "BigInt value is too big to store without precision loss:",
                            value,
                        );
                    } else if (wasm.bigIntEnabled) {
                        binder = capi.sqlite3_bind_int64;
                    } else if (util.bigIntFitsDouble(value)) {
                        value = Number(value);
                        binder = capi.sqlite3_bind_double;
                    } else {
                        toss(
                            "BigInt value is too big to store without precision loss:",
                            value,
                        );
                    }
                } else {
                    value = Number(value);
                    if (wasm.bigIntEnabled && Number.isInteger(value)) {
                        binder = capi.sqlite3_bind_int64;
                    } else {
                        binder = capi.sqlite3_bind_double;
                    }
                }
                rc = binder(stmtPointer, resolvedIndex, value);
                break;
            }
            case BindTypes.boolean:
                rc = capi.sqlite3_bind_int(
                    stmtPointer,
                    resolvedIndex,
                    value ? 1 : 0,
                );
                break;
            case BindTypes.blob: {
                if (typeof value === "string") {
                    rc = bindString(stmtPointer, resolvedIndex, value, true);
                    break;
                }
                let blob = value;
                if (value instanceof ArrayBuffer) {
                    blob = new Uint8Array(value);
                } else if (!util.isBindableTypedArray(value)) {
                    toss(
                        "Binding a value as a blob requires that it be a string,",
                        "Uint8Array, Int8Array, or ArrayBuffer.",
                    );
                }
                const blobPtr = wasm.alloc(blob.byteLength || 1);
                wasm.heap8().set(blob.byteLength ? blob : [0], blobPtr);
                rc = capi.sqlite3_bind_blob(
                    stmtPointer,
                    resolvedIndex,
                    blobPtr,
                    blob.byteLength,
                    capi.SQLITE_WASM_DEALLOC,
                );
                break;
            }
            default:
                sqlite3.config.warn("Unsupported bind() argument type:", value);
                toss("Unsupported bind() argument type:", typeof value);
        }

        if (rc) context.checkRc(stmt.db, rc);

        // 3. Output handling
        stmt._mayGet = false;
        return stmt;
    };

    return {
        BindTypes,
        determineBindType,
        ensureSupportedBindType,
        bindString,
        bindSingleValue,
    };
}
