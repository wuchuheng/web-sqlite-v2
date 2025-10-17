import type { SQLite3API } from "../sqlite3.d.ts";
import type { Oo1Context } from "./oo1-db/context.d.ts";
import type { DbCtorHelper } from "./oo1-db/db-ctor-helper.d.ts";
import type { DbClassesResult } from "./oo1-db/db-statement/index.d.ts";

/**
 * Function signature for the OO1 database API installer produced by
 * {@link createInstallOo1DbApiInitializer}.
 */
export type InstallOo1DbApiInitializer = (sqlite3: SQLite3API) => void;

/**
 * Creates the installer that wires the database classes, pointer accessors, and
 * storage helpers onto the {@link SQLite3API#oo1} namespace.
 */
export declare function createInstallOo1DbApiInitializer(): InstallOo1DbApiInitializer;

/**
 * Internal hook describing the pieces assembled by the OO1 DB API.
 */
export interface InstallOo1DbApiArtifacts {
    /** Shared context with helper maps and utilities. */
    context: Oo1Context;
    /** Database constructor helper bound to OO1 state. */
    dbCtorHelper: DbCtorHelper;
    /** Constructed Database and Statement classes with validation helpers. */
    classes: DbClassesResult;
}
