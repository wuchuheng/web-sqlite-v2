import { describe, test, expect } from "vitest";
import openDB from "web-sqlite-js";

describe("exec e2e tests", () => {
  test("should execute DDL and DML scripts", async () => {
    const filename = "exec-phase1.sqlite3";
    const db = await openDB(filename);

    // DDL: Create table
    await db.exec(
      "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT);"
    );

    // DML: Insert data via script
    await db.exec(
      "INSERT INTO test (name) VALUES ('a'); INSERT INTO test (name) VALUES ('b');"
    );

    // Validation: Check file size in OPFS
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(filename);
    const file = await handle.getFile();

    // SQLite header is 100 bytes, plus pages. It should be significant.
    expect(file.size).toBeGreaterThan(100);
  });
});
