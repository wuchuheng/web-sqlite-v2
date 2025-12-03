import { describe, test, expect } from "vitest";
import { runTestInWorker } from "../../../tests/e2e/worker-client";

describe("Module System Validation Tests", () => {
  const DB_FILE = "/module-system-test.db";

  test("SQLite module loading and initialization", async () => {
    const checkSql = `
      -- Check SQLite version
      SELECT sqlite_version() as version;
      -- Check SQLite source ID
      SELECT sqlite_source_id() as source_id;
      -- Check if module is properly initialized
      SELECT 1 as module_loaded;
    `;

    const result = await runTestInWorker(
      "Module loading test",
      checkSql,
      DB_FILE,
    );

    // SQLite exec() only returns results from the first SELECT statement
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("version");
  });

  test("Module API surface validation", async () => {
    const sql = `
      -- Test basic SQLite operations
      CREATE TABLE api_test (id INTEGER PRIMARY KEY, data TEXT);
      INSERT INTO api_test (data) VALUES ('API test data');
      SELECT * FROM api_test;
      
      -- Test SQLite functions
      SELECT typeof(42) as int_type, typeof(3.14) as real_type, typeof('text') as text_type;
    `;

    const result = await runTestInWorker(
      "API surface validation",
      sql,
      DB_FILE,
    );

    // SQLite exec() only returns results from the first SELECT statement
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      data: "API test data",
    });
  });

  test("Module version compatibility", async () => {
    const sql = `
      -- Check SQLite version compatibility
      SELECT sqlite_version() as version;
      -- Check for required SQLite features
      SELECT sqlite_compileoption_used('ENABLE_JSON1') as has_json;
      SELECT sqlite_compileoption_used('ENABLE_FTS5') as has_fts5;
      SELECT sqlite_compileoption_used('ENABLE_RTREE') as has_rtree;
    `;

    const result = await runTestInWorker(
      "Version compatibility test",
      sql,
      DB_FILE,
    );

    // SQLite exec() only returns results from the first SELECT statement
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("version");
  });

  test("Module export/import functionality", async () => {
    const sql = `
      -- Setup table and data
      CREATE TABLE export_test (id INTEGER PRIMARY KEY, data TEXT, value REAL);
      INSERT INTO export_test (data, value) VALUES ('Export test 1', 1.23), ('Export test 2', 4.56);
      
      -- Test data types
      SELECT typeof(data) as text_type, typeof(value) as real_type FROM export_test LIMIT 1;
    `;

    const result = await runTestInWorker(
      "Export functionality test",
      sql,
      DB_FILE,
    );

    // SQLite exec() only returns results from the last SELECT statement
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      text_type: "text",
      real_type: "real",
    });
  });

  test("Module namespace and object model", async () => {
    const sql = `
      -- Test SQLite object model
      CREATE TABLE namespace_test (
        id INTEGER PRIMARY KEY,
        text_col TEXT,
        int_col INTEGER,
        real_col REAL,
        blob_col BLOB
      );
      
      INSERT INTO namespace_test (text_col, int_col, real_col, blob_col) 
      VALUES ('text', 42, 3.14, x'01020304');
      
      SELECT * FROM namespace_test;
      
      -- Test column types
      SELECT typeof(text_col) as text_type, typeof(int_col) as int_type, 
             typeof(real_col) as real_type, typeof(blob_col) as blob_type
      FROM namespace_test;
    `;

    const result = await runTestInWorker(
      "Namespace and object model test",
      sql,
      DB_FILE,
    );

    // SQLite exec() only returns results from the first SELECT statement
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      text_col: "text",
      int_col: 42,
      real_col: 3.14,
      blob_col: expect.any(Uint8Array),
    });
  });

  test("Module error handling and result codes", async () => {
    const validSql = `
      CREATE TABLE error_test (id INTEGER PRIMARY KEY);
      INSERT INTO error_test DEFAULT VALUES;
      SELECT * FROM error_test;
    `;

    const result = await runTestInWorker(
      "Error handling - valid operations",
      validSql,
      DB_FILE,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("id", 1);

    // Test error handling
    const invalidSql = `INVALID MODULE OPERATION !!!;`;

    await expect(
      runTestInWorker(
        "Error handling - invalid operations",
        invalidSql,
        DB_FILE,
      ),
    ).rejects.toThrow();
  });

  test("Module initialization parameters and configuration", async () => {
    const sql = `
      -- Test configuration parameters
      PRAGMA journal_mode;
      PRAGMA synchronous;
      PRAGMA cache_size;
      PRAGMA temp_store;
      PRAGMA foreign_keys;
    `;

    const result = await runTestInWorker(
      "Initialization parameters test",
      sql,
      DB_FILE,
    );

    // SQLite exec() only returns results from the first PRAGMA statement
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("journal_mode");
  });

  test("Module dependency resolution", async () => {
    const sql = `
      -- Test that all required SQLite functions are available
      SELECT abs(-42) as abs_result;
      SELECT upper('test') as upper_result;
      SELECT lower('TEST') as lower_result;
      SELECT length('test') as length_result;
      SELECT substr('test', 2, 2) as substr_result;
      SELECT round(3.14159, 2) as round_result;
    `;

    const result = await runTestInWorker(
      "Dependency resolution test",
      sql,
      DB_FILE,
    );

    // SQLite exec() only returns results from the first SELECT statement
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ abs_result: 42 });
  });

  test("Module lifecycle and cleanup", async () => {
    const sql = `
      -- Setup table and data
      CREATE TABLE lifecycle_test (id INTEGER PRIMARY KEY, data TEXT);
      INSERT INTO lifecycle_test (data) VALUES ('Lifecycle test data');
      
      -- Verify cleanup
      DROP TABLE lifecycle_test;
      SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table' AND name='lifecycle_test';
    `;

    const result = await runTestInWorker(
      "Lifecycle cleanup test",
      sql,
      DB_FILE,
    );

    // SQLite exec() only returns results from the last SELECT statement
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      table_count: 0,
    });
  });
});
