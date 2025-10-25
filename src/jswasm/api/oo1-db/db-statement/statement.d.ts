import type { Oo1Context } from "../context.d.ts";
import type { StatementValidators } from "./validation.d.ts";
import type { BindHelpers, BindSpecification } from "./binding.d.ts";
import type { DB } from "./database.d.ts";

/**
 * Prepared statement wrapper installed at `sqlite3.oo1.Stmt`.
 */
export class Stmt {
  /** Underlying SQL text. */
  readonly sql: string;
  /** Owning database connection. */
  readonly db: DB;
  /** Native pointer for the prepared statement. */
  readonly pointer: number;
  /** Number of result columns. */
  readonly columnCount: number;
  /** Number of bindable parameters. */
  readonly parameterCount: number;

  /** Internal constructor signature. */
  constructor(db: DB, pointer: number, token: symbol);

  /** Finalise the statement and release resources. */
  finalize(): void;
  /** Remove all parameter bindings. */
  clearBindings(): this;
  /** Reset the statement, optionally clearing bindings. */
  reset(alsoClearBinds?: boolean): this;
  /** Bind parameters using positional or named values. */
  bind(...bindArgs: BindSpecification[]): this;
  /** Bind parameters from an array or map. */
  bind(bindArgs: BindSpecification): this;
  /** Bind a value at a specific index or parameter name. */
  bind(index: number | string, value: BindSpecification): this;
  /** Force a value to be bound as a blob. */
  bindAsBlob(index: number | string, value: BindSpecification): this;
  /** Execute one step of the statement. */
  step(): boolean;
  /** Execute {@link Stmt.step} and immediately reset. */
  stepReset(): this;
  /** Execute {@link Stmt.step} and immediately finalize. */
  stepFinalize(): this;
  /** Retrieve column data. */
  get(index: number): unknown;
  /** Retrieve all columns into an array or object. */
  get(
    target: unknown[] | Record<string, unknown>,
  ): unknown[] | Record<string, unknown>;
  /** Retrieve named column. */
  getColumnName(index: number): string;
  /** Retrieve all column names. */
  getColumnNames(): string[];
}

/**
 * Creates the Statement class exposed through `sqlite3.oo1.Stmt`.
 */
export function createStatementClass(
  context: Oo1Context,
  validators: StatementValidators,
  bindHelpers: BindHelpers,
  constructorToken: symbol,
): typeof Stmt;
