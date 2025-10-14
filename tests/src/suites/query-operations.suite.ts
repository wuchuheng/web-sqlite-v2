import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

/**
 * Query Operations Tests
 * Tests for complex queries, aggregations, joins, and subqueries
 */
export const queryOperationsTests: TestCase[] = [
  {
    name: "Aggregate functions (COUNT, SUM, AVG)",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value INTEGER)");
      db.exec("INSERT INTO test VALUES (10), (20), (30), (40), (50)");

      const result = TestUtils.execQuery(
        db,
        "SELECT COUNT(*) as cnt, SUM(value) as sum, AVG(value) as avg FROM test"
      );

      TestUtils.assertEqual(result[0].cnt, 5, "Count should be 5");
      TestUtils.assertEqual(result[0].sum, 150, "Sum should be 150");
      TestUtils.assertEqual(result[0].avg, 30, "Average should be 30");

      db.close();
    },
  },
  {
    name: "GROUP BY with HAVING",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE sales (product TEXT, quantity INTEGER)");
      db.exec(`
        INSERT INTO sales VALUES
          ('Apple', 10), ('Apple', 20),
          ('Banana', 5), ('Banana', 3)
      `);

      const result = TestUtils.execQuery(
        db,
        `SELECT product, SUM(quantity) as total
         FROM sales
         GROUP BY product
         HAVING total > 10
         ORDER BY product`
      );

      TestUtils.assertEqual(result.length, 1, "Only Apple should have total > 10");
      TestUtils.assertEqual(result[0].product, "Apple", "Product should be Apple");

      db.close();
    },
  },
  {
    name: "JOIN operations",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE users (id INTEGER, name TEXT)");
      db.exec("CREATE TABLE orders (id INTEGER, user_id INTEGER, product TEXT)");

      db.exec("INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob')");
      db.exec(
        "INSERT INTO orders VALUES (1, 1, 'Book'), (2, 1, 'Pen'), (3, 2, 'Laptop')"
      );

      const result = TestUtils.execQuery(
        db,
        `SELECT u.name, COUNT(o.id) as order_count
         FROM users u
         LEFT JOIN orders o ON u.id = o.user_id
         GROUP BY u.id`
      );

      TestUtils.assertEqual(result.length, 2, "Should have two users");

      db.close();
    },
  },
  {
    name: "Subquery in SELECT",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value INTEGER)");
      db.exec("INSERT INTO test VALUES (10), (20), (30)");

      const result = TestUtils.execQuery(
        db,
        "SELECT value, (SELECT AVG(value) FROM test) as avg FROM test"
      );

      TestUtils.assertEqual(result.length, 3, "Should have three rows");
      TestUtils.assertEqual(result[0].avg, 20, "Average should be 20");

      db.close();
    },
  },
  {
    name: "ORDER BY and LIMIT",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value INTEGER)");
      db.exec("INSERT INTO test VALUES (5), (2), (8), (1), (9)");

      const result = TestUtils.execQuery(
        db,
        "SELECT value FROM test ORDER BY value DESC LIMIT 3"
      );

      TestUtils.assertEqual(result.length, 3, "Should have three rows");
      TestUtils.assertEqual(result[0].value, 9, "First should be 9");
      TestUtils.assertEqual(result[1].value, 8, "Second should be 8");
      TestUtils.assertEqual(result[2].value, 5, "Third should be 5");

      db.close();
    },
  },
];
