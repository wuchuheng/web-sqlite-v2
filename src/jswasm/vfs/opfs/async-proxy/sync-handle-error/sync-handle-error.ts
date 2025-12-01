/**
 * Type definition for SQLite error codes map.
 * Replicated here to avoid runtime dependency on other modules if not needed,
 * or should be imported from a shared type definition.
 * Assuming it matches the structure used in the original file.
 */
type LocalSQLiteErrorCodes = {
  SQLITE_BUSY: number;
  SQLITE_CANTOPEN: number;
  [key: string]: number;
};

/**
 * Error wrapper signalling repeated failures while requesting a sync access handle.
 *
 * Mirrors the behavior of the original `GetSyncHandleError` class.
 */
class GetSyncHandleError extends Error {
  /**
   * Underlying failure from the OPFS API.
   */
  public override cause: DOMException | Error;

  /**
   * Creates a new GetSyncHandleError.
   *
   * @param cause - Underlying failure from the OPFS API.
   * @param messageParts - Fragments describing the failed operation.
   */
  constructor(cause: DOMException | Error, ...messageParts: string[]) {
    super(
      [messageParts.join(" "), ": ", cause.name, ": ", cause.message].join(""),
    );
    this.cause = cause;
    this.name = "GetSyncHandleError";
  }

  /**
   * Converts an error into the appropriate SQLite error code.
   *
   * @param error - Error to inspect.
   * @param fallbackCode - Error code used when no specific mapping exists.
   * @param sqliteCodes - Mapping of sqlite error codes.
   * @returns SQLite-compatible error code.
   */
  static toSQLiteCode(
    error: Error | DOMException | GetSyncHandleError | unknown,
    fallbackCode: number,
    sqliteCodes: LocalSQLiteErrorCodes,
  ): number {
    if (error instanceof GetSyncHandleError) {
      const cause = error.cause;
      if (
        cause?.name === "NoModificationAllowedError" ||
        (cause?.name === "DOMException" &&
          cause?.message?.startsWith("Access Handles cannot"))
      ) {
        return sqliteCodes.SQLITE_BUSY;
      }
      if (cause?.name === "NotFoundError") {
        return sqliteCodes.SQLITE_CANTOPEN;
      }
    } else if (
      error &&
      typeof error === "object" &&
      (error as { name?: string }).name === "NotFoundError"
    ) {
      return sqliteCodes.SQLITE_CANTOPEN;
    }
    return fallbackCode;
  }
}

// Assign to globalThis to maintain compatibility with consumers expecting it there.
(
  globalThis as unknown as { GetSyncHandleError: typeof GetSyncHandleError }
).GetSyncHandleError = GetSyncHandleError;
