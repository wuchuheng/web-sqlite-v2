import { describe, test, expect } from "vitest";
import openDB from "web-sqlite-js";

describe("web-sqlite-js e2e tests — OPFS integration", () => {
  test("should create an SQLite file in OPFS when opening the database", async () => {
    const filename = "e2e-sqlite3.sqlite3";
    const db = await openDB(filename);
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(filename);
    const releaseHandle = await dir.getFileHandle("release.sqlite3");
    const defaultHandle = await dir.getFileHandle("default.sqlite3");
    const releaseFile = await releaseHandle.getFile();
    const defaultFile = await defaultHandle.getFile();

    expect(releaseFile).toBeTruthy();
    expect(defaultFile).toBeTruthy();
    await db.close();
  });
});
