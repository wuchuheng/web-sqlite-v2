import type { SQLite3API } from "../../sqlite3.d.ts";

/**
 * Metadata tracked for each open database handle.
 */
export interface DbCleanupMetadata {
    /** Registered collation names. */
    collation?: Set<string>;
    /** Scalar/aggregate UDF arity map keyed by lowercase function name. */
    udf?: Map<string, Set<number>>;
    /** Window UDF arity map keyed by lowercase function name. */
    wudf?: Map<string, Set<number>>;
}

/**
 * Cleanup map responsible for tracking hooks, UDFs, and collations so they can
 * be released when a database connection closes.
 */
export interface DbCleanupMap {
    (pDb: number | object, mode?: number): DbCleanupMetadata | undefined;
    /** Records a collation that should be removed during cleanup. */
    addCollation(pDb: number | object, name: string | number): void;
    /** Records a user-defined function and its arity. */
    addFunction(pDb: number | object, name: string | number, arity: number): void;
    /** Records a window function and its arity when available. */
    addWindowFunc?(pDb: number | object, name: string | number, arity: number): void;
    /** Tears down hooks, UDFs, and collations for the given database pointer. */
    cleanup(pDb: number | object): void;
}

/**
 * Creates a database cleanup manager bound to the wasm/capi helpers.
 */
export declare function createDbCleanup(
    wasm: SQLite3API["wasm"],
    capi: SQLite3API["capi"]
): DbCleanupMap;
