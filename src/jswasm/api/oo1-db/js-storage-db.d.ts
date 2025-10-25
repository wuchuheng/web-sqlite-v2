import type { Oo1Context } from "./context.d.ts";
import type { DbCtorHelper } from "./db-ctor-helper.d.ts";
import type { DB } from "./db-statement/database.d.ts";

/**
 * Browser-only wrapper that persists databases to Web Storage (kvvfs).
 */
export class JsStorageDb extends DB {
  constructor(storageType?: "local" | "session");
  /** Persist current database state to storage. */
  flush(): void;
  /** Clear persisted storage for this database. */
  clearStorage(): number;
  /** Return approximate storage footprint in bytes. */
  storageSize(): number;

  static clearStorage(storageType?: "local" | "session"): number;
  static storageSize(storageType?: "local" | "session"): number;
}

/**
 * Installs the JsStorageDb convenience class on the sqlite3 facade when running on the main thread.
 */
export function attachJsStorageDb(
  context: Oo1Context,
  Database: typeof DB,
  dbCtorHelper: DbCtorHelper,
  ensureDbOpen: <T extends DB>(db: T) => T,
): void;
