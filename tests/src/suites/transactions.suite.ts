import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

const TRANSACTION_DB_FILE = TestUtils.getSharedDbFile();
const TRANSACTION_TABLES = {
  commit: "transactions_commit",
  rollback: "transactions_rollback",
  autoRollback: "transactions_auto_rollback",
  savepoints: "transactions_savepoints",
} as const;

TestUtils.trackOpfsDb(TRANSACTION_DB_FILE);

/**
 * Transactions Tests
 * Tests for transaction handling, commit, and rollback
 */
export const transactionsTests: TestCase[] = [
  {
    name: "Successful transaction with COMMIT",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, TRANSACTION_DB_FILE);
      const tableName = TRANSACTION_TABLES.commit;

      try {
        db.exec(`CREATE TABLE ${tableName} (value INTEGER)`);

        db.exec("BEGIN TRANSACTION");
        db.exec(`INSERT INTO ${tableName} VALUES (1)`);
        db.exec(`INSERT INTO ${tableName} VALUES (2)`);
        db.exec("COMMIT");

        const result = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName}`
        );
        TestUtils.assertEqual(result.length, 2, "Both inserts should be committed");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "Transaction ROLLBACK",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, TRANSACTION_DB_FILE);
      const tableName = TRANSACTION_TABLES.rollback;

      try {
        db.exec(`CREATE TABLE ${tableName} (value INTEGER)`);
        db.exec(`INSERT INTO ${tableName} VALUES (1)`);

        db.exec("BEGIN TRANSACTION");
        db.exec(`INSERT INTO ${tableName} VALUES (2)`);
        db.exec("ROLLBACK");

        const result = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName}`
        );
        TestUtils.assertEqual(
          result.length,
          1,
          "Second insert should be rolled back"
        );
      } finally {
        db.close();
      }
    },
  },
  {
    name: "Automatic rollback on error",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, TRANSACTION_DB_FILE);
      const tableName = TRANSACTION_TABLES.autoRollback;

      try {
        db.exec(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value TEXT)`);
        db.exec(`INSERT INTO ${tableName} VALUES (1, 'first')`);

        try {
          db.exec("BEGIN TRANSACTION");
          db.exec(`INSERT INTO ${tableName} VALUES (2, 'second')`);
          db.exec(`INSERT INTO ${tableName} VALUES (1, 'duplicate')`);
          db.exec("COMMIT");
        } catch (_error) {
          try {
            db.exec("ROLLBACK");
          } catch (_rollbackError) {
            // ignore rollback errors
          }
        }

        const result = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName}`
        );
        TestUtils.assertEqual(
          result.length,
          1,
          "Only first insert should remain"
        );
      } finally {
        db.close();
      }
    },
  },
  {
    name: "Nested savepoints",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, TRANSACTION_DB_FILE);
      const tableName = TRANSACTION_TABLES.savepoints;

      try {
        db.exec(`CREATE TABLE ${tableName} (value INTEGER)`);

        db.exec("BEGIN TRANSACTION");
        db.exec(`INSERT INTO ${tableName} VALUES (1)`);

        db.exec("SAVEPOINT sp1");
        db.exec(`INSERT INTO ${tableName} VALUES (2)`);

        db.exec("SAVEPOINT sp2");
        db.exec(`INSERT INTO ${tableName} VALUES (3)`);

        db.exec("ROLLBACK TO sp2");
        db.exec("COMMIT");

        const result = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName}`
        );
        TestUtils.assertEqual(result.length, 2, "Should have two values (1 and 2)");
      } finally {
        db.close();
      }
    },
  },
];
