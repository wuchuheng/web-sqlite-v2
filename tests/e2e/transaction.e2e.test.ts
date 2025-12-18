import { describe, test, expect } from "vitest";
import openDB from "../../src/main";

describe("transaction e2e tests", () => {
  test("should commit transaction on success", async () => {
    const filename = "transaction-commit.sqlite3";
    const db = await openDB(filename);

    await db.exec("DROP TABLE IF EXISTS tx_test;");
    await db.exec(
      "CREATE TABLE IF NOT EXISTS tx_test (id INTEGER PRIMARY KEY, name TEXT);",
    );

    await db.transaction(async (tx) => {
      await tx.exec("INSERT INTO tx_test (id, name) VALUES (1, 'Alice');");
      await tx.exec("INSERT INTO tx_test (id, name) VALUES (2, 'Bob');");
    });

    const rows = await db.query("SELECT * FROM tx_test");
    expect(rows).toHaveLength(2);

    await db.close();
  });

  test("should rollback transaction on error", async () => {
    const filename = "transaction-rollback.sqlite3";
    const db = await openDB(filename);

    await db.exec("DROP TABLE IF EXISTS tx_fail;");
    await db.exec(
      "CREATE TABLE IF NOT EXISTS tx_fail (id INTEGER PRIMARY KEY, name TEXT);",
    );

    // Initial data
    await db.exec("INSERT INTO tx_fail (id, name) VALUES (1, 'Initial');");

    try {
      await db.transaction(async (tx) => {
        await tx.exec("INSERT INTO tx_fail (id, name) VALUES (2, 'Pending');");
        throw new Error("Simulated Failure");
      });
    } catch (e) {
      expect((e as Error).message).toBe("Simulated Failure");
    }

    const rows = await db.query<{ id: number; name: string }>(
      "SELECT * FROM tx_fail",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Initial");

    await db.close();
  });
});
