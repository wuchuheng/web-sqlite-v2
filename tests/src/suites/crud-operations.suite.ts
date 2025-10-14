import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

/**
 * CRUD Operations Tests
 * Tests for Create, Read, Update, Delete operations
 */
export const crudOperationsTests: TestCase[] = [
  {
    name: "INSERT single row",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER, name TEXT)");
      db.exec("INSERT INTO test (id, name) VALUES (1, 'Alice')");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result.length, 1, "Should have one row");
      TestUtils.assertEqual(result[0].name, "Alice", "Name should match");

      db.close();
    },
  },
  {
    name: "INSERT multiple rows",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER, name TEXT)");
      db.exec(`
        INSERT INTO test (id, name) VALUES
          (1, 'Alice'),
          (2, 'Bob'),
          (3, 'Charlie')
      `);

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result.length, 3, "Should have three rows");

      db.close();
    },
  },
  {
    name: "SELECT with WHERE clause",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER, age INTEGER)");
      db.exec("INSERT INTO test VALUES (1, 25), (2, 30), (3, 25)");

      const result = TestUtils.execQuery(db, "SELECT * FROM test WHERE age = 25");
      TestUtils.assertEqual(result.length, 2, "Should find two rows");

      db.close();
    },
  },
  {
    name: "UPDATE rows",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER, status TEXT)");
      db.exec("INSERT INTO test VALUES (1, 'pending'), (2, 'pending')");
      db.exec("UPDATE test SET status = 'completed' WHERE id = 1");

      const completed = TestUtils.execQuery(
        db,
        "SELECT * FROM test WHERE status = 'completed'"
      );
      const pending = TestUtils.execQuery(
        db,
        "SELECT * FROM test WHERE status = 'pending'"
      );

      TestUtils.assertEqual(completed.length, 1, "Should have one completed");
      TestUtils.assertEqual(pending.length, 1, "Should have one pending");

      db.close();
    },
  },
  {
    name: "DELETE rows",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER)");
      db.exec("INSERT INTO test VALUES (1), (2), (3)");
      db.exec("DELETE FROM test WHERE id = 2");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result.length, 2, "Should have two rows left");

      db.close();
    },
  },
  {
    name: "CREATE table and insert 100 rows",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      try {
        db.exec("CREATE TABLE bulk_test (id INTEGER PRIMARY KEY, value TEXT)");
        db.exec("BEGIN TRANSACTION");
        const stmt = db.prepare("INSERT INTO bulk_test VALUES (?, ?)");

        try {
          for (let i = 0; i < 100; i++) {
            stmt.bind([i, `value_${i}`]).stepReset();
          }
        } finally {
          stmt.finalize();
        }

        db.exec("COMMIT");

        const result = TestUtils.execQuery(
          db,
          "SELECT COUNT(*) as cnt FROM bulk_test"
        );
        TestUtils.assertEqual(result[0].cnt, 100, "Should insert 100 rows");
      } finally {
        db.close();
      }
    },
  },
];
