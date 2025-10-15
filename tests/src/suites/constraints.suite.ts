import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

const CONSTRAINT_DB_FILE = TestUtils.getSharedDbFile();
const CONSTRAINT_TABLES = {
  primaryKey: "constraints_primary",
  unique: "constraints_unique",
  notNull: "constraints_not_null",
  check: "constraints_check",
  parent: "constraints_parent",
  child: "constraints_child",
} as const;

TestUtils.trackOpfsDb(CONSTRAINT_DB_FILE);

/**
 * Constraints Tests
 * Tests for database constraints and validation
 */
export const constraintsTests: TestCase[] = [
  {
    name: "PRIMARY KEY constraint",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, CONSTRAINT_DB_FILE);
      const tableName = CONSTRAINT_TABLES.primaryKey;

      try {
        db.exec(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY)`);
        db.exec(`INSERT INTO ${tableName} VALUES (1)`);

        TestUtils.assertThrows(() => {
          db.exec(`INSERT INTO ${tableName} VALUES (1)`);
        }, "Should reject duplicate primary key");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "UNIQUE constraint",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, CONSTRAINT_DB_FILE);
      const tableName = CONSTRAINT_TABLES.unique;

      try {
        db.exec(`CREATE TABLE ${tableName} (email TEXT UNIQUE)`);
        db.exec(`INSERT INTO ${tableName} VALUES ('test@example.com')`);

        TestUtils.assertThrows(() => {
          db.exec(`INSERT INTO ${tableName} VALUES ('test@example.com')`);
        }, "Should reject duplicate unique value");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "NOT NULL constraint",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, CONSTRAINT_DB_FILE);
      const tableName = CONSTRAINT_TABLES.notNull;

      try {
        db.exec(`CREATE TABLE ${tableName} (name TEXT NOT NULL)`);

        TestUtils.assertThrows(() => {
          db.exec(`INSERT INTO ${tableName} VALUES (NULL)`);
        }, "Should reject NULL value");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "CHECK constraint",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, CONSTRAINT_DB_FILE);
      const tableName = CONSTRAINT_TABLES.check;

      try {
        db.exec(
          `CREATE TABLE ${tableName} (age INTEGER CHECK(age >= 0 AND age <= 150))`
        );
        db.exec(`INSERT INTO ${tableName} VALUES (25)`);

        TestUtils.assertThrows(() => {
          db.exec(`INSERT INTO ${tableName} VALUES (200)`);
        }, "Should reject value violating CHECK constraint");
      } finally {
        db.close();
      }
    },
  },
  {
    name: "FOREIGN KEY constraint",
    fn: async (sqlite3) => {
      const db = TestUtils.createTestDb(sqlite3, CONSTRAINT_DB_FILE);
      const parentTable = CONSTRAINT_TABLES.parent;
      const childTable = CONSTRAINT_TABLES.child;

      try {
        db.exec("PRAGMA foreign_keys = ON");
        db.exec(`CREATE TABLE ${parentTable} (id INTEGER PRIMARY KEY)`);
        db.exec(
          `CREATE TABLE ${childTable} (id INTEGER, parent_id INTEGER, FOREIGN KEY(parent_id) REFERENCES ${parentTable}(id))`
        );

        db.exec(`INSERT INTO ${parentTable} VALUES (1)`);
        db.exec(`INSERT INTO ${childTable} VALUES (1, 1)`);

        TestUtils.assertThrows(() => {
          db.exec(`INSERT INTO ${childTable} VALUES (2, 999)`);
        }, "Should reject invalid foreign key");
      } finally {
        db.close();
      }
    },
  },
];
