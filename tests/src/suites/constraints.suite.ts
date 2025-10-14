import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

/**
 * Constraints Tests
 * Tests for database constraints and validation
 */
export const constraintsTests: TestCase[] = [
  {
    name: "PRIMARY KEY constraint",
    fn: async (sqlite3) => {
      const db = new sqlite3.oo1.DB();

      db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");
      db.exec("INSERT INTO test VALUES (1)");

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

      TestUtils.assertThrows(() => {
        db.exec("INSERT INTO child VALUES (2, 999)");
      }, "Should reject invalid foreign key");

      db.close();
    },
  },
];
