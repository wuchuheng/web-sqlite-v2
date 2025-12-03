import { describe, test, expect } from "vitest";
import { runTestInWorker } from "./worker-client";

describe("Transactions Tests", () => {
  const DB_FILE = "/transactions.db";

  test("Successful transaction with COMMIT", async () => {
    const tableName = "transactions_commit";
    const sql = `
      CREATE TABLE ${tableName} (value INTEGER);
      INSERT INTO ${tableName} VALUES (1);
      BEGIN TRANSACTION;
      INSERT INTO ${tableName} VALUES (2);
      COMMIT;
      SELECT * FROM ${tableName};
    `;

    const result = await runTestInWorker(
      "Successful transaction",
      sql,
      DB_FILE,
    );

    expect(result.length).toBe(2);
  });

  test("Transaction rollback with ROLLBACK", async () => {
    const tableName = "transactions_rollback";
    const sql = `
      CREATE TABLE ${tableName} (value INTEGER);
      INSERT INTO ${tableName} VALUES (1);
      BEGIN TRANSACTION;
      INSERT INTO ${tableName} VALUES (2);
      ROLLBACK;
      SELECT * FROM ${tableName};
    `;

    const result = await runTestInWorker("Transaction rollback", sql, DB_FILE);

    expect(result.length).toBe(1);
    expect(result[0].value).toBe(1);
  });

  test("Automatic rollback on error - constraint violation", async () => {
    const tableName = "transactions_auto_rollback_constraint";
    const sql = `
      CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value TEXT);
      INSERT INTO ${tableName} VALUES (1, 'first');
      
      -- Start transaction and insert valid data
      BEGIN TRANSACTION;
      INSERT INTO ${tableName} VALUES (2, 'second');
      
      -- This will cause a constraint violation (duplicate primary key)
      INSERT INTO ${tableName} VALUES (1, 'duplicate');
    `;

    // The transaction should fail and automatically rollback
    await expect(
      runTestInWorker(
        "Automatic rollback on constraint violation",
        sql,
        DB_FILE,
      ),
    ).rejects.toThrow();

    // Verify that the transaction was rolled back (only 'first' should exist)
    const checkSql = `SELECT * FROM ${tableName} ORDER BY id;`;
    const result = await runTestInWorker(
      "Check after constraint violation",
      checkSql,
      DB_FILE,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 1, value: "first" });
  });

  test("Automatic rollback on error - syntax error", async () => {
    const tableName = "transactions_auto_rollback_syntax";
    const sql = `
      CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value TEXT);
      INSERT INTO ${tableName} VALUES (1, 'first');
      
      -- Start transaction and insert valid data
      BEGIN TRANSACTION;
      INSERT INTO ${tableName} VALUES (2, 'second');
      
      -- This will cause a syntax error
      INVALID SQL SYNTAX HERE;
    `;

    // The transaction should fail due to syntax error
    await expect(
      runTestInWorker("Automatic rollback on syntax error", sql, DB_FILE),
    ).rejects.toThrow();

    // Verify that the transaction was rolled back (only 'first' should exist)
    const checkSql = `SELECT * FROM ${tableName} ORDER BY id;`;
    const result = await runTestInWorker(
      "Check after syntax error",
      checkSql,
      DB_FILE,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 1, value: "first" });
  });

  test("Automatic rollback on error - type mismatch", async () => {
    const tableName = "transactions_auto_rollback_type";
    const sql = `
      CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value INTEGER CHECK (value > 0));
      INSERT INTO ${tableName} VALUES (1, 100);
      
      -- Start transaction and insert valid data
      BEGIN TRANSACTION;
      INSERT INTO ${tableName} VALUES (2, 200);
      
      -- This will cause a constraint violation error (negative value violates CHECK constraint)
      INSERT INTO ${tableName} VALUES (3, -50);
    `;

    // The transaction should fail due to constraint violation
    await expect(
      runTestInWorker(
        "Automatic rollback on constraint violation",
        sql,
        DB_FILE,
      ),
    ).rejects.toThrow();

    // Verify that the transaction was rolled back (only the first row should exist)
    const checkSql = `SELECT * FROM ${tableName} ORDER BY id;`;
    const result = await runTestInWorker(
      "Check after constraint violation",
      checkSql,
      DB_FILE,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 1, value: 100 });
  });

  test("Nested savepoints", async () => {
    const tableName = "transactions_savepoints";
    const sql = `
      CREATE TABLE ${tableName} (value INTEGER);
      BEGIN TRANSACTION;
      INSERT INTO ${tableName} VALUES (1);
      
      SAVEPOINT sp1;
      INSERT INTO ${tableName} VALUES (2);
      
      SAVEPOINT sp2;
      INSERT INTO ${tableName} VALUES (3);
      
      ROLLBACK TO sp2;
      COMMIT;
      
      SELECT * FROM ${tableName};
    `;

    const result = await runTestInWorker("Nested savepoints", sql, DB_FILE);

    // Should have 1 and 2 (3 was rolled back)
    expect(result.length).toBe(2);
    expect(result.find((r: any) => r.value === 1)).toBeTruthy();
    expect(result.find((r: any) => r.value === 2)).toBeTruthy();
    expect(result.find((r: any) => r.value === 3)).toBeFalsy();
  });
});
