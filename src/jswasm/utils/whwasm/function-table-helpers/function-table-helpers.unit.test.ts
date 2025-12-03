import { beforeEach, describe, expect, it, vi } from "vitest";

import { WhWasmInstallerContext } from "../installer-context/installer-context";
import { attachFunctionTableUtilities } from "./function-table-helpers";

interface FakeTableOptions {
  rejectJsFunctions?: boolean;
}

type WrappedFunction = ((...args: unknown[]) => unknown) & {
  __wasmWrapped?: boolean;
};

class FakeTable {
  private entries: (WrappedFunction | null | undefined)[] = [];
  private readonly rejectJsFunctions: boolean;

  constructor(options: FakeTableOptions = {}) {
    this.rejectJsFunctions = options.rejectJsFunctions ?? false;
  }

  get length(): number {
    return this.entries.length;
  }

  grow(delta: number): number {
    const oldLength = this.entries.length;
    for (let index = 0; index < delta; index += 1) {
      this.entries.push(null);
    }
    return oldLength;
  }

  get(index: number): WrappedFunction | null | undefined {
    return this.entries[index];
  }

  set(index: number, value: WrappedFunction | null): void {
    if (index >= this.entries.length) {
      throw new RangeError("Index out of bounds");
    }
    if (
      this.rejectJsFunctions &&
      typeof value === "function" &&
      !value.__wasmWrapped
    ) {
      throw new TypeError("WebAssembly.Function expected");
    }
    this.entries[index] = value;
  }
}

type TargetWithHelpers = WhWasmInstallerContext["target"] & {
  functionTable: () => FakeTable;
  functionEntry: (pointer: number) => WrappedFunction | null | undefined;
  installFunction: {
    (func: WrappedFunction, sig?: string): number;
    (sig: string, func: WrappedFunction): number;
  };
  scopedInstallFunction: {
    (func: WrappedFunction, sig?: string): number;
    (sig: string, func: WrappedFunction): number;
  };
  uninstallFunction: (
    ptr: number | bigint | null | undefined,
  ) => WrappedFunction | null | undefined;
  jsFuncToWasm: (func: WrappedFunction, sig: string) => WrappedFunction;
};

function createInstallerHarness(options: FakeTableOptions = {}) {
  const table = new FakeTable(options);
  const baseTarget: WhWasmInstallerContext["target"] = {
    exports: {
      __indirect_function_table: table,
    },
  };
  const context = new WhWasmInstallerContext(baseTarget);
  attachFunctionTableUtilities(context);
  return {
    cache: context.cache,
    context,
    table,
    target: context.target as TargetWithHelpers,
  };
}

describe("function-table-helpers (mjs)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes function table access helpers", () => {
    const { target, table } = createInstallerHarness();
    table.grow(1);
    const sentinel = () => 1;
    table.set(0, sentinel);
    expect(target.functionTable()).toBe(table);
    expect(target.functionEntry(0)).toBe(sentinel);
    expect(target.functionEntry(5)).toBeUndefined();
  });

  it("installs, uninstalls, and reuses freed slots", () => {
    const { cache, target, table } = createInstallerHarness();
    const fn = () => 42;
    const ptr = target.installFunction(fn, "i()");
    expect(ptr).toBe(0);
    expect(table.get(ptr)).toBe(fn);

    const previous = target.uninstallFunction(ptr);
    expect(previous).toBe(fn);
    expect(cache.freeFuncIndexes).toContain(ptr);
    expect(table.get(ptr)).toBeNull();

    const reusedPtr = target.installFunction(() => 7, "i()");
    expect(reusedPtr).toBe(ptr);
  });

  it("tracks scoped installs and enforces scope presence", () => {
    const { cache, target } = createInstallerHarness();
    expect(() => target.scopedInstallFunction(() => 1, "v()")).toThrow(
      /No scopedAllocPush/,
    );

    cache.scopedAlloc.push([]);
    const ptr = target.scopedInstallFunction(() => 2, "v()");
    expect(cache.scopedAlloc[cache.scopedAlloc.length - 1]).toContain(ptr);
  });

  it("supports swapped signature/function arguments and validates input", () => {
    const { target } = createInstallerHarness();
    const ptr = target.installFunction("v()", () => 9);
    expect(ptr).toBe(0);
    expect(() => target.installFunction(123 as never, "v()")).toThrow(
      /Invalid arguments/,
    );
  });

  it("wraps JS functions via jsFuncToWasm when table rejects raw functions", () => {
    const { target, table } = createInstallerHarness({
      rejectJsFunctions: true,
    });
    const wrapped = vi.fn(() => {
      const wasmFn: WrappedFunction = () => "wrapped";
      wasmFn.__wasmWrapped = true;
      return wasmFn;
    });
    target.jsFuncToWasm = wrapped as TargetWithHelpers["jsFuncToWasm"];
    const fn = () => "direct";
    const ptr = target.installFunction(fn, "i()");
    expect(wrapped).toHaveBeenCalledWith(fn, "i()");
    expect(table.get(ptr)?.()).toBe("wrapped");
  });

  it("ignores uninstall requests for nullish pointers", () => {
    const { target, table } = createInstallerHarness();
    table.grow(1);
    expect(target.uninstallFunction(undefined)).toBeUndefined();
    expect(target.uninstallFunction(null)).toBeUndefined();
  });
});
