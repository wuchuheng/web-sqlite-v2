import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

/**
 * Environment Tests
 * Tests for SQLite3 module initialization and environment setup
 */
export const environmentTests: TestCase[] = [
  {
    name: "SQLite3 module loads successfully",
    fn: async (sqlite3) => {
      TestUtils.assert(sqlite3, "SQLite3 module should be initialized");
      TestUtils.assert(sqlite3.version, "SQLite3 should have version info");
    },
  },
  {
    name: "OPFS VFS is available",
    fn: async (sqlite3) => {
      const vfs = sqlite3.capi.sqlite3_vfs_find("opfs");
      TestUtils.assert(vfs, "OPFS VFS should be available in worker context");
    },
  },
  {
    name: "SharedArrayBuffer is supported",
    fn: async () => {
      TestUtils.assert(
        typeof SharedArrayBuffer !== "undefined",
        "SharedArrayBuffer must be available",
      );
    },
  },
  {
    name: "DB class is available",
    fn: async (sqlite3) => {
      TestUtils.assert(sqlite3.oo1?.DB, "OO1 DB class should be available");
    },
  },
];
