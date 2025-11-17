import { describe, expect, test } from "vitest";
import {
  describeMember,
  detectLittleEndian,
  defineReadonly,
  isNumericValue,
  toss,
} from "./struct-binder-helpers";

describe("struct-binder helpers", () => {
  test("toss throws with joined message and never returns", () => {
    expect(() => toss("alpha", "beta")).toThrow("alpha beta");
  });

  test("defineReadonly creates sealed, non-enumerable fields", () => {
    const target: Record<string, unknown> = {};
    defineReadonly(target, "answer", 42);
    const descriptor = Object.getOwnPropertyDescriptor(target, "answer");
    expect(target.answer).toBe(42);
    expect(descriptor).toEqual({
      configurable: false,
      enumerable: false,
      writable: false,
      value: 42,
    });
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (target as any).answer = 100;
    }).toThrow();
  });

  test("describeMember formats struct::member", () => {
    expect(describeMember("Foo", "bar")).toBe("Foo::bar");
  });

  test("isNumericValue validates numbers, bigints, and Number wrappers", () => {
    expect(isNumericValue(0)).toBe(true);
    expect(isNumericValue(3.14)).toBe(true);
    expect(isNumericValue(BigInt(1))).toBe(true);
    expect(isNumericValue(Object(5))).toBe(true);
    expect(isNumericValue(NaN)).toBe(false);
    expect(isNumericValue(Infinity)).toBe(false);
    expect(isNumericValue("5")).toBe(false);
    expect(isNumericValue({})).toBe(false);
  });

  test("detectLittleEndian matches DataView check", () => {
    const littleEndian = detectLittleEndian();
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true);
    expect(new Int16Array(buffer)[0] === 256).toBe(littleEndian);
  });
});
