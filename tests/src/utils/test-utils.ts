import type { BindValue, SQLite3API } from "@wuchuheng/web-sqlite";

type Database = InstanceType<SQLite3API["oo1"]["DB"]>;
type SQLite3WithOpfs = SQLite3API & {
  opfs?: {
    unlink?: (fsEntryName: string, recursive?: boolean) => Promise<unknown>;
    getResolvedPath?: (filename: string, splitIt?: boolean) => string | string[];
    mkdir?: (dirName: string) => Promise<unknown>;
  };
};

/**
 * Test Utilities
 * Helper functions for assertions and database operations
 */
export class TestUtils {
  private static readonly opfsTestRoot = "tests";
  private static readonly sharedDbFile = "shared-tests.db";
  private static trackedDbFiles = new Set<string>();

  /**
   * Expose the shared OPFS database filename used across suites.
   */
  static getSharedDbFile(): string {
    return this.sharedDbFile;
  }

  /**
   * Normalize test database paths so they are namespaced under the tests directory in OPFS.
   */
  private static normalizeOpfsPath(filename: string): string | null {
    if (!filename) return null;

    const trimmed = filename.trim();
    if (!trimmed) return null;

    const withoutScheme = trimmed.replace(/^file:\/+/, "");
    const withoutQuery = withoutScheme.split("?")[0];
    const segments = withoutQuery.split("/").filter(Boolean);

    if (!segments.length) return null;

    if (segments[0] !== this.opfsTestRoot) {
      segments.unshift(this.opfsTestRoot);
    }

    return segments.join("/");
  }

  /**
   * Best-effort creation of the backing tests directory on OPFS.
   */
  private static async ensureOpfsTestDirectory(
    opfs: NonNullable<SQLite3WithOpfs["opfs"]>
  ): Promise<void> {
    if (typeof opfs.mkdir !== "function") return;

    const target = `/${this.opfsTestRoot}`;
    try {
      await opfs.mkdir(target);
    } catch (_error) {
      // Directory likely already exists; ignore.
    }
  }

  /**
   * Track an OPFS database file for cleanup at test initialization.
   */
  static trackOpfsDb(filename: string): void {
    const normalized = this.normalizeOpfsPath(filename);
    if (normalized) {
      this.trackedDbFiles.add(normalized);
    }
  }

  /**
   * Remove tracked OPFS database files before running tests to avoid state bleed.
   */
  static async cleanupTrackedOpfsDatabases(sqlite3: SQLite3API): Promise<void> {
    const api = sqlite3 as SQLite3WithOpfs;
    const opfs = api.opfs;
    if (!opfs || typeof opfs.unlink !== "function") {
      return;
    }
    await this.ensureOpfsTestDirectory(opfs);

    const files = Array.from(this.trackedDbFiles);
    for (const filename of files) {
      try {
        const resolved = opfs.getResolvedPath
          ? opfs.getResolvedPath(filename)
          : `/${filename}`;
        const target =
          typeof resolved === "string"
            ? resolved
            : `/${resolved.filter(Boolean).join("/")}`;
        await opfs.unlink(target, true);
      } catch (error) {
        console.warn(
          `Failed to cleanup OPFS database ${filename}: ${(error as Error).message}`
        );
      }
    }
  }

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
  static createTestDb(sqlite3: SQLite3API, name?: string): Database {
    const normalized = this.normalizeOpfsPath(name ?? this.sharedDbFile);
    if (!normalized) {
      throw new Error("Test database name is required");
    }

    this.trackedDbFiles.add(normalized);
    const dbName = `file:///${normalized}?vfs=opfs`;
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
