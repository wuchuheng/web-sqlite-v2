import { StructBinderFactory } from "../../utils/struct-binder/struct-binder-factory.mjs";
import { createInstallOo1Initializer } from "../../api/install-oo1.mjs";
import { createInstallOo1DbApiInitializer } from "../../api/install-oo1-db-api.mjs";
import { createInstallOpfsVfsContext } from "../../vfs/opfs/installer/index.mjs";
import { createOpfsSahpoolInitializer } from "../../vfs/opfs/opfs-sahpool-vfs.mjs";
import { createWorker1ApiInitializer } from "./worker1-api-initializer.mjs";
import {
    createVfsInitializer,
    createVtabInitializer,
} from "./vfs-initializers.mjs";

/**
 * @typedef {import("../sqlite3Apibootstrap.d.ts").Sqlite3Initializer} Sqlite3Initializer
 * @typedef {import("../sqlite3Apibootstrap.d.ts").Sqlite3BootstrapFunction} Sqlite3BootstrapFunction
 */

/**
 * Provides the canonical set of bootstrap initializers that ship with the WASM
 * distribution. The initializers array collects both synchronous and
 * asynchronous hooks so the main bootstrapper can stay focused on orchestrating
 * module wiring.
 *
 * @param {Sqlite3BootstrapFunction} sqlite3ApiBootstrap
 *        Bootstrap facade populated by {@link runSQLite3PostLoadInit}; the
 *        object is mutated to install default configuration, metadata, and
 *        initializer lists.
 * @throws {Error}
 *         Thrown when the bootstrap facade is undefined, signalling an
 *         unexpected call order during startup.
 */
export function applyDefaultBootstrapState(sqlite3ApiBootstrap) {
    if (!sqlite3ApiBootstrap) {
        throw new Error(
            "sqlite3ApiBootstrap must exist before applying the default state.",
        );
    }

    sqlite3ApiBootstrap.initializers = [];
    sqlite3ApiBootstrap.initializersAsync = [];
    sqlite3ApiBootstrap.defaultConfig = Object.create(null);
    sqlite3ApiBootstrap.sqlite3 = undefined;

    globalThis.Jaccwabyt = StructBinderFactory;

    sqlite3ApiBootstrap.initializers.push(createInstallOo1Initializer());
    sqlite3ApiBootstrap.initializers.push(createVersionInitializer());
    sqlite3ApiBootstrap.initializers.push(createInstallOo1DbApiInitializer());
    sqlite3ApiBootstrap.initializers.push(createWorker1ApiInitializer());
    sqlite3ApiBootstrap.initializers.push(createVfsInitializer());
    sqlite3ApiBootstrap.initializers.push(createVtabInitializer());
    sqlite3ApiBootstrap.initializers.push((sqlite3) => {
        const { installOpfsVfsInitializer } =
            createInstallOpfsVfsContext(sqlite3);
        sqlite3ApiBootstrap.initializersAsync.push(installOpfsVfsInitializer);
    });
    sqlite3ApiBootstrap.initializers.push(createOpfsSahpoolInitializer());
}

/**
 * Creates the initializer responsible for setting the metadata about the
 * embedded SQLite build. Having it encapsulated makes it easy for tooling to
 * update the version numbers without touching the main bootstrap script.
 *
 * @returns {Sqlite3Initializer}
 *          Initializer that annotates the sqlite3 facade with version info.
 */
function createVersionInitializer() {
    return function initializeVersion(sqlite3) {
        sqlite3.version = {
            libVersion: "3.50.4",
            libVersionNumber: 3050004,
            sourceId:
                "2025-07-30 19:33:53 4d8adfb30e03f9cf27f800a2c1ba3c48fb4ca1b08b0f5ed59a4d5ecbf45e20a3",
            downloadVersion: 3500400,
        };
    };
}
