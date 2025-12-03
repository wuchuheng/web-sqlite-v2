import { test, expect } from "vitest";
import { runTestInWorker } from "./worker-client";

const DB_FILE = "/test.db";

test("Create OPFS database", async () => {
  const sql = "SELECT 1;";
  const result = await runTestInWorker("Create OPFS database", sql, DB_FILE);

  // If the test runs without error, the database was created successfully
  expect(result.length).toBe(1);
  expect(result[0]["1"]).toBe(1);
});

test("Create OPFS database with helper", async () => {
  const sql = "SELECT name FROM sqlite_master WHERE type='table';";
  const result = await runTestInWorker(
    "Create OPFS database with helper",
    sql,
    DB_FILE,
  );

  // If the test runs without error, the database helper worked successfully
  expect(Array.isArray(result)).toBe(true);
});

test("Database persistence across connections", async () => {
  const tableName = "lifecycle_persistence_test";

  // First connection - create table and insert data
  const setupSql = `
    CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value TEXT);
    INSERT INTO ${tableName} (value) VALUES ('persistent_data');
  `;
  await runTestInWorker("Setup persistence", setupSql, DB_FILE, true);

  // Second connection - verify data persists
  const verifySql = `SELECT value FROM ${tableName}`;
  const result = await runTestInWorker(
    "Verify persistence across connections",
    verifySql,
    DB_FILE,
  );

  expect(result.length).toBe(1);
  expect(result[0].value).toBe("persistent_data");
});

test("Data persistence across connections", async () => {
  const tableName = "lifecycle_persistence";
  const setupSql = `
    CREATE TABLE ${tableName} (value TEXT);
    INSERT INTO ${tableName} VALUES ('persistent_data');
  `;
  // Skip cleanup so the file persists for the next step
  await runTestInWorker("Setup persistence", setupSql, DB_FILE, true);

  const verifySql = `SELECT value FROM ${tableName}`;
  const result = await runTestInWorker(
    "Verify persistence",
    verifySql,
    DB_FILE,
  );

  expect(result.length).toBe(1);
  expect(result[0].value).toBe("persistent_data");
});

test("Multiple OPFS database connections", async () => {
  // In the worker context, we simulate multiple connections by running two separate worker tasks
  // that access the same database file concurrently-ish (or sequentially, which is fine for this test).
  // The key is that both can open the file without error.

  const checkSql = "SELECT 1";

  // Connection 1
  await runTestInWorker("Connection 1", checkSql, DB_FILE);

  // Connection 2
  await runTestInWorker("Connection 2", checkSql, DB_FILE);

  // If both succeed without throwing, the test passes.
  expect(true).toBe(true);
});
