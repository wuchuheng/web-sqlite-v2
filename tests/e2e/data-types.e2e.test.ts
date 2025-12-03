import { describe, test, expect } from "vitest";
import { runTestInWorker } from "./worker-client";

describe("Data Types Tests", () => {
  const DB_FILE = "/data_types.db";

  test("INTEGER type", async () => {
    const tableName = "datatype_integer";
    const sql = `
      CREATE TABLE ${tableName} (value INTEGER);
      INSERT INTO ${tableName} VALUES (42), (-100), (0);
      SELECT * FROM ${tableName};
    `;

    const result = await runTestInWorker("INTEGER type", sql, DB_FILE);

    expect(result[0].value).toBe(42);
    expect(result[1].value).toBe(-100);
    expect(result[2].value).toBe(0);
  });

  test("REAL type", async () => {
    const tableName = "datatype_real";
    const sql = `
      CREATE TABLE ${tableName} (value REAL);
      INSERT INTO ${tableName} VALUES (3.14), (-2.5), (0.0);
      SELECT * FROM ${tableName};
    `;

    const result = await runTestInWorker("REAL type", sql, DB_FILE);

    expect(Math.abs((result[0].value as number) - 3.14)).toBeLessThan(0.001);
  });

  test("TEXT type", async () => {
    const tableName = "datatype_text";
    const sql = `
      CREATE TABLE ${tableName} (value TEXT);
      INSERT INTO ${tableName} VALUES ('Hello'), (''), ('Unicode: 你好 🚀');
      SELECT * FROM ${tableName};
    `;

    const result = await runTestInWorker("TEXT type", sql, DB_FILE);

    expect(result[0].value).toBe("Hello");
    expect(result[1].value).toBe("");
    expect(result[2].value).toBe("Unicode: 你好 🚀");
  });

  test("BLOB type", async () => {
    const tableName = "datatype_blob";
    // Note: Passing binary data via SQL string is tricky (requires hex literal or bind params).
    // Our simple worker helper takes a SQL string.
    // We can use hex literal: x'0102030405'
    const sql = `
      CREATE TABLE ${tableName} (value BLOB);
      INSERT INTO ${tableName} VALUES (x'0102030405');
      SELECT LENGTH(value) as len FROM ${tableName};
    `;

    const result = await runTestInWorker("BLOB type", sql, DB_FILE);

    expect(result[0].len).toBe(5);
  });

  test("NULL values", async () => {
    const tableName = "datatype_nullable";
    const sql = `
      CREATE TABLE ${tableName} (value TEXT);
      INSERT INTO ${tableName} VALUES (NULL), ('not null');
      SELECT * FROM ${tableName};
    `;

    const result = await runTestInWorker("NULL values", sql, DB_FILE);

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBe("not null");
  });
});
