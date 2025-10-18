import type { DB, Stmt } from "@wuchuheng/web-sqlite";
import type { Oo1Context } from "../context.d.ts";
import type { DbCtorHelper } from "../db-ctor-helper.d.ts";
import type { StatementValidators } from "./validation.d.ts";
import type { ExecHelpers } from "./execution.d.ts";

/**
 * Creates the Database class exposed through sqlite3.oo1.DB.
 */
export function createDatabaseClass(
    context: Oo1Context,
    dbCtorHelper: DbCtorHelper,
    validators: StatementValidators,
    execHelpers: ExecHelpers,
    Statement: typeof Stmt,
    statementToken: symbol
): typeof DB;
