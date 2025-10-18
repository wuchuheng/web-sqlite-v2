/**
 * @fileoverview Database class implementation for the OO1 API.
 */

/**
 * Creates the Database class with all its methods.
 *
 * @param {import("../context.d.ts").Oo1Context} context Shared runtime context.
 * @param {import("../db-ctor-helper.d.ts").DbCtorHelper} dbCtorHelper
 *        Constructor helper to open DBs.
 * @param {import("./validation.d.ts").StatementValidators} validators Validation helper functions.
 * @param {import("./execution.d.ts").ExecHelpers} execHelpers Execution helper functions.
 * @param {typeof import("./statement.d.ts").Stmt} Statement Statement class.
 * @param {symbol} statementToken Guard for Statement construction.
 * @returns {typeof import("./database.d.ts").DB} Database class.
 */
export function createDatabaseClass(
    context,
    dbCtorHelper,
    validators,
    execHelpers,
    Statement,
    statementToken
) {
    const { capi, wasm, util, ptrMap, stmtMap, toss } = context;
    const { pointerOf, ensureDbOpen } = validators;
    const { selectFirstRow, selectAllRows, parseExecPlan } = execHelpers;

    /**
     * High-level database wrapper used by sqlite3.oo1.DB.
     *
     * @implements {import("./database.d.ts").DB}
     */
    class Database {
        /**
         * Opens the database using the shared constructor helper.
         *
         * @param {...Parameters<import("../db-ctor-helper.d.ts").DbCtorHelper>} ctorArgs
         *        Database constructor arguments.
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
         * Serialises the database contents into a byte array.
         *
         * @returns {Uint8Array} Database snapshot.
         */
        export() {
            const pointer = pointerOf(ensureDbOpen(this));
            return capi.sqlite3_js_db_export(pointer);
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
            return capi.sqlite3_db_filename(
                pointerOf(ensureDbOpen(this)),
                dbName
            );
        }

        /**
         * Resolves the logical database name for the given attachment index.
         *
         * @param {number} [dbNumber=0] - Attachment index.
         * @returns {string|null} Database name.
         */
        dbName(dbNumber = 0) {
            return capi.sqlite3_db_name(
                pointerOf(ensureDbOpen(this)),
                dbNumber
            );
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
         * @returns {import("./statement.d.ts").Stmt} Prepared statement.
         */
        prepare(sql) {
            // 1. Input handling
            ensureDbOpen(this);
            const stack = wasm.pstack.pointer;
            let stmtPointer;

            try {
                // 2. Core processing
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

            // 3. Output handling
            return new Statement(this, stmtPointer, statementToken);
        }

        /**
         * Executes SQL with optional callbacks, mirroring the original API.
         *
         * @param {string|import("./database.d.ts").ExecOptions} sql - SQL text or options bag.
         * @param {import("./database.d.ts").ExecOptions} [options] - Execution options.
         * @returns {import("./database.d.ts").DB | import("./database.d.ts").ExecResult}
         *     Configured return value.
         */
        exec(sql, options) {
            // 1. Input handling
            ensureDbOpen(this);
            const execArgs =
                arguments.length === 1 &&
                sql &&
                typeof sql === "object" &&
                !Array.isArray(sql)
                    ? [sql]
                    : options === undefined
                    ? [sql]
                    : [sql, options];
            const plan = parseExecPlan(this, execArgs);
            if (!plan.sql) {
                toss("exec() requires an SQL string.");
            }
            const opt = plan.opt;
            const callback = opt.callback;
            const resultRows = plan.resultRows;
            const saveSql = plan.saveSql;
            let statement = null;
            let bindSpec = opt.bind;
            let needFirstEval = Boolean(
                plan.cbArg || opt.columnNames || resultRows
            );
            const stack = wasm.scopedAllocPush();

            try {
                // 2. Core processing
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

                    statement = new Statement(this, pStmt, statementToken);

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
                            for (
                                ;
                                statement.step();
                                statement._lockedByExec = false
                            ) {
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
                                    callback.call(opt, row, statement)
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
                    if (plan.multi === false) {
                        break;
                    }
                }
            } finally {
                wasm.scopedAllocPop(stack);
                if (statement) {
                    delete statement._lockedByExec;
                    statement.finalize();
                }
            }

            // 3. Output handling
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
            // 1. Input handling
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

            // 1.1 Determine function type
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
                toss("Missing xStep() callback for aggregate or window UDF.");
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

            // 1.2 Validate pApp and xDestroy
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

            // 1.3 Build function flags
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

            // 2. Core processing
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

            // 3. Output handling
            return this;
        }

        /**
         * Executes a query returning a single value.
         *
         * @param {string} sql - SQL text.
         * @param {import("./database.d.ts").ExecOptions["bind"]} [bind]
         *        Bind specification.
         * @param {number} [asType] - Column type hint.
         * @returns {unknown} Selected value.
         */
        selectValue(sql, bind, asType) {
            return selectFirstRow(this, sql, bind, 0, asType);
        }

        /**
         * Executes a query returning the first column across rows.
         *
         * @param {string} sql - SQL text.
         * @param {import("./database.d.ts").ExecOptions["bind"]} [bind]
         *        Bind specification.
         * @param {number} [asType] - Type hint.
         * @returns {unknown[]} Values.
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
         * @param {import("./database.d.ts").ExecOptions["bind"]} [bind]
         *        Bind specification.
         * @returns {unknown[]|undefined} Row.
         */
        selectArray(sql, bind) {
            return selectFirstRow(this, sql, bind, []);
        }

        /**
         * Returns the first row as an object.
         *
         * @param {string} sql - SQL text.
         * @param {import("./database.d.ts").ExecOptions["bind"]} [bind]
         *        Bind specification.
         * @returns {Record<string, unknown>|undefined} Row.
         */
        selectObject(sql, bind) {
            return selectFirstRow(this, sql, bind, {});
        }

        /**
         * Collects all rows as arrays.
         *
         * @param {string} sql - SQL text.
         * @param {import("./database.d.ts").ExecOptions["bind"]} [bind]
         *        Bind specification.
         * @returns {unknown[][]} Rows.
         */
        selectArrays(sql, bind) {
            return selectAllRows(this, sql, bind, "array");
        }

        /**
         * Collects all rows as objects.
         *
         * @param {string} sql - SQL text.
         * @param {import("./database.d.ts").ExecOptions["bind"]} [bind]
         *        Bind specification.
         * @returns {Array<Record<string, unknown>>} Rows.
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
         * @param {() => unknown} callback - Callback receiving control within the transaction.
         * @returns {unknown} Value returned by callback.
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
         * @param {() => unknown} callback - Callback receiving control within the savepoint.
         * @returns {unknown} Value returned by callback.
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

    return Database;
}
