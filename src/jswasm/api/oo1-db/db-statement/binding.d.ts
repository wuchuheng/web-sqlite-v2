import type { BindValue, Stmt } from "../../../sqlite3.d.ts";
import type { Oo1Context } from "../context.d.ts";
import type { ValidationHelpers } from "./validation.d.ts";

/**
 * Mapping of bindable JavaScript value categories to native binding codes.
 */
export interface BindTypeMap {
    /** Null-like values (null/undefined). */
    null: number;
    /** Numeric values (number/bigint). */
    number: number;
    /** String values. */
    string: number;
    /** Boolean values. */
    boolean: number;
    /** Binary blobs. */
    blob: number;
    /** Optional mapping used when BigInt support is enabled. */
    bigint?: number;
    /** Alias ensuring undefined resolves to the null handler. */
    undefined: number;
}

/**
 * Helper methods for statement parameter binding.
 */
export interface BindingHelpers {
    /** Exposed enum of bind types recognised by the helper. */
    BindTypes: BindTypeMap;
    /** Classifies a JavaScript value into one of the known bind types. */
    determineBindType(value: BindValue | ArrayBufferView | ArrayBuffer): number | undefined;
    /** Ensures a value is bindable and returns the resolved bind type. */
    ensureSupportedBindType(value: BindValue | ArrayBufferView | ArrayBuffer): number;
    /** Binds a string or blob value using the provided native pointer. */
    bindString(
        stmtPointer: number,
        index: number,
        value: string,
        asBlob: boolean
    ): number;
    /** Binds a single value to a statement parameter, returning the statement. */
    bindSingleValue(
        stmt: Stmt,
        index: number | string,
        bindType: number,
        value: BindValue | ArrayBufferView | ArrayBuffer
    ): Stmt;
}

/**
 * Creates the parameter binding helpers used by the Statement implementation.
 */
export declare function createBindingHelpers(
    context: Oo1Context,
    validators: ValidationHelpers
): BindingHelpers;
