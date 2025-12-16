import { describe, test, expect } from "vitest";
import openDB from "web-sqlite-js";

describe("web-sqlite-js e2e tests — OPFS integration", () => {
  test("should create an SQLite file in OPFS when opening the database", async () => {
    const filename = "e2e-sqlite3.sqlite3";
    await openDB(filename);
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(filename);
    const file = await handle.getFile();

    expect(file).toBeTruthy();
  });
});
