import sqlite3InitModule from "../src/jswasm/sqlite3.mjs";

/**
 * Test Framework for SQLite3 OPFS/WASM
 * Comprehensive test suite for database operations
 */
class TestRunner {
  constructor() {
    // 1. Input handling - Initialize state
    this.sqlite3 = null;
    this.testSuites = [];
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
    };
  }

  /**
   * Initialize SQLite3 module
   */
  async initialize() {
    // 1. Input handling
    this.log("info", "🚀 Initializing SQLite3 WASM module...");

    try {
      // 2. Core processing - Load SQLite3
      this.sqlite3 = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
      });

      // 3. Output handling - Log success
      this.log("success", `✅ SQLite3 loaded successfully`);
      this.log("info", `📋 Version: ${this.sqlite3.version.libVersion}`);

      // Check OPFS VFS availability
      const hasOpfs = !!this.sqlite3.capi.sqlite3_vfs_find("opfs");
      this.log(
        hasOpfs ? "success" : "warn",
        `🏗️ OPFS VFS: ${hasOpfs ? "Available" : "Not available"}`
      );

      return true;
    } catch (error) {
      this.log("error", `❌ Initialization failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Register a test suite
   */
  registerSuite(name, tests) {
    // 1. Input handling - Validate parameters
    if (!name || !tests) {
      throw new Error("Suite name and tests are required");
    }

    // 2. Core processing - Add suite
    this.testSuites.push({ name, tests });
  }

  /**
   * Run all test suites
   */
  async runAllTests() {
    // 1. Input handling - Reset results
    this.results = { total: 0, passed: 0, failed: 0 };
    const startTime = performance.now();

    // 2. Core processing - Execute each suite
    for (const suite of this.testSuites) {
      await this.runSuite(suite);
    }

    // 3. Output handling - Report final results
    const duration = Math.round(performance.now() - startTime);
    this.sendMessage("all-tests-complete", {
      total: this.results.total,
      passed: this.results.passed,
      failed: this.results.failed,
      duration,
    });
  }

  /**
   * Run a single test suite
   */
  async runSuite(suite) {
    // 1. Input handling
    const { name, tests } = suite;
    let suitePassed = 0;
    let suiteFailed = 0;
    const suiteStartTime = performance.now();

    // Note: Suite header is created by the UI's createSuiteLogBlock() method
    // No need to log it here to avoid duplication

    // 2. Core processing - Run each test
    for (const test of tests) {
      const result = await this.runTest(name, test);
      if (result) {
        suitePassed++;
      } else {
        suiteFailed++;
      }
    }

    // 3. Output handling - Report suite results
    const suiteDuration = Math.round(performance.now() - suiteStartTime);
    this.sendMessage("test-suite-complete", {
      suite: name,
      passed: suitePassed,
      failed: suiteFailed,
      duration: suiteDuration,
    });
  }

  /**
   * Run a single test
   */
  async runTest(suiteName, test) {
    // 1. Input handling
    const { name, fn } = test;
    this.results.total++;

    // 2. Core processing - Execute test
    const source = fn.toString();
    this.sendMessage("test-start", { suite: suiteName, test: name, source });
    const startTime = performance.now();

    try {
      await fn(this.sqlite3);
      const duration = Math.round(performance.now() - startTime);

      // 3. Output handling - Test passed
      this.results.passed++;
      this.sendMessage("test-complete", {
        suite: suiteName,
        test: name,
        passed: true,
        duration,
      });
      return true;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);

      // 3. Output handling - Test failed
      this.results.failed++;
      this.sendMessage("test-complete", {
        suite: suiteName,
        test: name,
        passed: false,
        error: error.message,
        duration,
      });
      return false;
    }
  }

  /**
   * Send message to main thread
   */
  sendMessage(type, data) {
    // 1. Input handling - Create message
    // 2. Core processing - Post message
    self.postMessage({ type, data });
  }

  /**
   * Log message to main thread
   */
  log(level, message) {
    // 1. Input handling
    console[level === "error" ? "error" : "log"](message);

    // 2. Core processing - Send log message
    this.sendMessage("log", { level, message });
  }
}

/**
 * Test Utilities
 * Helper functions for assertions and database operations
 */
class TestUtils {
  /**
   * Assert that a condition is true
   */
  static assert(condition, message) {
    // 1. Input handling - Check condition
    if (!condition) {
      // 2. Core processing - Throw error
      throw new Error(message || "Assertion failed");
    }
  }

  /**
   * Assert equality
   */
  static assertEqual(actual, expected, message) {
    // 1. Input handling - Compare values
    if (actual !== expected) {
      // 2. Core processing - Throw error with details
      throw new Error(
        message ||
          `Expected ${expected} but got ${actual}`
      );
    }
  }

  /**
   * Assert that value is truthy
   */
  static assertTrue(value, message) {
    // 1. Input handling - Check truthiness
    TestUtils.assert(!!value, message || `Expected truthy value but got ${value}`);
  }

  /**
   * Assert that value is falsy
   */
  static assertFalse(value, message) {
    // 1. Input handling - Check falsiness
    TestUtils.assert(!value, message || `Expected falsy value but got ${value}`);
  }

  /**
   * Assert that a function throws an error
   */
  static assertThrows(fn, message) {
    // 1. Input handling
    let threw = false;

    try {
      // 2. Core processing - Execute function
      fn();
    } catch (_error) {
      threw = true;
    }

    // 3. Output handling - Verify error was thrown
    TestUtils.assert(threw, message || "Expected function to throw an error");
  }

  /**
   * Create a test database with OPFS
   */
  static createTestDb(sqlite3, name = "test.db") {
    // 1. Input handling - Generate unique name
    const dbName = `file:///${name}?vfs=opfs`;

    // 2. Core processing - Create database
    const db = new sqlite3.oo1.DB(dbName);

    // 3. Output handling
    return db;
  }

  /**
   * Clean up test database
   */
  static cleanupDb(db) {
    // 1. Input handling - Check if db exists
    if (!db) return;

    try {
      // 2. Core processing - Close database
      db.close();
    } catch (error) {
      console.error("Failed to cleanup database:", error);
    }
  }

  /**
   * Execute SQL and return results as objects
   */
  static execQuery(db, sql, params = []) {
    // 1. Input handling
    const results = [];

    // 2. Core processing - Prepare and execute
    const stmt = db.prepare(sql);
    try {
      if (params.length > 0) {
        stmt.bind(params);
      }

      while (stmt.step()) {
        results.push(stmt.get({}));
      }
    } finally {
      // 3. Output handling - Cleanup
      stmt.finalize();
    }

    return results;
  }
}

// Initialize test runner
const testRunner = new TestRunner();

// ============================================================================
// TEST SUITE: Environment Tests
// ============================================================================
testRunner.registerSuite("Environment", [
  {
    name: "SQLite3 module loads successfully",
    fn: async (sqlite3) => {
      TestUtils.assert(sqlite3, "SQLite3 module should be initialized");
      TestUtils.assert(
        sqlite3.version,
        "SQLite3 should have version info"
      );
    },
  },
  {
    name: "OPFS VFS is available",
    fn: async (sqlite3) => {
      const vfs = sqlite3.capi.sqlite3_vfs_find("opfs");
      TestUtils.assert(vfs, "OPFS VFS should be available in worker context");
    },
  },
  {
    name: "SharedArrayBuffer is supported",
    fn: async () => {
      TestUtils.assert(
        typeof SharedArrayBuffer !== "undefined",
        "SharedArrayBuffer must be available"
      );
    },
  },
  {
    name: "DB class is available",
    fn: async (sqlite3) => {
      TestUtils.assert(sqlite3.oo1?.DB, "OO1 DB class should be available");
    },
  },
]);

// ============================================================================
// TEST SUITE: Database Lifecycle
// ============================================================================
testRunner.registerSuite("Database Lifecycle", [
  {
    name: "Create in-memory database",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();
      TestUtils.assert(db, "Database should be created");
      db.close();
    },
  },
  {
    name: "Create OPFS database",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, "lifecycle_test.db");
      TestUtils.assert(db, "OPFS database should be created");
      TestUtils.cleanupDb(db);
    },
  },
  {
    name: "Database persistence across connections",
    fn: async (sqlite3) => {
      // 1. Create database and insert data
      const dbName = "file:///persist_test.db?vfs=opfs";
      let db = new sqlite3.oo1.DB(dbName);

      db.exec("CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, value TEXT)");
      db.exec("INSERT INTO test (value) VALUES ('persistent_data')");
      db.close();

      // 2. Reopen and verify data persists
      db = new sqlite3.oo1.DB(dbName);
      const result = TestUtils.execQuery(db, "SELECT value FROM test");
      TestUtils.assertEqual(result.length, 1, "Should have one row");
      TestUtils.assertEqual(
        result[0].value,
        "persistent_data",
        "Data should persist"
      );

      // 3. Cleanup
      db.exec("DROP TABLE test");
      db.close();
    },
  },
  {
    name: "Multiple database connections",
    fn: async (sqlite3) => {
      const db1 = new sqlite3.oo1.DB();
      const db2 = new sqlite3.oo1.DB();

      TestUtils.assert(db1, "First database should be created");
      TestUtils.assert(db2, "Second database should be created");

      db1.close();
      db2.close();
    },
  },
]);

// ============================================================================
// TEST SUITE: Schema Operations
// ============================================================================
testRunner.registerSuite("Schema Operations", [
  {
    name: "CREATE TABLE with various column types",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          age INTEGER,
          balance REAL,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Verify table exists
      const tables = TestUtils.execQuery(
        db,
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
      );
      TestUtils.assertEqual(tables.length, 1, "Table should be created");

      db.close();
    },
  },
  {
    name: "CREATE INDEX on table",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE products (id INTEGER, name TEXT, price REAL)");
      db.exec("CREATE INDEX idx_products_name ON products(name)");
      db.exec("CREATE INDEX idx_products_price ON products(price)");

      // Verify indexes exist
      const indexes = TestUtils.execQuery(
        db,
        "SELECT name FROM sqlite_master WHERE type='index'"
      );
      TestUtils.assertTrue(
        indexes.length >= 2,
        "Indexes should be created"
      );

      db.close();
    },
  },
  {
    name: "ALTER TABLE add column",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY)");
      db.exec("ALTER TABLE items ADD COLUMN name TEXT");

      // Verify column was added
      const info = TestUtils.execQuery(db, "PRAGMA table_info(items)");
      TestUtils.assertEqual(info.length, 2, "Should have 2 columns");

      db.close();
    },
  },
  {
    name: "DROP TABLE",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE temp_table (id INTEGER)");
      db.exec("DROP TABLE temp_table");

      // Verify table was dropped
      const tables = TestUtils.execQuery(
        db,
        "SELECT name FROM sqlite_master WHERE type='table' AND name='temp_table'"
      );
      TestUtils.assertEqual(tables.length, 0, "Table should be dropped");

      db.close();
    },
  },
]);

// ============================================================================
// TEST SUITE: CRUD Operations
// ============================================================================
testRunner.registerSuite("CRUD Operations", [
  {
    name: "INSERT single row",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER, name TEXT)");
      db.exec("INSERT INTO test (id, name) VALUES (1, 'Alice')");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result.length, 1, "Should have one row");
      TestUtils.assertEqual(result[0].name, "Alice", "Name should match");

      db.close();
    },
  },
  {
    name: "INSERT multiple rows",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER, name TEXT)");
      db.exec(`
        INSERT INTO test (id, name) VALUES
          (1, 'Alice'),
          (2, 'Bob'),
          (3, 'Charlie')
      `);

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result.length, 3, "Should have three rows");

      db.close();
    },
  },
  {
    name: "SELECT with WHERE clause",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER, age INTEGER)");
      db.exec("INSERT INTO test VALUES (1, 25), (2, 30), (3, 25)");

      const result = TestUtils.execQuery(db, "SELECT * FROM test WHERE age = 25");
      TestUtils.assertEqual(result.length, 2, "Should find two rows");

      db.close();
    },
  },
  {
    name: "UPDATE rows",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER, status TEXT)");
      db.exec("INSERT INTO test VALUES (1, 'pending'), (2, 'pending')");
      db.exec("UPDATE test SET status = 'completed' WHERE id = 1");

      const completed = TestUtils.execQuery(
        db,
        "SELECT * FROM test WHERE status = 'completed'"
      );
      const pending = TestUtils.execQuery(
        db,
        "SELECT * FROM test WHERE status = 'pending'"
      );

      TestUtils.assertEqual(completed.length, 1, "Should have one completed");
      TestUtils.assertEqual(pending.length, 1, "Should have one pending");

      db.close();
    },
  },
  {
    name: "DELETE rows",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER)");
      db.exec("INSERT INTO test VALUES (1), (2), (3)");
      db.exec("DELETE FROM test WHERE id = 2");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result.length, 2, "Should have two rows left");

      db.close();
    },
  },
]);

// ============================================================================
// TEST SUITE: Prepared Statements
// ============================================================================
testRunner.registerSuite("Prepared Statements", [
  {
    name: "Prepare and execute statement with parameters",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER, name TEXT)");

      const stmt = db.prepare("INSERT INTO test (id, name) VALUES (?, ?)");
      stmt.bind([1, "Alice"]).stepReset();
      stmt.bind([2, "Bob"]).stepReset();
      stmt.finalize();

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result.length, 2, "Should have two rows");

      db.close();
    },
  },
  {
    name: "Statement reuse with reset",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value INTEGER)");

      const stmt = db.prepare("INSERT INTO test (value) VALUES (?)");
      for (let i = 1; i <= 5; i++) {
        stmt.bind([i]).stepReset();
      }
      stmt.finalize();

      const result = TestUtils.execQuery(db, "SELECT COUNT(*) as count FROM test");
      TestUtils.assertEqual(result[0].count, 5, "Should have five rows");

      db.close();
    },
  },
  {
    name: "Named parameters",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (name TEXT, age INTEGER)");

      const stmt = db.prepare(
        "INSERT INTO test (name, age) VALUES (:name, :age)"
      );
      stmt.bind({ ":name": "Alice", ":age": 30 }).stepReset();
      stmt.finalize();

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result[0].name, "Alice", "Name should match");
      TestUtils.assertEqual(result[0].age, 30, "Age should match");

      db.close();
    },
  },
  {
    name: "Get results from SELECT statement",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER, name TEXT)");
      db.exec("INSERT INTO test VALUES (1, 'Alice'), (2, 'Bob')");

      const stmt = db.prepare("SELECT * FROM test WHERE id = ?");
      stmt.bind([1]);

      TestUtils.assertTrue(stmt.step(), "Should have a result row");

      const row = stmt.get({});
      TestUtils.assertEqual(row.id, 1, "ID should be 1");
      TestUtils.assertEqual(row.name, "Alice", "Name should be Alice");

      stmt.finalize();
      db.close();
    },
  },
]);

// ============================================================================
// TEST SUITE: Transactions
// ============================================================================
testRunner.registerSuite("Transactions", [
  {
    name: "Successful transaction with COMMIT",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value INTEGER)");

      db.exec("BEGIN TRANSACTION");
      db.exec("INSERT INTO test VALUES (1)");
      db.exec("INSERT INTO test VALUES (2)");
      db.exec("COMMIT");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result.length, 2, "Both inserts should be committed");

      db.close();
    },
  },
  {
    name: "Transaction ROLLBACK",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value INTEGER)");
      db.exec("INSERT INTO test VALUES (1)");

      db.exec("BEGIN TRANSACTION");
      db.exec("INSERT INTO test VALUES (2)");
      db.exec("ROLLBACK");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(
        result.length,
        1,
        "Second insert should be rolled back"
      );

      db.close();
    },
  },
  {
    name: "Automatic rollback on error",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
      db.exec("INSERT INTO test VALUES (1, 'first')");

      try {
        db.exec("BEGIN TRANSACTION");
        db.exec("INSERT INTO test VALUES (2, 'second')");
        // This will fail due to PRIMARY KEY constraint
        db.exec("INSERT INTO test VALUES (1, 'duplicate')");
        db.exec("COMMIT");
      } catch (_error) {
        // Expected to fail
      }

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(
        result.length,
        1,
        "Only first insert should remain"
      );

      db.close();
    },
  },
  {
    name: "Nested savepoints",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value INTEGER)");

      db.exec("BEGIN TRANSACTION");
      db.exec("INSERT INTO test VALUES (1)");

      db.exec("SAVEPOINT sp1");
      db.exec("INSERT INTO test VALUES (2)");

      db.exec("SAVEPOINT sp2");
      db.exec("INSERT INTO test VALUES (3)");

      db.exec("ROLLBACK TO sp2");
      db.exec("COMMIT");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result.length, 2, "Should have two values (1 and 2)");

      db.close();
    },
  },
]);

// ============================================================================
// TEST SUITE: Query Operations
// ============================================================================
testRunner.registerSuite("Query Operations", [
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
]);

// ============================================================================
// TEST SUITE: Constraints and Validation
// ============================================================================
testRunner.registerSuite("Constraints", [
  {
    name: "PRIMARY KEY constraint",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");
      db.exec("INSERT INTO test VALUES (1)");

      // Should throw error for duplicate primary key
      TestUtils.assertThrows(() => {
        db.exec("INSERT INTO test VALUES (1)");
      }, "Should reject duplicate primary key");

      db.close();
    },
  },
  {
    name: "UNIQUE constraint",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (email TEXT UNIQUE)");
      db.exec("INSERT INTO test VALUES ('test@example.com')");

      // Should throw error for duplicate unique value
      TestUtils.assertThrows(() => {
        db.exec("INSERT INTO test VALUES ('test@example.com')");
      }, "Should reject duplicate unique value");

      db.close();
    },
  },
  {
    name: "NOT NULL constraint",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (name TEXT NOT NULL)");

      // Should throw error for NULL value
      TestUtils.assertThrows(() => {
        db.exec("INSERT INTO test VALUES (NULL)");
      }, "Should reject NULL value");

      db.close();
    },
  },
  {
    name: "CHECK constraint",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (age INTEGER CHECK(age >= 0 AND age <= 150))");
      db.exec("INSERT INTO test VALUES (25)");

      // Should throw error for invalid value
      TestUtils.assertThrows(() => {
        db.exec("INSERT INTO test VALUES (200)");
      }, "Should reject value violating CHECK constraint");

      db.close();
    },
  },
  {
    name: "FOREIGN KEY constraint",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("PRAGMA foreign_keys = ON");
      db.exec("CREATE TABLE parent (id INTEGER PRIMARY KEY)");
      db.exec(
        "CREATE TABLE child (id INTEGER, parent_id INTEGER, FOREIGN KEY(parent_id) REFERENCES parent(id))"
      );

      db.exec("INSERT INTO parent VALUES (1)");
      db.exec("INSERT INTO child VALUES (1, 1)");

      // Should throw error for invalid foreign key
      TestUtils.assertThrows(() => {
        db.exec("INSERT INTO child VALUES (2, 999)");
      }, "Should reject invalid foreign key");

      db.close();
    },
  },
]);

// ============================================================================
// TEST SUITE: Error Handling
// ============================================================================
testRunner.registerSuite("Error Handling", [
  {
    name: "Invalid SQL syntax",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      TestUtils.assertThrows(() => {
        db.exec("SELCT * FROM nowhere");
      }, "Should throw syntax error");

      db.close();
    },
  },
  {
    name: "Table does not exist",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      TestUtils.assertThrows(() => {
        db.exec("SELECT * FROM nonexistent_table");
      }, "Should throw table not found error");

      db.close();
    },
  },
  {
    name: "Column does not exist",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER)");

      TestUtils.assertThrows(() => {
        db.exec("SELECT nonexistent_column FROM test");
      }, "Should throw column not found error");

      db.close();
    },
  },
  {
    name: "Proper error message format",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      try {
        db.exec("INVALID SQL STATEMENT");
        TestUtils.assert(false, "Should have thrown an error");
      } catch (error) {
        TestUtils.assertTrue(
          error.message.length > 0,
          "Error message should not be empty"
        );
      }

      db.close();
    },
  },
]);

// ============================================================================
// TEST SUITE: Performance and Bulk Operations
// ============================================================================
testRunner.registerSuite("Performance", [
  {
    name: "Bulk insert with transaction",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER, value TEXT)");

      const startTime = performance.now();

      db.exec("BEGIN TRANSACTION");
      const stmt = db.prepare("INSERT INTO test VALUES (?, ?)");
      for (let i = 0; i < 1000; i++) {
        stmt.bind([i, `value_${i}`]).stepReset();
      }
      stmt.finalize();
      db.exec("COMMIT");

      const duration = performance.now() - startTime;

      const count = TestUtils.execQuery(db, "SELECT COUNT(*) as cnt FROM test");
      TestUtils.assertEqual(count[0].cnt, 1000, "Should insert 1000 rows");
      TestUtils.assertTrue(
        duration < 1000,
        `Bulk insert should be fast (took ${duration}ms)`
      );

      db.close();
    },
  },
  {
    name: "Index improves query performance",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER, value TEXT)");

      // Insert test data
      db.exec("BEGIN TRANSACTION");
      const stmt = db.prepare("INSERT INTO test VALUES (?, ?)");
      for (let i = 0; i < 1000; i++) {
        stmt.bind([i, `value_${i}`]).stepReset();
      }
      stmt.finalize();
      db.exec("COMMIT");

      // Query without index
      const start1 = performance.now();
      TestUtils.execQuery(db, "SELECT * FROM test WHERE id = 500");
      const time1 = performance.now() - start1;

      // Create index
      db.exec("CREATE INDEX idx_id ON test(id)");

      // Query with index
      const start2 = performance.now();
      TestUtils.execQuery(db, "SELECT * FROM test WHERE id = 500");
      const time2 = performance.now() - start2;

      TestUtils.assertTrue(
        time2 <= time1 * 1.5,
        "Indexed query should be as fast or faster"
      );

      db.close();
    },
  },
  {
    name: "Large result set handling",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value INTEGER)");

      db.exec("BEGIN TRANSACTION");
      const stmt = db.prepare("INSERT INTO test VALUES (?)");
      for (let i = 0; i < 5000; i++) {
        stmt.bind([i]).stepReset();
      }
      stmt.finalize();
      db.exec("COMMIT");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result.length, 5000, "Should retrieve all 5000 rows");

      db.close();
    },
  },
]);

// ============================================================================
// TEST SUITE: Data Types
// ============================================================================
testRunner.registerSuite("Data Types", [
  {
    name: "INTEGER type",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value INTEGER)");
      db.exec("INSERT INTO test VALUES (42), (-100), (0)");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result[0].value, 42, "Should store positive integer");
      TestUtils.assertEqual(result[1].value, -100, "Should store negative integer");
      TestUtils.assertEqual(result[2].value, 0, "Should store zero");

      db.close();
    },
  },
  {
    name: "REAL type",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value REAL)");
      db.exec("INSERT INTO test VALUES (3.14), (-2.5), (0.0)");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertTrue(
        Math.abs(result[0].value - 3.14) < 0.001,
        "Should store float"
      );

      db.close();
    },
  },
  {
    name: "TEXT type",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value TEXT)");
      db.exec(
        "INSERT INTO test VALUES ('Hello'), (''), ('Unicode: 你好 🚀')"
      );

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result[0].value, "Hello", "Should store text");
      TestUtils.assertEqual(result[1].value, "", "Should store empty string");
      TestUtils.assertEqual(
        result[2].value,
        "Unicode: 你好 🚀",
        "Should store Unicode"
      );

      db.close();
    },
  },
  {
    name: "BLOB type",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value BLOB)");

      const stmt = db.prepare("INSERT INTO test VALUES (?)");
      const blobData = new Uint8Array([1, 2, 3, 4, 5]);
      stmt.bind([blobData]).stepFinalize();

      // Verify blob was stored
      const result = TestUtils.execQuery(db, "SELECT LENGTH(value) as len FROM test");
      TestUtils.assertEqual(result[0].len, 5, "Blob should have 5 bytes");

      db.close();
    },
  },
  {
    name: "NULL values",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (value TEXT)");
      db.exec("INSERT INTO test VALUES (NULL), ('not null')");

      const result = TestUtils.execQuery(db, "SELECT * FROM test");
      TestUtils.assertEqual(result[0].value, null, "Should store NULL");
      TestUtils.assertEqual(result[1].value, "not null", "Should store text");

      db.close();
    },
  },
]);

// ============================================================================
// Message Handler
// ============================================================================
self.onmessage = async function (event) {
  // 1. Input handling
  const { cmd } = event.data;

  // 2. Core processing - Handle command
  if (cmd === "run-tests") {
    // 3. Output handling - Initialize and run tests
    const initialized = await testRunner.initialize();
    if (initialized) {
      await testRunner.runAllTests();
    } else {
      testRunner.sendMessage("error", {
        error: "Failed to initialize SQLite3",
      });
    }
  }
};
