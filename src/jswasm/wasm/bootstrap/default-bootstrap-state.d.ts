import type { Sqlite3BootstrapFunction } from "../sqlite3Apibootstrap.d.ts";

/**
 * Seeds the canonical bootstrap function with default metadata, configuration,
 * and initializer queues prior to executing user-provided hooks.
 *
 * @param sqlite3ApiBootstrap Bootstrap function instance to populate.
 */
export function applyDefaultBootstrapState(
    sqlite3ApiBootstrap: Sqlite3BootstrapFunction
): void;
