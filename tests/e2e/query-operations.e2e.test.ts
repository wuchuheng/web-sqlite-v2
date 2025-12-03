import { describe, test, expect } from "vitest";
import { runTestInWorker } from "./worker-client";

describe("Query Operations Tests", () => {
  const DB_FILE = "/query_operations.db";

  test("Aggregate functions (COUNT, SUM, AVG)", async () => {
    const tableName = "query_aggregates";
    const setupSql = `
      CREATE TABLE ${tableName} (value INTEGER);
      INSERT INTO ${tableName} VALUES (10), (20), (30), (40), (50);
    `;

    // Run setup and query in one go for now, or we need a persistent worker session
    // For simplicity in this migration step, we'll execute the full test logic in one SQL block if possible,
    // or just execute the query part if the worker handles persistence.
    // However, our current worker implementation closes the DB after each request.
    // So we need to send the full SQL script.

    const sql = `
      ${setupSql}
      SELECT COUNT(*) as cnt, SUM(value) as sum, AVG(value) as avg FROM ${tableName};
    `;

    const result = await runTestInWorker("Aggregate functions", sql, DB_FILE);

    // The result will contain the output of the LAST statement that returned rows
    // But our worker implementation accumulates all callback rows.
    // If we have multiple statements, only those with callbacks (SELECTs) might be captured efficiently if we adjust the worker.
    // Let's check the worker implementation again. It executes `db.exec({ sql, callback })`.
    // `db.exec` with a callback will invoke the callback for result rows of SELECT statements.

    expect(result[0].cnt).toBe(5);
    expect(result[0].sum).toBe(150);
    expect(result[0].avg).toBe(30);
  });

  test("GROUP BY with HAVING", async () => {
    const tableName = "query_group_by";
    const sql = `
      CREATE TABLE ${tableName} (product TEXT, quantity INTEGER);
      INSERT INTO ${tableName} VALUES
          ('Apple', 10), ('Apple', 20),
          ('Banana', 5), ('Banana', 3);
      SELECT product, SUM(quantity) as total
           FROM ${tableName}
           GROUP BY product
           HAVING total > 10
           ORDER BY product;
    `;

    const result = await runTestInWorker("GROUP BY with HAVING", sql, DB_FILE);

    expect(result.length).toBe(1);
    expect(result[0].product).toBe("Apple");
  });

  test("JOIN operations", async () => {
    const usersTable = "query_users";
    const ordersTable = "query_orders";
    const sql = `
      CREATE TABLE ${usersTable} (id INTEGER, name TEXT);
      CREATE TABLE ${ordersTable} (id INTEGER, user_id INTEGER, product TEXT);

      INSERT INTO ${usersTable} VALUES (1, 'Alice'), (2, 'Bob');
      INSERT INTO ${ordersTable} VALUES (1, 1, 'Book'), (2, 1, 'Pen'), (3, 2, 'Laptop');

      SELECT u.name, COUNT(o.id) as order_count
           FROM ${usersTable} u
           LEFT JOIN ${ordersTable} o ON u.id = o.user_id
           GROUP BY u.id;
    `;

    const result = await runTestInWorker("JOIN operations", sql, DB_FILE);

    expect(result.length).toBe(2);
    // Sort or reliable order check might be needed, but SQL is usually deterministic here
    // Alice (id 1) has 2 orders, Bob (id 2) has 1 order.
    // Let's find Alice
    const alice = result.find((r: any) => r.name === "Alice");
    expect(alice.order_count).toBe(2);
  });

  test("Subquery in SELECT", async () => {
    const tableName = "query_subquery";
    const sql = `
      CREATE TABLE ${tableName} (value INTEGER);
      INSERT INTO ${tableName} VALUES (10), (20), (30);
      SELECT value, (SELECT AVG(value) FROM ${tableName}) as avg FROM ${tableName};
    `;

    const result = await runTestInWorker("Subquery in SELECT", sql, DB_FILE);

    expect(result.length).toBe(3);
    expect(result[0].avg).toBe(20);
  });

  test("ORDER BY and LIMIT", async () => {
    const tableName = "query_ordering";
    const sql = `
      CREATE TABLE ${tableName} (value INTEGER);
      INSERT INTO ${tableName} VALUES (5), (2), (8), (1), (9);
      SELECT value FROM ${tableName} ORDER BY value DESC LIMIT 3;
    `;

    const result = await runTestInWorker("ORDER BY and LIMIT", sql, DB_FILE);

    expect(result.length).toBe(3);
    expect(result[0].value).toBe(9);
    expect(result[1].value).toBe(8);
    expect(result[2].value).toBe(5);
  });
});
