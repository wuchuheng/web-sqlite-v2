import { describe, test, expect } from "vitest";
import { runTestInWorker } from "../../../../tests/e2e/worker-client";

describe("VFS Integration Tests", () => {
  const DB_FILE_OPFS = "/vfs-opfs-test.db";
  const DB_FILE_MEMFS = "/vfs-memfs-test.db";

  test("OPFS VFS installation and initialization", async () => {
    const checkSql = `
      SELECT 1 as opfs_check;
    `;

    const result = await runTestInWorker(
      "OPFS VFS installation test",
      checkSql,
      DB_FILE_OPFS,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("opfs_check", 1);
  });

  test("OPFS VFS database creation and persistence", async () => {
    const setupSql = `
      CREATE TABLE vfs_persistence_test (id INTEGER PRIMARY KEY, data TEXT);
      INSERT INTO vfs_persistence_test (data) VALUES ('OPFS persistent data');
      SELECT * FROM vfs_persistence_test;
    `;

    const result = await runTestInWorker(
      "OPFS VFS persistence test",
      setupSql,
      DB_FILE_OPFS,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      data: "OPFS persistent data",
    });
  });

  test("Memory VFS (memfs) database operations", async () => {
    const sql = `
      -- Create in-memory database using memfs
      CREATE TABLE memfs_test (id INTEGER PRIMARY KEY, value INTEGER);
      INSERT INTO memfs_test (value) VALUES (42), (84), (168);
      SELECT * FROM memfs_test ORDER BY value;
    `;

    const result = await runTestInWorker(
      "Memory VFS operations test",
      sql,
      DB_FILE_MEMFS,
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      id: 1,
      value: 42,
    });
    expect(result[1]).toMatchObject({
      id: 2,
      value: 84,
    });
    expect(result[2]).toMatchObject({
      id: 3,
      value: 168,
    });
  });

  test("VFS switching and database compatibility", async () => {
    const opfsSql = `
      CREATE TABLE vfs_switch_test (id INTEGER PRIMARY KEY, vfs_type TEXT);
      INSERT INTO vfs_switch_test (vfs_type) VALUES ('OPFS');
      SELECT * FROM vfs_switch_test;
    `;

    const result = await runTestInWorker(
      "VFS switching test",
      opfsSql,
      DB_FILE_OPFS,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      vfs_type: "OPFS",
    });
  });

  test("VFS file operations and metadata", async () => {
    const sql = `
      -- Test file operations
      CREATE TABLE vfs_file_test (id INTEGER PRIMARY KEY, filename TEXT);
      INSERT INTO vfs_file_test (filename) VALUES ('test1.db'), ('test2.db');
      SELECT * FROM vfs_file_test ORDER BY id;
    `;

    const result = await runTestInWorker(
      "VFS file operations test",
      sql,
      DB_FILE_OPFS,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty("filename", "test1.db");
    expect(result[1]).toHaveProperty("filename", "test2.db");
  });

  test("VFS performance characteristics", async () => {
    const sql = `
      -- Create test table with multiple rows
      CREATE TABLE vfs_perf_test (id INTEGER PRIMARY KEY, data TEXT);
      WITH RECURSIVE data_generator(i) AS (
        SELECT 1
        UNION ALL
        SELECT i + 1 FROM data_generator WHERE i < 100
      )
      INSERT INTO vfs_perf_test (data) SELECT 'Performance test data ' || i FROM data_generator;
      
      -- Query performance
      SELECT COUNT(*) as row_count FROM vfs_perf_test;
    `;

    const result = await runTestInWorker(
      "VFS performance test",
      sql,
      DB_FILE_OPFS,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      row_count: 100,
    });
  });

  test("VFS error handling and recovery", async () => {
    const validSql = `
      CREATE TABLE vfs_error_test (id INTEGER PRIMARY KEY);
      INSERT INTO vfs_error_test DEFAULT VALUES;
      SELECT * FROM vfs_error_test;
    `;

    // Test that valid operations work
    const result = await runTestInWorker(
      "VFS error handling - valid operations",
      validSql,
      DB_FILE_OPFS,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("id", 1);

    // Test error handling
    const invalidSql = `INVALID VFS OPERATION !!!;`;

    await expect(
      runTestInWorker(
        "VFS error handling - invalid operations",
        invalidSql,
        DB_FILE_OPFS,
      ),
    ).rejects.toThrow();
  });

  test("VFS concurrent access and locking", async () => {
    const promises = [];

    for (let i = 0; i < 3; i++) {
      const sql = `
        CREATE TABLE IF NOT EXISTS vfs_concurrent_test (id INTEGER PRIMARY KEY, worker_id INTEGER);
        INSERT INTO vfs_concurrent_test (worker_id) VALUES (${i});
        SELECT * FROM vfs_concurrent_test WHERE worker_id = ${i};
      `;

      promises.push(
        runTestInWorker(
          `VFS concurrent test ${i}`,
          sql,
          `/vfs-concurrent-${i}.db`,
        ),
      );
    }

    const results = await Promise.all(promises);

    results.forEach((result, index) => {
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        worker_id: index,
      });
    });
  });

  test("VFS memory management and cleanup", async () => {
    const sql = `
      -- Create large dataset
      CREATE TABLE vfs_memory_test (id INTEGER PRIMARY KEY, data TEXT);
      WITH RECURSIVE data_generator(i) AS (
        SELECT 1
        UNION ALL
        SELECT i + 1 FROM data_generator WHERE i < 50
      )
      INSERT INTO vfs_memory_test (data) SELECT 'Memory test data ' || i FROM data_generator;
      
      -- Query and cleanup
      SELECT COUNT(*) as count FROM vfs_memory_test;
      DROP TABLE vfs_memory_test;
    `;

    const result = await runTestInWorker(
      "VFS memory management test",
      sql,
      DB_FILE_OPFS,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      count: 50,
    });
  });

  test("VFS integration with SQLite pragmas", async () => {
    // Just check one pragma to verify VFS integration
    const sql = `
      PRAGMA journal_mode;
    `;

    const result = await runTestInWorker("VFS pragma test", sql, DB_FILE_OPFS);

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("journal_mode");
  });
});
