import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

/**
 * Data Types Tests
 * Tests for SQLite data type handling and storage
 */
export const dataTypesTests: TestCase[] = [
  {
    name: "INTEGER type",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value INTEGER)");
      db.exec("INSERT INTO test VALUES (42), (-100), (0)");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result[0].value, 42, "Should store positive integer");
      TestUtils.assertEqual(result[1].value, -100, "Should store negative integer");
      TestUtils.assertEqual(result[2].value, 0, "Should store zero");

      db.close();
    },
  },
  {
    name: "REAL type",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value REAL)");
      db.exec("INSERT INTO test VALUES (3.14), (-2.5), (0.0)");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertTrue(
        Math.abs((result[0].value as number) - 3.14) < 0.001,
        "Should store float"
      );

      db.close();
    },
  },
  {
    name: "TEXT type",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value TEXT)");
      db.exec(
        "INSERT INTO test VALUES ('Hello'), (''), ('Unicode: 你好 🚀')"
      );

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result[0].value, "Hello", "Should store text");
      TestUtils.assertEqual(result[1].value, "", "Should store empty string");
      TestUtils.assertEqual(
        result[2].value,
        "Unicode: 你好 🚀",
        "Should store Unicode"
      );

      db.close();
    },
  },
  {
    name: "BLOB type",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value BLOB)");

      const stmt = db.prepare("INSERT INTO test VALUES (?)");
      const blobData = new Uint8Array([1, 2, 3, 4, 5]);
      stmt.bind([blobData]).stepFinalize();

      const result = TestUtils.execQuery(db, "SELECT LENGTH(value) as len FROM test");
      TestUtils.assertEqual(result[0].len, 5, "Blob should have 5 bytes");

      db.close();
    },
  },
  {
    name: "NULL values",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value TEXT)");
      db.exec("INSERT INTO test VALUES (NULL), ('not null')");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result[0].value, null, "Should store NULL");
      TestUtils.assertEqual(result[1].value, "not null", "Should store text");

      db.close();
    },
  },
];
