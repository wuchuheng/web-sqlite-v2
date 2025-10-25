import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

const PERFORMANCE_DB_FILE = TestUtils.getSharedDbFile();
const PERFORMANCE_TABLES = {
  bulkInsert: "performance_bulk_insert",
  index: "performance_index",
  largeResult: "performance_large_result",
} as const;

TestUtils.trackOpfsDb(PERFORMANCE_DB_FILE);

/**
 * Performance Tests
 * Tests for bulk operations and performance characteristics
 */
export const performanceTests: TestCase[] = [
  {
    name: "Bulk insert with transaction",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, PERFORMANCE_DB_FILE);
      const tableName = PERFORMANCE_TABLES.bulkInsert;

      try {
        db.exec(`CREATE TABLE ${tableName} (id INTEGER, value TEXT)`);

        const startTime = performance.now();

        db.exec("BEGIN TRANSACTION");
        const stmt = db.prepare(`INSERT INTO ${tableName} VALUES (?, ?)`);
        try {
          for (let i = 0; i < 1000; i++) {
            stmt.bind([i, `value_${i}`]).stepReset();
          }
        } finally {
          stmt.finalize();
        }
        db.exec("COMMIT");

        const duration = performance.now() - startTime;

        const count = TestUtils.execQuery(
          db,
          `SELECT COUNT(*) as cnt FROM ${tableName}`,
        );
        TestUtils.assertEqual(count[0].cnt, 1000, "Should insert 1000 rows");
        TestUtils.assertTrue(
          duration < 1000,
          `Bulk insert should be fast (took ${duration}ms)`,
        );
      } finally {
        db.close();
      }
    },
  },
  {
    name: "Index improves query performance",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, PERFORMANCE_DB_FILE);
      const tableName = PERFORMANCE_TABLES.index;

      try {
        db.exec(`CREATE TABLE ${tableName} (id INTEGER, value TEXT)`);

        db.exec("BEGIN TRANSACTION");
        const stmt = db.prepare(`INSERT INTO ${tableName} VALUES (?, ?)`);
        try {
          for (let i = 0; i < 1000; i++) {
            stmt.bind([i, `value_${i}`]).stepReset();
          }
        } finally {
          stmt.finalize();
        }
        db.exec("COMMIT");

        const start1 = performance.now();
        TestUtils.execQuery(db, `SELECT * FROM ${tableName} WHERE id = 500`);
        const time1 = performance.now() - start1;

        db.exec(`CREATE INDEX idx_${tableName}_id ON ${tableName}(id)`);

        const start2 = performance.now();
        TestUtils.execQuery(db, `SELECT * FROM ${tableName} WHERE id = 500`);
        const time2 = performance.now() - start2;

        TestUtils.assertTrue(
          time2 <= time1 * 1.5,
          "Indexed query should be as fast or faster",
        );
      } finally {
        db.close();
      }
    },
  },
  {
    name: "Large result set handling",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, PERFORMANCE_DB_FILE);
      const tableName = PERFORMANCE_TABLES.largeResult;

      try {
        db.exec(`CREATE TABLE ${tableName} (value INTEGER)`);

        db.exec("BEGIN TRANSACTION");
        const stmt = db.prepare(`INSERT INTO ${tableName} VALUES (?)`);
        try {
          for (let i = 0; i < 5000; i++) {
            stmt.bind([i]).stepReset();
          }
        } finally {
          stmt.finalize();
        }
        db.exec("COMMIT");

        const result = TestUtils.execQuery(db, `SELECT * FROM ${tableName}`);
        TestUtils.assertEqual(
          result.length,
          5000,
          "Should retrieve all 5000 rows",
        );
      } finally {
        db.close();
      }
    },
  },
];
