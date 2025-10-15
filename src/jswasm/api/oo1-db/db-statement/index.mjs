/**
 * @fileoverview Main entry point for Database and Statement class creation.
 */

import { createValidationHelpers } from "./validation.mjs";
import { createBindingHelpers } from "./binding.mjs";
import { createExecHelpers } from "./execution.mjs";
import { createStatementClass } from "./statement.mjs";
import { createDatabaseClass } from "./database.mjs";

/** Internal token to prevent external Statement construction. */
const INTERNAL_STATEMENT_TOKEN = Symbol("StatementConstructorGuard");

/**
 * Builds the Database/Statement classes and supporting utilities.
 *
 * @param {object} context - Shared runtime context.
 * @param {Function} dbCtorHelper - Constructor helper to open DBs.
 * @returns {{Database: typeof Database, Statement: typeof Statement, ensureDbOpen: Function}}
 */
export function createDbClasses(context, dbCtorHelper) {
    // 1. Input handling
    const validators = createValidationHelpers(context);
    const bindHelpers = createBindingHelpers(context, validators);
    const execHelpers = createExecHelpers(context);

    // 2. Core processing
    const Statement = createStatementClass(
        context,
        validators,
        bindHelpers,
        INTERNAL_STATEMENT_TOKEN
    );

    const Database = createDatabaseClass(
        context,
        dbCtorHelper,
        validators,
        execHelpers,
        Statement,
        INTERNAL_STATEMENT_TOKEN
    );

    // 3. Output handling
    return { Database, Statement, ensureDbOpen: validators.ensureDbOpen };
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
