import type { DB, Stmt } from "../../../sqlite3.d.ts";
import type { Oo1Context } from "../context.d.ts";

/**
 * Collection of validation helpers shared by the Database and Statement
 * implementations.
 */
export interface ValidationHelpers {
    /** Resolves the native pointer for a database or statement wrapper. */
    pointerOf(target: DB | Stmt | object): number | undefined;
    /** Ensures the provided database instance still has an open handle. */
    ensureDbOpen<T extends DB>(db: T): T;
    /** Ensures the provided statement instance still has an open handle. */
    ensureStmtOpen<T extends Stmt>(stmt: T): T;
    /** Guards that the statement is not locked by an in-flight exec() call. */
    ensureNotLockedByExec<T extends Stmt>(stmt: T, operation: string): T;
    /** Validates and returns a zero-based column index. */
    resolveColumnIndex(stmt: Stmt, index: number): number;
    /** Resolves a parameter name or index to a 1-based bind index. */
    resolveParameterIndex(stmt: Stmt, key: number | string): number;
}

/**
 * Creates the validation helper set used by the OO1 database classes.
 */
export declare function createValidationHelpers(
    context: Oo1Context
): ValidationHelpers;
