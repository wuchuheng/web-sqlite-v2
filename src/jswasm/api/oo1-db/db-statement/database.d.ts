import type { DB, ExecOptions, SQLite3CAPI } from "../../../sqlite3.d.ts";
import type { Oo1Context } from "../context.d.ts";
import type { DbCtorHelper } from "../db-ctor-helper.d.ts";
import type { ExecHelpers } from "./execution.d.ts";
import type { StatementClass } from "./statement.d.ts";
import type { ValidationHelpers } from "./validation.d.ts";

/** Constructor type returned by {@link createDatabaseClass}. */
export type DatabaseClass = typeof DB;

/**
 * Composite helpers installed on the Database prototype for select methods.
 */
export interface DatabaseSelectHelpers {
    /** Selects a single scalar value. */
    selectValue<T = unknown>(sql: string, bind?: ExecOptions["bind"], asType?: number): T;
    /** Selects multiple scalar values from the first column. */
    selectValues<T = unknown[]>(sql: string, bind?: ExecOptions["bind"], asType?: number): T;
    /** Selects the first row as an array. */
    selectArray<T = unknown[]>(sql: string, bind?: ExecOptions["bind"]): T;
    /** Selects the first row as an object map. */
    selectObject<T = Record<string, unknown>>(sql: string, bind?: ExecOptions["bind"]): T;
    /** Selects all rows as arrays. */
    selectArrays<T = unknown[][]>(sql: string, bind?: ExecOptions["bind"]): T;
    /** Selects all rows as objects. */
    selectObjects<T = Record<string, unknown>[]>(sql: string, bind?: ExecOptions["bind"]): T;
}

/**
 * Creates the Database class bound to the provided helpers.
 */
export declare function createDatabaseClass(
    context: Oo1Context,
    dbCtorHelper: DbCtorHelper,
    validators: ValidationHelpers,
    execHelpers: ExecHelpers,
    Statement: StatementClass,
    statementToken: symbol
): DatabaseClass & {
    prototype: DB & DatabaseSelectHelpers & {
        /** Statement registry shared with the context map. */
        onclose?: {
            before?: (db: DB) => void;
            after?: (db: DB) => void;
        };
        /** Busy-wait trace helper installed when requested. */
        dbTraceLogger?: number;
    };
    /** Underlying constructor helper exposed for integration helpers. */
    dbCtorHelper: DbCtorHelper;
    /** Reference to the shared validators for consumers needing ensureDbOpen. */
    ensureDbOpen: ValidationHelpers["ensureDbOpen"];
    /** Exposed C API reference for integration tests. */
    capi: SQLite3CAPI;
};
