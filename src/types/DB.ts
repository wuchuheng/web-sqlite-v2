/**
 * A value which can be bound to a SQLite parameter.
 */
export type SqlValue =
  | null
  | number
  | string
  | boolean
  | bigint
  | Uint8Array
  | ArrayBuffer;

/** A bindable parameter collection: positional or named. */
export type SQLParams = SqlValue[] | Record<string, SqlValue>;

export type ExecParams = { sql: string; bind?: SQLParams };

/**
 * Metadata returned for non-query statements.
 * @property changes Number of rows changed by last operation (may be bigint on some builds).
 * @property lastInsertRowid Last inserted row id when applicable.
 */
export type ExecResult = {
  changes?: number | bigint;
  lastInsertRowid?: number | bigint;
};

/**
 * A prepared statement client wrapper.
 * @remarks The `stmtId` is optional and intended for debugging only; callers should not depend on it.
 */
export interface PreparedStatement {
  /**
   * Execute a SQL script (one or more statements) without returning rows.
   * Intended for migrations, schema setup, or bulk SQL execution.
   * @param sql - SQL string to execute.
   * @param params - Optional bind parameters for the statement.
   */
  exec(sql: string, params?: SQLParams): Promise<ExecResult>;

  /**
   * Execute a query and return all result rows as an array of objects.
   * @param sql - SELECT SQL to execute.
   * @param params - Optional bind parameters for the query.
   */
  query<T = unknown>(sql: string, params?: SQLParams): Promise<T[]>;

  /** Reset the statement cursor to allow re-execution with different parameters. */
  reset(): Promise<void>;

  /** Finalize the statement and release worker-side resources. Idempotent. */
  finalize(): Promise<void>;

  /** Optional debug-only statement id returned by the worker when the statement was prepared. */
  readonly stmtId?: number;
}

/** Primary DB interface used by client code. */
export interface DBInterface {
  /**
   * Execute a SQL script (one or more statements) without returning rows.
   * Intended for migrations, schema setup, or bulk SQL execution.
   * @param sql - SQL string to execute.
   * @param params - Optional bind parameters for the statement.
   */
  exec(sql: string, params?: SQLParams): Promise<ExecResult>;

  /**
   * Execute a query and return all result rows as an array of objects.
   * @param sql - SELECT SQL to execute.
   * @param params - Optional bind parameters for the query.
   */
  query<T = unknown>(sql: string, params?: SQLParams): Promise<T[]>;

  /**
   * Run a callback inside a transaction. The implementation should BEGIN before calling `fn`
   * and COMMIT on success or ROLLBACK on error.
   * @param fn - Callback that receives a DBInterface and performs transactional work.
   */
  transaction<T>(fn: transactionCallback<T>): Promise<T>;

  /** Close the database and release resources. */
  close(): Promise<void>;
}

export type transactionCallback<T> = (
  db: Pick<DBInterface, "exec" | "query">
) => Promise<T>;
