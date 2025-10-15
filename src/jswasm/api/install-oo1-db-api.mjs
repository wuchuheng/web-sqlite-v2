/**
 * @fileoverview Installs the high-level OO1 database API on top of the SQLite
 * WebAssembly bridge by composing the modular helpers under `./oo1-db`.
 */

import { createOo1Context } from "./oo1-db/context.mjs";
import { createDbCtorHelper } from "./oo1-db/db-ctor-helper.mjs";
import {
    createDbClasses,
    definePointerAccessors,
} from "./oo1-db/db-statement/index.mjs";
import { attachJsStorageDb } from "./oo1-db/js-storage-db.mjs";

/**
 * Creates the OO1 DB API installer.
 *
 * @returns {(sqlite3: import("../sqlite3.mjs").Module) => void}
 */
export function createInstallOo1DbApiInitializer() {
    return function installOo1DbApi(sqlite3) {
        const context = createOo1Context(sqlite3);
        const dbCtorHelper = createDbCtorHelper(context);
        const { Database, Statement, ensureDbOpen } = createDbClasses(
            context,
            dbCtorHelper
        );

        definePointerAccessors(context, Database, Statement);

        sqlite3.oo1 = {
            DB: Database,
            Stmt: Statement,
        };

        if (context.util.isUIThread()) {
            attachJsStorageDb(context, Database, dbCtorHelper, ensureDbOpen);
        }
    };
}
