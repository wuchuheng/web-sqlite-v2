import type { DB, ExecOptions, Stmt } from "../../../sqlite3.d.ts";
import type { Oo1Context } from "../context.d.ts";

/**
 * Normalized execution plan derived from {@link DB#exec} arguments.
 */
export interface NormalizedExecPlan {
    /** Final SQL text to execute. */
    sql: string;
    /** Mutable options bag consumed by exec(). */
    opt: ExecOptions & {
        resultRows?: unknown[];
        saveSql?: string[];
        callback?: (row: unknown, stmt: Stmt) => boolean | void;
    };
    /** Builder that supplies the exec() return value. */
    returnVal(): DB | unknown[] | string[];
    /** Optional callback argument builder used while iterating rows. */
    cbArg?: (stmt: Stmt, cache: Record<string, unknown>) => unknown;
}

/**
 * Execution helper functions that back the high-level convenience APIs on
 * {@link DB}.
 */
export interface ExecHelpers {
    /** Executes the SQL and returns only the first row result. */
    selectFirstRow<TArgs extends unknown[]>(
        db: DB,
        sql: string,
        bind: ExecOptions["bind"],
        ...getArgs: TArgs
    ): ReturnType<Stmt["get"]> | undefined;
    /** Executes the SQL and returns every row using the configured row mode. */
    selectAllRows(
        db: DB,
        sql: string,
        bind: ExecOptions["bind"],
        rowMode: NonNullable<ExecOptions["rowMode"]>
    ): Array<ReturnType<Stmt["get"]>>;
    /** Parses exec() arguments into a normalized execution plan. */
    parseExecPlan(
        db: DB,
        args: ReadonlyArray<
            | string
            | ExecOptions
            | Array<unknown>
            | ArrayBufferView
            | ArrayBuffer
        >
    ): NormalizedExecPlan;
}

/**
 * Creates the execution helper utilities used by the Database class.
 */
export declare function createExecHelpers(context: Oo1Context): ExecHelpers;
