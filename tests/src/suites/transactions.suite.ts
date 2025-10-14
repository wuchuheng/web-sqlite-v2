import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

/**
 * Transactions Tests
 * Tests for transaction handling, commit, and rollback
 */
export const transactionsTests: TestCase[] = [
  {
    name: "Successful transaction with COMMIT",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value INTEGER)");

      db.exec("BEGIN TRANSACTION");
      db.exec("INSERT INTO test VALUES (1)");
      db.exec("INSERT INTO test VALUES (2)");
      db.exec("COMMIT");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result.length, 2, "Both inserts should be committed");

      db.close();
    },
  },
  {
    name: "Transaction ROLLBACK",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value INTEGER)");
      db.exec("INSERT INTO test VALUES (1)");

      db.exec("BEGIN TRANSACTION");
      db.exec("INSERT INTO test VALUES (2)");
      db.exec("ROLLBACK");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(
        result.length,
        1,
        "Second insert should be rolled back"
      );

      db.close();
    },
  },
  {
    name: "Automatic rollback on error",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
      db.exec("INSERT INTO test VALUES (1, 'first')");

      try {
        db.exec("BEGIN TRANSACTION");
        db.exec("INSERT INTO test VALUES (2, 'second')");
        db.exec("INSERT INTO test VALUES (1, 'duplicate')");
        db.exec("COMMIT");
      } catch (_error) {
        // Expected to fail
      }

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(
        result.length,
        1,
        "Only first insert should remain"
      );

      db.close();
    },
  },
  {
    name: "Nested savepoints",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value INTEGER)");

      db.exec("BEGIN TRANSACTION");
      db.exec("INSERT INTO test VALUES (1)");

      db.exec("SAVEPOINT sp1");
      db.exec("INSERT INTO test VALUES (2)");

      db.exec("SAVEPOINT sp2");
      db.exec("INSERT INTO test VALUES (3)");

      db.exec("ROLLBACK TO sp2");
      db.exec("COMMIT");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result.length, 2, "Should have two values (1 and 2)");

      db.close();
    },
  },
];
