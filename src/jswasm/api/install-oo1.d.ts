import type { SQLite3API } from "../sqlite3.d.ts";

/**
 * Function signature for the OO1 API installer returned by
 * {@link createInstallOo1Initializer}.
 */
export type InstallOo1Initializer = (sqlite3: SQLite3API) => void;

/**
 * Creates the refactored installer responsible for wiring up the complete
 * object-oriented SQLite API, memory helpers, bindings, and utilities onto the
 * provided {@link SQLite3API} instance.
 */
export declare function createInstallOo1Initializer(): InstallOo1Initializer;
