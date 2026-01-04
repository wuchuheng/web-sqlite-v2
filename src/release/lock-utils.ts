/** Identify lock contention errors from SQLite. */
export const isLockError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("database is locked") || message.includes("SQLITE_BUSY")
  );
};
