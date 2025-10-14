import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

/**
 * Prepared Statements Tests
 * Tests for parameterized queries and statement reuse
 */
export const preparedStatementsTests: TestCase[] = [
  {
    name: "Prepare and execute statement with parameters",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER, name TEXT)");

      const stmt = db.prepare("INSERT INTO test (id, name) VALUES (?, ?)");
      stmt.bind([1, "Alice"]).stepReset();
      stmt.bind([2, "Bob"]).stepReset();
      stmt.finalize();

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result.length, 2, "Should have two rows");

      db.close();
    },
  },
  {
    name: "Statement reuse with reset",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value INTEGER)");

      const stmt = db.prepare("INSERT INTO test (value) VALUES (?)");
      for (let i = 1; i <= 5; i++) {
        stmt.bind([i]).stepReset();
      }
      stmt.finalize();

      const result = TestUtils.execQuery(db, "SELECT COUNT(*) as count FROM test");
      TestUtils.assertEqual(result[0].count, 5, "Should have five rows");

      db.close();
    },
  },
  {
    name: "Named parameters",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (name TEXT, age INTEGER)");

      const stmt = db.prepare(
        "INSERT INTO test (name, age) VALUES (:name, :age)"
      );
      stmt.bind({ ":name": "Alice", ":age": 30 }).stepReset();
      stmt.finalize();

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result[0].name, "Alice", "Name should match");
      TestUtils.assertEqual(result[0].age, 30, "Age should match");

      db.close();
    },
  },
  {
    name: "Get results from SELECT statement",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER, name TEXT)");
      db.exec("INSERT INTO test VALUES (1, 'Alice'), (2, 'Bob')");

      const stmt = db.prepare("SELECT * FROM test WHERE id = ?");
      stmt.bind([1]);

      TestUtils.assertTrue(stmt.step(), "Should have a result row");

      const row = stmt.get({});
      TestUtils.assertEqual(row.id, 1, "ID should be 1");
      TestUtils.assertEqual(row.name, "Alice", "Name should be Alice");

      stmt.finalize();
      db.close();
    },
  },
];
