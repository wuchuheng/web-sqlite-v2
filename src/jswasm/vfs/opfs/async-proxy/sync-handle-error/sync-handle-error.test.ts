import { describe, it, expect, beforeEach } from "vitest";

// Import for side effects to populate globalThis.GetSyncHandleError
// This now points to the local TS file which assigns to globalThis
import "./sync-handle-error";

interface SQLiteErrorCodes {
  SQLITE_BUSY: number;
  SQLITE_CANTOPEN: number;
  [key: string]: number;
}

interface GetSyncHandleErrorInstance extends Error {
  cause: unknown;
}

interface GetSyncHandleErrorConstructor {
  new (cause: unknown, ...messageParts: string[]): GetSyncHandleErrorInstance;
  toSQLiteCode(
    error: unknown,
    fallbackCode: number,
    sqliteCodes: SQLiteErrorCodes,
  ): number;
}

describe("sync-handle-error.ts migration", () => {
  let GetSyncHandleError: GetSyncHandleErrorConstructor;

  beforeEach(() => {
    GetSyncHandleError = (
      globalThis as unknown as {
        GetSyncHandleError: GetSyncHandleErrorConstructor;
      }
    ).GetSyncHandleError;
  });

  const mockSqliteCodes: SQLiteErrorCodes = {
    SQLITE_BUSY: 5,
    SQLITE_CANTOPEN: 14,
    SQLITE_IOERR: 10,
  };

  it("is defined on globalThis", () => {
    expect(GetSyncHandleError).toBeDefined();
  });

  it("constructs with correct message and cause", () => {
    const cause = new Error("Original Cause");
    const error = new GetSyncHandleError(cause, "Failed", "to", "open");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("GetSyncHandleError");
    expect(error.cause).toBe(cause);
    // "Failed to open : Error : Original Cause"
    expect(error.message).toContain("Failed to open");
    expect(error.message).toContain("Original Cause");
  });

  describe("toSQLiteCode", () => {
    it("maps NoModificationAllowedError to SQLITE_BUSY", () => {
      const cause = new DOMException("Message", "NoModificationAllowedError");
      const error = new GetSyncHandleError(cause, "Context");
      const code = GetSyncHandleError.toSQLiteCode(error, 0, mockSqliteCodes);
      expect(code).toBe(mockSqliteCodes.SQLITE_BUSY);
    });

    it("maps DOMException with specific message to SQLITE_BUSY", () => {
      const cause = new DOMException(
        "Access Handles cannot be created...",
        "InvalidStateError",
      );
      // Force name to match strict check in implementation if needed
      Object.defineProperty(cause, "name", { value: "DOMException" });

      const error = new GetSyncHandleError(cause, "Context");
      const code = GetSyncHandleError.toSQLiteCode(error, 0, mockSqliteCodes);
      expect(code).toBe(mockSqliteCodes.SQLITE_BUSY);
    });

    it("maps NotFoundError (wrapped) to SQLITE_CANTOPEN", () => {
      const cause = new DOMException("Message", "NotFoundError");
      const error = new GetSyncHandleError(cause, "Context");
      const code = GetSyncHandleError.toSQLiteCode(error, 0, mockSqliteCodes);
      expect(code).toBe(mockSqliteCodes.SQLITE_CANTOPEN);
    });

    it("maps NotFoundError (direct) to SQLITE_CANTOPEN", () => {
      const error = new DOMException("Message", "NotFoundError");
      const code = GetSyncHandleError.toSQLiteCode(error, 0, mockSqliteCodes);
      expect(code).toBe(mockSqliteCodes.SQLITE_CANTOPEN);
    });

    it("returns fallback code for unknown errors", () => {
      const error = new Error("Unknown");
      const fallback = 999;
      const code = GetSyncHandleError.toSQLiteCode(
        error,
        fallback,
        mockSqliteCodes,
      );
      expect(code).toBe(fallback);
    });
  });
});
