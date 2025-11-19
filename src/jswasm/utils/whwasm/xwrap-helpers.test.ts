import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  WhWasmHelperTarget,
  WhWasmValue,
} from "./installer-context/installer-context";
import { WhWasmInstallerContext } from "./installer-context/installer-context";
import { attachXWrapAdapters } from "./xwrap-helpers";

type ExtendedXWrapCache = WhWasmInstallerContext["cache"]["xWrap"] & {
  convertArg: (type: unknown, ...args: unknown[]) => unknown;
  convertArgNoCheck: (type: unknown, ...args: unknown[]) => unknown;
  convertResult: (type: unknown, value: unknown) => unknown;
  convertResultNoCheck: (type: unknown, value: unknown) => unknown;
};

type InstalledXWrap = {
  (
    fArg: string | ((...args: unknown[]) => unknown),
    resultType?: string | null,
    ...argTypes: unknown[]
  ): (...args: unknown[]) => unknown;
  argAdapter: (typeName: string, adapter?: (value: unknown) => unknown) => unknown;
  resultAdapter: (
    typeName: string,
    adapter?: (value: unknown) => unknown,
  ) => unknown;
  FuncPtrAdapter: new (options: Record<string, unknown>) => {
    convertArg: (value: unknown, argv: unknown[], argIndex: number) => unknown;
  };
  testConvertArg: (type: unknown, ...args: unknown[]) => unknown;
  testConvertResult: (type: unknown, value: unknown) => unknown;
};

function createXWrapHarness(options?: {
  pointerIR?: "i32" | "i64";
  bigIntEnabled?: boolean;
}) {
  // 1. Input handling - resolve pointer and bigint preferences.
  const pointerIR = options?.pointerIR ?? "i32";
  const bigIntEnabled = options?.bigIntEnabled ?? false;
  const memory = new WebAssembly.Memory({ initial: 1 });
  const xGetRegistry = new Map<string, (...args: unknown[]) => unknown>();
  let nextStringPtr = 1024;
  const allocatedStringPtrs: number[] = [];
  const scopedAllocCString = vi
    .fn<(value: string) => number>((value) => {
      const ptr = nextStringPtr++ + value.length;
      allocatedStringPtrs.push(ptr);
      return ptr;
    })
    .mockName("scopedAllocCString");
  const cstrToJs = vi
    .fn<(ptr: number | bigint | null) => string | null>((ptr) =>
      ptr === null || ptr === 0 ? null : `js:${ptr}`,
    )
    .mockName("cstrToJs");
  const dealloc = vi
    .fn<(ptr: number | bigint | null) => void>(() => undefined)
    .mockName("dealloc");
  const scopedAllocPushMock = vi.fn<() => number[]>().mockName("scopedAllocPush");
  const scopedAllocPopMock = vi
    .fn<(scope: number[]) => void>()
    .mockName("scopedAllocPop");
  const functionEntry = vi
    .fn<
      (
        ptr: number | bigint,
      ) => ((...args: unknown[]) => unknown) | undefined
    >(() => undefined)
    .mockName("functionEntry");
  const xGet = vi
    .fn<(name: string) => (...args: unknown[]) => unknown>((name) => {
      const fn = xGetRegistry.get(name);
      if (!fn) {
        throw new Error(`Missing wrapped function ${name}`);
      }
      return fn;
    })
    .mockName("xGet");
  const target = {
    pointerIR,
    bigIntEnabled,
    memory,
    isPtr: (value: unknown) =>
      typeof value === "number" || typeof value === "bigint",
    scopedAllocCString,
    cstrToJs,
    dealloc,
    functionEntry,
    xGet,
    scopedAllocPush: scopedAllocPushMock,
    scopedAllocPop: scopedAllocPopMock,
  } as WhWasmHelperTarget & Record<string, WhWasmValue>;
  const context = new WhWasmInstallerContext(target);
  const scopeStack = context.cache.scopedAlloc;
  const pushedScopes: number[][] = [];
  const poppedScopes: number[][] = [];
  scopedAllocPushMock.mockImplementation(() => {
    const scope: number[] = [];
    scopeStack.push(scope);
    pushedScopes.push(scope);
    return scope;
  });
  scopedAllocPopMock.mockImplementation((scope) => {
    const popped = scopeStack.pop();
    if (popped !== scope) {
      throw new Error("Scoped allocation mismatch");
    }
    poppedScopes.push(scope);
    popped.forEach((ptr) => {
      dealloc(ptr);
    });
  });

  let nextFuncPtr = 1;
  const installSpy = vi.fn<
    NonNullable<WhWasmInstallerContext["installFunctionInternal"]>
  >((fn) => {
    const ptr = nextFuncPtr++;
    xGetRegistry.set(`fp:${ptr}`, fn as (...args: unknown[]) => unknown);
    return ptr;
  });
  context.installFunctionInternal = installSpy;

  attachXWrapAdapters(context);
  const typedTarget = target as WhWasmHelperTarget & {
    xWrap?: InstalledXWrap;
  };
  const xWrap = typedTarget.xWrap;
  if (typeof xWrap !== "function") {
    throw new Error("xWrap not installed");
  }
  // 3. Output handling - expose harness internals for assertions.
  return {
    context,
    target: typedTarget as WhWasmHelperTarget & { xWrap: InstalledXWrap },
    xWrap,
    xGetRegistry,
    installSpy,
    allocatedStringPtrs,
    pushedScopes,
    poppedScopes,
    scopedAllocCString,
    cstrToJs,
    scopedAllocPush: scopedAllocPushMock,
    scopedAllocPop: scopedAllocPopMock,
    cache: context.cache.xWrap as ExtendedXWrapCache,
  };
}

describe("xwrap-helpers.mjs (baseline)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("registers numeric, pointer, and string/json converters", () => {
    const { cache, scopedAllocCString, allocatedStringPtrs, cstrToJs } =
      createXWrapHarness();
    expect(cache.convertArg("i16", -1)).toBe(0xffff);
    expect(cache.convertArg("*", 0x1fffffff)).toBe(0x1fffffff);
    const ptr = cache.convertArg("string", "sqlite");
    expect(scopedAllocCString).toHaveBeenCalledWith("sqlite");
    expect(ptr).toBe(allocatedStringPtrs[0]);

    cstrToJs.mockReturnValueOnce("decoded");
    expect(cache.convertResult("string", 99)).toBe("decoded");
    cstrToJs.mockReturnValueOnce('{"ok":true}');
    expect(cache.convertResult("json", 123)).toEqual({ ok: true });
    expect(cache.convertResult(null, { raw: true })).toEqual({
      raw: true,
    });
  });

  it("wraps wasm exports with argument/result adapters and scoping", () => {
    const { xWrap, xGetRegistry, pushedScopes, poppedScopes, scopedAllocPush } =
      createXWrapHarness();
    const wasmAdd = vi.fn((a: number, b: number) => a + b);
    xGetRegistry.set(
      "wasmAdd",
      wasmAdd as unknown as (...args: unknown[]) => unknown,
    );
    const wrapped = xWrap("wasmAdd", "int", "i32", "i32");
    expect(wrapped(1.9, 2.1)).toBe(3);
    expect(wasmAdd).toHaveBeenCalledWith(1, 2);
    expect(scopedAllocPush).toHaveBeenCalledTimes(1);
    expect(poppedScopes[0]).toBe(pushedScopes[0]);
    expect(() => wrapped(1)).toThrow(/requires 2 argument/);
  });

  it("installs and reuses function pointers via FuncPtrAdapter", () => {
    const { xWrap, installSpy } = createXWrapHarness();
    const FuncPtrAdapter = xWrap.FuncPtrAdapter;
    const adapter = new FuncPtrAdapter({
      name: "cb",
      signature: "vii",
      bindScope: "singleton",
    });
    const callback = vi.fn();
    const argv: unknown[] = [callback];
    const firstPtr = adapter.convertArg(callback, argv, 0);
    expect(firstPtr).toBe(1);
    expect(installSpy).toHaveBeenCalledTimes(1);
    const secondPtr = adapter.convertArg(callback, argv, 0);
    expect(secondPtr).toBe(firstPtr);
    expect(installSpy).toHaveBeenCalledTimes(1);
    const existingPtr = adapter.convertArg(99, argv, 0);
    expect(existingPtr).toBe(99);
  });
});
