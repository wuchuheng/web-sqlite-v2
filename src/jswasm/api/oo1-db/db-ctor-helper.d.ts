import type { DB } from "../../sqlite3.d.ts";
import type { Oo1Context, VfsPostOpenCallback } from "./context.d.ts";

/**
 * Normalized constructor options accepted by the OO1 database helper.
 */
export interface NormalizedDbArgs {
    /** Database filename or pointer to a filename string. */
    filename: string | number;
    /** Flag string describing the desired open mode. */
    flags: string;
    /** Optional VFS identifier supplied to sqlite3_open_v2. */
    vfs: string | number | null;
}

/**
 * Constructor helper responsible for opening database connections and binding
 * them to OO1 `DB` instances.
 */
export interface DbCtorHelper {
    (
        this: DB,
        options: Partial<NormalizedDbArgs> | string | number,
        flags?: string,
        vfs?: string | number | null
    ): void;
    (
        this: DB,
        filename?: string | number,
        flags?: string,
        vfs?: string | number | null
    ): void;
    /** Normalizes constructor arguments into a consistent options object. */
    normalizeArgs(
        options?: Partial<NormalizedDbArgs> | string | number,
        flags?: string,
        vfs?: string | number | null
    ): NormalizedDbArgs;
    /** Registers a callback executed after a database opens for a given VFS. */
    setVfsPostOpenCallback(
        vfsPointer: number,
        callback: VfsPostOpenCallback | string
    ): void;
}

/**
 * Builds the helper that OO1 database constructors delegate to.
 */
export declare function createDbCtorHelper(context: Oo1Context): DbCtorHelper;
