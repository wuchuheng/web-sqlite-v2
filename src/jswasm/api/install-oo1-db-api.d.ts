import type { SQLite3API } from "@wuchuheng/web-sqlite";

/**
 * Factory returning the installer that wires the OO1 DB API onto the sqlite3 facade.
 */
export function createInstallOo1DbApiInitializer(): (
  sqlite3: SQLite3API,
) => void;
