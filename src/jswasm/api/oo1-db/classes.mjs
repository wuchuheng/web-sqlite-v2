/**
 * @fileoverview Creates the Database and Statement classes for the OO1 API.
 */

const INTERNAL_STATEMENT_TOKEN = Symbol("StatementConstructorGuard");

/**
 * Builds the Database/Statement classes and supporting utilities.
 *
 * @param {object} context - Shared runtime context.
 * @param {Function} dbCtorHelper - Constructor helper to open DBs.
 * @returns {{Database: typeof Database, Statement: typeof Statement, ensureDbOpen: Function}}
 */
export function createDbClasses(context, dbCtorHelper) {
    const { sqlite3, capi, wasm, util, ptrMap, stmtMap, toss } = context;

    const pointerOf = (target) => ptrMap.get(target);

    const ensureDbOpen = (db) => {
        if (!pointerOf(db)) toss("DB has been closed.");
        return db;
    };

    const ensureStmtOpen = (stmt) => {
        if (!pointerOf(stmt)) toss("Stmt has been closed.");
        return stmt;
    };

    const ensureNotLockedByExec = (stmt, operation) => {
        if (stmt._lockedByExec) {
            toss(
                "Operation is illegal when statement is locked:",
                operation
            );
        }
        return stmt;
    };

    const resolveColumnIndex = (stmt, index) => {
        if (index !== (index | 0) || index < 0 || index >= stmt.columnCount) {
            toss("Column index", index, "is out of range.");
        }
        return index;
    };

    const resolveParameterIndex = (stmt, key) => {
        const pointer = pointerOf(ensureStmtOpen(stmt));
        const index =
            typeof key === "number"
                ? key
                : capi.sqlite3_bind_parameter_index(pointer, key);
        if (!index || !util.isInt32(index)) {
            toss("Invalid bind() parameter name:", key);
        }
        if (index < 1 || index > stmt.parameterCount) {
            toss("Bind index", key, "is out of range.");
        }
        return index;
    };

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

    const ensureSupportedBindType = (value) => {
        const kind = determineBindType(value);
        if (kind === undefined) {
            toss("Unsupported bind() argument type:", typeof value);
        }
        return kind;
    };

    const bindString = (stmtPointer, index, value, asBlob) => {
        const [strPtr, length] = wasm.allocCString(value, true);
        const binder = asBlob
            ? capi.sqlite3_bind_blob
            : capi.sqlite3_bind_text;
        return binder(
            stmtPointer,
            index,
            strPtr,
            length,
            capi.SQLITE_WASM_DEALLOC
        );
    };

    const bindSingleValue = (stmt, index, bindType, value) => {
        ensureNotLockedByExec(ensureStmtOpen(stmt), "bind()");
        const stmtPointer = pointerOf(stmt);
        const resolvedIndex = resolveParameterIndex(stmt, index);
        let rc = 0;

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
                            value
                        );
                    } else if (wasm.bigIntEnabled) {
                        binder = capi.sqlite3_bind_int64;
                    } else if (util.bigIntFitsDouble(value)) {
                        value = Number(value);
                        binder = capi.sqlite3_bind_double;
                    } else {
                        toss(
                            "BigInt value is too big to store without precision loss:",
                            value
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
                    value ? 1 : 0
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
                        "Uint8Array, Int8Array, or ArrayBuffer."
                    );
                }
                const blobPtr = wasm.alloc(blob.byteLength || 1);
                wasm.heap8().set(blob.byteLength ? blob : [0], blobPtr);
                rc = capi.sqlite3_bind_blob(
                    stmtPointer,
                    resolvedIndex,
                    blobPtr,
                    blob.byteLength,
                    capi.SQLITE_WASM_DEALLOC
                );
                break;
            }
            default:
                sqlite3.config.warn(
                    "Unsupported bind() argument type:",
                    value
                );
                toss("Unsupported bind() argument type:", typeof value);
        }

        if (rc) context.checkRc(stmt.db, rc);
        stmt._mayGet = false;
        return stmt;
    };

    const selectFirstRow = (db, sql, bind, ...getArgs) => {
        const stmt = db.prepare(sql);
        try {
            const hasRow = stmt.bind(bind).step();
            const result = hasRow ? stmt.get(...getArgs) : undefined;
            stmt.reset();
            return result;
        } finally {
            stmt.finalize();
        }
    };

    const selectAllRows = (db, sql, bind, rowMode) =>
        db.exec({
            sql,
            bind,
            rowMode,
            returnValue: "resultRows",
        });

    const parseExecPlan = (db, args) => {
        const plan = {
            opt: Object.create(null),
        };

        switch (args.length) {
            case 1:
                if (
                    typeof args[0] === "string" ||
                    util.isSQLableTypedArray(args[0])
                ) {
                    plan.sql = args[0];
                } else if (Array.isArray(args[0])) {
                    plan.sql = args[0];
                } else if (args[0] && typeof args[0] === "object") {
                    plan.opt = args[0];
                    plan.sql = plan.opt.sql;
                }
                break;
            case 2:
                plan.sql = args[0];
                plan.opt = args[1];
                break;
            default:
                toss("Invalid argument count for exec().");
        }

        plan.sql = util.flexibleString(plan.sql);
        if (typeof plan.sql !== "string") {
            toss("Missing SQL argument or unsupported SQL value type.");
        }

        const opt = plan.opt;
        switch (opt.returnValue) {
            case "resultRows":
                if (!opt.resultRows) opt.resultRows = [];
                plan.returnVal = () => opt.resultRows;
                break;
            case "saveSql":
                if (!opt.saveSql) opt.saveSql = [];
                plan.returnVal = () => opt.saveSql;
                break;
            case undefined:
            case "this":
                plan.returnVal = () => db;
                break;
            default:
                toss("Invalid returnValue value:", opt.returnValue);
        }

        if (!opt.callback && !opt.returnValue && opt.rowMode !== undefined) {
            if (!opt.resultRows) opt.resultRows = [];
            plan.returnVal = () => opt.resultRows;
        }

        if (opt.callback || opt.resultRows) {
            const rowMode = opt.rowMode ?? "array";
            switch (rowMode) {
                case "object":
                    plan.cbArg = (stmt, cache) => {
                        if (!cache.columnNames) {
                            cache.columnNames = stmt.getColumnNames([]);
                        }
                        const row = stmt.get([]);
                        const record = Object.create(null);
                        for (const i in cache.columnNames) {
                            record[cache.columnNames[i]] = row[i];
                        }
                        return record;
                    };
                    break;
                case "array":
                    plan.cbArg = (stmt) => stmt.get([]);
                    break;
                case "stmt":
                    if (Array.isArray(opt.resultRows)) {
                        toss(
                            "exec(): invalid rowMode for a resultRows array: must",
                            "be one of 'array', 'object', a result column number,",
                            "or column name reference."
                        );
                    }
                    plan.cbArg = (stmt) => stmt;
                    break;
                default:
                    if (util.isInt32(rowMode)) {
                        plan.cbArg = (stmt) => stmt.get(rowMode);
                    } else if (
                        typeof rowMode === "string" &&
                        rowMode.startsWith("$") &&
                        rowMode.length > 1
                    ) {
                        const columnName = rowMode.slice(1);
                        plan.cbArg = (stmt) => {
                            const cache = Object.create(null);
                            const record = stmt.get(cache);
                            if (record[columnName] === undefined) {
                                toss(
                                    capi.SQLITE_NOTFOUND,
                                    "exec(): unknown result column:",
                                    columnName
                                );
                            }
                            return record[columnName];
                        };
                    } else {
                        toss("Invalid rowMode:", rowMode);
                    }
            }
        }

        return plan;
    };

    /**
     * Represents a prepared statement bound to a database connection.
     */
    class Statement {
        /**
         * @param {Database} db - Owning database instance.
         * @param {number} pointer - Pointer to the native sqlite3_stmt.
         * @param {symbol} token - Guard to prevent external construction.
         */
        constructor(db, pointer, token) {
            if (token !== INTERNAL_STATEMENT_TOKEN) {
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
            if (typeof value === "object" && !util.isBindableTypedArray(value)) {
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
                    sqlite3.config.warn(
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
            if (!ensureStmtOpen(this)._mayGet) {
                toss("Stmt.step() has not (recently) returned true.");
            }

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
                    const blobPtr = capi.sqlite3_column_blob(stmtPointer, index);
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
                0 !== capi.sqlite3_stmt_readonly(pointerOf(ensureStmtOpen(this)))
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

    /**
     * High-level database wrapper used by sqlite3.oo1.DB.
     */
    class Database {
        /**
         * Opens the database using the shared constructor helper.
         *
         * @param {...any} ctorArgs - Database constructor arguments.
         */
        constructor(...ctorArgs) {
            dbCtorHelper.apply(this, ctorArgs);
        }

        /**
         * Indicates whether the handle is open.
         *
         * @returns {boolean} Open flag.
         */
        isOpen() {
            return Boolean(pointerOf(this));
        }

        /**
         * Ensures the database handle is open, returning itself for chaining.
         *
         * @returns {Database} Fluent reference.
         */
        affirmOpen() {
            ensureDbOpen(this);
            return this;
        }

        /**
         * Closes the database, finalising any outstanding statements.
         */
        close() {
            const pointer = pointerOf(this);
            if (!pointer) return;

            if (this.onclose?.before instanceof Function) {
                try {
                    this.onclose.before(this);
                } catch (e) {
                    void e;
                }
            }

            const stmtRegistry = stmtMap.get(this);
            for (const statement of Object.values(stmtRegistry)) {
                if (statement && pointerOf(statement)) {
                    try {
                        statement.finalize();
                    } catch (e) {
                        void e;
                    }
                }
            }

            ptrMap.delete(this);
            stmtMap.delete(this);
            capi.sqlite3_close_v2(pointer);

            if (this.onclose?.after instanceof Function) {
                try {
                    this.onclose.after(this);
                } catch (e) {
                    void e;
                }
            }

            delete this.filename;
        }

        /**
         * Reports the number of changes made by recent operations.
         *
         * @param {boolean} [total=false] - Whether to report total changes.
         * @param {boolean} [sixtyFour=false] - Whether to return 64-bit counters.
         * @returns {number|bigint} Number of changes.
         */
        changes(total = false, sixtyFour = false) {
            const pointer = pointerOf(ensureDbOpen(this));
            if (total) {
                return sixtyFour
                    ? capi.sqlite3_total_changes64(pointer)
                    : capi.sqlite3_total_changes(pointer);
            }
            return sixtyFour
                ? capi.sqlite3_changes64(pointer)
                : capi.sqlite3_changes(pointer);
        }

        /**
         * Resolves the on-disk filename for the given attached database.
         *
         * @param {string} [dbName="main"] - Logical database name.
         * @returns {string|null} Absolute filename or null.
         */
        dbFilename(dbName = "main") {
            return capi.sqlite3_db_filename(pointerOf(ensureDbOpen(this)), dbName);
        }

        /**
         * Resolves the logical database name for the given attachment index.
         *
         * @param {number} [dbNumber=0] - Attachment index.
         * @returns {string|null} Database name.
         */
        dbName(dbNumber = 0) {
            return capi.sqlite3_db_name(pointerOf(ensureDbOpen(this)), dbNumber);
        }

        /**
         * Retrieves the name of the VFS backing the database connection.
         *
         * @param {string|number} [dbName=0] - Logical database name or index.
         * @returns {string|undefined} VFS name.
         */
        dbVfsName(dbName = 0) {
            const pointer = pointerOf(ensureDbOpen(this));
            const pVfs = capi.sqlite3_js_db_vfs(pointer, dbName);
            if (!pVfs) return undefined;
            const vfs = new capi.sqlite3_vfs(pVfs);
            try {
                return wasm.cstrToJs(vfs.$zName);
            } finally {
                vfs.dispose();
            }
        }

        /**
         * Prepares a statement for execution.
         *
         * @param {string} sql - SQL text.
         * @returns {Statement} Prepared statement.
         */
        prepare(sql) {
            ensureDbOpen(this);
            const stack = wasm.pstack.pointer;
            let stmtPointer;

            try {
                const stmtSlot = wasm.pstack.alloc(wasm.ptrSizeof);
                context.checkRc(
                    this,
                    capi.sqlite3_prepare_v2(
                        pointerOf(this),
                        sql,
                        -1,
                        stmtSlot,
                        null
                    )
                );
                stmtPointer = wasm.peekPtr(stmtSlot);
            } finally {
                wasm.pstack.restore(stack);
            }

            if (!stmtPointer) {
                toss("Cannot prepare empty SQL.");
            }
            return new Statement(this, stmtPointer, INTERNAL_STATEMENT_TOKEN);
        }

        /**
         * Executes SQL with optional callbacks, mirroring the original API.
         *
         * @param {...any} execArgs - Flexible exec() argument set.
         * @returns {any} Configured return value.
         */
        exec(...execArgs) {
            ensureDbOpen(this);
            const plan = parseExecPlan(this, execArgs);
            if (!plan.sql) {
                toss("exec() requires an SQL string.");
            }
            const opt = plan.opt;
            const callback = opt.callback;
            const resultRows = Array.isArray(opt.resultRows)
                ? opt.resultRows
                : undefined;
            const saveSql = Array.isArray(opt.saveSql) ? opt.saveSql : undefined;
            let statement = null;
            let bindSpec = opt.bind;
            let needFirstEval = Boolean(
                plan.cbArg || opt.columnNames || resultRows
            );
            const stack = wasm.scopedAllocPush();

            try {
                const isTypedArray = util.isSQLableTypedArray(plan.sql);
                let sqlByteLength = isTypedArray
                    ? plan.sql.byteLength
                    : wasm.jstrlen(plan.sql);
                const ppStmt = wasm.scopedAlloc(
                    2 * wasm.ptrSizeof + (sqlByteLength + 1)
                );
                const pzTail = ppStmt + wasm.ptrSizeof;
                let pSql = pzTail + wasm.ptrSizeof;
                const pSqlEnd = pSql + sqlByteLength;

                if (isTypedArray) {
                    wasm.heap8().set(plan.sql, pSql);
                } else {
                    wasm.jstrcpy(
                        plan.sql,
                        wasm.heap8(),
                        pSql,
                        sqlByteLength,
                        false
                    );
                }

                wasm.poke(pSql + sqlByteLength, 0);

                while (pSql && wasm.peek(pSql, "i8")) {
                    wasm.pokePtr([ppStmt, pzTail], 0);
                    context.checkRc(
                        this,
                        capi.sqlite3_prepare_v3(
                            pointerOf(this),
                            pSql,
                            sqlByteLength,
                            0,
                            ppStmt,
                            pzTail
                        )
                    );

                    const pStmt = wasm.peekPtr(ppStmt);
                    pSql = wasm.peekPtr(pzTail);
                    sqlByteLength = pSqlEnd - pSql;
                    if (!pStmt) continue;

                    if (saveSql) {
                        saveSql.push(capi.sqlite3_sql(pStmt).trim());
                    }

                    statement = new Statement(
                        this,
                        pStmt,
                        INTERNAL_STATEMENT_TOKEN
                    );

                    if (bindSpec && statement.parameterCount) {
                        statement.bind(bindSpec);
                        bindSpec = null;
                    }

                    if (needFirstEval && statement.columnCount) {
                        let columnNamesCaptured = Array.isArray(opt.columnNames)
                            ? 0
                            : 1;
                        needFirstEval = false;
                        if (plan.cbArg || resultRows) {
                            const cbCache = Object.create(null);
                            for (; statement.step(); statement._lockedByExec = false) {
                                if (columnNamesCaptured++ === 0) {
                                    statement.getColumnNames(
                                        (cbCache.columnNames =
                                            opt.columnNames || [])
                                    );
                                }
                                statement._lockedByExec = true;
                                const row = plan.cbArg(statement, cbCache);
                                if (resultRows) resultRows.push(row);
                                if (
                                    callback &&
                                    callback.call(opt, row, statement) === false
                                ) {
                                    break;
                                }
                            }
                            statement._lockedByExec = false;
                        }
                        if (columnNamesCaptured === 0) {
                            statement.getColumnNames(opt.columnNames);
                        }
                    } else {
                        statement.step();
                    }

                    statement.reset().finalize();
                    statement = null;
                }
            } finally {
                wasm.scopedAllocPop(stack);
                if (statement) {
                    delete statement._lockedByExec;
                    statement.finalize();
                }
            }

            return plan.returnVal();
        }

        /**
         * Registers scalar, aggregate, or window functions.
         *
         * @param {string|object} name - Function name or options object.
         * @param {Function} [xFunc] - Scalar callback.
         * @param {object} [opt] - Additional configuration.
         * @returns {Database} Fluent reference.
         */
        createFunction(name, xFunc, opt) {
            const isFunction = (fn) => fn instanceof Function;
            switch (arguments.length) {
                case 1:
                    opt = name;
                    name = opt.name;
                    xFunc = opt.xFunc || 0;
                    break;
                case 2:
                    if (!isFunction(xFunc)) {
                        opt = xFunc;
                        xFunc = opt.xFunc || 0;
                    }
                    break;
                default:
                    break;
            }

            if (!opt) opt = {};
            if (typeof name !== "string") {
                toss("Invalid arguments: missing function name.");
            }

            let xStep = opt.xStep || 0;
            let xFinal = opt.xFinal || 0;
            const xValue = opt.xValue || 0;
            const xInverse = opt.xInverse || 0;

            let isWindow = undefined;
            if (isFunction(xFunc)) {
                isWindow = false;
                if (isFunction(xStep) || isFunction(xFinal)) {
                    toss("Ambiguous arguments: scalar or aggregate?");
                }
                xStep = xFinal = null;
            } else if (isFunction(xStep)) {
                if (!isFunction(xFinal)) {
                    toss(
                        "Missing xFinal() callback for aggregate or window UDF."
                    );
                }
                xFunc = null;
            } else if (isFunction(xFinal)) {
                toss(
                    "Missing xStep() callback for aggregate or window UDF."
                );
            } else {
                toss("Missing function-type properties.");
            }

            if (isWindow === false) {
                if (isFunction(xValue) || isFunction(xInverse)) {
                    toss(
                        "xValue and xInverse are not permitted for non-window UDFs."
                    );
                }
            } else if (isFunction(xValue)) {
                if (!isFunction(xInverse)) {
                    toss("xInverse must be provided if xValue is.");
                }
                isWindow = true;
            } else if (isFunction(xInverse)) {
                toss("xValue must be provided if xInverse is.");
            }

            const pApp = opt.pApp;
            if (
                pApp !== undefined &&
                pApp !== null &&
                (typeof pApp !== "number" || !util.isInt32(pApp))
            ) {
                toss(
                    "Invalid value for pApp property. Must be a legal WASM pointer value."
                );
            }

            const xDestroy = opt.xDestroy || 0;
            if (xDestroy && !isFunction(xDestroy)) {
                toss("xDestroy property must be a function.");
            }

            let functionFlags = 0;
            if (Object.prototype.hasOwnProperty.call(opt, "deterministic")) {
                functionFlags |= capi.SQLITE_DETERMINISTIC;
            }
            if (Object.prototype.hasOwnProperty.call(opt, "directOnly")) {
                functionFlags |= capi.SQLITE_DIRECTONLY;
            }
            if (Object.prototype.hasOwnProperty.call(opt, "innocuous")) {
                functionFlags |= capi.SQLITE_INNOCUOUS;
            }

            const aritySource = xFunc || xStep;
            const arity = Object.prototype.hasOwnProperty.call(opt, "arity")
                ? opt.arity
                : aritySource.length
                ? aritySource.length - 1
                : 0;

            let rc;
            const pointer = pointerOf(this);
            const lowerName = name.toLowerCase();
            if (isWindow) {
                rc = capi.sqlite3_create_window_function(
                    pointer,
                    lowerName,
                    arity,
                    capi.SQLITE_UTF8 | functionFlags,
                    pApp || 0,
                    xStep,
                    xFinal,
                    xValue,
                    xInverse,
                    xDestroy
                );
            } else {
                rc = capi.sqlite3_create_function_v2(
                    pointer,
                    lowerName,
                    arity,
                    capi.SQLITE_UTF8 | functionFlags,
                    pApp || 0,
                    xFunc,
                    xStep,
                    xFinal,
                    xDestroy
                );
            }

            context.checkRc(this, rc);
            return this;
        }

        /**
         * Executes a query returning a single value.
         *
         * @param {string} sql - SQL text.
         * @param {any} bind - Bind specification.
         * @param {number} [asType] - Column type hint.
         * @returns {any} Selected value.
         */
        selectValue(sql, bind, asType) {
            return selectFirstRow(this, sql, bind, 0, asType);
        }

        /**
         * Executes a query returning the first column across rows.
         *
         * @param {string} sql - SQL text.
         * @param {any} bind - Bind specification.
         * @param {number} [asType] - Type hint.
         * @returns {Array<any>} Values.
         */
        selectValues(sql, bind, asType) {
            const stmt = this.prepare(sql);
            const results = [];
            try {
                stmt.bind(bind);
                while (stmt.step()) {
                    results.push(stmt.get(0, asType));
                }
                stmt.reset();
            } finally {
                stmt.finalize();
            }
            return results;
        }

        /**
         * Returns the first row as an array.
         *
         * @param {string} sql - SQL text.
         * @param {any} bind - Bind specification.
         * @returns {Array<any>|undefined} Row.
         */
        selectArray(sql, bind) {
            return selectFirstRow(this, sql, bind, []);
        }

        /**
         * Returns the first row as an object.
         *
         * @param {string} sql - SQL text.
         * @param {any} bind - Bind specification.
         * @returns {object|undefined} Row.
         */
        selectObject(sql, bind) {
            return selectFirstRow(this, sql, bind, {});
        }

        /**
         * Collects all rows as arrays.
         *
         * @param {string} sql - SQL text.
         * @param {any} bind - Bind specification.
         * @returns {Array<Array<any>>} Rows.
         */
        selectArrays(sql, bind) {
            return selectAllRows(this, sql, bind, "array");
        }

        /**
         * Collects all rows as objects.
         *
         * @param {string} sql - SQL text.
         * @param {any} bind - Bind specification.
         * @returns {Array<object>} Rows.
         */
        selectObjects(sql, bind) {
            return selectAllRows(this, sql, bind, "object");
        }

        /**
         * Returns the number of currently open statements.
         *
         * @returns {number} Count.
         */
        openStatementCount() {
            return pointerOf(this)
                ? Object.values(stmtMap.get(this)).filter(Boolean).length
                : 0;
        }

        /**
         * Executes a callback inside a transaction.
         *
         * @param {Function} callback - Callback receiving the DB instance.
         * @returns {any} Value returned by callback.
         */
        transaction(callback) {
            let opener = "BEGIN";
            if (arguments.length > 1) {
                if (/[^a-zA-Z]/.test(arguments[0])) {
                    toss(
                        capi.SQLITE_MISUSE,
                        "Invalid argument for BEGIN qualifier."
                    );
                }
                opener += ` ${arguments[0]}`;
                callback = arguments[1];
            }

            this.exec(opener);
            try {
                const rc = callback(this);
                this.exec("COMMIT");
                return rc;
            } catch (error) {
                this.exec("ROLLBACK");
                throw error;
            }
        }

        /**
         * Executes a callback inside a savepoint transaction.
         *
         * @param {Function} callback - Callback receiving the DB instance.
         * @returns {any} Value returned by callback.
         */
        savepoint(callback) {
            this.exec("SAVEPOINT oo1");
            try {
                const rc = callback(this);
                this.exec("RELEASE oo1");
                return rc;
            } catch (error) {
                this.exec("ROLLBACK to SAVEPOINT oo1; RELEASE SAVEPOINT oo1");
                throw error;
            }
        }

        /**
         * Convenience wrapper around the shared result-code checker.
         *
         * @param {number} resultCode - sqlite result code.
         * @returns {Database} Fluent reference.
         */
        checkRc(resultCode) {
            context.checkRc(this, resultCode);
            return this;
        }

        /**
         * Exposes the internal statement registry (for tests).
         *
         * @returns {object} Statement registry keyed by native pointer.
         */
        _getStatementRegistry() {
            return stmtMap.get(this);
        }

        /**
         * Exposes low-level pointer map (for tests).
         *
         * @returns {number|undefined} Native sqlite pointer.
         */
        _pointer() {
            return pointerOf(this);
        }
    }

    Database.dbCtorHelper = dbCtorHelper;
    Database.checkRc = (dbOrPtr, rc) => context.checkRc(dbOrPtr, rc);

    return { Database, Statement, ensureDbOpen };
}

/**
 * Defines the public `pointer` accessor on the database and statement classes.
 *
 * @param {object} context - Runtime context.
 * @param {typeof Database} Database - Database class.
 * @param {typeof Statement} Statement - Statement class.
 */
export function definePointerAccessors(context, Database, Statement) {
    const { ptrMap, toss } = context;
    const pointerDescriptor = {
        enumerable: true,
        configurable: false,
        get() {
            return ptrMap.get(this);
        },
        set() {
            toss("The pointer property is read-only.");
        },
    };

    Object.defineProperty(Statement.prototype, "pointer", pointerDescriptor);
    Object.defineProperty(Database.prototype, "pointer", pointerDescriptor);
}
