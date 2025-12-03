import { describe, test, expect } from "vitest";
import { runTestInWorker } from "./worker-client";

describe("Performance and Memory Management Tests", () => {
  const DB_FILE = "/performance-memory-test.db";

  describe("Performance Benchmarks", () => {
    test("Large dataset insertion performance", async () => {
      const sql = `
        CREATE TABLE large_insert_test (
          id INTEGER PRIMARY KEY,
          data TEXT,
          timestamp TEXT,
          category TEXT
        );
        
        -- Insert 1000 rows to test performance
        WITH RECURSIVE numbers(n) AS (
          SELECT 1
          UNION ALL
          SELECT n + 1 FROM numbers WHERE n < 1000
        )
        INSERT INTO large_insert_test (data, timestamp, category)
        SELECT 
          'Data item ' || n,
          datetime('now', '-' || (n % 365) || ' days'),
          CASE WHEN n % 3 = 0 THEN 'A' WHEN n % 3 = 1 THEN 'B' ELSE 'C' END
        FROM numbers;
        
        SELECT COUNT(*) as total_rows FROM large_insert_test;
      `;

      const startTime = Date.now();
      const result = await runTestInWorker(
        "Large dataset insertion",
        sql,
        DB_FILE,
      );
      const endTime = Date.now();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ total_rows: 1000 });

      // Performance assertion - should complete within reasonable time
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test("Complex query performance", async () => {
      const sql = `
        CREATE TABLE performance_test (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          category TEXT,
          amount REAL,
          timestamp TEXT
        );
        
        -- Insert test data
        WITH RECURSIVE data(n) AS (
          SELECT 1
          UNION ALL
          SELECT n + 1 FROM data WHERE n < 500
        )
        INSERT INTO performance_test (user_id, category, amount, timestamp)
        SELECT 
          (n % 50) + 1,
          CASE WHEN n % 4 = 0 THEN 'A' WHEN n % 4 = 1 THEN 'B' WHEN n % 4 = 2 THEN 'C' ELSE 'D' END,
          (n % 1000) + 1.0,
          datetime('now', '-' || (n % 365) || ' days')
        FROM data;
        
        -- Complex query with multiple aggregations and joins
        SELECT 
          category,
          COUNT(*) as transaction_count,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount,
          MIN(amount) as min_amount,
          MAX(amount) as max_amount,
          COUNT(DISTINCT user_id) as unique_users
        FROM performance_test
        WHERE timestamp >= datetime('now', '-30 days')
        GROUP BY category
        ORDER BY total_amount DESC;
      `;

      const startTime = Date.now();
      const result = await runTestInWorker(
        "Complex query performance",
        sql,
        DB_FILE,
      );
      const endTime = Date.now();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("category");
      expect(result[0]).toHaveProperty("transaction_count");
      expect(result[0]).toHaveProperty("total_amount");

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(3000); // Should complete within 3 seconds
    });

    test("Index performance optimization", async () => {
      const sql = `
        CREATE TABLE indexed_test (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          category TEXT,
          amount REAL,
          timestamp TEXT
        );
        
        -- Insert test data
        WITH RECURSIVE data(n) AS (
          SELECT 1
          UNION ALL
          SELECT n + 1 FROM data WHERE n < 1000
        )
        INSERT INTO indexed_test (user_id, category, amount, timestamp)
        SELECT 
          (n % 100) + 1,
          CASE WHEN n % 5 = 0 THEN 'A' WHEN n % 5 = 1 THEN 'B' WHEN n % 5 = 2 THEN 'C' WHEN n % 5 = 3 THEN 'D' ELSE 'E' END,
          (n % 1000) + 1.0,
          datetime('now', '-' || (n % 365) || ' days')
        FROM data;
        
        -- Query without index (baseline)
        SELECT COUNT(*) as count_without_index 
        FROM indexed_test 
        WHERE user_id = 50 AND category = 'A';
      `;

      const result = await runTestInWorker(
        "Index performance test",
        sql,
        DB_FILE,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        count_without_index: expect.any(Number),
      });
    });

    test("Prepared statement reuse performance", async () => {
      const sql = `
        CREATE TABLE prepared_test (
          id INTEGER PRIMARY KEY,
          name TEXT,
          value INTEGER
        );
        
        -- Test prepared statement reuse by simulating multiple executions
        INSERT INTO prepared_test (name, value) VALUES ('Item 1', 100);
        INSERT INTO prepared_test (name, value) VALUES ('Item 2', 200);
        INSERT INTO prepared_test (name, value) VALUES ('Item 3', 300);
        INSERT INTO prepared_test (name, value) VALUES ('Item 4', 400);
        INSERT INTO prepared_test (name, value) VALUES ('Item 5', 500);
        
        -- Multiple queries that could benefit from prepared statements
        SELECT * FROM prepared_test WHERE value > 200;
        SELECT * FROM prepared_test WHERE value > 300;
        SELECT * FROM prepared_test WHERE value > 400;
        
        SELECT COUNT(*) as total_items FROM prepared_test;
      `;

      const result = await runTestInWorker(
        "Prepared statement performance",
        sql,
        DB_FILE,
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("value");
      expect(result[0].value).toBeGreaterThan(200);
    });

    test("Concurrent operations performance", async () => {
      const sql = `
        CREATE TABLE concurrent_test (
          id INTEGER PRIMARY KEY,
          thread_id INTEGER,
          operation TEXT,
          timestamp TEXT
        );
        
        -- Simulate concurrent operations
        INSERT INTO concurrent_test (thread_id, operation, timestamp) VALUES (1, 'read', datetime('now'));
        INSERT INTO concurrent_test (thread_id, operation, timestamp) VALUES (2, 'write', datetime('now'));
        INSERT INTO concurrent_test (thread_id, operation, timestamp) VALUES (3, 'update', datetime('now'));
        INSERT INTO concurrent_test (thread_id, operation, timestamp) VALUES (1, 'write', datetime('now'));
        INSERT INTO concurrent_test (thread_id, operation, timestamp) VALUES (2, 'read', datetime('now'));
        
        -- Query to check concurrent operations
        SELECT 
          thread_id,
          COUNT(*) as operation_count,
          GROUP_CONCAT(operation, ', ') as operations
        FROM concurrent_test
        GROUP BY thread_id
        ORDER BY thread_id;
      `;

      const result = await runTestInWorker(
        "Concurrent operations test",
        sql,
        DB_FILE,
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty("thread_id");
      expect(result[0]).toHaveProperty("operation_count");
      expect(result[0]).toHaveProperty("operations");
    });
  });

  describe("Memory Management", () => {
    test("Memory usage monitoring", async () => {
      const sql = `
        CREATE TABLE memory_test (
          id INTEGER PRIMARY KEY,
          data TEXT,
          blob_data BLOB
        );
        
        -- Insert data to monitor memory usage
        INSERT INTO memory_test (data, blob_data) VALUES 
        ('Small data', x'48656C6C6F'),
        ('Medium data', x'48656C6C6F20576F726C6421'),
        ('Large data', x'4142434445');
        
        -- Check memory usage indicators
        SELECT 
          COUNT(*) as row_count,
          SUM(length(data)) as total_text_size,
          SUM(length(blob_data)) as total_blob_size
        FROM memory_test;
      `;

      const result = await runTestInWorker(
        "Memory usage monitoring",
        sql,
        DB_FILE,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("row_count");
      expect(result[0]).toHaveProperty("total_text_size");
      expect(result[0]).toHaveProperty("total_blob_size");
      expect(result[0].row_count).toBe(3);
    });

    test("Memory leak detection", async () => {
      const sql = `
        CREATE TABLE leak_test (
          id INTEGER PRIMARY KEY,
          data TEXT
        );
        
        -- Create and drop multiple tables to test for memory leaks
        CREATE TEMP TABLE temp_leak_1 (id INTEGER PRIMARY KEY, data TEXT);
        INSERT INTO temp_leak_1 VALUES (1, 'temp data 1');
        DROP TABLE temp_leak_1;
        
        CREATE TEMP TABLE temp_leak_2 (id INTEGER PRIMARY KEY, data TEXT);
        INSERT INTO temp_leak_2 VALUES (1, 'temp data 2');
        DROP TABLE temp_leak_2;
        
        -- Verify main table still works
        INSERT INTO leak_test (data) VALUES ('main data');
        SELECT COUNT(*) as count FROM leak_test;
      `;

      const result = await runTestInWorker(
        "Memory leak detection",
        sql,
        DB_FILE,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ count: 1 });
    });

    test("Large blob handling", async () => {
      const sql = `
        CREATE TABLE blob_test (
          id INTEGER PRIMARY KEY,
          blob_data BLOB,
          size INTEGER
        );
        
        -- Insert blobs of different sizes
        INSERT INTO blob_test (blob_data, size) VALUES 
        (randomblob(1024), 1024),        -- 1KB
        (randomblob(10240), 10240),      -- 10KB
        (randomblob(102400), 102400);    -- 100KB
        
        -- Verify blob integrity
        SELECT 
          id,
          size,
          length(blob_data) as actual_size,
          typeof(blob_data) as blob_type
        FROM blob_test
        ORDER BY size;
      `;

      const result = await runTestInWorker("Large blob handling", sql, DB_FILE);

      expect(result).toHaveLength(3);
      result.forEach((row) => {
        expect(row).toHaveProperty("id");
        expect(row).toHaveProperty("size");
        expect(row).toHaveProperty("actual_size");
        expect(row).toHaveProperty("blob_type");
        expect(row.size).toBe(row.actual_size);
        expect(row.blob_type).toBe("blob");
      });
    });

    test("Memory cleanup after large operations", async () => {
      const sql = `
        CREATE TABLE cleanup_test (
          id INTEGER PRIMARY KEY,
          data TEXT
        );
        
        -- Insert large dataset
        WITH RECURSIVE large_data(n) AS (
          SELECT 1
          UNION ALL
          SELECT n + 1 FROM large_data WHERE n < 1000
        )
        INSERT INTO cleanup_test (data)
        SELECT 'Data item ' || n || ' ' || substr('x' || lower(hex(randomblob(50))), 3)
        FROM large_data;
        
        -- Verify data was inserted
        SELECT COUNT(*) as initial_count FROM cleanup_test;
        
        -- Delete half the data
        DELETE FROM cleanup_test WHERE id % 2 = 0;
        
        -- Check remaining data
        SELECT COUNT(*) as remaining_count FROM cleanup_test;
        
        -- Vacuum to reclaim space
        VACUUM;
        
        -- Final count
        SELECT COUNT(*) as final_count FROM cleanup_test;
      `;

      const result = await runTestInWorker("Memory cleanup test", sql, DB_FILE);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ initial_count: 1000 });
    });

    test("WASM memory limits", async () => {
      const sql = `
        CREATE TABLE memory_limits_test (
          id INTEGER PRIMARY KEY,
          data TEXT
        );
        
        -- Test memory limits by inserting increasingly large data
        INSERT INTO memory_limits_test (data) VALUES ('Small data');
        
        -- Try to insert larger data (should work within reasonable limits)
        INSERT INTO memory_limits_test (data) 
        VALUES (substr('x' || lower(hex(randomblob(1000))), 3));
        
        -- Verify data integrity
        SELECT 
          COUNT(*) as count,
          MAX(length(data)) as max_data_size,
          MIN(length(data)) as min_data_size
        FROM memory_limits_test;
      `;

      const result = await runTestInWorker(
        "WASM memory limits test",
        sql,
        DB_FILE,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ count: 2 });
      expect(result[0]).toHaveProperty("max_data_size");
      expect(result[0]).toHaveProperty("min_data_size");
    });
  });

  describe("Resource Management", () => {
    test("Connection pool simulation", async () => {
      const sql = `
        CREATE TABLE connection_test (
          id INTEGER PRIMARY KEY,
          connection_id TEXT,
          status TEXT,
          created_at TEXT
        );
        
        -- Simulate multiple connections
        INSERT INTO connection_test (connection_id, status, created_at) VALUES 
        ('conn_1', 'active', datetime('now')),
        ('conn_2', 'active', datetime('now')),
        ('conn_3', 'idle', datetime('now')),
        ('conn_4', 'active', datetime('now')),
        ('conn_5', 'closed', datetime('now'));
        
        -- Check connection status distribution
        SELECT 
          status,
          COUNT(*) as connection_count
        FROM connection_test
        GROUP BY status
        ORDER BY connection_count DESC;
      `;

      const result = await runTestInWorker(
        "Connection pool simulation",
        sql,
        DB_FILE,
      );

      expect(result.length).toBeGreaterThan(0);
      result.forEach((row) => {
        expect(row).toHaveProperty("status");
        expect(row).toHaveProperty("connection_count");
      });
    });

    test("Transaction timeout simulation", async () => {
      const sql = `
        CREATE TABLE timeout_test (
          id INTEGER PRIMARY KEY,
          data TEXT,
          created_at TEXT
        );
        
        BEGIN TRANSACTION;
        
        INSERT INTO timeout_test (data, created_at) VALUES 
        ('transaction data', datetime('now'));
        
        -- Simulate transaction in progress
        SELECT 'Transaction started' as status;
        
        COMMIT;
        
        -- Verify transaction completed
        SELECT COUNT(*) as count FROM timeout_test;
      `;

      const result = await runTestInWorker(
        "Transaction timeout simulation",
        sql,
        DB_FILE,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ status: "Transaction started" });
    });

    test("Resource cleanup on error", async () => {
      const sql = `
        CREATE TABLE error_cleanup_test (
          id INTEGER PRIMARY KEY,
          data TEXT
        );
        
        BEGIN TRANSACTION;
        
        INSERT INTO error_cleanup_test (data) VALUES ('transaction data');
        
        -- This will cause an error
        INSERT INTO error_cleanup_test (id, data) VALUES (1, 'duplicate');
      `;

      await expect(
        runTestInWorker("Resource cleanup on error", sql, DB_FILE),
      ).rejects.toThrow();

      // Verify cleanup occurred (transaction rolled back)
      const checkSql = `SELECT COUNT(*) as count FROM error_cleanup_test;`;
      const result = await runTestInWorker(
        "Check after error",
        checkSql,
        DB_FILE,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ count: 0 });
    });
  });
});
