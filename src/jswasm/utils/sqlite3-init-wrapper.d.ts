import type { SQLite3InitModule } from "../sqlite3.d.ts";

/**
 * Wraps the sqlite3InitModule function to attach initialization helpers.
 */
export declare function wrapSqlite3InitModule(
  originalInit: SQLite3InitModule,
): SQLite3InitModule & { __isUnderTest?: boolean };
