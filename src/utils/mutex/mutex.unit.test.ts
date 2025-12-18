import { describe, it, expect } from "vitest";
import { createMutex } from "./mutex";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("createMutex", () => {
  it("should execute tasks sequentially", async () => {
    const runMutex = createMutex();
    const results: string[] = [];

    const task1 = () =>
      runMutex(async () => {
        await delay(50);
        results.push("task1");
      });

    const task2 = () =>
      runMutex(async () => {
        await delay(10); // Shorter delay, but should run after task1
        results.push("task2");
      });

    await Promise.all([task1(), task2()]);

    expect(results).toEqual(["task1", "task2"]);
  });

  it("should continue processing queue after a task fails", async () => {
    const runMutex = createMutex();
    const results: string[] = [];

    const failTask = () =>
      runMutex(async () => {
        await delay(20);
        throw new Error("Task failed");
      });

    const successTask = () =>
      runMutex(async () => {
        await delay(20);
        results.push("success");
      });

    // We expect failTask to reject, but the mutex queue should proceed to successTask
    await expect(failTask()).rejects.toThrow("Task failed");
    await successTask();

    expect(results).toEqual(["success"]);
  });

  it("should return the result of the task", async () => {
    const runMutex = createMutex();

    const result = await runMutex<string>(async () => {
      return "value";
    });

    expect(result).toBe("value");
  });
});
