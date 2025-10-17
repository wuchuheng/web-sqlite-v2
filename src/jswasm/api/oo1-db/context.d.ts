import type { DB, SQLite3API, Stmt } from "../../sqlite3.d.ts";

/**
 * Callback invoked immediately after a database backed by a specific VFS has
 * been opened.
 */
export type VfsPostOpenCallback = (db: DB, sqlite3: SQLite3API) => void;

/**
 * Registry mapping native statement pointers to managed {@link Stmt}
 * instances for a single {@link DB} connection.
 */
export type StatementRegistry = Record<number, Stmt | undefined>;

/**
 * Shared context structure threaded through the refactored OO1 helper
 * functions.
 */
export interface Oo1Context {
    /** Root SQLite3 API surface. */
    sqlite3: SQLite3API;
    /** Bound C API helpers. */
    capi: SQLite3API["capi"];
    /** Low-level WASM helpers for memory and pointer work. */
    wasm: SQLite3API["wasm"];
    /** High-level utility helpers. */
    util: SQLite3API["util"];
    /** Weak map tracking JS wrapper instances to native pointers. */
    ptrMap: WeakMap<object, number>;
    /** Weak map tracking active statements per database wrapper. */
    stmtMap: WeakMap<object, StatementRegistry>;
    /** Post-open hooks keyed by VFS pointer. */
    vfsCallbacks: Record<number, VfsPostOpenCallback | string>;
    /** Error helper that always throws a {@link SQLite3API.SQLite3Error}. */
    toss: (...args: Array<string | number | bigint | boolean | Error>) => never;
    /** Result code checker mirroring {@link SQLite3API.SQLite3Error} semantics. */
    checkRc<T>(dbOrPointer: T, resultCode: number): T;
}

/**
 * Creates the shared context consumed throughout the OO1 helpers.
 */
export declare function createOo1Context(sqlite3: SQLite3API): Oo1Context;
