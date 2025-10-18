import type { Stmt } from "@wuchuheng/web-sqlite";
import type { Oo1Context } from "../context.d.ts";
import type { StatementValidators } from "./validation.d.ts";

/** Numerical identifiers describing supported bind value categories. */
export interface BindTypeMap {
    readonly null: number;
    readonly number: number;
    readonly string: number;
    readonly boolean: number;
    readonly blob: number;
    readonly undefined: number;
    readonly bigint?: number;
}

/** Binding helper collection returned by {@link createBindingHelpers}. */
export interface BindHelpers {
    /** Enumeration of supported bind kinds. */
    readonly BindTypes: BindTypeMap;
    /** Classifies a value into a bind category or returns undefined. */
    determineBindType(value: unknown): number | undefined;
    /** Validates a value can be bound and returns the bind category. */
    ensureSupportedBindType(value: unknown): number;
    /** Binds a UTF-8 string or blob to a prepared statement parameter. */
    bindString(
        statementPointer: number,
        index: number,
        value: string,
        asBlob: boolean
    ): number;
    /** Binds a single value to the supplied statement. */
    bindSingleValue(
        statement: Stmt,
        index: number | string,
        bindType: number,
        value: unknown
    ): Stmt;
}

/**
 * Creates helper routines for statement parameter binding.
 */
export function createBindingHelpers(
    context: Oo1Context,
    validators: StatementValidators
): BindHelpers;
