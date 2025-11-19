import { describe, expect, it, vi } from "vitest";

import { attachScopedAllocators } from "./scoped-alloc-helpers";
import {
  type WhWasmHelperTarget,
  WhWasmInstallerContext,
} from "../installer-context/installer-context";

const FUNCTION_PTR = 0xdeadbeef;

type TestTarget = WhWasmHelperTarget & {
  alloc: (size: number) => number;
  dealloc: (ptr: number) => void;
  functionEntry: (ptr: number) => (() => void) | null;
  uninstallFunction: (ptr: number) => void;
  allocCString: (value: string) => number;
  pokePtr: (addr: number, value: number | bigint) => void;
  peekPtr: (addr: number) => number;
  poke: (addr: number, value: number | bigint, type?: string) => void;
  cstrToJs: (ptr: number) => string | null;
  ptrSizeof: number;
  pointerIR: "i32" | "i64";
  exports: Record<string, unknown>;
};

interface MockContext {
  context: WhWasmInstallerContext;
  target: TestTarget & {
    scopedAllocPush: () => number[];
    scopedAllocPop: (state?: number[]) => void;
    scopedAlloc: ((size: number) => number) & { level: number };
    scopedAllocCString: (
      value: string,
      returnWithLength?: boolean,
    ) => number | [number, number] | null;
    scopedAllocMainArgv: (values: unknown[]) => number;
    allocMainArgv: (values: unknown[]) => number;
    cArgvToJs: (argc: number, argvPtr: number) => (string | null)[];
    scopedAllocCall: <T>(fn: () => T) => T;
    allocPtr: (howMany?: number, safePtrSize?: boolean) => number | number[];
  };
  pointerMemory: Map<number, number>;
  strings: Map<number, string>;
}

function createMockContext(): MockContext {
  let nextPtr = 1024;
  const pointerMemory = new Map<number, number>();
  const strings = new Map<number, string>();
  const target = {
    pointerIR: "i32" as const,
    ptrSizeof: 4,
    exports: {} as Record<string, unknown>,
    alloc: vi.fn<(size: number) => number>((size: number) => {
      const base = nextPtr;
      nextPtr += size;
      return base;
    }),
    dealloc: vi.fn<(ptr: number) => void>(),
    functionEntry: vi.fn<(ptr: number) => (() => void) | null>((ptr: number) =>
      ptr === FUNCTION_PTR ? () => undefined : null,
    ),
    uninstallFunction: vi.fn<(ptr: number) => void>(),
    allocCString: vi.fn<(value: string) => number>((value: string) => {
      const base = nextPtr;
      nextPtr += value.length + 1;
      strings.set(base, value);
      return base;
    }),
    pokePtr: vi.fn<(addr: number, value: number | bigint) => void>(
      (addr, value) => {
        pointerMemory.set(addr, Number(value ?? 0));
      },
    ),
    peekPtr: vi.fn<(addr: number) => number>(
      (addr: number) => pointerMemory.get(addr) ?? 0,
    ),
    poke: vi.fn<(addr: number, value: number | bigint) => void>(
      (addr: number, value: number | bigint) => {
        pointerMemory.set(addr, Number(value ?? 0));
      },
    ),
    cstrToJs: vi.fn<(ptr: number) => string | null>(
      (ptr: number) => strings.get(ptr) ?? null,
    ),
  } as TestTarget;

  const context = new WhWasmInstallerContext(target);
  context.allocCStringInternal = ((
    value: string,
    returnWithLength: boolean,
    stackAlloc: (size: number) => number,
  ) => {
    const ptr = stackAlloc(value.length + 1);
    strings.set(ptr, value);
    return returnWithLength ? [ptr, value.length] : ptr;
  }) as WhWasmInstallerContext["allocCStringInternal"];

  attachScopedAllocators(context);

  return {
    context,
    target: target as MockContext["target"],
    pointerMemory,
    strings,
  };
}

describe("attachScopedAllocators (baseline)", () => {
  it("manages scoped frames and releases pointers", () => {
    const { context, target } = createMockContext();

    const outerScope = target.scopedAllocPush();
    const ptrA = target.scopedAlloc(8);
    const ptrB = target.scopedAlloc(4);
    expect(target.scopedAlloc.level).toBe(1);

    const innerScope = target.scopedAllocPush();
    context.cache.scopedAlloc[context.cache.scopedAlloc.length - 1].push(
      FUNCTION_PTR,
    );
    expect(target.scopedAlloc.level).toBe(2);

    target.scopedAllocPop(innerScope);
    expect(target.uninstallFunction).toHaveBeenCalledWith(FUNCTION_PTR);

    target.scopedAllocPop(outerScope);
    expect(target.dealloc).toHaveBeenCalledWith(ptrB);
    expect(target.dealloc).toHaveBeenCalledWith(ptrA);
    expect(target.scopedAlloc.level).toBe(0);
  });

  it("enforces scoped allocator guards and CString wiring", () => {
    const { target } = createMockContext();

    expect(() => target.scopedAlloc(4)).toThrowError(
      /No scopedAllocPush\(\) scope is active/,
    );

    const scope = target.scopedAllocPush();
    const scoped = target.scopedAllocCString("hello", true);
    expect(scoped).toBeInstanceOf(Array);
    const [ptr, length] = scoped as [number, number];
    expect(length).toBe(5);
    expect(typeof ptr).toBe("number");
    target.scopedAllocPop(scope);
  });

  it("builds argv arrays and converts back to JS strings", () => {
    const { target, pointerMemory, strings } = createMockContext();

    const scopedScope = target.scopedAllocPush();
    const scopedPtr = target.scopedAllocMainArgv(["foo", 42]);
    const firstEntry = pointerMemory.get(scopedPtr)!;
    const secondEntry = pointerMemory.get(scopedPtr + target.ptrSizeof)!;
    const sentinel = pointerMemory.get(scopedPtr + target.ptrSizeof * 2)!;
    expect(strings.get(firstEntry)).toBe("foo");
    expect(strings.get(secondEntry)).toBe("42");
    expect(sentinel).toBe(0);
    target.scopedAllocPop(scopedScope);

    const generalPtr = target.allocMainArgv(["alpha"]);
    expect(generalPtr).not.toBe(scopedPtr);

    const args = target.cArgvToJs(2, scopedPtr);
    expect(args).toEqual(["foo", "42"]);
  });

  it("wraps callbacks with scopedAllocCall", () => {
    const { target } = createMockContext();

    const result = target.scopedAllocCall(() => {
      const ptr = target.scopedAlloc(4);
      expect(typeof ptr).toBe("number");
      return "ok";
    });
    expect(result).toBe("ok");
    expect(target.scopedAlloc.level).toBe(0);

    expect(() =>
      target.scopedAllocCall(() => {
        target.scopedAlloc(8);
        throw new Error("boom");
      }),
    ).toThrowError("boom");
    expect(target.scopedAlloc.level).toBe(0);
  });

  it("allocates pointer slots with zero initialization", () => {
    const { target, pointerMemory } = createMockContext();

    const single = target.allocPtr() as number;
    expect(pointerMemory.get(single)).toBe(0);

    const pair = target.allocPtr(2, false) as number[];
    expect(pair).toHaveLength(2);
    expect(pair[1]).toBe(pair[0] + target.ptrSizeof);
    expect(pointerMemory.get(pair[0])).toBe(0);
    expect(pointerMemory.get(pair[1])).toBe(0);
  });
});
