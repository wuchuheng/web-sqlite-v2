import type { SQLite3API } from "../../sqlite3.d.ts";
import type { DbCleanupMap } from "./db-cleanup.d.ts";

/**
 * Shared helpers attached to each generated UDF wrapper.
 */
export interface UdfAdapterHelpers {
    /** Assigns a JavaScript value as the function result. */
    udfSetResult(pCtx: number, value: unknown): void;
    /** Converts native sqlite3_value arguments into JavaScript values. */
    udfConvertArgs(argc: number, argv: number): unknown[];
    /** Reports an error back to SQLite. */
    udfSetError(pCtx: number, error: unknown): void;
}

/**
 * Callable wrapper around sqlite3_create_function_v2 with attached helpers.
 */
export interface CreateFunctionV2 extends UdfAdapterHelpers {
    (
        pDb: number,
        name: string,
        arity: number,
        encodingFlags: number,
        pApp: number,
        xFunc: number | ((ctx: number, ...args: unknown[]) => unknown),
        xStep: number | ((ctx: number, ...args: unknown[]) => void),
        xFinal: number | ((ctx: number) => unknown),
        xDestroy: number | ((pApp: number) => void)
    ): number;
}

/** Simplified wrapper for sqlite3_create_function. */
export interface CreateFunction extends UdfAdapterHelpers {
    (
        pDb: number,
        name: string,
        arity: number,
        encodingFlags: number,
        pApp: number,
        xFunc: number | ((ctx: number, ...args: unknown[]) => unknown),
        xStep: number | ((ctx: number, ...args: unknown[]) => void),
        xFinal: number | ((ctx: number) => unknown)
    ): number;
}

/** Window function wrapper mirroring sqlite3_create_window_function. */
export interface CreateWindowFunction extends UdfAdapterHelpers {
    (
        pDb: number,
        name: string,
        arity: number,
        encodingFlags: number,
        pApp: number,
        xStep: number | ((ctx: number, ...args: unknown[]) => void),
        xFinal: number | ((ctx: number) => unknown),
        xValue: number | ((ctx: number) => unknown),
        xInverse: number | ((ctx: number, ...args: unknown[]) => void),
        xDestroy: number | ((pApp: number) => void)
    ): number;
}

/**
 * Aggregate return type from {@link createUdfFactory}.
 */
export interface UdfFactory {
    /** Scalar/aggregate UDF creation helper. */
    sqlite3_create_function_v2: CreateFunctionV2;
    /** Simplified helper that omits the destructor callback. */
    sqlite3_create_function: CreateFunction;
    /** Optional window function helper when supported by the wasm build. */
    sqlite3_create_window_function?: CreateWindowFunction;
}

/**
 * Creates helper wrappers for registering scalar, aggregate, and window UDFs.
 */
export declare function createUdfFactory(
    wasm: SQLite3API["wasm"],
    capi: SQLite3API["capi"],
    dbCleanupMap: DbCleanupMap
): UdfFactory;
