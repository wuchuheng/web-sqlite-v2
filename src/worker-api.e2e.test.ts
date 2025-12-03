import { describe, test, expect } from "vitest";
import { runTestInWorker } from "../tests/e2e/worker-client";

describe("Worker API Tests", () => {
  const DB_FILE = "/worker-api-test.db";

  test("Worker initialization and SQLite module loading", async () => {
    const result = await runTestInWorker(
      "Worker initialization check",
      "",
      DB_FILE,
      false,
      true, // checkEnv flag
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sqlite3Loaded: true,
      opfsVfsAvailable: true,
      dbClassAvailable: true,
    });
    expect(result[0].version).toBeDefined();
  });

  test("Worker message handling for database operations", async () => {
    const sql = `
      CREATE TABLE test_messages (id INTEGER PRIMARY KEY, message TEXT);
      INSERT INTO test_messages (message) VALUES ('Hello from worker');
      SELECT * FROM test_messages;
    `;

    const result = await runTestInWorker(
      "Worker message handling test",
      sql,
      DB_FILE,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      message: "Hello from worker",
    });
  });

  test("Worker error handling and propagation", async () => {
    const invalidSql = "INVALID SQL SYNTAX !!!";

    await expect(
      runTestInWorker("Worker error handling test", invalidSql, DB_FILE),
    ).rejects.toThrow();
  });

  test("Worker cleanup and resource management", async () => {
    const sql = `
      CREATE TABLE cleanup_test (id INTEGER PRIMARY KEY);
      INSERT INTO cleanup_test DEFAULT VALUES;
      SELECT * FROM cleanup_test;
    `;

    const result = await runTestInWorker("Worker cleanup test", sql, DB_FILE);

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("id", 1);
  });

  test("Worker concurrent request handling", async () => {
    const promises = [];

    for (let i = 0; i < 3; i++) {
      const sql = `
        CREATE TABLE IF NOT EXISTS concurrent_test (id INTEGER PRIMARY KEY, value INTEGER);
        INSERT INTO concurrent_test (value) VALUES (${i});
        SELECT * FROM concurrent_test WHERE value = ${i};
      `;

      promises.push(
        runTestInWorker(
          `Concurrent test ${i}`,
          sql,
          `/concurrent-test-${i}.db`,
        ),
      );
    }

    const results = await Promise.all(promises);

    results.forEach((result, index) => {
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        value: index,
      });
    });
  });

  test("Worker timeout and long-running operations", async () => {
    const sql = `
      CREATE TABLE timeout_test (id INTEGER PRIMARY KEY);
      WITH RECURSIVE counter(i) AS (
        SELECT 1
        UNION ALL
        SELECT i + 1 FROM counter WHERE i < 100
      )
      INSERT INTO timeout_test SELECT i FROM counter;
      SELECT COUNT(*) as count FROM timeout_test;
    `;

    const result = await runTestInWorker("Worker timeout test", sql, DB_FILE);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      count: 100,
    });
  });

  test("Worker memory management and large result sets", async () => {
    const sql = `
      CREATE TABLE memory_test (id INTEGER PRIMARY KEY, data TEXT);
      WITH RECURSIVE data_generator(i) AS (
        SELECT 1
        UNION ALL
        SELECT i + 1 FROM data_generator WHERE i < 50
      )
      INSERT INTO memory_test (data) SELECT 'Test data row ' || i FROM data_generator;
      SELECT * FROM memory_test ORDER BY id;
    `;

    const result = await runTestInWorker(
      "Worker memory management test",
      sql,
      DB_FILE,
    );

    expect(result).toHaveLength(50);
    expect(result[0]).toMatchObject({
      id: 1,
      data: "Test data row 1",
    });
    expect(result[49]).toMatchObject({
      id: 50,
      data: "Test data row 50",
    });
  });

  test("Worker database connection persistence", async () => {
    const sql = `
      CREATE TABLE persistence_test (id INTEGER PRIMARY KEY, value TEXT);
      INSERT INTO persistence_test (value) VALUES ('Initial value');
      SELECT * FROM persistence_test;
    `;

    const result = await runTestInWorker("Check persistence", sql, DB_FILE);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      value: "Initial value",
    });
  });

  test("Worker VFS integration verification", async () => {
    const sql = `
      PRAGMA journal_mode;
    `;

    const result = await runTestInWorker("VFS integration test", sql, DB_FILE);

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("journal_mode");
  });

  test("Worker transaction state isolation", async () => {
    const sql = `
      CREATE TABLE isolation_test (id INTEGER PRIMARY KEY, value INTEGER);
      BEGIN TRANSACTION;
      INSERT INTO isolation_test (value) VALUES (42);
      SELECT * FROM isolation_test;
    `;

    const result = await runTestInWorker(
      "Transaction isolation test",
      sql,
      DB_FILE,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      value: 42,
    });
  });
});
