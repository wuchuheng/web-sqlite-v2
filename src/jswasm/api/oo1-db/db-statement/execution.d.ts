import type { DB, ExecOptions, Stmt } from "@wuchuheng/web-sqlite";
import type { Oo1Context } from "../context.d.ts";
import type { BindSpecification } from "./binding.d.ts";

/** SQL payloads accepted by {@link import("@wuchuheng/web-sqlite").DB.exec}. */
export type ExecSqlSource =
    | string
    | Uint8Array
    | Int8Array
    | ArrayBuffer
    | string[];

/** Individual argument supported by {@link import("@wuchuheng/web-sqlite").DB.exec}. */
export type ExecInvocationArgument = ExecSqlSource | ExecOptions;

/** Normalised execution plan produced by {@link createExecHelpers}. */
export interface NormalizedExecPlan {
    /** SQL payload to execute (string or typed array). */
    sql: string | Uint8Array | Int8Array | ArrayBuffer;
    /** Mutable exec options bag used during execution. */
    opt: ExecOptions;
    /** Whether multi-statement execution remains enabled. */
    multi: boolean;
    /** Accumulator for collected result rows. */
    resultRows?: unknown[];
    /** Collected SQL text when requested. */
    saveSql?: string[];
    /** Computes the exec() return value once processing completes. */
    returnVal(): unknown;
    /** Optional builder that materialises row callback arguments. */
    cbArg?: (statement: Stmt, cache: Record<string, unknown>) => unknown;
}

/** Collection of execution helpers used by the Database class. */
export interface ExecHelpers {
    /** Executes SQL and returns the first row if present. */
    selectFirstRow(
        db: DB,
        sql: string,
        bind?: BindSpecification,
        ...getArgs: Parameters<Stmt["get"]>
    ): ReturnType<Stmt["get"]> | undefined;
    /** Executes SQL and collects all result rows. */
    selectAllRows(
        db: DB,
        sql: string,
        bind: BindSpecification | undefined,
        rowMode: ExecOptions["rowMode"]
    ): unknown[];
    /** Parses exec() arguments into a normalised execution plan. */
    parseExecPlan(
        db: DB,
        args: ReadonlyArray<ExecInvocationArgument>
    ): NormalizedExecPlan;
}

/**
 * Constructs execution helpers for the Database facade.
 */
export function createExecHelpers(context: Oo1Context): ExecHelpers;
