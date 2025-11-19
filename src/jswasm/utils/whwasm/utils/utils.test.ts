import { describe, expect, it } from "vitest";

import { assertAllocator } from "./utils";
import type {
  WhWasmHelperTarget,
  WhWasmInstallerContext,
} from "../installer-context/installer-context";

const createContext = (target: Partial<WhWasmHelperTarget>) =>
  ({
    target,
    toss: (...args: unknown[]) => {
      throw new Error(args.join(" "));
    },
  }) as unknown as WhWasmInstallerContext;

describe("assertAllocator (baseline)", () => {
  it("passes through when both alloc and dealloc are functions", () => {
    const context = createContext({
      alloc: () => 1,
      dealloc: () => undefined,
    });
    expect(() => assertAllocator(context, "testFn")).not.toThrow();
  });

  it("throws when alloc is missing", () => {
    const context = createContext({
      dealloc: () => undefined,
    });
    expect(() => assertAllocator(context, "missingAlloc")).toThrow(
      /missing alloc\(\)/,
    );
  });

  it("throws when dealloc is missing or not a function", () => {
    const context = createContext({
      alloc: () => 1,
      dealloc: 42,
    });
    expect(() => assertAllocator(context, "badTarget")).toThrow(
      /missing alloc\(\)/,
    );
  });
});
