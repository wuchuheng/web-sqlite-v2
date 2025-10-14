import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

/**
 * Database Lifecycle Tests
 * Tests for database creation, connection, and persistence
 */
export const databaseLifecycleTests: TestCase[] = [
  {
    name: "Create in-memory database",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();
      TestUtils.assert(db, "Database should be created");
      db.close();
    },
  },
  {
    name: "Create OPFS database",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, "lifecycle_test.db");
      TestUtils.assert(db, "OPFS database should be created");
      TestUtils.cleanupDb(db);
    },
  },
  {
    name: "Database persistence across connections",
    fn: async (sqlite3) => {
      const dbName = "file:///persist_test.db?vfs=opfs";
      let db = new sqlite3.oo1.DB(dbName);

      db.exec("CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, value TEXT)");
      db.exec("INSERT INTO test (value) VALUES ('persistent_data')");
      db.close();

      db = new sqlite3.oo1.DB(dbName);
      const result = TestUtils.execQuery(db, "SELECT value FROM test");
      TestUtils.assertEqual(result.length, 1, "Should have one row");
      TestUtils.assertEqual(
        result[0].value,
        "persistent_data",
        "Data should persist"
      );

      db.exec("DROP TABLE test");
      db.close();
    },
  },
  {
    name: "Multiple database connections",
    fn: async (sqlite3) => {
      const db1 = new sqlite3.oo1.DB();
      const db2 = new sqlite3.oo1.DB();

      TestUtils.assert(db1, "First database should be created");
      TestUtils.assert(db2, "Second database should be created");

      db1.close();
      db2.close();
    },
  },
];
