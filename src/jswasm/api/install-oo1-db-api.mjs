export function createInstallOo1DbApiInitializer() {
    return function installOo1DbApi(sqlite3) {
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
    };
}
