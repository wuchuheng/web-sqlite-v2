import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

const ERROR_DB_FILE = TestUtils.getSharedDbFile();
const ERROR_TABLES = {
  missingColumn: "errors_missing_column",
} as const;

TestUtils.trackOpfsDb(ERROR_DB_FILE);

/**
 * Error Handling Tests
 * Tests for proper error handling and error messages
 */
export const errorHandlingTests: TestCase[] = [
  {
    name: "Invalid SQL syntax",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, ERROR_DB_FILE);

      try {
        TestUtils.assertThrows(() => {
          db.exec("SELCT * FROM nowhere");
        }, "Should throw syntax error");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "Table does not exist",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, ERROR_DB_FILE);

      try {
        TestUtils.assertThrows(() => {
          db.exec("SELECT * FROM nonexistent_table");
        }, "Should throw table not found error");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "Column does not exist",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, ERROR_DB_FILE);
      const tableName = ERROR_TABLES.missingColumn;

      try {
        db.exec(`CREATE TABLE ${tableName} (id INTEGER)`);

        TestUtils.assertThrows(() => {
          db.exec(`SELECT nonexistent_column FROM ${tableName}`);
        }, "Should throw column not found error");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "Proper error message format",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, ERROR_DB_FILE);

      try {
        try {
          db.exec("INVALID SQL STATEMENT");
          TestUtils.assert(false, "Should have thrown an error");
        } catch (error) {
          TestUtils.assertTrue(
            (error as Error).message.length > 0,
            "Error message should not be empty",
          );
        }
      } finally {
        db.close();
      }
    },
  },
];
