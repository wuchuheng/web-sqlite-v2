import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

const SCHEMA_DB_FILE = TestUtils.getSharedDbFile();
const SCHEMA_TABLES = {
  users: "schema_users",
  products: "schema_products",
  items: "schema_items",
  temp: "schema_temp_table",
} as const;

TestUtils.trackOpfsDb(SCHEMA_DB_FILE);

/**
 * Schema Operations Tests
 * Tests for table creation, alteration, and index management
 */
export const schemaOperationsTests: TestCase[] = [
  {
    name: "CREATE TABLE with various column types",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, SCHEMA_DB_FILE);
      const tableName = SCHEMA_TABLES.users;

      try {
        db.exec(`
          CREATE TABLE ${tableName} (
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
          `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
        );
        TestUtils.assertEqual(tables.length, 1, "Table should be created");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "CREATE INDEX on table",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, SCHEMA_DB_FILE);
      const tableName = SCHEMA_TABLES.products;

      try {
        db.exec(
          `CREATE TABLE ${tableName} (id INTEGER, name TEXT, price REAL)`,
        );
        db.exec(`CREATE INDEX idx_${tableName}_name ON ${tableName}(name)`);
        db.exec(`CREATE INDEX idx_${tableName}_price ON ${tableName}(price)`);

        const indexes = TestUtils.execQuery(
          db,
          "SELECT name FROM sqlite_master WHERE type='index'",
        );
        TestUtils.assertTrue(indexes.length >= 2, "Indexes should be created");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "ALTER TABLE add column",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, SCHEMA_DB_FILE);
      const tableName = SCHEMA_TABLES.items;

      try {
        db.exec(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY)`);
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN name TEXT`);

        const info = TestUtils.execQuery(db, `PRAGMA table_info(${tableName})`);
        TestUtils.assertEqual(info.length, 2, "Should have 2 columns");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "DROP TABLE",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, SCHEMA_DB_FILE);
      const tableName = SCHEMA_TABLES.temp;

      try {
        db.exec(`CREATE TABLE ${tableName} (id INTEGER)`);
        db.exec(`DROP TABLE ${tableName}`);

        const tables = TestUtils.execQuery(
          db,
          `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
        );
        TestUtils.assertEqual(tables.length, 0, "Table should be dropped");
      } finally {
        db.close();
      }
    },
  },
];
