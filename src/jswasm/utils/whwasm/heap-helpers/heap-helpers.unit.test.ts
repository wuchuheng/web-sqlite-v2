import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  WhWasmHelperTarget,
  WhWasmInstallerContext,
} from "../installer-context/installer-context";
import { WhWasmInstallerContext as InstallerContext } from "../installer-context/installer-context";

type HeapHelpersModule = {
  attachHeapAccessors: (context: WhWasmInstallerContext) => void;
  attachSizeHelpers: (context: WhWasmInstallerContext) => void;
};

type TargetWithHelpers = WhWasmHelperTarget & {
  heap32: () => Int32Array;
  heap32u: () => Uint32Array;
  heap16: () => Int16Array;
  heap16u: () => Uint16Array;
  heap8: () => Int8Array;
  heap8u: () => Uint8Array;
  heapForSize: (
    sizeIndicator:
      | number
      | typeof Int8Array
      | typeof Uint8Array
      | typeof Int16Array
      | typeof Uint16Array
      | typeof Int32Array
      | typeof Uint32Array
      | typeof Float32Array
      | typeof Float64Array
      | typeof BigInt64Array
      | typeof BigUint64Array,
    unsigned?: boolean,
  ) => ArrayBufferView;
  sizeofIR: (identifier: string) => number | undefined;
};

const loadHeapHelpers = async (): Promise<HeapHelpersModule> => {
  vi.resetModules();
  return await import("./heap-helpers");
};

const createInstallerContext = (options?: {
  bigIntEnabled?: boolean;
  pointerIR?: "i32" | "i64";
}) => {
  const { bigIntEnabled = false, pointerIR = "i32" } = options ?? {};
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 2 });
  const target: WhWasmHelperTarget = {
    bigIntEnabled,
    memory,
    pointerIR,
  };
  const context = new InstallerContext(target);
  return { context, target: target as TargetWithHelpers };
};

describe("heap-helpers.mjs (baseline)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("installs sizeofIR mappings for primitive signatures", async () => {
    const { attachSizeHelpers } = await loadHeapHelpers();
    const { context, target } = createInstallerContext({ pointerIR: "i32" });
    attachSizeHelpers(context);
    expect(target.sizeofIR("i8")).toBe(1);
    expect(target.sizeofIR("i16")).toBe(2);
    expect(target.sizeofIR("i32")).toBe(4);
    expect(target.sizeofIR("f32")).toBe(4);
    expect(target.sizeofIR("float")).toBe(4);
    expect(target.sizeofIR("i64")).toBe(8);
    expect(target.sizeofIR("f64")).toBe(8);
    expect(target.sizeofIR("double")).toBe(8);
    expect(target.sizeofIR("unknown")).toBeUndefined();
  });

  it("resolves pointer-like signatures using the configured ptrSizeof", async () => {
    const { attachSizeHelpers } = await loadHeapHelpers();
    const { context, target } = createInstallerContext({ pointerIR: "i64" });
    attachSizeHelpers(context);
    expect(target.sizeofIR("*")).toBe(context.ptrSizeof);
    expect(target.sizeofIR("Foo*")).toBe(context.ptrSizeof);
    expect(target.sizeofIR("Bar**")).toBe(context.ptrSizeof);
  });

  it("exposes typed heap accessor helpers", async () => {
    const { attachHeapAccessors } = await loadHeapHelpers();
    const { context, target } = createInstallerContext();
    attachHeapAccessors(context);
    const heap = context.getHeapViews();
    expect(target.heap8()).toBe(heap.HEAP8);
    expect(target.heap8u()).toBe(heap.HEAP8U);
    expect(target.heap16()).toBe(heap.HEAP16);
    expect(target.heap16u()).toBe(heap.HEAP16U);
    expect(target.heap32()).toBe(heap.HEAP32);
    expect(target.heap32u()).toBe(heap.HEAP32U);
  });

  it("selects heap views by typed-array constructor", async () => {
    const { attachHeapAccessors } = await loadHeapHelpers();
    const { context, target } = createInstallerContext();
    attachHeapAccessors(context);
    const heap = context.getHeapViews();
    expect(target.heapForSize(Int8Array)).toBe(heap.HEAP8);
    expect(target.heapForSize(Uint8Array)).toBe(heap.HEAP8U);
    expect(target.heapForSize(Int16Array)).toBe(heap.HEAP16);
    expect(target.heapForSize(Uint16Array)).toBe(heap.HEAP16U);
    expect(target.heapForSize(Int32Array)).toBe(heap.HEAP32);
    expect(target.heapForSize(Uint32Array)).toBe(heap.HEAP32U);
  });

  it("selects heap views by byte width and unsigned flag", async () => {
    const { attachHeapAccessors } = await loadHeapHelpers();
    const { context, target } = createInstallerContext();
    attachHeapAccessors(context);
    const heap = context.getHeapViews();
    expect(target.heapForSize(8)).toBe(heap.HEAP8U);
    expect(target.heapForSize(8, false)).toBe(heap.HEAP8);
    expect(target.heapForSize(16)).toBe(heap.HEAP16U);
    expect(target.heapForSize(16, false)).toBe(heap.HEAP16);
    expect(target.heapForSize(32)).toBe(heap.HEAP32U);
    expect(target.heapForSize(32, false)).toBe(heap.HEAP32);
  });

  it("supports 64-bit views and BigInt constructors when enabled", async () => {
    const { attachHeapAccessors } = await loadHeapHelpers();
    const { context, target } = createInstallerContext({
      bigIntEnabled: true,
      pointerIR: "i64",
    });
    attachHeapAccessors(context);
    const heap = context.getHeapViews();
    expect(target.heapForSize(64)).toBe(heap.HEAP64U);
    expect(target.heapForSize(64, false)).toBe(heap.HEAP64);
    expect(target.heapForSize(BigUint64Array)).toBe(heap.HEAP64U);
    expect(target.heapForSize(BigInt64Array)).toBe(heap.HEAP64);
  });

  it("throws via toss when an invalid selector is provided", async () => {
    const { attachHeapAccessors } = await loadHeapHelpers();
    const { context, target } = createInstallerContext();
    attachHeapAccessors(context);
    const tossSpy = vi.spyOn(context, "toss");
    expect(() => target.heapForSize(24)).toThrow(
      "Invalid heapForSize() size: expecting 8, 16, 32, or 64 (BigInt).",
    );
    expect(tossSpy).toHaveBeenCalledWith(
      "Invalid heapForSize() size: expecting 8, 16, 32, or 64 (BigInt).",
    );
  });
});
