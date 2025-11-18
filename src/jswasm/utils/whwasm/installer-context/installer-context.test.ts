import { describe, expect, it } from "vitest";

import { WhWasmInstallerContext } from "./installer-context";

type TargetOverrides = Partial<
  import("./installer-context.d.ts").WhWasmHelperTarget
>;

const createTarget = (overrides: TargetOverrides = {}) => {
  const memory =
    overrides.memory ??
    new WebAssembly.Memory({
      initial: 2,
    });
  const exports = overrides.exports ?? { memory };
  return {
    memory,
    exports,
    ...overrides,
  };
};

const newContext = (overrides: TargetOverrides = {}) =>
  new WhWasmInstallerContext(createTarget(overrides));

describe("WhWasmInstallerContext", () => {
  describe("resolveMemory", () => {
    it("prefers the direct memory reference", () => {
      const memory = new WebAssembly.Memory({ initial: 1 });
      const ctx = new WhWasmInstallerContext(
        createTarget({
          memory,
          exports: { memory: new WebAssembly.Memory({ initial: 1 }) },
        }),
      );
      expect(ctx.resolveMemory()).toBe(memory);
      expect(ctx.cache.memory).toBe(memory);
    });

    it("falls back to exports.memory when needed", () => {
      const memory = new WebAssembly.Memory({ initial: 1 });
      const ctx = new WhWasmInstallerContext(
        createTarget({
          memory: undefined,
          exports: { memory },
        }),
      );
      expect(ctx.resolveMemory()).toBe(memory);
    });
  });

  describe("getHeapViews", () => {
    it("caches typed-array views until the heap grows", () => {
      const ctx = newContext();
      const first = ctx.getHeapViews();
      const firstHeap8 = first.HEAP8;
      const firstHeapSize = first.heapSize;
      const second = ctx.getHeapViews();
      expect(second.HEAP8).toBe(firstHeap8);

      ctx.target.memory!.grow(1);
      const refreshed = ctx.getHeapViews();
      expect(refreshed.heapSize).toBeGreaterThan(firstHeapSize);
      expect(refreshed.HEAP8?.byteLength).toBe(
        ctx.target.memory!.buffer.byteLength,
      );
    });

    it("exposes bigint heap views only when enabled", () => {
      const ctx = newContext();
      expect(ctx.getHeapViews().HEAP64).toBeUndefined();

      ctx.target.bigIntEnabled = true;
      ctx.target.memory!.grow(1);
      expect(ctx.getHeapViews().HEAP64).toBeDefined();

      ctx.target.bigIntEnabled = false;
      ctx.target.memory!.grow(1);
      expect(ctx.getHeapViews().HEAP64).toBeUndefined();
    });
  });

  describe("pointer metadata", () => {
    it("defaults to 32-bit pointers", () => {
      const ctx = newContext();
      expect(ctx.ptrIR).toBe("i32");
      expect(ctx.ptrSizeof).toBe(4);
    });

    it("supports 64-bit pointer metadata", () => {
      const ctx = newContext({ pointerIR: "i64" });
      expect(ctx.ptrIR).toBe("i64");
      expect(ctx.ptrSizeof).toBe(8);
    });

    it("throws for unsupported pointer representations", () => {
      expect(() => newContext({ pointerIR: "foo" as never })).toThrowError(
        "Unhandled ptrSizeof: foo",
      );
    });
  });

  it("toss joins message parts", () => {
    const ctx = newContext();
    expect(() => ctx.toss("bad", "input")).toThrowError("bad input");
  });
});
