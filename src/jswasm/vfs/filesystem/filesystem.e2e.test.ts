import { describe, test, expect } from "vitest";
import { runTestInWorker } from "../../../../tests/e2e/worker-client";

describe("filesystem.e2e", () => {
  test("should create filesystem with valid configuration", async () => {
    const sql = `
      -- Test filesystem creation by performing basic operations
      CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT);
      INSERT INTO test_table (name) VALUES ('test');
      SELECT * FROM test_table;
    `;

    const result = await runTestInWorker(
      "filesystem-creation-test",
      sql,
      "test-filesystem.db",
      false, // cleanup after test
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 1, name: "test" });
  });

  test("should handle filesystem operations with OPFS", async () => {
    const sql = `
      -- Test filesystem operations that would use the composed modules
      CREATE TABLE files (id INTEGER PRIMARY KEY, filename TEXT, content BLOB);
      INSERT INTO files (filename, content) VALUES ('test.txt', 'Hello World');
      SELECT filename, length(content) as content_length FROM files;
    `;

    const result = await runTestInWorker(
      "filesystem-opfs-test",
      sql,
      "test-filesystem-opfs.db",
      false, // cleanup after test
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      filename: "test.txt",
      content_length: 11,
    });
  });

  test("should handle multiple filesystem operations in sequence", async () => {
    // First operation: create and populate
    const sql1 = `
      CREATE TABLE sequence_test (id INTEGER PRIMARY KEY, value INTEGER);
      INSERT INTO sequence_test (value) VALUES (1), (2), (3);
    `;

    await runTestInWorker(
      "filesystem-sequence-1",
      sql1,
      "test-filesystem-sequence.db",
      true, // keep file for next test
    );

    // Second operation: verify persistence and add more data
    const sql2 = `
      SELECT COUNT(*) as final_count FROM sequence_test;
    `;

    const result = await runTestInWorker(
      "filesystem-sequence-2",
      sql2,
      "test-filesystem-sequence.db",
      false, // cleanup after test
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ final_count: 3 });
  });

  test("should handle filesystem with complex operations", async () => {
    const sql = `
      -- Test complex filesystem operations that exercise multiple composed modules
      CREATE TABLE complex_test (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        data BLOB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      INSERT INTO complex_test (name, data) VALUES 
        ('file1', 'binary data here'),
        ('file2', 'more binary data');
        
      SELECT name, length(data) as size FROM complex_test ORDER BY name;
    `;

    const result = await runTestInWorker(
      "filesystem-complex-test",
      sql,
      "test-filesystem-complex.db",
      false, // cleanup after test
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "file1", size: 16 });
    expect(result[1]).toEqual({ name: "file2", size: 16 });
  });

  test("should handle filesystem error conditions gracefully", async () => {
    const sql = `
      -- This should cause an error that should be properly handled
      CREATE TABLE error_test (id INTEGER PRIMARY KEY);
      INSERT INTO error_test (id) VALUES (1);
      INSERT INTO error_test (id) VALUES (1); -- Duplicate primary key
    `;

    await expect(
      runTestInWorker(
        "filesystem-error-test",
        sql,
        "test-filesystem-error.db",
        false, // cleanup after test
      ),
    ).rejects.toThrow();
  });
});
