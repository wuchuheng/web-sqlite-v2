import { describe, test, expect } from "vitest";
import openDB from "web-sqlite-js";

describe("error handling e2e tests", () => {
  test("should throw error when executing invalid SQL with exec", async () => {
    const filename = "error-exec.sqlite3";
    const db = await openDB(filename);

    // Invalid SQL syntax
    await expect(db.exec("SELECT * FROM;")).rejects.toThrow();

    // Cleanup
    await db.close();
  });

  test("should throw error when executing DML on non-existent table", async () => {
    const filename = "error-run.sqlite3";
    const db = await openDB(filename, { debug: true });

    // Table 'missing_table' does not exist
    await expect(
      db.exec("INSERT INTO missing_table (name) VALUES (?)", ["test"]),
    ).rejects.toThrow();

    // Cleanup
    await db.close();
  });

  test("should throw error when db is closed", async () => {
    const filename = "error-close.sqlite3";
    const db = await openDB(filename);
    await db.close();

    // Attempt to execute after close
    await expect(db.exec("CREATE TABLE test (id INT)")).rejects.toThrow(
      "Database is not open",
    );
  });

  test("should throw on invalid release version format", async () => {
    const filename = "error-release-format.sqlite3";
    await expect(
      openDB(filename, {
        releases: [
          {
            version: "01.0.0",
            migrationSQL: "CREATE TABLE t (id INTEGER PRIMARY KEY);",
          },
        ],
      }),
    ).rejects.toThrow();
  });

  test("should throw on non-increasing release versions", async () => {
    const filename = "error-release-order.sqlite3";
    await expect(
      openDB(filename, {
        releases: [
          {
            version: "0.0.1",
            migrationSQL: "CREATE TABLE t (id INTEGER PRIMARY KEY);",
          },
          {
            version: "0.0.0",
            migrationSQL: "CREATE TABLE t2 (id INTEGER PRIMARY KEY);",
          },
        ],
      }),
    ).rejects.toThrow();
  });
});
