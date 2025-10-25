import type { DB, Stmt } from "@wuchuheng/web-sqlite";
import type { Oo1Context } from "../context.d.ts";

/**
 * Validation and resolution helpers shared between Database and Statement.
 */
export interface StatementValidators {
  /** Retrieves the native pointer for a wrapper instance. */
  pointerOf(
    target: DB | Stmt | { pointer?: number } | object,
  ): number | undefined;
  /** Ensures a database handle is still open. */
  ensureDbOpen<T extends DB>(db: T): T;
  /** Ensures a statement handle is still open. */
  ensureStmtOpen<T extends Stmt>(statement: T): T;
  /** Guards against operations while a statement is locked by exec(). */
  ensureNotLockedByExec<T extends Stmt>(statement: T, operation: string): T;
  /** Resolves a zero-based column index after validation. */
  resolveColumnIndex(statement: Stmt, index: number): number;
  /** Resolves a bind parameter name or index to a 1-based index. */
  resolveParameterIndex(statement: Stmt, key: number | string): number;
}

/**
 * Creates the validation helper collection.
 */
export function createValidationHelpers(
  context: Oo1Context,
): StatementValidators;
