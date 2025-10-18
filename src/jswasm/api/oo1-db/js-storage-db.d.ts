import type { DB } from "@wuchuheng/web-sqlite";
import type { Oo1Context } from "./context.d.ts";
import type { DbCtorHelper } from "./db-ctor-helper.d.ts";

/**
 * Installs the JsStorageDb convenience class on the sqlite3 facade when running on the main thread.
 */
export function attachJsStorageDb(
    context: Oo1Context,
    Database: typeof DB,
    dbCtorHelper: DbCtorHelper,
    ensureDbOpen: <T extends DB>(db: T) => T
): void;
