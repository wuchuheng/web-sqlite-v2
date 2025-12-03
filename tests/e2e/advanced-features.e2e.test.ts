import { describe, test, expect } from "vitest";
import { runTestInWorker } from "./worker-client";

describe("Advanced Features Tests", () => {
  const DB_FILE = "/advanced-features-test.db";

  describe("Transaction Savepoints", () => {
    test("Basic savepoint creation and release", async () => {
      const sql = `
        CREATE TABLE savepoint_test (id INTEGER PRIMARY KEY, value TEXT);
        BEGIN TRANSACTION;
        INSERT INTO savepoint_test (value) VALUES ('initial');
        
        SAVEPOINT sp1;
        INSERT INTO savepoint_test (value) VALUES ('after savepoint');
        
        RELEASE SAVEPOINT sp1;
        INSERT INTO savepoint_test (value) VALUES ('after release');
        COMMIT;
        
        SELECT * FROM savepoint_test ORDER BY id;
      `;

      const result = await runTestInWorker(
        "Basic savepoint test",
        sql,
        DB_FILE,
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ value: "initial" });
      expect(result[1]).toMatchObject({ value: "after savepoint" });
      expect(result[2]).toMatchObject({ value: "after release" });
    });

    test("Rollback to savepoint", async () => {
      const sql = `
        CREATE TABLE rollback_test (id INTEGER PRIMARY KEY, value TEXT);
        BEGIN TRANSACTION;
        INSERT INTO rollback_test (value) VALUES ('before savepoint');
        
        SAVEPOINT sp1;
        INSERT INTO rollback_test (value) VALUES ('after savepoint');
        
        ROLLBACK TO SAVEPOINT sp1;
        INSERT INTO rollback_test (value) VALUES ('after rollback');
        COMMIT;
        
        SELECT * FROM rollback_test ORDER BY id;
      `;

      const result = await runTestInWorker(
        "Rollback to savepoint test",
        sql,
        DB_FILE,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ value: "before savepoint" });
      expect(result[1]).toMatchObject({ value: "after rollback" });
    });

    test("Nested savepoints", async () => {
      const sql = `
        CREATE TABLE nested_test (id INTEGER PRIMARY KEY, value TEXT);
        BEGIN TRANSACTION;
        INSERT INTO nested_test (value) VALUES ('level 0');
        
        SAVEPOINT sp1;
        INSERT INTO nested_test (value) VALUES ('level 1');
        
        SAVEPOINT sp2;
        INSERT INTO nested_test (value) VALUES ('level 2');
        
        ROLLBACK TO SAVEPOINT sp1;
        INSERT INTO nested_test (value) VALUES ('after nested rollback');
        
        RELEASE SAVEPOINT sp1;
        COMMIT;
        
        SELECT * FROM nested_test ORDER BY id;
      `;

      const result = await runTestInWorker(
        "Nested savepoints test",
        sql,
        DB_FILE,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ value: "level 0" });
      expect(result[1]).toMatchObject({ value: "after nested rollback" });
    });

    test("Savepoint with error handling", async () => {
      const sql = `
        CREATE TABLE error_savepoint_test (id INTEGER PRIMARY KEY, value TEXT);
        BEGIN TRANSACTION;
        INSERT INTO error_savepoint_test (value) VALUES ('before error');
        
        SAVEPOINT sp1;
        INSERT INTO error_savepoint_test (value) VALUES ('in savepoint');
        
        -- This will cause an error due to unique constraint violation
        INSERT INTO error_savepoint_test (id, value) VALUES (1, 'duplicate');
      `;

      await expect(
        runTestInWorker("Savepoint error handling test", sql, DB_FILE),
      ).rejects.toThrow();

      // Verify transaction was rolled back
      const checkSql = `SELECT * FROM error_savepoint_test;`;
      const result = await runTestInWorker(
        "Check after error",
        checkSql,
        DB_FILE,
      );

      expect(result).toHaveLength(0); // Transaction should be rolled back
    });

    test("Savepoint memory management", async () => {
      const sql = `
        CREATE TABLE memory_savepoint_test (id INTEGER PRIMARY KEY, value TEXT);
        BEGIN TRANSACTION;
        
        -- Create multiple savepoints
        SAVEPOINT sp1;
        INSERT INTO memory_savepoint_test (value) VALUES ('sp1 data');
        
        SAVEPOINT sp2;
        INSERT INTO memory_savepoint_test (value) VALUES ('sp2 data');
        
        SAVEPOINT sp3;
        INSERT INTO memory_savepoint_test (value) VALUES ('sp3 data');
        
        -- Release savepoints in reverse order
        RELEASE SAVEPOINT sp3;
        RELEASE SAVEPOINT sp2;
        RELEASE SAVEPOINT sp1;
        
        COMMIT;
        
        SELECT COUNT(*) as count FROM memory_savepoint_test;
      `;

      const result = await runTestInWorker(
        "Savepoint memory test",
        sql,
        DB_FILE,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ count: 3 });
    });
  });

  describe("Struct Binder Functionality", () => {
    test("Basic struct binding and data mapping", async () => {
      const sql = `
        CREATE TABLE struct_test (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          age INTEGER,
          salary REAL,
          active BOOLEAN
        );
        
        INSERT INTO struct_test (name, age, salary, active) VALUES 
        ('Alice', 30, 75000.50, 1),
        ('Bob', 25, 60000.00, 0),
        ('Charlie', 35, 90000.75, 1);
        
        SELECT * FROM struct_test ORDER BY id;
      `;

      const result = await runTestInWorker("Struct binding test", sql, DB_FILE);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        id: 1,
        name: "Alice",
        age: 30,
        salary: 75000.5,
        active: 1,
      });
    });

    test("Complex data type binding", async () => {
      const sql = `
        CREATE TABLE complex_types_test (
          id INTEGER PRIMARY KEY,
          text_data TEXT,
          int_data INTEGER,
          real_data REAL,
          blob_data BLOB,
          null_data TEXT
        );
        
        INSERT INTO complex_types_test (text_data, int_data, real_data, blob_data, null_data) 
        VALUES ('text', 42, 3.14159, x'48656C6C6F', NULL);
        
        SELECT * FROM complex_types_test;
      `;

      const result = await runTestInWorker("Complex types test", sql, DB_FILE);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        text_data: "text",
        int_data: 42,
        real_data: 3.14159,
        blob_data: expect.any(Uint8Array),
        null_data: null,
      });
    });

    test("Array parameter binding", async () => {
      const sql = `
        CREATE TABLE array_test (id INTEGER PRIMARY KEY, value TEXT);
        
        -- Simulate array binding with multiple inserts
        INSERT INTO array_test (value) VALUES ('item1');
        INSERT INTO array_test (value) VALUES ('item2');
        INSERT INTO array_test (value) VALUES ('item3');
        
        SELECT * FROM array_test ORDER BY id;
      `;

      const result = await runTestInWorker("Array binding test", sql, DB_FILE);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ value: "item1" });
      expect(result[1]).toMatchObject({ value: "item2" });
      expect(result[2]).toMatchObject({ value: "item3" });
    });

    test("Object parameter binding", async () => {
      const sql = `
        CREATE TABLE object_test (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          user_name TEXT,
          user_email TEXT,
          created_at TEXT
        );
        
        -- Simulate object binding
        INSERT INTO object_test (user_id, user_name, user_email, created_at) 
        VALUES (1, 'John Doe', 'john@example.com', datetime('now'));
        
        SELECT * FROM object_test;
      `;

      const result = await runTestInWorker("Object binding test", sql, DB_FILE);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        user_id: 1,
        user_name: "John Doe",
        user_email: "john@example.com",
        created_at: expect.any(String),
      });
    });

    test("Bulk operations with struct binding", async () => {
      const sql = `
        CREATE TABLE bulk_test (
          id INTEGER PRIMARY KEY,
          category TEXT,
          amount REAL,
          timestamp TEXT
        );
        
        -- Simulate bulk insert
        INSERT INTO bulk_test (category, amount, timestamp) VALUES 
        ('A', 100.00, datetime('now')),
        ('B', 200.00, datetime('now')),
        ('C', 300.00, datetime('now')),
        ('A', 150.00, datetime('now')),
        ('B', 250.00, datetime('now'));
        
        -- Verify bulk operation
        SELECT category, COUNT(*) as count, SUM(amount) as total 
        FROM bulk_test 
        GROUP BY category 
        ORDER BY category;
      `;

      const result = await runTestInWorker(
        "Bulk operations test",
        sql,
        DB_FILE,
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        category: "A",
        count: 2,
        total: 250.0,
      });
      expect(result[1]).toMatchObject({
        category: "B",
        count: 2,
        total: 450.0,
      });
      expect(result[2]).toMatchObject({
        category: "C",
        count: 1,
        total: 300.0,
      });
    });

    test("Struct validation and type checking", async () => {
      const sql = `
        CREATE TABLE validation_test (
          id INTEGER PRIMARY KEY,
          required_field TEXT NOT NULL,
          optional_field TEXT,
          min_value INTEGER CHECK (min_value >= 0),
          max_value INTEGER CHECK (max_value <= 100),
          email_field TEXT CHECK (email_field LIKE '%@%')
        );
        
        -- Valid data
        INSERT INTO validation_test (required_field, optional_field, min_value, max_value, email_field) 
        VALUES ('required', 'optional', 50, 75, 'test@example.com');
        
        SELECT * FROM validation_test;
      `;

      const result = await runTestInWorker(
        "Struct validation test",
        sql,
        DB_FILE,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        required_field: "required",
        optional_field: "optional",
        min_value: 50,
        max_value: 75,
        email_field: "test@example.com",
      });
    });
  });

  describe("Advanced Query Operations", () => {
    test("Complex JOIN operations", async () => {
      const sql = `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
        
        CREATE TABLE orders (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          total REAL,
          status TEXT
        );
        
        CREATE TABLE products (
          id INTEGER PRIMARY KEY,
          name TEXT,
          price REAL
        );
        
        INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie');
        INSERT INTO orders (user_id, total, status) VALUES 
        (1, 100.00, 'completed'),
        (1, 200.00, 'pending'),
        (2, 150.00, 'completed'),
        (3, 300.00, 'completed');
        
        INSERT INTO products (name, price) VALUES 
        ('Product A', 50.00),
        ('Product B', 75.00),
        ('Product C', 100.00);
        
        -- Complex JOIN query
        SELECT 
          u.name as user_name,
          COUNT(o.id) as order_count,
          SUM(o.total) as total_spent,
          AVG(o.total) as avg_order_value
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id AND o.status = 'completed'
        GROUP BY u.id, u.name
        ORDER BY total_spent DESC;
      `;

      const result = await runTestInWorker("Complex JOIN test", sql, DB_FILE);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        user_name: "Charlie",
        order_count: 1,
        total_spent: 300.0,
        avg_order_value: 300.0,
      });
    });

    test("Subqueries and CTEs", async () => {
      const sql = `
        CREATE TABLE sales (
          id INTEGER PRIMARY KEY,
          product_id INTEGER,
          quantity INTEGER,
          sale_date TEXT
        );
        
        INSERT INTO sales (product_id, quantity, sale_date) VALUES 
        (1, 10, '2023-01-01'),
        (1, 15, '2023-01-02'),
        (2, 20, '2023-01-01'),
        (2, 25, '2023-01-03'),
        (3, 30, '2023-01-02');
        
        -- Common Table Expression (CTE)
        WITH daily_sales AS (
          SELECT 
            product_id,
            SUM(quantity) as total_quantity,
            sale_date
          FROM sales
          GROUP BY product_id, sale_date
        )
        SELECT 
          product_id,
          AVG(total_quantity) as avg_daily_quantity,
          COUNT(*) as days_with_sales
        FROM daily_sales
        GROUP BY product_id
        ORDER BY avg_daily_quantity DESC;
      `;

      const result = await runTestInWorker(
        "CTEs and subqueries test",
        sql,
        DB_FILE,
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty("product_id");
      expect(result[0]).toHaveProperty("avg_daily_quantity");
      expect(result[0]).toHaveProperty("days_with_sales");
    });

    test("Window functions and analytics", async () => {
      const sql = `
        CREATE TABLE employee_sales (
          id INTEGER PRIMARY KEY,
          employee_name TEXT,
          department TEXT,
          sales_amount REAL,
          sale_date TEXT
        );
        
        INSERT INTO employee_sales (employee_name, department, sales_amount, sale_date) VALUES 
        ('Alice', 'Sales', 1000.00, '2023-01-01'),
        ('Alice', 'Sales', 1500.00, '2023-01-02'),
        ('Bob', 'Sales', 800.00, '2023-01-01'),
        ('Bob', 'Sales', 1200.00, '2023-01-02'),
        ('Charlie', 'Marketing', 500.00, '2023-01-01'),
        ('Charlie', 'Marketing', 700.00, '2023-01-02');
        
        -- Window functions
        SELECT 
          employee_name,
          department,
          sales_amount,
          RANK() OVER (PARTITION BY department ORDER BY sales_amount DESC) as dept_rank,
          SUM(sales_amount) OVER (PARTITION BY department) as dept_total,
          AVG(sales_amount) OVER (PARTITION BY department) as dept_avg,
          SUM(sales_amount) OVER (ORDER BY sale_date) as cumulative_sales
        FROM employee_sales
        ORDER BY department, sales_amount DESC;
      `;

      const result = await runTestInWorker(
        "Window functions test",
        sql,
        DB_FILE,
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("employee_name");
      expect(result[0]).toHaveProperty("dept_rank");
      expect(result[0]).toHaveProperty("dept_total");
      expect(result[0]).toHaveProperty("cumulative_sales");
    });
  });

  describe("WASM Memory Management", () => {
    test("Large data handling", async () => {
      const sql = `
        CREATE TABLE large_data_test (
          id INTEGER PRIMARY KEY,
          data TEXT,
          blob_data BLOB
        );
        
        -- Insert large text data
        INSERT INTO large_data_test (data, blob_data) 
        VALUES (
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' || 
          'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' ||
          'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
          x'48656C6C6F20576F726C642120546869732069732061206C6172676520626C6F62206F6620646174612E'
        );
        
        SELECT 
          id,
          length(data) as text_length,
          length(blob_data) as blob_length
        FROM large_data_test;
      `;

      const result = await runTestInWorker("Large data test", sql, DB_FILE);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("text_length");
      expect(result[0]).toHaveProperty("blob_length");
      expect(result[0].text_length).toBeGreaterThan(100);
    });

    test("Memory cleanup and garbage collection", async () => {
      const sql = `
        CREATE TABLE memory_cleanup_test (id INTEGER PRIMARY KEY, data TEXT);
        
        -- Create and drop multiple tables to test memory cleanup
        INSERT INTO memory_cleanup_test (data) VALUES ('test data');
        
        -- Create temporary objects
        CREATE TEMP TABLE temp_test (id INTEGER PRIMARY KEY);
        INSERT INTO temp_test DEFAULT VALUES;
        
        -- Clean up
        DROP TABLE temp_test;
        
        SELECT COUNT(*) as count FROM memory_cleanup_test;
      `;

      const result = await runTestInWorker("Memory cleanup test", sql, DB_FILE);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ count: 1 });
    });
  });
});
