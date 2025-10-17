import type { Stmt } from "../../../sqlite3.d.ts";
import type { Oo1Context } from "../context.d.ts";
import type { BindingHelpers } from "./binding.d.ts";
import type { ValidationHelpers } from "./validation.d.ts";

/**
 * Runtime Statement constructor type exposed by the OO1 API.
 */
export type StatementClass = typeof Stmt;

/**
 * Builds the Statement class implementation backed by the refactored helpers.
 */
export declare function createStatementClass(
    context: Oo1Context,
    validators: ValidationHelpers,
    bindHelpers: BindingHelpers,
    constructorToken: symbol
): StatementClass;
