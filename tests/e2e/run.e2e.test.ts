import { describe, test, expect } from "vitest";
import openDB from "web-sqlite-js";

describe("run e2e tests", () => {
  test("should execute parameterized DML and return metadata", async () => {
    const filename = "run-test.sqlite3";
    const db = await openDB(filename, { debug: true });

    // Setup
    await db.exec(
      "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT);"
    );

    // Test Run with positional params
    const result1 = await db.run("INSERT INTO test (name) VALUES (?)", ["foo"]);
    expect(result1.changes).toBe(1);
    expect(result1.lastInsertRowid).toBeDefined();

    // Test Run with named params
    const result2 = await db.run("INSERT INTO test (name) VALUES ($n)", {
      $n: "bar",
    });
    expect(result2.changes).toBe(1);
    expect(result2.lastInsertRowid).toBeDefined();
    expect(result2.lastInsertRowid).not.toBe(result1.lastInsertRowid);

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
