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

  test("should execute parameterized DML and return metadata", async () => {
    const filename = "run-test.sqlite3";
    const db = await openDB(filename, { debug: true });

    // Setup
    await db.exec(
      "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT);"
    );

    // Test Run with positional params
    const result1 = await db.exec("INSERT INTO test (name) VALUES (?)", [
      "foo",
    ]);
    expect(result1.changes).toBe(1);
    expect(result1.lastInsertRowid).toBeDefined();
    expect(result1.lastInsertRowid).toBeTypeOf("number");

    // Test Run with named params
    const result2 = await db.exec("INSERT INTO test (name) VALUES ($n)", {
      $n: "bar",
    });
    expect(result2.changes).toBe(1);
    expect(result2.lastInsertRowid).toBeDefined();
    expect(result2.lastInsertRowid).not.toBe(result1.lastInsertRowid);
    expect(result2.lastInsertRowid).toBeTypeOf("number");

    // Validation (Persistence): Close and Reopen to ensure data is written
    await db.close(); // Close the database
    const db2 = await openDB(filename, { debug: true }); // Reopen it

    // Attempt to select from it (we don't have query yet, but we can try to exec a DDL/DML)
    // For now, simply successfully reopening and not throwing errors implies persistence
    // A full data check will happen with the 'query' phase.
    await db2.exec("SELECT * FROM test"); // Just to ensure it's readable
    await db2.close();
  });
});
