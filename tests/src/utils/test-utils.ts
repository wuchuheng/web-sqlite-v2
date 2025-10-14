import type { BindValue, SQLite3API } from "@wuchuheng/web-sqlite";

type Database = InstanceType<SQLite3API["oo1"]["DB"]>;

/**
 * Test Utilities
 * Helper functions for assertions and database operations
 */
export class TestUtils {
  /**
   * Assert that a condition is true
   */
  static assert(condition: unknown, message?: string): void {
    const isTruthy = Boolean(condition);
    if (!isTruthy) {
      throw new Error(message || "Assertion failed");
    }
  }

  /**
   * Assert equality
   */
  static assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(
        message || `Expected ${expected} but got ${actual}`
      );
    }
  }

  /**
   * Assert that value is truthy
   */
  static assertTrue(value: unknown, message?: string): void {
    TestUtils.assert(!!value, message || `Expected truthy value but got ${value}`);
  }

  /**
   * Assert that value is falsy
   */
  static assertFalse(value: unknown, message?: string): void {
    TestUtils.assert(!value, message || `Expected falsy value but got ${value}`);
  }

  /**
   * Assert that a function throws an error
   */
  static assertThrows(fn: () => void, message?: string): void {
    let threw = false;

    try {
      fn();
    } catch (_error) {
      threw = true;
    }

    TestUtils.assert(threw, message || "Expected function to throw an error");
  }

  /**
   * Create a test database with OPFS
   */
  static createTestDb(sqlite3: SQLite3API, name = "test.db"): Database {
    const dbName = `file:///${name}?vfs=opfs`;
    return new sqlite3.oo1.DB(dbName);
  }

  /**
   * Clean up test database
   */
  static cleanupDb(db: { close: () => void } | null): void {
    if (!db) return;

    try {
      db.close();
    } catch (error) {
      console.error("Failed to cleanup database:", error);
    }
  }

  /**
   * Execute SQL and return results as objects
   */
  static execQuery<T extends Record<string, unknown> = Record<string, unknown>>(
    db: Database,
    sql: string,
    params: BindValue[] = []
  ): T[] {
    const results: T[] = [];
    const stmt = db.prepare(sql);

    try {
      if (params.length > 0) stmt.bind(params);

      while (stmt.step()) {
        results.push(stmt.get<Record<string, unknown>>({}) as T);
      }
    } finally {
      stmt.finalize();
    }

    return results;
  }
}
