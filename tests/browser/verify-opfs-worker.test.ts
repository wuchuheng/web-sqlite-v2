import { describe, test, expect } from "vitest";

describe("OPFS Worker Verification", () => {
  test("Should run OPFS operations in a worker", async () => {
    const worker = new Worker(new URL("./test-worker.ts", import.meta.url), {
      type: "module",
    });

    const result = await new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        if (e.data.type === "test-success") {
          resolve(e.data.result);
        } else if (e.data.type === "test-failure") {
          reject(new Error(e.data.error));
        }
      };

      worker.postMessage({
        type: "run-opfs-test",
        payload: {
          testName: "basic-opfs",
          dbFile: "/worker_test.db",
          sql: "SELECT 1 as val",
        },
      });
    });

    expect(result).toEqual([{ val: 1 }]);
    worker.terminate();
  });
});
