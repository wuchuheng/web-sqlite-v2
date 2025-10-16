import type { Sqlite3BootstrapFunction } from "../sqlite3Apibootstrap.d.ts";

/**
 * Apply Default Bootstrap State
 *
 * Initializes the sqlite3ApiBootstrap function with empty arrays for synchronous
 * and asynchronous initializers. This prepares the bootstrap function to accept
 * VFS installers, worker API setup, and other extension initialization hooks.
 *
 * @param sqlite3ApiBootstrap - The bootstrap function to configure with default state
 *
 * @remarks
 * This function is called immediately after attaching sqlite3ApiBootstrap to globalThis
 * and before any actual bootstrap execution. It ensures the initializers and
 * initializersAsync arrays exist so that extension code can safely push to them.
 *
 * @example
 * ```typescript
 * globalThis.sqlite3ApiBootstrap = function(...) { ... };
 * applyDefaultBootstrapState(globalThis.sqlite3ApiBootstrap);
 * // Now safe to add initializers
 * sqlite3ApiBootstrap.initializers.push(myInitFn);
 * ```
 */
export function applyDefaultBootstrapState(
    sqlite3ApiBootstrap: Sqlite3BootstrapFunction
): void;
