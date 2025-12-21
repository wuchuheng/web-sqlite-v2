/** Primary DB interface used by client code. */
declare interface DBInterface {
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

/**
 * Metadata returned for non-query statements.
 * @property changes Number of rows changed by last operation (may be bigint on some builds).
 * @property lastInsertRowid Last inserted row id when applicable.
 */
declare type ExecResult = {
    changes?: number | bigint;
    lastInsertRowid?: number | bigint;
};

/**
 * Opens a SQLite database connection.
 *
 * @param filename - The path to the SQLite database file to open.
 * @param options - Optional configuration options for opening the database.
 * @returns A promise that resolves to a DBInterface object providing methods to interact with the database.
 *
 * @example
 * ```typescript
 * const db = await openDB('./mydata.db');
 * const results = await db.query('SELECT * FROM users');
 * await db.close();
 * ```
 */
declare const openDB: (filename: string, options?: WorkerOpenDBOptions) => Promise<DBInterface>;
export default openDB;
export { openDB }

/** A bindable parameter collection: positional or named. */
declare type SQLParams = SqlValue[] | Record<string, SqlValue>;

/**
 * A value which can be bound to a SQLite parameter.
 */
declare type SqlValue = null | number | string | boolean | bigint | Uint8Array | ArrayBuffer;

declare type transactionCallback<T> = (db: Pick<DBInterface, "exec" | "query">) => Promise<T>;

declare type WorkerOpenDBOptions = {
    debug?: boolean;
};

export { }
