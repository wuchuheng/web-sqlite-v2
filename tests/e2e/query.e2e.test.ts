import { describe, test, expect } from "vitest";
import openDB from "web-sqlite-js";

describe("query e2e tests", () => {
  test("should execute query and return typed rows", async () => {
    // 1. Setup: Test table and insert data.
    const filename = "query-test.sqlite3";
    const db = await openDB(filename);

    // 1.1 Remove existing table, then create table and insert data.
    await db.exec("DROP TABLE IF EXISTS test;");

    await db.exec(
      "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT);",
    );

    type TestItem = {
      id: number;
      name: string;
    };

    const testData: TestItem[] = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];

    // 1.2 Fill the mock data.
    for (const row of testData) {
      await db.exec("INSERT INTO test (id, name) VALUES ($id, $name);", {
        $id: row.id,
        $name: row.name,
      });
    }

    // 2. Test the query API.
    const rows = await db.query<TestItem>("SELECT * FROM test");

    expect(rows).toHaveLength(testData.length);
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i].id).toBe(testData[i].id);
      expect(rows[i].name).toBe(testData[i].name);
    }

    await db.close();
  });

  // Multiple db instances to test the same database file.
  test("should handle multiple db instances querying the same database file", async () => {
    const filename = "multi-instance-query-test.sqlite3";

    // 1. First instance: create table and insert data.
    const db1 = await openDB(filename);
    const db2 = await openDB(filename);
    await db1.exec("DROP TABLE IF EXISTS test_multi;");
    await db1.exec(
      "CREATE TABLE IF NOT EXISTS test_multi (id INTEGER PRIMARY KEY, value TEXT);",
    );
    await db1.exec(
      "INSERT INTO test_multi (id, value) VALUES (1, 'First'), (2, 'Second');",
    );

    // 2. Use the db2 to query the data that inserted by db1.
    const rows = await db2.query<{ id: number; value: string }>(
      "SELECT * FROM test_multi;",
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: 1, value: "First" });
    expect(rows[1]).toEqual({ id: 2, value: "Second" });

    await db1.close();
    await db2.close();
  });
});
