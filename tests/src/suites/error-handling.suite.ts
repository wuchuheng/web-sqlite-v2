import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

/**
 * Error Handling Tests
 * Tests for proper error handling and error messages
 */
export const errorHandlingTests: TestCase[] = [
  {
    name: "Invalid SQL syntax",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      TestUtils.assertThrows(() => {
        db.exec("SELCT * FROM nowhere");
      }, "Should throw syntax error");

      db.close();
    },
  },
  {
    name: "Table does not exist",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      TestUtils.assertThrows(() => {
        db.exec("SELECT * FROM nonexistent_table");
      }, "Should throw table not found error");

      db.close();
    },
  },
  {
    name: "Column does not exist",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER)");

      TestUtils.assertThrows(() => {
        db.exec("SELECT nonexistent_column FROM test");
      }, "Should throw column not found error");

      db.close();
    },
  },
  {
    name: "Proper error message format",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      try {
        db.exec("INVALID SQL STATEMENT");
        TestUtils.assert(false, "Should have thrown an error");
      } catch (error) {
        TestUtils.assertTrue(
          (error as Error).message.length > 0,
          "Error message should not be empty"
        );
      }

      db.close();
    },
  },
];
