import { describe, test, expect } from "vitest";
import openDB from "@wuchuheng/web-sqlite";

describe("Sqlite3 test", () => {
  test("opens a database via the library", async () => {
    await openDB("e2e-sqlite3");
    expect(true).toBe(true);
  });
});
