import { describe, test, expect } from "vitest";
import { runTestInWorker } from "./worker-client";

describe("Schema Operations Tests", () => {
  const DB_FILE = "/schema_operations.db";

  test("CREATE TABLE with various column types", async () => {
    const tableName = "schema_users";
    const sql = `
      CREATE TABLE ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        age INTEGER,
        balance REAL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}';
    `;

    const result = await runTestInWorker(
      "CREATE TABLE with various column types",
      sql,
      DB_FILE,
    );

    expect(result.length).toBe(1);
    expect(result[0].name).toBe(tableName);
  });

  test("CREATE INDEX on table", async () => {
    const tableName = "schema_products";
    const sql = `
      CREATE TABLE ${tableName} (id INTEGER, name TEXT, price REAL);
      CREATE INDEX idx_${tableName}_name ON ${tableName}(name);
      CREATE INDEX idx_${tableName}_price ON ${tableName}(price);
      SELECT name FROM sqlite_master WHERE type='index';
    `;

    const result = await runTestInWorker("CREATE INDEX on table", sql, DB_FILE);

    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  test("CREATE TABLE and verify schema", async () => {
    const tableName = "schema_products";
    const sql = `
      CREATE TABLE ${tableName} (id INTEGER, name TEXT, price REAL);
      CREATE INDEX idx_${tableName}_name ON ${tableName}(name);
      CREATE INDEX idx_${tableName}_price ON ${tableName}(price);
      SELECT name FROM sqlite_master WHERE type='index';
    `;

    const result = await runTestInWorker(
      "CREATE TABLE and verify schema",
      sql,
      DB_FILE,
    );

    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  test("ALTER TABLE add column", async () => {
    const tableName = "schema_items";
    const sql = `
      CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY);
      ALTER TABLE ${tableName} ADD COLUMN name TEXT;
      PRAGMA table_info(${tableName});
    `;

    const result = await runTestInWorker(
      "ALTER TABLE add column",
      sql,
      DB_FILE,
    );

    expect(result.length).toBe(2);
  });

  test("DROP TABLE", async () => {
    const tableName = "schema_temp_table";
    const sql = `
      CREATE TABLE ${tableName} (id INTEGER);
      DROP TABLE ${tableName};
      SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}';
    `;

    const result = await runTestInWorker("DROP TABLE", sql, DB_FILE);

    expect(result.length).toBe(0);
  });
});
