import type { Oo1Context } from "../context.d.ts";
import type { DbCtorHelper } from "../db-ctor-helper.d.ts";
import type { DatabaseClass } from "./database.d.ts";
import type { StatementClass } from "./statement.d.ts";
import type { ValidationHelpers } from "./validation.d.ts";

/** Result of {@link createDbClasses}, bundling the OO1 classes and helpers. */
export interface DbClassesResult {
    /** Database class constructor. */
    Database: DatabaseClass;
    /** Statement class constructor. */
    Statement: StatementClass;
    /** Helper that ensures DB handles are open. */
    ensureDbOpen: ValidationHelpers["ensureDbOpen"];
}

/**
 * Builds the Database and Statement classes for the OO1 API along with helper
 * utilities used by other modules.
 */
export declare function createDbClasses(
    context: Oo1Context,
    dbCtorHelper: DbCtorHelper
): DbClassesResult;

/**
 * Defines pointer accessors on the Database and Statement prototypes for
 * compatibility with upstream sqlite3.js semantics.
 */
export declare function definePointerAccessors(
    context: Oo1Context,
    Database: DatabaseClass,
    Statement: StatementClass
): void;
