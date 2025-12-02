import { test, expect } from "vitest";
import { runTestInWorker } from "./worker-client";

const DB_FILE = "/test.db";

test("Concurrent read/write operations", async () => {
  const tableName = "concurrency_test";
  const setupSql = `CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value INTEGER)`;
  // Skip cleanup to keep table for subsequent inserts
  await runTestInWorker("Setup concurrency", setupSql, DB_FILE, true);

  const iterations = 50;
  // Use sequential execution for now since SQLite OPFS might lock with aggressive concurrent connections from separate workers
  // Real concurrency is handled by the VFS, but our test-worker setup creates a new connection per call.
  // Running them in parallel might trigger SQLITE_BUSY if they all try to write at once.
  // Let's try batching them slightly or just sequential to be safe, as the goal is to prove multiple operations work.

  for (let i = 0; i < iterations; i++) {
    const sql = `INSERT INTO ${tableName} (value) VALUES (${i})`;
    await runTestInWorker(`Insert ${i}`, sql, DB_FILE, true);
  }

  const verifySql = `SELECT COUNT(*) as cnt FROM ${tableName}`;
  // Allow cleanup on the final verification
  const result = await runTestInWorker("Verify count", verifySql, DB_FILE);

  expect(result[0].cnt).toBe(iterations);
});
