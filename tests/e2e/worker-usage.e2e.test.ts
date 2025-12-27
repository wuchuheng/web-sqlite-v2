import { describe, it, expect } from "vitest";

describe("Worker Integration (Chrome Extension Style)", () => {
  it("should allow using the library inside another worker", async () => {
    // In Vitest Browser mode, we can spawn a worker from the test
    const worker = new Worker(
      new URL("./support/integration-worker.ts", import.meta.url),
      { type: "module" },
    );

    const result = await new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        if (e.data.success) {
          resolve(e.data.data);
        } else {
          reject(new Error(e.data.error));
        }
      };
      worker.onerror = () => reject(new Error("Worker load error"));

      worker.postMessage({ type: "RUN_TEST" });
    });

    expect(result).toBeInstanceOf(Array);
    const rows = result as { msg: string }[];
    expect(rows[0].msg).toBe("Worker is running");

    worker.terminate();
  });
});
