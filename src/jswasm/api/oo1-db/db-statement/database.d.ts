import type { Oo1Context } from "../context.d.ts";
import type { DbCtorHelper } from "../db-ctor-helper.d.ts";
import type { StatementValidators } from "./validation.d.ts";
import type { ExecHelpers } from "./execution.d.ts";
import type { Stmt } from "./statement.d.ts";

/** Row mode options accepted by {@link ExecOptions}. */
export type ExecRowMode = "array" | "object" | "stmt";

/**
 * Options object accepted by {@link DB.exec}.
 */
export interface ExecOptions {
  /** Bind values for positional or named parameters. */
  bind?: unknown[] | Record<string, unknown>;
  /** Callback invoked for each row in the result set. */
  callback?: (row: unknown, stmt: Stmt) => unknown;
  /** Result row materialisation strategy. */
  rowMode?: ExecRowMode;
  /** Explicit column names when using object mode. */
  columnNames?: string[];
  /** Configure {@link DB.exec} to return all rows. */
  returnValue?: "resultRows";
  /** Disable multi-statement execution when `false`. */
  multi?: boolean;
}

/**
 * Result returned by {@link DB.exec} when configured to collect rows.
 */
export interface ExecResult {
  /** Array of collected result rows. */
  resultRows?: unknown[];
}

/**
 * High-level database wrapper installed at `sqlite3.oo1.DB`.
 */
export class DB {
  /** Helper used internally by {@link DB} constructors. */
  static dbCtorHelper: DbCtorHelper;
  /** Shared result-code checker. */
  static checkRc(db: DB | number, resultCode: number): void;

  /** Database filename (e.g. `":memory:"`, OPFS path, kvvfs bucket). */
  readonly filename: string;
  /** Low-level pointer to the native sqlite3 handle. */
  readonly pointer: number;
  /** Indicates whether the database handle is open. */
  readonly isOpen: boolean;

  /**
   * Create a new database connection.
   */
  constructor(filename?: string, flags?: string, vfs?: string | null);
  constructor(config: {
    filename?: string;
    flags?: string;
    vfs?: string | null;
  });

  /** Execute SQL with optional result handling. */
  exec(sql: string, options?: ExecOptions): this | ExecResult;
  /** Execute SQL using an options bag. */
  exec(options: ExecOptions): this | ExecResult;
  /** Prepare SQL into a reusable statement. */
  prepare(sql: string): Stmt;
  /** Execute a callback inside a transaction. */
  transaction<T>(callback: () => T): T;
  /** Execute a callback inside a transaction with qualifier. */
  transaction<T>(qualifier: string, callback: () => T): T;
  /** Execute a callback within a savepoint. */
  savepoint<T>(callback: () => T): T;
  /** Return first row as an array. */
  selectArray(sql: string, bind?: ExecOptions["bind"]): unknown[] | undefined;
  /** Return all rows as arrays. */
  selectArrays(sql: string, bind?: ExecOptions["bind"]): unknown[][];
  /** Return first row as an object. */
  selectObject(
    sql: string,
    bind?: ExecOptions["bind"],
  ): Record<string, unknown> | undefined;
  /** Return all rows as objects. */
  selectObjects(
    sql: string,
    bind?: ExecOptions["bind"],
  ): Array<Record<string, unknown>>;
  /** Return first column of the first row. */
  selectValue(sql: string, bind?: ExecOptions["bind"]): unknown;
  /** Number of rows modified by the last statement. */
  changes(total?: boolean, sixtyFour?: boolean): number | bigint;
  /** Close the database handle and free resources. */
  close(): void;
  /** Serialize the database into a Uint8Array. */
  export(): Uint8Array;
}

/**
 * Creates the Database class exposed through `sqlite3.oo1.DB`.
 */
export function createDatabaseClass(
  context: Oo1Context,
  dbCtorHelper: DbCtorHelper,
  validators: StatementValidators,
  execHelpers: ExecHelpers,
  Statement: typeof Stmt,
  statementToken: symbol,
): typeof DB;
