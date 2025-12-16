/**
 * SqliteEvent enum used at runtime and in types.
 * Provides string constants for worker message events.
 */
export enum SqliteEvent {
  /** Open database */
  OPEN = "open",
  /** Close database */
  CLOSE = "close", // Added CLOSE
  /** Execute SQL script */
  EXECUTE = "execute",
  /** Run parameterized DML (returns ExecResult) */
  RUN = "run",
}

/**
 * Request message shape sent to the worker.
 */
export type SqliteReqMsg<T> = {
  id: number;
  event: SqliteEvent;
  payload?: T;
};

/**
 * Response message shape from the worker.
 */
export type SqliteResMsg<T> = {
  id: number;
  success: boolean;
  error?: Error;
  payload?: T;
};
