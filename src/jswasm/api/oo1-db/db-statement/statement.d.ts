import type { Stmt } from "@wuchuheng/web-sqlite";
import type { Oo1Context } from "../context.d.ts";
import type { StatementValidators } from "./validation.d.ts";
import type { BindHelpers } from "./binding.d.ts";

/**
 * Creates the Statement class exposed through sqlite3.oo1.Stmt.
 */
export function createStatementClass(
    context: Oo1Context,
    validators: StatementValidators,
    bindHelpers: BindHelpers,
    constructorToken: symbol
): typeof Stmt;
