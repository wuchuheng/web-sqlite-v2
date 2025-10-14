import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

/**
 * Schema Operations Tests
 * Tests for table creation, alteration, and index management
 */
export const schemaOperationsTests: TestCase[] = [
  {
    name: "CREATE TABLE with various column types",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          age INTEGER,
          balance REAL,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const tables = TestUtils.execQuery(
        db,
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
      );
      TestUtils.assertEqual(tables.length, 1, "Table should be created");

      db.close();
    },
  },
  {
    name: "CREATE INDEX on table",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE products (id INTEGER, name TEXT, price REAL)");
      db.exec("CREATE INDEX idx_products_name ON products(name)");
      db.exec("CREATE INDEX idx_products_price ON products(price)");

      const indexes = TestUtils.execQuery(
        db,
        "SELECT name FROM sqlite_master WHERE type='index'"
      );
      TestUtils.assertTrue(
        indexes.length >= 2,
        "Indexes should be created"
      );

      db.close();
    },
  },
  {
    name: "ALTER TABLE add column",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY)");
      db.exec("ALTER TABLE items ADD COLUMN name TEXT");

      const info = TestUtils.execQuery(db, "PRAGMA table_info(items)");
      TestUtils.assertEqual(info.length, 2, "Should have 2 columns");

      db.close();
    },
  },
  {
    name: "DROP TABLE",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE temp_table (id INTEGER)");
      db.exec("DROP TABLE temp_table");

      const tables = TestUtils.execQuery(
        db,
        "SELECT name FROM sqlite_master WHERE type='table' AND name='temp_table'"
      );
      TestUtils.assertEqual(tables.length, 0, "Table should be dropped");

      db.close();
    },
  },
];
