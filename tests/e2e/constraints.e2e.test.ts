import { describe, test, expect } from "vitest";
import { runTestInWorker } from "./worker-client";

describe("Constraints Tests", () => {
  const DB_FILE = "/constraints.db";

  test("PRIMARY KEY constraint", async () => {
    const tableName = "constraints_primary";
    const sql = `
      CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY);
      INSERT INTO ${tableName} VALUES (1);
      INSERT INTO ${tableName} VALUES (1); -- Should fail
    `;

    try {
      await runTestInWorker("PRIMARY KEY constraint", sql, DB_FILE);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect((error as Error).message).toMatch(/UNIQUE constraint failed/);
    }
  });

  test("UNIQUE constraint", async () => {
    const tableName = "constraints_unique";
    const sql = `
      CREATE TABLE ${tableName} (email TEXT UNIQUE);
      INSERT INTO ${tableName} VALUES ('test@example.com');
      INSERT INTO ${tableName} VALUES ('test@example.com'); -- Should fail
    `;

    try {
      await runTestInWorker("UNIQUE constraint", sql, DB_FILE);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect((error as Error).message).toMatch(/UNIQUE constraint failed/);
    }
  });

  test("NOT NULL constraint", async () => {
    const tableName = "constraints_not_null";
    const sql = `
      CREATE TABLE ${tableName} (name TEXT NOT NULL);
      INSERT INTO ${tableName} VALUES (NULL); -- Should fail
    `;

    try {
      await runTestInWorker("NOT NULL constraint", sql, DB_FILE);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect((error as Error).message).toMatch(/NOT NULL constraint failed/);
    }
  });

  test("CHECK constraint", async () => {
    const tableName = "constraints_check";
    const sql = `
      CREATE TABLE ${tableName} (age INTEGER CHECK(age >= 0 AND age <= 150));
      INSERT INTO ${tableName} VALUES (25);
      INSERT INTO ${tableName} VALUES (200); -- Should fail
    `;

    try {
      await runTestInWorker("CHECK constraint", sql, DB_FILE);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect((error as Error).message).toMatch(/CHECK constraint failed/);
    }
  });

  test("FOREIGN KEY constraint", async () => {
    const parentTable = "constraints_parent";
    const childTable = "constraints_child";
    const sql = `
      PRAGMA foreign_keys = ON;
      CREATE TABLE ${parentTable} (id INTEGER PRIMARY KEY);
      CREATE TABLE ${childTable} (id INTEGER, parent_id INTEGER, FOREIGN KEY(parent_id) REFERENCES ${parentTable}(id));
      INSERT INTO ${parentTable} VALUES (1);
      INSERT INTO ${childTable} VALUES (1, 1);
      INSERT INTO ${childTable} VALUES (2, 999); -- Should fail
    `;

    try {
      await runTestInWorker("FOREIGN KEY constraint", sql, DB_FILE);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect((error as Error).message).toMatch(/FOREIGN KEY constraint failed/);
    }
  });
});
