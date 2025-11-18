import type { WhWasmHelperTarget } from "../whwasm/installer-context/installer-context";
import { describe, expect, it } from "vitest";
import { createWhWasmUtilInstaller } from "./create-wh-wasm-util-installer";

type FakeTargetBase = WhWasmHelperTarget & {
  alloc: (size: number) => number;
  dealloc: (ptr: number) => void;
  isPtr: (value: unknown) => boolean;
};

type InstalledTarget = FakeTargetBase & {
  sizeofIR: (identifier: string) => number | undefined;
  heap32: () => Int32Array;
  heapForSize: (sizeIndicator: number) => ArrayBufferView;
  heap8u: () => Uint8Array;
  cstrlen: (ptr: number) => number | null;
  cstrToJs: (ptr: number) => string | null;
};

const createFakeTarget = (): FakeTargetBase => {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const table = new WebAssembly.Table({ element: "anyfunc", initial: 1 });
  const exports = {
    memory,
    __indirect_function_table: table,
  };
  let nextPtr = 1024;

  const target = {} as FakeTargetBase;
  target.pointerIR = "i32" as const;
  target.bigIntEnabled = false;
  target.memory = memory;
  target.exports = exports;
  target.alloc = (size: number) => {
    const ptr = nextPtr;
    nextPtr += Math.max(size, 1);
    return ptr;
  };
  target.dealloc = () => {};
  target.isPtr = (value: unknown) => typeof value === "number" && value >= 0;
  return target;
};

const writeCString = (target: InstalledTarget, text: string) => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(`${text}\0`);
  const ptr = target.alloc(bytes.length);
  target.heap8u().set(bytes, ptr);
  return ptr;
};

describe("createWhWasmUtilInstaller", () => {
  it("returns an installer with a yawl factory and helper accessors", () => {
    const fakeTarget = createFakeTarget();
    const installer = createWhWasmUtilInstaller();
    const installedTarget = installer(fakeTarget) as InstalledTarget;

    expect(installedTarget).toBe(fakeTarget);
    expect(typeof installer.yawl).toBe("function");
    expect(installedTarget.sizeofIR("i32")).toBe(4);
    expect(installedTarget.heap32().BYTES_PER_ELEMENT).toBe(4);

    const heapView = installedTarget.heapForSize(32);
    expect(heapView.constructor).toBe(Uint32Array);
    const bufferedView = heapView as Uint32Array;
    expect(bufferedView.BYTES_PER_ELEMENT).toBe(4);
    expect(bufferedView.buffer).toBe(installedTarget.heap32().buffer);
  });

  it("allows string helpers to read C strings from the heap", () => {
    const fakeTarget = createFakeTarget();
    const installer = createWhWasmUtilInstaller();
    const installedTarget = installer(fakeTarget) as InstalledTarget;
    const pointer = writeCString(installedTarget, "hi");

    expect(installedTarget.cstrlen(pointer)).toBe(2);
    expect(installedTarget.cstrToJs(pointer)).toBe("hi");
  });
});
