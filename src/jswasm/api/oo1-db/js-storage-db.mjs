/**
 * @fileoverview UI-thread-only JsStorageDb wrapper for the OO1 API.
 */

/**
 * Installs the JsStorageDb convenience class when running on the UI thread.
 *
 * @param {import("./context.d.ts").Oo1Context} context Runtime context.
 * @param {typeof import("./db-statement/database.d.ts").DB} Database Database class.
 * @param {import("./db-ctor-helper.d.ts").DbCtorHelper} dbCtorHelper Helper for opening DB handles.
 * @param {(db: import("./db-statement/database.d.ts").DB) => import("./db-statement/database.d.ts").DB} ensureDbOpen
 *        Helper that asserts DB handles are open.
 */
export function attachJsStorageDb(
    context,
    Database,
    dbCtorHelper,
    ensureDbOpen
) {
    const { sqlite3, capi, toss } = context;

    class JsStorageDb extends Database {
        /**
         * Opens a kvvfs-backed storage database.
         *
         * @param {...Parameters<import("./db-ctor-helper.d.ts").DbCtorHelper>} ctorArgs
         *        Constructor arguments accepted by the OO1 Database helper.
         */
        constructor(...ctorArgs) {
            const opt = dbCtorHelper.normalizeArgs(...ctorArgs);
            const storageName = opt.filename;
            if (storageName !== "session" && storageName !== "local") {
                toss(
                    "JsStorageDb db name must be one of 'session' or 'local'."
                );
            }
            opt.vfs = "kvvfs";
            super(opt);
        }

        /**
         * Clears the underlying storage bucket.
         *
         * @returns {number} sqlite result code.
         */
        clearStorage() {
            return JsStorageDb.clearStorage(ensureDbOpen(this).filename);
        }

        /**
         * Returns the approximate storage footprint in bytes.
         *
         * @returns {number} Storage footprint.
         */
        storageSize() {
            return JsStorageDb.storageSize(ensureDbOpen(this).filename);
        }
    }

    JsStorageDb.clearStorage = capi.sqlite3_js_kvvfs_clear;
    JsStorageDb.storageSize = capi.sqlite3_js_kvvfs_size;
    JsStorageDb.dbCtorHelper = Database.dbCtorHelper;

    sqlite3.oo1.JsStorageDb = JsStorageDb;
}
