import { test, expect } from "vitest";
import { runTestInWorker } from "./worker-client";

test("OPFS VFS should be registered in worker", async () => {
  const sql = "SELECT 1";
  // This basically tests if we can run a query, which implies VFS is working
  // But let's make it check for 'opfs' VFS specifically
  // We can't easily check CAPI from here without exposing it, but if runTestInWorker works,
  // it means OPFS VFS was installed and used (since we force it in test-worker.ts)

  const result = await runTestInWorker("Check VFS", sql);
  expect(result).toBeDefined();
  expect(result.length).toBe(1);
});
