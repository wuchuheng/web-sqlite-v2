import { test, expect } from "vitest";
import { runTestInWorker } from "./worker-client";

const DB_FILE = "/test.db";

test("Check version info", async () => {
  const sql = "SELECT sqlite_version() as version";
  const result = await runTestInWorker("Version Info", sql, DB_FILE);

  expect(result.length).toBe(1);
  expect(typeof result[0].version).toBe("string");
  expect(result[0].version.length).toBeGreaterThan(0);
});

test("Version metadata matches C API values", async () => {
  const sql = `
    SELECT 
      sqlite_version() as libVersion,
      sqlite_source_id() as sourceId;
  `;
  const result = await runTestInWorker(
    "Version metadata matches C API values",
    sql,
    DB_FILE,
  );

  expect(result.length).toBe(1);
  expect(typeof result[0].libVersion).toBe("string");
  expect(result[0].libVersion.length).toBeGreaterThan(0);
  expect(typeof result[0].sourceId).toBe("string");
  expect(result[0].sourceId.length).toBeGreaterThan(0);
});

test("Source ID is consistent", async () => {
  const sql = `
    SELECT 
      sqlite_source_id() as sourceId1,
      sqlite_source_id() as sourceId2;
  `;
  const result = await runTestInWorker("Source ID is consistent", sql, DB_FILE);

  expect(result.length).toBe(1);
  expect(result[0].sourceId1).toBe(result[0].sourceId2);
  expect(typeof result[0].sourceId1).toBe("string");
  expect(result[0].sourceId1.length).toBeGreaterThan(0);
});

test("Version fields have expected shapes", async () => {
  const sql = `
    SELECT 
      sqlite_version() as libVersion;
  `;
  const result = await runTestInWorker(
    "Version fields have expected shapes",
    sql,
    DB_FILE,
  );

  expect(result.length).toBe(1);

  // Check libVersion format (should be semantic version)
  expect(typeof result[0].libVersion).toBe("string");
  expect(/^\d+\.\d+\.\d+$/.test(result[0].libVersion)).toBe(true);
});
