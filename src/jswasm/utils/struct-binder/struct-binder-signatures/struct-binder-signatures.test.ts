import { beforeEach, describe, expect, test } from "vitest";
import { createSignatureHelpers } from "./struct-binder-signatures";

type Config = Parameters<typeof createSignatureHelpers>[0];

const baseConfig: Config = {
  ptrSizeof: 4,
  ptrIR: "ptr",
  bigIntEnabled: true,
};

const withBigIntOverride = <T>(
  value: typeof globalThis.BigInt64Array | undefined,
  fn: () => T,
): T => {
  const original = globalThis.BigInt64Array;
  try {
    // @ts-expect-error allow temporarily clearing the ctor
    globalThis.BigInt64Array = value;
    return fn();
  } finally {
    globalThis.BigInt64Array = original;
  }
};

describe("struct-binder signature helpers", () => {
  beforeEach(() => {
    // Ensure the default BigInt64Array stays defined for tests that rely on it.
    if (!globalThis.BigInt64Array) {
      throw new Error("Environment is missing BigInt64Array");
    }
  });

  test("glyph detection matches the original helper", () => {
    const helper = createSignatureHelpers(baseConfig);
    expect(helper.glyphFor("p")).toBe("p");
    expect(helper.glyphFor("P")).toBe("P");
    expect(helper.glyphFor("j")?.toLowerCase()).toBe("j");
    expect(helper.glyphFor("p(i)")).toBe("p");
    expect(helper.isAutoPointer("P")).toBe(true);
  });

  test("irFor maps glyphs to IR names", () => {
    const helper = createSignatureHelpers(baseConfig);
    expect(helper.irFor("c")).toBe("i8");
    expect(helper.irFor("i")).toBe("i32");
    expect(helper.irFor("p")).toBe("ptr");
    expect(helper.irFor("P")).toBe("ptr");
    expect(helper.irFor("s")).toBe("ptr");
    expect(helper.irFor("j")).toBe("i64");
    expect(helper.irFor("f")).toBe("float");
    expect(helper.irFor("d")).toBe("double");
  });

  test("getters/setters fall back to Number-based accessors when pointers are 32-bit", () => {
    const helper = createSignatureHelpers(baseConfig);
    expect(helper.getterFor("p")).toBe("getInt32");
    expect(helper.setterFor("p")).toBe("setInt32");
    expect(helper.getterFor("i")).toBe("getInt32");
    expect(helper.setterFor("i")).toBe("setInt32");
    expect(helper.getterFor("c")).toBe("getInt8");
    expect(helper.setterFor("C")).toBe("setUint8");
    expect(helper.getterFor("f")).toBe("getFloat32");
    expect(helper.setterFor("d")).toBe("setFloat64");
  });

  test("64-bit accessors use BigInt when enabled", () => {
    const helper = createSignatureHelpers({ ...baseConfig, ptrSizeof: 8 });
    expect(helper.getterFor("p")).toBe("getBigInt64");
    expect(helper.setterFor("p")).toBe("setBigInt64");
    expect(helper.getterFor("j")).toBe("getBigInt64");
    expect(helper.setterFor("j")).toBe("setBigInt64");
    expect(helper.wrapForSet("j")).toBe(BigInt);
    expect(helper.wrapForSet("p")).toBe(BigInt);
  });

  test("wrapForSet returns Number for non-BigInt signatures", () => {
    const helper = createSignatureHelpers(baseConfig);
    expect(helper.wrapForSet("i")).toBe(Number);
    expect(helper.wrapForSet("f")).toBe(Number);
    expect(helper.wrapForSet("c")).toBe(Number);
  });

  test("throws when encountering unknown signatures", () => {
    const helper = createSignatureHelpers(baseConfig);
    expect(() => helper.irFor("z")).toThrow("Unhandled signature IR");
    expect(() => helper.getterFor("z")).toThrow("Unhandled DataView getter");
    expect(() => helper.setterFor("z")).toThrow("Unhandled DataView setter");
    expect(() => helper.wrapForSet("z")).toThrow("Unhandled setter wrapper");
  });

  test("requires BigInt64Array when 64-bit pointers or i64 signatures are requested", () => {
    expect(() =>
      withBigIntOverride(undefined, () =>
        createSignatureHelpers({ ...baseConfig, ptrSizeof: 8 }).getterFor("p"),
      ),
    ).toThrow("BigInt64Array is not available");
    expect(() =>
      withBigIntOverride(undefined, () =>
        createSignatureHelpers({
          ...baseConfig,
          ptrSizeof: 4,
          bigIntEnabled: true,
        }).getterFor("j"),
      ),
    ).toThrow("BigInt64Array is not available");
  });
});
