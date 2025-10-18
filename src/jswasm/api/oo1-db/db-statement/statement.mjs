/**
 * @fileoverview Statement class implementation for prepared SQL statements.
 */

/**
 * Creates the Statement class with all its methods.
 *
 * @param {import("../context.d.ts").Oo1Context} context Shared runtime context.
 * @param {import("./validation.d.ts").StatementValidators} validators Validation helper functions.
 * @param {import("./binding.d.ts").BindHelpers} bindHelpers Binding helper functions.
 * @param {symbol} constructorToken Guard to prevent external construction.
 * @returns {typeof import("@wuchuheng/web-sqlite").Stmt} Statement class.
 */
export function createStatementClass(
    context,
    validators,
    bindHelpers,
    constructorToken
) {
    const { capi, wasm, util, ptrMap, stmtMap, toss } = context;
    const {
        pointerOf,
        ensureStmtOpen,
        ensureNotLockedByExec,
        resolveColumnIndex,
    } = validators;
    const { BindTypes, ensureSupportedBindType, bindSingleValue } = bindHelpers;

    /**
     * Represents a prepared statement bound to a database connection.
     */
    class Statement {
        /**
         * @param {object} db - Owning database instance.
         * @param {number} pointer - Pointer to the native sqlite3_stmt.
         * @param {symbol} token - Guard to prevent external construction.
         */
        constructor(db, pointer, token) {
            if (token !== constructorToken) {
                toss(
                    capi.SQLITE_MISUSE,
                    "Do not call the Stmt constructor directly. Use DB.prepare()."
                );
            }
            this.db = db;
            this.parameterCount = capi.sqlite3_bind_parameter_count(pointer);
            this._mayGet = false;
            ptrMap.set(this, pointer);
            stmtMap.get(db)[pointer] = this;
        }

        /**
         * Finalises the statement, releasing native resources.
         *
         * @returns {number|undefined} sqlite result code.
         */
        finalize() {
            const pointer = pointerOf(this);
            if (!pointer) return undefined;
            ensureNotLockedByExec(this, "finalize()");
            const rc = capi.sqlite3_finalize(pointer);
            delete stmtMap.get(this.db)[pointer];
            ptrMap.delete(this);
            delete this.parameterCount;
            delete this._lockedByExec;
            delete this._mayGet;
            delete this.db;
            return rc;
        }

        /**
         * Clears all bindings on the statement.
         *
         * @returns {Statement} Fluent reference.
         */
        clearBindings() {
            ensureNotLockedByExec(ensureStmtOpen(this), "clearBindings()");
            capi.sqlite3_clear_bindings(pointerOf(this));
            this._mayGet = false;
            return this;
        }

        /**
         * Resets the statement, optionally clearing bindings.
         *
         * @param {boolean} [alsoClearBinds=false] - Whether to clear bindings too.
         * @returns {Statement} Fluent reference.
         */
        reset(alsoClearBinds = false) {
            ensureNotLockedByExec(this, "reset()");
            if (alsoClearBinds) this.clearBindings();
            const rc = capi.sqlite3_reset(pointerOf(ensureStmtOpen(this)));
            this._mayGet = false;
            context.checkRc(this.db, rc);
            return this;
        }

        /**
         * Binds values to statement parameters.
         *
         * @param {...any} bindArgs - Parameter index/name and value(s).
         * @returns {Statement} Fluent reference.
         */
        bind(...bindArgs) {
            // 1. Input handling
            ensureStmtOpen(this);
            let index;
            let value;
            switch (bindArgs.length) {
                case 1:
                    index = 1;
                    value = bindArgs[0];
                    break;
                case 2:
                    index = bindArgs[0];
                    value = bindArgs[1];
                    break;
                default:
                    toss("Invalid bind() arguments.");
            }
            if (value === undefined) return this;
            if (!this.parameterCount) {
                toss("This statement has no bindable parameters.");
            }
            this._mayGet = false;

            // 2. Core processing
            if (value === null) {
                return bindSingleValue(this, index, BindTypes.null, value);
            }
            if (Array.isArray(value)) {
                if (bindArgs.length !== 1) {
                    toss(
                        "When binding an array, an index argument is not permitted."
                    );
                }
                value.forEach((entry, i) =>
                    bindSingleValue(
                        this,
                        i + 1,
                        ensureSupportedBindType(entry),
                        entry
                    )
                );
                return this;
            }
            if (value instanceof ArrayBuffer) {
                value = new Uint8Array(value);
            }
            if (
                typeof value === "object" &&
                !util.isBindableTypedArray(value)
            ) {
                if (bindArgs.length !== 1) {
                    toss(
                        "When binding an object, an index argument is not permitted."
                    );
                }
                Object.keys(value).forEach((key) =>
                    bindSingleValue(
                        this,
                        key,
                        ensureSupportedBindType(value[key]),
                        value[key]
                    )
                );
                return this;
            }

            // 3. Output handling
            return bindSingleValue(
                this,
                index,
                ensureSupportedBindType(value),
                value
            );
        }

        /**
         * Forces a bind as BLOB regardless of inferred type.
         *
         * @param {number|string} index - Parameter index or name.
         * @param {any} value - Value to bind.
         * @returns {Statement} Fluent reference.
         */
        bindAsBlob(index, value) {
            ensureStmtOpen(this);
            if (arguments.length === 1) {
                value = index;
                index = 1;
            }
            const kind = ensureSupportedBindType(value);
            if (
                kind !== BindTypes.string &&
                kind !== BindTypes.blob &&
                kind !== BindTypes.null
            ) {
                toss("Invalid value type for bindAsBlob().");
            }
            return bindSingleValue(this, index, BindTypes.blob, value);
        }

        /**
         * Steps the statement forward.
         *
         * @returns {boolean} `true` when a row is available.
         */
        step() {
            ensureNotLockedByExec(this, "step()");
            const rc = capi.sqlite3_step(pointerOf(ensureStmtOpen(this)));
            switch (rc) {
                case capi.SQLITE_DONE:
                    this._mayGet = false;
                    return false;
                case capi.SQLITE_ROW:
                    this._mayGet = true;
                    return true;
                default:
                    this._mayGet = false;
                    context.sqlite3.config.warn(
                        "sqlite3_step() rc=",
                        rc,
                        capi.sqlite3_js_rc_str(rc),
                        "SQL =",
                        capi.sqlite3_sql(pointerOf(this))
                    );
                    context.checkRc(this.db, rc);
            }
            return false;
        }

        /**
         * Convenience wrapper combining step and reset.
         *
         * @returns {Statement} Fluent reference.
         */
        stepReset() {
            this.step();
            return this.reset();
        }

        /**
         * Convenience wrapper combining step, reset, and finalize.
         *
         * @returns {number|undefined} sqlite result code.
         */
        stepFinalize() {
            try {
                const rc = this.step();
                this.reset();
                return rc;
            } finally {
                try {
                    this.finalize();
                } catch (e) {
                    void e;
                }
            }
        }

        /**
         * Retrieves column data in a variety of formats.
         *
         * @param {number|Array|object} ndx - Column index or reusable container.
         * @param {number} [asType] - Optional explicit sqlite type.
         * @returns {any} Column value.
         */
        get(ndx, asType) {
            // 1. Input handling
            if (!ensureStmtOpen(this)._mayGet) {
                toss("Stmt.step() has not (recently) returned true.");
            }

            // 2. Core processing
            if (Array.isArray(ndx)) {
                for (let i = 0; i < this.columnCount; ++i) {
                    ndx[i] = this.get(i);
                }
                return ndx;
            }
            if (ndx && typeof ndx === "object") {
                for (let i = 0; i < this.columnCount; ++i) {
                    ndx[capi.sqlite3_column_name(pointerOf(this), i)] =
                        this.get(i);
                }
                return ndx;
            }

            const index = resolveColumnIndex(this, ndx);
            const desiredType =
                asType === undefined
                    ? capi.sqlite3_column_type(pointerOf(this), index)
                    : asType;
            const stmtPointer = pointerOf(this);

            // 3. Output handling
            switch (desiredType) {
                case capi.SQLITE_NULL:
                    return null;
                case capi.SQLITE_INTEGER: {
                    if (wasm.bigIntEnabled) {
                        const rc = capi.sqlite3_column_int64(
                            stmtPointer,
                            index
                        );
                        if (
                            rc >= Number.MIN_SAFE_INTEGER &&
                            rc <= Number.MAX_SAFE_INTEGER
                        ) {
                            return Number(rc).valueOf();
                        }
                        return rc;
                    }
                    const rc = capi.sqlite3_column_double(stmtPointer, index);
                    if (
                        rc > Number.MAX_SAFE_INTEGER ||
                        rc < Number.MIN_SAFE_INTEGER
                    ) {
                        toss(
                            "Integer is out of range for JS integer range:",
                            rc
                        );
                    }
                    return util.isInt32(rc) ? rc | 0 : rc;
                }
                case capi.SQLITE_FLOAT:
                    return capi.sqlite3_column_double(stmtPointer, index);
                case capi.SQLITE_TEXT:
                    return capi.sqlite3_column_text(stmtPointer, index);
                case capi.SQLITE_BLOB: {
                    const length = capi.sqlite3_column_bytes(
                        stmtPointer,
                        index
                    );
                    const blobPtr = capi.sqlite3_column_blob(
                        stmtPointer,
                        index
                    );
                    const result = new Uint8Array(length);
                    if (length) {
                        result.set(
                            wasm.heap8u().slice(blobPtr, blobPtr + length),
                            0
                        );
                    }
                    if (length && Array.isArray(this.db._blobXfer)) {
                        this.db._blobXfer.push(result.buffer);
                    }
                    return result;
                }
                default:
                    toss(
                        "Don't know how to translate type of result column #",
                        index,
                        "."
                    );
            }
        }

        /**
         * Retrieves column value coerced to integer.
         *
         * @param {number} ndx - Column index.
         * @returns {number|bigint} Column value.
         */
        getInt(ndx) {
            return this.get(ndx, capi.SQLITE_INTEGER);
        }

        /**
         * Retrieves column value coerced to float.
         *
         * @param {number} ndx - Column index.
         * @returns {number} Column value.
         */
        getFloat(ndx) {
            return this.get(ndx, capi.SQLITE_FLOAT);
        }

        /**
         * Retrieves column value coerced to text.
         *
         * @param {number} ndx - Column index.
         * @returns {string|null} Column value.
         */
        getString(ndx) {
            return this.get(ndx, capi.SQLITE_TEXT);
        }

        /**
         * Retrieves column value coerced to blob.
         *
         * @param {number} ndx - Column index.
         * @returns {Uint8Array} Column value.
         */
        getBlob(ndx) {
            return this.get(ndx, capi.SQLITE_BLOB);
        }

        /**
         * Retrieves column value and parses it as JSON.
         *
         * @param {number} ndx - Column index.
         * @returns {any} Parsed JSON or null.
         */
        getJSON(ndx) {
            const textType = capi.SQLITE_STRING ?? capi.SQLITE_TEXT;
            const payload = this.get(ndx, textType);
            return payload === null ? payload : JSON.parse(payload);
        }

        /**
         * Returns the column name for a given index.
         *
         * @param {number} ndx - Column index.
         * @returns {string} Column name.
         */
        getColumnName(ndx) {
            return capi.sqlite3_column_name(
                pointerOf(this),
                resolveColumnIndex(this, ndx)
            );
        }

        /**
         * Collects all column names into the supplied array.
         *
         * @param {string[]} [target=[]] - Target array receives column names.
         * @returns {string[]} Filled array.
         */
        getColumnNames(target = []) {
            resolveColumnIndex(this, 0);
            for (let i = 0; i < this.columnCount; ++i) {
                target.push(capi.sqlite3_column_name(pointerOf(this), i));
            }
            return target;
        }

        /**
         * Resolves a parameter name to its index.
         *
         * @param {string} name - Parameter name.
         * @returns {number|undefined} Index or undefined when unbound.
         */
        getParamIndex(name) {
            return this.parameterCount
                ? capi.sqlite3_bind_parameter_index(pointerOf(this), name)
                : undefined;
        }

        /**
         * Retrieves the parameter name for a given index.
         *
         * @param {number} index - Parameter index.
         * @returns {string|undefined} Parameter name.
         */
        getParamName(index) {
            return this.parameterCount
                ? capi.sqlite3_bind_parameter_name(pointerOf(this), index)
                : undefined;
        }

        /**
         * Reports whether the statement is currently busy.
         *
         * @returns {boolean} Busy flag.
         */
        isBusy() {
            return (
                0 !== capi.sqlite3_stmt_busy(pointerOf(ensureStmtOpen(this)))
            );
        }

        /**
         * Reports whether the statement is read-only.
         *
         * @returns {boolean} Read-only flag.
         */
        isReadOnly() {
            return (
                0 !==
                capi.sqlite3_stmt_readonly(pointerOf(ensureStmtOpen(this)))
            );
        }
    }

    Object.defineProperty(Statement.prototype, "columnCount", {
        enumerable: false,
        configurable: false,
        get() {
            return capi.sqlite3_column_count(pointerOf(this));
        },
        set() {
            toss("The columnCount property is read-only.");
        },
    });

    return Statement;
}
