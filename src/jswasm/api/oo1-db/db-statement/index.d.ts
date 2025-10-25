import type { DB } from "./database.d.ts";
import type { Stmt } from "./statement.d.ts";
import type { Oo1Context } from "../context.d.ts";
import type { DbCtorHelper } from "../db-ctor-helper.d.ts";
import type { ExecHelpers } from "./execution.d.ts";
import type { BindHelpers } from "./binding.d.ts";
import type { StatementValidators } from "./validation.d.ts";

/** Bundle of Database/Statement classes and supporting utilities. */
export interface DbClassBundle {
  /** Database class implementation. */
  Database: typeof DB;
  /** Statement class implementation. */
  Statement: typeof Stmt;
  /** Validator ensuring a database handle is open. */
  ensureDbOpen<T extends DB>(db: T): T;
}

/**
 * Composes the Database and Statement classes together with their helpers.
 */
export function createDbClasses(
  context: Oo1Context,
  dbCtorHelper: DbCtorHelper,
  validators: StatementValidators,
  bindHelpers: BindHelpers,
  execHelpers: ExecHelpers,
  statementToken: symbol,
): DbClassBundle;

/**
 * Defines the `pointer` accessor on the Database and Statement prototypes.
 */
export function definePointerAccessors(
  context: Oo1Context,
  Database: typeof DB,
  Statement: typeof Stmt,
): void;
