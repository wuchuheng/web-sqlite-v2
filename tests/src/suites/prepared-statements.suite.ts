import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

const PREPARED_DB_FILE = TestUtils.getSharedDbFile();
const PREPARED_TABLES = {
  parameters: "prepared_parameters",
  reuse: "prepared_reuse",
  namedParams: "prepared_named_params",
  select: "prepared_select",
} as const;

TestUtils.trackOpfsDb(PREPARED_DB_FILE);

/**
 * Prepared Statements Tests
 * Tests for parameterized queries and statement reuse
 */
export const preparedStatementsTests: TestCase[] = [
  {
    name: "Prepare and execute statement with parameters",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, PREPARED_DB_FILE);
      const tableName = PREPARED_TABLES.parameters;

      try {
        db.exec(`CREATE TABLE ${tableName} (id INTEGER, name TEXT)`);

        const stmt = db.prepare(
          `INSERT INTO ${tableName} (id, name) VALUES (?, ?)`
        );
        stmt.bind([1, "Alice"]).stepReset();
        stmt.bind([2, "Bob"]).stepReset();
        stmt.finalize();

        const result = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName}`
        );
        TestUtils.assertEqual(result.length, 2, "Should have two rows");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "Statement reuse with reset",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, PREPARED_DB_FILE);
      const tableName = PREPARED_TABLES.reuse;

      try {
        db.exec(`CREATE TABLE ${tableName} (value INTEGER)`);

        const stmt = db.prepare(
          `INSERT INTO ${tableName} (value) VALUES (?)`
        );
        for (let i = 1; i <= 5; i++) {
          stmt.bind([i]).stepReset();
        }
        stmt.finalize();

        const result = TestUtils.execQuery(
          db,
          `SELECT COUNT(*) as count FROM ${tableName}`
        );
        TestUtils.assertEqual(result[0].count, 5, "Should have five rows");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "Named parameters",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, PREPARED_DB_FILE);
      const tableName = PREPARED_TABLES.namedParams;

      try {
        db.exec(`CREATE TABLE ${tableName} (name TEXT, age INTEGER)`);

        const stmt = db.prepare(
          `INSERT INTO ${tableName} (name, age) VALUES (:name, :age)`
        );
        stmt.bind({ ":name": "Alice", ":age": 30 }).stepReset();
        stmt.finalize();

        const result = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName}`
        );
        TestUtils.assertEqual(result[0].name, "Alice", "Name should match");
        TestUtils.assertEqual(result[0].age, 30, "Age should match");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "Get results from SELECT statement",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, PREPARED_DB_FILE);
      const tableName = PREPARED_TABLES.select;

      try {
        db.exec(`CREATE TABLE ${tableName} (id INTEGER, name TEXT)`);
        db.exec(
          `INSERT INTO ${tableName} VALUES (1, 'Alice'), (2, 'Bob')`
        );

        const stmt = db.prepare(
          `SELECT * FROM ${tableName} WHERE id = ?`
        );
        stmt.bind([1]);

        TestUtils.assertTrue(stmt.step(), "Should have a result row");

        const row = stmt.get({});
        TestUtils.assertEqual(row.id, 1, "ID should be 1");
        TestUtils.assertEqual(row.name, "Alice", "Name should be Alice");

        stmt.finalize();
      } finally {
        db.close();
      }
    },
  },
];
