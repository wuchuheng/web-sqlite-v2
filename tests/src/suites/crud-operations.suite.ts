import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

const CRUD_DB_FILE = TestUtils.getSharedDbFile();
const CRUD_TABLES = {
  singleRow: "crud_single_row",
  multipleRows: "crud_multiple_rows",
  selectWhere: "crud_select_where",
  updateRows: "crud_update_rows",
  deleteRows: "crud_delete_rows",
  persistHundred: "crud_persist_hundred",
} as const;

TestUtils.trackOpfsDb(CRUD_DB_FILE);

/**
 * CRUD Operations Tests
 * Tests for Create, Read, Update, Delete operations
 */
export const crudOperationsTests: TestCase[] = [
  {
    name: "INSERT single row",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, CRUD_DB_FILE);
      const tableName = CRUD_TABLES.singleRow;

      try {
        db.exec(
          `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`
        );
        db.exec(
          `INSERT INTO ${tableName} (id, name) VALUES (1, 'Alice')`
        );

        const result = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName}`
        );
        TestUtils.assertEqual(result.length, 1, "Should have one row");
        TestUtils.assertEqual(result[0].name, "Alice", "Name should match");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "INSERT multiple rows",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, CRUD_DB_FILE);
      const tableName = CRUD_TABLES.multipleRows;

      try {
        db.exec(`CREATE TABLE ${tableName} (id INTEGER, name TEXT)`);
        db.exec(`
          INSERT INTO ${tableName} (id, name) VALUES
            (1, 'Alice'),
            (2, 'Bob'),
            (3, 'Charlie')
        `);

        const result = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName}`
        );
        TestUtils.assertEqual(result.length, 3, "Should have three rows");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "SELECT with WHERE clause",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, CRUD_DB_FILE);
      const tableName = CRUD_TABLES.selectWhere;

      try {
        db.exec(`CREATE TABLE ${tableName} (id INTEGER, age INTEGER)`);
        db.exec(
          `INSERT INTO ${tableName} VALUES (1, 25), (2, 30), (3, 25)`
        );

        const result = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName} WHERE age = 25`
        );
        TestUtils.assertEqual(result.length, 2, "Should find two rows");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "UPDATE rows",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, CRUD_DB_FILE);
      const tableName = CRUD_TABLES.updateRows;

      try {
        db.exec(`CREATE TABLE ${tableName} (id INTEGER, status TEXT)`);
        db.exec(
          `INSERT INTO ${tableName} VALUES (1, 'pending'), (2, 'pending')`
        );
        db.exec(
          `UPDATE ${tableName} SET status = 'completed' WHERE id = 1`
        );

        const completed = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName} WHERE status = 'completed'`
        );
        const pending = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName} WHERE status = 'pending'`
        );

        TestUtils.assertEqual(completed.length, 1, "Should have one completed");
        TestUtils.assertEqual(pending.length, 1, "Should have one pending");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "DELETE rows",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, CRUD_DB_FILE);
      const tableName = CRUD_TABLES.deleteRows;

      try {
        db.exec(`CREATE TABLE ${tableName} (id INTEGER)`);
        db.exec(`INSERT INTO ${tableName} VALUES (1), (2), (3)`);
        db.exec(`DELETE FROM ${tableName} WHERE id = 2`);

        const result = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName}`
        );
        TestUtils.assertEqual(result.length, 2, "Should have two rows left");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "Persist 100 rows to OPFS",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, CRUD_DB_FILE);
      const tableName = CRUD_TABLES.persistHundred;

      try {
        db.exec(
          `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value TEXT)`
        );
        db.exec("BEGIN TRANSACTION");
        const stmt = db.prepare(
          `INSERT INTO ${tableName} VALUES (?, ?)`
        );

        try {
          for (let i = 0; i < 100; i++) {
            stmt.bind([i, `value_${i}`]).stepReset();
          }
        } finally {
          stmt.finalize();
        }

        db.exec("COMMIT");
      } catch (error) {
        try {
          db.exec("ROLLBACK");
        } catch (_rollbackError) {
          // ignore rollback failures
        }
        throw error;
      } finally {
        db.close();
      }

      const reopened = TestUtils.createTestDb(
        sqlite3,
        CRUD_DB_FILE
      );

      try {
        const result = TestUtils.execQuery(
          reopened,
          `SELECT COUNT(*) as cnt FROM ${tableName}`
        );
        TestUtils.assertEqual(
          result[0].cnt,
          100,
          "Should persist 100 rows in OPFS database"
        );
      } finally {
        reopened.close();
      }
    },
  },
];
