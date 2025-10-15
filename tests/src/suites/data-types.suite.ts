import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

const DATA_DB_FILE = TestUtils.getSharedDbFile();
const DATA_TABLES = {
  integer: "datatype_integer",
  real: "datatype_real",
  text: "datatype_text",
  blob: "datatype_blob",
  nullable: "datatype_nullable",
} as const;

TestUtils.trackOpfsDb(DATA_DB_FILE);

/**
 * Data Types Tests
 * Tests for SQLite data type handling and storage
 */
export const dataTypesTests: TestCase[] = [
  {
    name: "INTEGER type",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, DATA_DB_FILE);
      const tableName = DATA_TABLES.integer;

      try {
        db.exec(`CREATE TABLE ${tableName} (value INTEGER)`);
        db.exec(`INSERT INTO ${tableName} VALUES (42), (-100), (0)`);

        const result = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName}`
        );
        TestUtils.assertEqual(result[0].value, 42, "Should store positive integer");
        TestUtils.assertEqual(result[1].value, -100, "Should store negative integer");
        TestUtils.assertEqual(result[2].value, 0, "Should store zero");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "REAL type",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, DATA_DB_FILE);
      const tableName = DATA_TABLES.real;

      try {
        db.exec(`CREATE TABLE ${tableName} (value REAL)`);
        db.exec(`INSERT INTO ${tableName} VALUES (3.14), (-2.5), (0.0)`);

        const result = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName}`
        );
        TestUtils.assertTrue(
          Math.abs((result[0].value as number) - 3.14) < 0.001,
          "Should store float"
        );
      } finally {
        db.close();
      }
    },
  },
  {
    name: "TEXT type",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, DATA_DB_FILE);
      const tableName = DATA_TABLES.text;

      try {
        db.exec(`CREATE TABLE ${tableName} (value TEXT)`);
        db.exec(
          `INSERT INTO ${tableName} VALUES ('Hello'), (''), ('Unicode: 你好 🚀')`
        );

        const result = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName}`
        );
        TestUtils.assertEqual(result[0].value, "Hello", "Should store text");
        TestUtils.assertEqual(result[1].value, "", "Should store empty string");
        TestUtils.assertEqual(
          result[2].value,
          "Unicode: 你好 🚀",
          "Should store Unicode"
        );
      } finally {
        db.close();
      }
    },
  },
  {
    name: "BLOB type",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, DATA_DB_FILE);
      const tableName = DATA_TABLES.blob;

      try {
        db.exec(`CREATE TABLE ${tableName} (value BLOB)`);

        const stmt = db.prepare(`INSERT INTO ${tableName} VALUES (?)`);
        const blobData = new Uint8Array([1, 2, 3, 4, 5]);
        stmt.bind([blobData]).stepFinalize();

        const result = TestUtils.execQuery(
          db,
          `SELECT LENGTH(value) as len FROM ${tableName}`
        );
        TestUtils.assertEqual(result[0].len, 5, "Blob should have 5 bytes");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "NULL values",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, DATA_DB_FILE);
      const tableName = DATA_TABLES.nullable;

      try {
        db.exec(`CREATE TABLE ${tableName} (value TEXT)`);
        db.exec(`INSERT INTO ${tableName} VALUES (NULL), ('not null')`);

        const result = TestUtils.execQuery(
          db,
          `SELECT * FROM ${tableName}`
        );
        TestUtils.assertEqual(result[0].value, null, "Should store NULL");
        TestUtils.assertEqual(result[1].value, "not null", "Should store text");
      } finally {
        db.close();
      }
    },
  },
];
