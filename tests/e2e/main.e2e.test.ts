import { describe, test, expect } from "vitest";
import { hello } from "@/main";

describe("Hello test", () => {
  test("Hello test case", async () => {
    const result = hello();
    expect(result).toBe("hello world!");
  });
});
