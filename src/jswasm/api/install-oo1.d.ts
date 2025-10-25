import type { SQLite3API } from "@wuchuheng/web-sqlite";

/**
 * Produces the initializer that configures the OO1 facade on the sqlite3 bundle.
 */
export function createInstallOo1Initializer(): (sqlite3: SQLite3API) => void;
