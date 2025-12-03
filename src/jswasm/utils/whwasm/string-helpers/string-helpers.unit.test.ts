import { beforeEach, describe, expect, it, vi } from "vitest";

import { WhWasmInstallerContext } from "../installer-context/installer-context";
import { attachStringUtilities } from "./string-helpers";

type StringHelperTarget = WhWasmInstallerContext["target"] & {
  cstrlen: (ptr: number | bigint | null) => number | null;
  cstrToJs: (ptr: number | bigint | null) => string | null;
  jstrlen: (value: unknown) => number | null;
  jstrcpy: (
    value: string,
    target: Uint8Array | Int8Array,
    offset?: number,
    maxBytes?: number,
    addNul?: boolean,
  ) => number;
  cstrncpy: (tgtPtr: number, srcPtr: number, n: number) => number;
  jstrToUintArray: (value: string, addNul?: boolean) => Uint8Array;
  allocCString: (
    value: string,
    returnWithLength?: boolean,
  ) => number | [number, number] | null;
  heap8u: () => Uint8Array;
  alloc: (size: number) => number;
  dealloc: (ptr: number) => void;
  isPtr: (value: unknown) => boolean;
};

function createInstallerHarness() {
  const memory = new WebAssembly.Memory({ initial: 1 });
  let nextAlloc = 8;
  const target: WhWasmInstallerContext["target"] = {
    memory,
    isPtr: (value: unknown) =>
      typeof value === "number" &&
      value >= 0 &&
      value < memory.buffer.byteLength,
    heap8u: () => {
      throw new Error("heap8u called before context initialization");
    },
    alloc: (size: number) => {
      const ptr = nextAlloc;
      nextAlloc += size;
      return ptr;
    },
    dealloc: () => undefined,
  };

  const context = new WhWasmInstallerContext(target);
  const heap8u = () => context.getHeapViews().HEAP8U as Uint8Array;
  (target as StringHelperTarget).heap8u = heap8u;
  attachStringUtilities(context);

  const writeCString = (value: string) => {
    const bytes = context.cache.utf8Encoder.encode(value);
    const ptr = (target as StringHelperTarget).alloc(bytes.length + 1);
    const heap = heap8u();
    heap.set(bytes, ptr);
    heap[ptr + bytes.length] = 0;
    return ptr;
  };

  return {
    context,
    heap8u,
    target: target as StringHelperTarget,
    writeCString,
  };
}

describe("string-helpers (mjs)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("computes c-string length and decodes to JS strings", () => {
    const { target, writeCString } = createInstallerHarness();
    const ptr = writeCString("hello");
    expect(target.cstrlen(ptr)).toBe(5);
    expect(target.cstrToJs(ptr)).toBe("hello");
    expect(target.cstrlen(0)).toBeNull();
    expect(target.cstrToJs(null)).toBeNull();
  });

  it("calculates UTF-8 byte lengths via jstrlen", () => {
    const { target } = createInstallerHarness();
    expect(target.jstrlen("abc")).toBe(3);
    expect(target.jstrlen("π")).toBe(2);
    expect(target.jstrlen("A😂")).toBe(5);
    expect(target.jstrlen(42)).toBeNull();
  });

  it("copies JS strings into buffers with jstrcpy", () => {
    const { target } = createInstallerHarness();
    const buffer = new Uint8Array(8);
    const length = target.jstrcpy("Hi", buffer);
    expect(length).toBe(3);
    expect(Array.from(buffer.slice(0, 3))).toEqual([0x48, 0x69, 0x00]);

    const offsetBuffer = new Uint8Array(6);
    const offsetLength = target.jstrcpy("é", offsetBuffer, 1, 4, false);
    expect(offsetLength).toBe(2);
    expect(Array.from(offsetBuffer.slice(1, 3))).toEqual([0xc3, 0xa9]);

    expect(() => target.jstrcpy("x", [] as unknown as Uint8Array)).toThrow(
      /jstrcpy\(\) target must be/,
    );
  });

  it("copies between pointers via cstrncpy", () => {
    const { target, heap8u, writeCString } = createInstallerHarness();
    const src = writeCString("source");
    const dst = target.alloc(16);
    const copied = target.cstrncpy(dst, src, 4);
    expect(copied).toBe(4);
    expect(String.fromCharCode(...heap8u().slice(dst, dst + 4))).toBe("sour");

    const inferred = target.cstrncpy(dst, src, -1);
    expect(inferred).toBeGreaterThan(0);
    expect(() => target.cstrncpy(0, src, 1)).toThrow(/does not accept NULL/);
  });

  it("encodes strings to Uint8Array", () => {
    const { target } = createInstallerHarness();
    expect(Array.from(target.jstrToUintArray("ok"))).toEqual([0x6f, 0x6b]);
    expect(Array.from(target.jstrToUintArray("ok", true))).toEqual([
      0x6f, 0x6b, 0x00,
    ]);
  });

  it("allocates C strings on the wasm heap", () => {
    const { context, heap8u, target } = createInstallerHarness();
    const allocSpy = vi.spyOn(target, "alloc");
    const ptr = target.allocCString("abc");
    expect(typeof ptr).toBe("number");
    expect(allocSpy).toHaveBeenCalled();
    const heap = heap8u();
    expect(Array.from(heap.slice(ptr as number, (ptr as number) + 4))).toEqual([
      0x61, 0x62, 0x63, 0x00,
    ]);

    const withLength = target.allocCString("z", true);
    expect(withLength).toEqual([expect.any(Number), 1]);
    expect(typeof context.allocCStringInternal).toBe("function");
  });
});
