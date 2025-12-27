import { describe, test, expect } from "vitest";

describe("Same-Thread Mode e2e tests", () => {
  test("should work inside a worker where nested workers are disabled", async () => {
    const worker = new Worker(new URL("./test-worker.ts", import.meta.url), {
      type: "module",
    });

    const result = await new Promise<{
      success: boolean;
      data?: unknown[];
      error?: string;
    }>((resolve) => {
      worker.onmessage = (event) => resolve(event.data);
      worker.onerror = (_e) =>
        resolve({ success: false, error: "Worker Error" });
      worker.postMessage({ filename: "worker-in-worker.sqlite3" });
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    // @ts-expect-error - data is unknown[]
    expect(result.data![0].name).toBe("nested-worker-test");

    worker.terminate();
  });
});
