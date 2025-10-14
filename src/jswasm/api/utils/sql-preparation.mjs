/**
 * @fileoverview SQL statement preparation and binding utilities
 *
 * This module provides enhanced wrappers for SQLite's statement preparation
 * and parameter binding functions, with support for flexible input types.
 *
 * Features:
 * - Flexible SQL input (string, TypedArray, pointer)
 * - Automatic type conversion for bindings
 * - Memory management for bound values
 * - UTF-8 string handling
 */

/**
 * Creates SQL preparation and binding utilities.
 *
 * @param {Object} wasm - The WASM utilities object
 * @param {Object} capi - The C API object
 * @param {Object} util - Utility functions
 * @returns {Object} Object containing preparation and binding functions
 */
export function createSqlPreparation(wasm, capi, util) {
    /**
     * Helper function to report database argument count mismatches.
     *
     * @param {number} pDb - Database pointer
     * @param {string} f - Function name
     * @param {number} n - Expected argument count
     * @returns {number} SQLITE_MISUSE error code
     */
    const __dbArgcMismatch = (pDb, f, n) => {
        return util.sqlite3__wasm_db_error(
            pDb,
            capi.SQLITE_MISUSE,
            f + "() requires " + n + " argument" + (1 === n ? "" : "s") + "."
        );
    };

    /**
     * Converts SQL input to a flexible format (string or pointer with length).
     *
     * @param {string|TypedArray|number} v - SQL input
     * @param {number} n - Length (if known)
     * @returns {Array} [value, length] pair
     */
    const __flexiString = (v, n) => {
        // 1. Handle string input
        if ("string" === typeof v) {
            n = -1;
        }
        // 2. Handle TypedArray input
        else if (util.isSQLableTypedArray(v)) {
            n = v.byteLength;
            v = util.typedArrayToString(v instanceof ArrayBuffer ? new Uint8Array(v) : v);
        }
        // 3. Handle array input
        else if (Array.isArray(v)) {
            v = v.join("");
            n = -1;
        }

        return [v, n];
    };

    /**
     * Native prepare wrappers.
     */
    const __prepare = {
        // For string SQL
        basic: wasm.xWrap("sqlite3_prepare_v3", "int", [
            "sqlite3*",
            "string",
            "int",
            "int",
            "**",
            "**",
        ]),

        // For pointer SQL
        full: wasm.xWrap("sqlite3_prepare_v3", "int", [
            "sqlite3*",
            "*",
            "int",
            "int",
            "**",
            "**",
        ]),
    };

    /**
     * Prepares an SQL statement (v3 API with flags).
     *
     * @param {number} pDb - Database pointer
     * @param {string|TypedArray|number} sql - SQL statement
     * @param {number} sqlLen - SQL byte length (-1 for null-terminated)
     * @param {number} prepFlags - Preparation flags
     * @param {number} ppStmt - Output pointer for statement handle
     * @param {number} pzTail - Output pointer for remaining SQL
     * @returns {number} SQLite result code
     */
    const sqlite3_prepare_v3 = function f(pDb, sql, sqlLen, prepFlags, ppStmt, pzTail) {
        // 1. Validate argument count
        if (f.length !== arguments.length) {
            return __dbArgcMismatch(pDb, "sqlite3_prepare_v3", f.length);
        }

        // 2. Convert SQL to flexible format
        const [xSql, xSqlLen] = __flexiString(sql, sqlLen);

        // 3. Call appropriate native function
        switch (typeof xSql) {
            case "string":
                return __prepare.basic(pDb, xSql, xSqlLen, prepFlags, ppStmt, null);
            case "number":
                return __prepare.full(pDb, xSql, xSqlLen, prepFlags, ppStmt, pzTail);
            default:
                return util.sqlite3__wasm_db_error(
                    pDb,
                    capi.SQLITE_MISUSE,
                    "Invalid SQL argument type for sqlite3_prepare_v2/v3()."
                );
        }
    };

    /**
     * Prepares an SQL statement (v2 API without flags).
     *
     * @param {number} pDb - Database pointer
     * @param {string|TypedArray|number} sql - SQL statement
     * @param {number} sqlLen - SQL byte length (-1 for null-terminated)
     * @param {number} ppStmt - Output pointer for statement handle
     * @param {number} pzTail - Output pointer for remaining SQL
     * @returns {number} SQLite result code
     */
    const sqlite3_prepare_v2 = function f(pDb, sql, sqlLen, ppStmt, pzTail) {
        return f.length === arguments.length
            ? sqlite3_prepare_v3(pDb, sql, sqlLen, 0, ppStmt, pzTail)
            : __dbArgcMismatch(pDb, "sqlite3_prepare_v2", f.length);
    };

    /**
     * Native bind wrappers.
     */
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

    /**
     * Binds a text value to a prepared statement parameter.
     *
     * @param {number} pStmt - Statement pointer
     * @param {number} iCol - Parameter index (1-based)
     * @param {string|TypedArray|number|null} text - Text value
     * @param {number} nText - Text byte length (-1 for null-terminated)
     * @param {number} xDestroy - Destructor pointer
     * @returns {number} SQLite result code
     */
    const sqlite3_bind_text = function f(pStmt, iCol, text, nText, xDestroy) {
        // 1. Validate argument count
        if (f.length !== arguments.length) {
            return __dbArgcMismatch(
                capi.sqlite3_db_handle(pStmt),
                "sqlite3_bind_text",
                f.length
            );
        }

        // 2. Handle pointer or null input
        if (wasm.isPtr(text) || null === text) {
            return __bindText(pStmt, iCol, text, nText, xDestroy);
        }

        // 3. Convert ArrayBuffer to Uint8Array
        if (text instanceof ArrayBuffer) {
            text = new Uint8Array(text);
        }
        // 4. Convert array to string
        else if (Array.isArray(text)) {
            text = text.join("");
        }

        // 5. Allocate and bind
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

            return __bindText(pStmt, iCol, p, n, capi.SQLITE_WASM_DEALLOC);
        } catch (e) {
            wasm.dealloc(p);
            return util.sqlite3__wasm_db_error(capi.sqlite3_db_handle(pStmt), e);
        }
    };

    /**
     * Binds a blob value to a prepared statement parameter.
     *
     * @param {number} pStmt - Statement pointer
     * @param {number} iCol - Parameter index (1-based)
     * @param {TypedArray|ArrayBuffer|number|null} pMem - Blob data
     * @param {number} nMem - Blob byte length
     * @param {number} xDestroy - Destructor pointer
     * @returns {number} SQLite result code
     */
    const sqlite3_bind_blob = function f(pStmt, iCol, pMem, nMem, xDestroy) {
        // 1. Validate argument count
        if (f.length !== arguments.length) {
            return __dbArgcMismatch(
                capi.sqlite3_db_handle(pStmt),
                "sqlite3_bind_blob",
                f.length
            );
        }

        // 2. Handle pointer or null input
        if (wasm.isPtr(pMem) || null === pMem) {
            return __bindBlob(pStmt, iCol, pMem, nMem, xDestroy);
        }

        // 3. Convert ArrayBuffer to Uint8Array
        if (pMem instanceof ArrayBuffer) {
            pMem = new Uint8Array(pMem);
        }
        // 4. Convert array to string
        else if (Array.isArray(pMem)) {
            pMem = pMem.join("");
        }

        // 5. Allocate and bind
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

            return __bindBlob(pStmt, iCol, p, n, capi.SQLITE_WASM_DEALLOC);
        } catch (e) {
            wasm.dealloc(p);
            return util.sqlite3__wasm_db_error(capi.sqlite3_db_handle(pStmt), e);
        }
    };

    return {
        sqlite3_prepare_v3,
        sqlite3_prepare_v2,
        sqlite3_bind_text,
        sqlite3_bind_blob,
    };
}
