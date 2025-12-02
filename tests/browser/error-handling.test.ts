import { describe, test, expect } from "vitest";
import { runTestInWorker } from "./worker-client";

describe("Error Handling Tests", () => {
  const DB_FILE = "/error_handling.db";

  test("Invalid SQL syntax", async () => {
    const sql = "SELCT * FROM nowhere"; // Typo intended
    try {
      await runTestInWorker("Invalid SQL syntax", sql, DB_FILE);
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toMatch(/syntax error/);
    }
  });

  test("Table does not exist", async () => {
    const sql = "SELECT * FROM nonexistent_table";
    try {
      await runTestInWorker("Table does not exist", sql, DB_FILE);
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toMatch(/no such table/);
    }
  });

  test("Column does not exist", async () => {
    const tableName = "errors_missing_column";
    const sql = `
      CREATE TABLE ${tableName} (id INTEGER);
      SELECT nonexistent_column FROM ${tableName};
    `;
    try {
      await runTestInWorker("Column does not exist", sql, DB_FILE);
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toMatch(/no such column/);
    }
  });

  test("Proper error message format", async () => {
    const sql = "INVALID SQL STATEMENT";
    try {
      await runTestInWorker("Proper error message format", sql, DB_FILE);
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message.length).toBeGreaterThan(0);
    }
  });
});
