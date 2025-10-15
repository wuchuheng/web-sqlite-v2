import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

const LIFECYCLE_DB_FILE = TestUtils.getSharedDbFile();
const LIFECYCLE_TABLES = {
  persistence: "lifecycle_persistence",
} as const;

TestUtils.trackOpfsDb(LIFECYCLE_DB_FILE);

/**
 * Database Lifecycle Tests
 * Tests for database creation, connection, and persistence
 */
export const databaseLifecycleTests: TestCase[] = [
  {
    name: "Create OPFS database",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, LIFECYCLE_DB_FILE);

      try {
        TestUtils.assert(db.isOpen(), "Database should be created and open");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "Create OPFS database with helper",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, LIFECYCLE_DB_FILE);

      try {
        TestUtils.assert(db, "OPFS database should be created");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "Database persistence across connections",
    fn: async (sqlite3) => {
      const tableName = LIFECYCLE_TABLES.persistence;
      const firstConnection = TestUtils.createTestDb(sqlite3, LIFECYCLE_DB_FILE);

      try {
        firstConnection.exec(
          `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value TEXT)`
        );
        firstConnection.exec(
          `INSERT INTO ${tableName} (value) VALUES ('persistent_data')`
        );
      } finally {
        firstConnection.close();
      }

      const secondConnection = TestUtils.createTestDb(
        sqlite3,
        LIFECYCLE_DB_FILE
      );

      try {
        const result = TestUtils.execQuery(
          secondConnection,
          `SELECT value FROM ${tableName}`
        );
        TestUtils.assertEqual(result.length, 1, "Should have one row");
        TestUtils.assertEqual(
          result[0].value,
          "persistent_data",
          "Data should persist"
        );
      } finally {
        secondConnection.close();
      }
    },
  },
  {
    name: "Multiple OPFS database connections",
    fn: async (sqlite3) => {
      const db1 = TestUtils.createTestDb(sqlite3, LIFECYCLE_DB_FILE);
      const db2 = TestUtils.createTestDb(sqlite3, LIFECYCLE_DB_FILE);

      try {
        TestUtils.assert(db1.isOpen(), "First database should be created");
        TestUtils.assert(db2.isOpen(), "Second database should be created");
      } finally {
        db1.close();
        db2.close();
      }
    },
  },
];
