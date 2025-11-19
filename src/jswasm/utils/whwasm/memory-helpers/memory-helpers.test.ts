import { describe, expect, it } from "vitest";
import {
  attachMemoryAccessors,
  type MemoryAccessorTarget,
} from "./memory-helpers";

type HeapViews = {
  HEAP8: Int8Array;
  HEAP16: Int16Array;
  HEAP32: Int32Array;
  HEAP32F: Float32Array;
  HEAP64F: Float64Array;
  HEAP64: BigInt64Array;
};

const BUFFER_SIZE = 64;

type MockContext = {
  target: MemoryAccessorTarget;
  ptrIR: "i32" | "i64";
  getHeapViews: () => HeapViews;
  toss: (...args: unknown[]) => never;
};

const createMockContext = (
  overrides: Partial<{
    ptrIR: "i32" | "i64";
    bigIntEnabled: boolean;
  }> = {},
): MockContext => {
  const buffer = new ArrayBuffer(BUFFER_SIZE);
  const heaps: HeapViews = {
    HEAP8: new Int8Array(buffer),
    HEAP16: new Int16Array(buffer),
    HEAP32: new Int32Array(buffer),
    HEAP32F: new Float32Array(buffer),
    HEAP64F: new Float64Array(buffer),
    HEAP64: new BigInt64Array(buffer),
  };

  const target = {
    bigIntEnabled: overrides.bigIntEnabled ?? true,
  } as MemoryAccessorTarget;

  const context: MockContext = {
    target,
    ptrIR: overrides.ptrIR ?? "i32",
    getHeapViews: () => heaps,
    toss: (...args: unknown[]): never => {
      throw new Error(args.join(" "));
    },
  };

  attachMemoryAccessors(context as never);
  return context;
};

describe("attachMemoryAccessors", () => {
  it("round-trips scalar peek/poke helpers", () => {
    const { target } = createMockContext();

    target.poke8?.(0, 0x7f);
    expect(target.peek8?.(0)).toBe(0x7f);

    target.poke16?.(2, 0x7fff);
    expect(target.peek16?.(2)).toBe(0x7fff);

    target.poke32?.(4, 0x7fffffff);
    expect(target.peek32?.(4)).toBe(0x7fffffff);

    target.poke32f?.(8, 123.5);
    expect(target.peek32f?.(8)).toBeCloseTo(123.5);

    target.poke64f?.(16, 9876.5);
    expect(target.peek64f?.(16)).toBeCloseTo(9876.5);
  });

  it("supports pointer-sized helpers and star type resolution", () => {
    const { target } = createMockContext({ ptrIR: "i32" });

    target.pokePtr?.(0, 0x12345678);
    expect(target.peekPtr?.(0)).toBe(0x12345678);

    target.poke?.([0, 4], 0x55aa55aa, "ptr*");
    expect(target.peek?.([0, 4], "ptr*")).toEqual([0x55aa55aa, 0x55aa55aa]);
  });

  it("reads and writes 64-bit integers when BigInt is enabled", () => {
    const { target } = createMockContext({ ptrIR: "i64", bigIntEnabled: true });
    const bigValue = 2n ** 40n;

    target.poke64?.(0, bigValue);
    expect(target.peek64?.(0)).toBe(bigValue);
  });

  it("handles multi-pointer peek and poke requests", () => {
    const { target } = createMockContext();

    target.poke?.([0, 1], 33, "i8");
    expect(target.peek?.([0, 1], "i8")).toEqual([33, 33]);

    target.poke32?.(0, 101);
    target.poke32?.(4, 202);
    expect(target.peek32?.(0, 4)).toEqual([101, 202]);
  });

  it("exposes alias helpers for backward compatibility", () => {
    const { target } = createMockContext();

    target.setMemValue?.(0, 77, "i8");
    expect(target.getMemValue?.(0, "i8")).toBe(77);

    target.setPtrValue?.(4, 0x1fffffff);
    expect(target.getPtrValue?.(4)).toBe(0x1fffffff);
  });

  it("detects pointer shapes via isPtr32/isPtr", () => {
    const { target } = createMockContext();

    expect(target.isPtr32?.(0)).toBe(true);
    expect(target.isPtr32?.(4096)).toBe(true);
    expect(target.isPtr32?.(-1)).toBe(false);
    expect(target.isPtr32?.(3.14)).toBe(false);
    expect(target.isPtr32?.("42")).toBe(false);

    expect(target.isPtr?.(128)).toBe(true);
    expect(target.isPtr?.(Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});
