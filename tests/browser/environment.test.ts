import { test, expect } from "vitest";
import { runTestInWorker } from "./worker-client";

test("SQLite3 module loads successfully", async () => {
  const result = await runTestInWorker(
    "SQLite3 module loads successfully",
    "",
    "/env-test.db",
    false,
    true,
  );
  const env = result[0];
  expect(env.sqlite3Loaded).toBe(true);
  expect(env.version).toBeDefined();
});

test("OPFS VFS is available", async () => {
  const result = await runTestInWorker(
    "OPFS VFS is available",
    "",
    "/env-test.db",
    false,
    true,
  );
  const env = result[0];
  expect(env.opfsVfsAvailable).toBe(true);
});

test("SharedArrayBuffer is supported", async () => {
  expect(typeof SharedArrayBuffer).not.toBe("undefined");
});

test("DB class is available", async () => {
  const result = await runTestInWorker(
    "DB class is available",
    "",
    "/env-test.db",
    false,
    true,
  );
  const env = result[0];
  expect(env.dbClassAvailable).toBe(true);
});
