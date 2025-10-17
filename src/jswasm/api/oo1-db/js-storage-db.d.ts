import type { DB } from "../../sqlite3.d.ts";
import type { Oo1Context } from "./context.d.ts";
import type { DbCtorHelper } from "./db-ctor-helper.d.ts";
import type { DbClassesResult } from "./db-statement/index.d.ts";

/**
 * Browser-only JsStorageDb class that extends {@link DB} with kvvfs helpers.
 */
export interface JsStorageDbClass extends typeof DB {
    /** Clears the backing storage bucket. */
    clearStorage(storageName?: "session" | "local"): number;
    /** Returns the approximate storage footprint for the bucket. */
    storageSize(storageName?: "session" | "local"): number;
}

/**
 * Installs the JsStorageDb helper on the {@link Oo1Context} when the runtime
 * is executing on the UI thread.
 */
export declare function attachJsStorageDb(
    context: Oo1Context,
    Database: typeof DB,
    dbCtorHelper: DbCtorHelper,
    ensureDbOpen: DbClassesResult["ensureDbOpen"]
): void;
