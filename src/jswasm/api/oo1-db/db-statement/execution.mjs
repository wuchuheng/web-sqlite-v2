/**
 * @fileoverview Execution and query helpers for Database.exec() and select methods.
 */

/**
 * Creates execution and query helper functions.
 *
 * @param {import("../context.d.ts").Oo1Context} context Shared runtime context.
 * @returns {import("./execution.d.ts").ExecHelpers} Execution helper functions.
 */
export function createExecHelpers(context) {
    const { capi, util, toss } = context;

    /**
     * Executes a query and returns the first row.
     *
     * @param {import("@wuchuheng/web-sqlite").DB} db - Database instance.
     * @param {string} sql - SQL text.
     * @param {import("./binding.d.ts").BindSpecification | undefined} bind
     *        Bind specification.
     * @param {...Parameters<import("@wuchuheng/web-sqlite").Stmt["get"]>} getArgs
     *        Arguments to pass to stmt.get().
     * @returns {ReturnType<import("@wuchuheng/web-sqlite").Stmt["get"]> | undefined}
     *          First row or undefined.
     */
    const selectFirstRow = (db, sql, bind, ...getArgs) => {
        // 1. Input handling
        const stmt = db.prepare(sql);

        try {
            // 2. Core processing
            const hasRow = stmt.bind(bind).step();
            const result = hasRow ? stmt.get(...getArgs) : undefined;
            stmt.reset();

            // 3. Output handling
            return result;
        } finally {
            stmt.finalize();
        }
    };

    /**
     * Executes a query and collects all rows.
     *
     * @param {import("@wuchuheng/web-sqlite").DB} db - Database instance.
     * @param {string} sql - SQL text.
     * @param {import("./binding.d.ts").BindSpecification | undefined} bind
     *        Bind specification.
     * @param {string} rowMode - Row mode (array/object).
     * @returns {unknown[]} All result rows.
     */
    const selectAllRows = (db, sql, bind, rowMode) => {
        const result = db.exec({
            sql,
            bind,
            rowMode,
            returnValue: "resultRows",
        });
        return (result && result.resultRows) || [];
    };

    /**
     * Parses and validates exec() arguments into a normalized plan.
     *
     * @param {import("@wuchuheng/web-sqlite").DB} db - Database instance.
     * @param {ReadonlyArray<import("./execution.d.ts").ExecInvocationArgument>} args
     *        Arguments passed to exec().
     * @returns {import("./execution.d.ts").NormalizedExecPlan} Normalized execution plan.
     */
    const parseExecPlan = (db, args) => {
        // 1. Input handling
        const plan = {
            opt: Object.create(null),
            returnVal: () => db,
            multi: true,
            saveSql: undefined,
        };

        // 1.1 Parse arguments
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

        // 1.2 Validate SQL
        plan.sql = util.flexibleString(plan.sql);
        if (typeof plan.sql !== "string") {
            toss("Missing SQL argument or unsupported SQL value type.");
        }

        // 2. Core processing
        const opt = plan.opt;
        plan.multi = opt.multi !== false;
        plan.saveSql = Array.isArray(opt.saveSql) ? opt.saveSql : undefined;

        const createExecResult = () => {
            const result = {
                resultRows: plan.resultRows || [],
            };
            if (plan.saveSql) {
                result.saveSql = plan.saveSql;
            }
            return result;
        };

        const ensureResultCollector = () => {
            if (!plan.resultRows) {
                plan.resultRows = Array.isArray(opt.resultRows)
                    ? opt.resultRows
                    : [];
            }
        };

        // 2.1 Configure return value strategy
        if (Array.isArray(opt.resultRows)) {
            ensureResultCollector();
        }

        if (opt.returnValue !== undefined) {
            if (opt.returnValue === "resultRows") {
                ensureResultCollector();
                plan.returnVal = createExecResult;
            } else {
                toss("Invalid returnValue value:", opt.returnValue);
            }
        }

        // 2.2 Auto-enable resultRows when rowMode is set without callback
        if (
            !opt.callback &&
            opt.returnValue === undefined &&
            opt.rowMode !== undefined
        ) {
            ensureResultCollector();
            plan.returnVal = createExecResult;
        }

        // 2.3 Configure row callback argument builder
        if (opt.callback || plan.resultRows) {
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
                    if (plan.resultRows) {
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

        // 3. Output handling
        return plan;
    };

    return {
        selectFirstRow,
        selectAllRows,
        parseExecPlan,
    };
}
