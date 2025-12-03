import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  WhWasmHelperTarget,
  WhWasmValue,
} from "../installer-context/installer-context";
import { WhWasmInstallerContext } from "../installer-context/installer-context";

import { createXWrapInternals } from "./xwrap-internals";

type HarnessOptions = {
  pointerIR?: "i32" | "i64";
  bigIntEnabled?: boolean;
};

function createInternalsHarness(options?: HarnessOptions) {
  const pointerIR = options?.pointerIR ?? "i32";
  const bigIntEnabled = options?.bigIntEnabled ?? false;
  const memory = new WebAssembly.Memory({ initial: 1 });
  let nextStringPtr = 256;
  const scopedAllocCString = vi
    .fn<(value: string) => number | bigint>((_value) => {
      if (pointerIR === "i64") {
        const ptr = BigInt(nextStringPtr++);
        return ptr;
      }
      return nextStringPtr++;
    })
    .mockName("scopedAllocCString");
  const cstrToJs = vi
    .fn<
      (ptr: number | bigint | null) => string | null
    >((ptr) => (ptr === null || ptr === 0 ? null : `js:${ptr.toString()}`))
    .mockName("cstrToJs");
  const dealloc = vi
    .fn<(ptr: number | bigint | null) => void>(() => undefined)
    .mockName("dealloc");
  const functionEntry = vi
    .fn<
      (ptr: number | bigint) => ((...args: unknown[]) => unknown) | undefined
    >(() => undefined)
    .mockName("functionEntry");
  const xGetRegistry = new Map<string, (...args: unknown[]) => unknown>();
  const xGet = vi
    .fn<(name: string) => (...args: unknown[]) => unknown>((name) => {
      const fn = xGetRegistry.get(name);
      if (!fn) {
        throw new Error(`Missing wasm function ${name}`);
      }
      return fn;
    })
    .mockName("xGet");
  const scopedAllocPush = vi
    .fn<() => Array<number | bigint>>()
    .mockName("scopedAllocPush");
  const scopedAllocPop = vi
    .fn<(scope: Array<number | bigint>) => void>()
    .mockName("scopedAllocPop");

  const target = {
    pointerIR,
    bigIntEnabled,
    memory,
    isPtr: (value: unknown) =>
      typeof value === "number" || typeof value === "bigint",
    scopedAllocCString,
    cstrToJs,
    dealloc,
    scopedAllocPush,
    scopedAllocPop,
    functionEntry,
    xGet,
  } as WhWasmHelperTarget & Record<string, WhWasmValue>;

  const context = new WhWasmInstallerContext(target);
  const scopeStack = context.cache.scopedAlloc as unknown as Array<
    Array<number | bigint>
  >;
  scopedAllocPush.mockImplementation(() => {
    const scope: Array<number | bigint> = [];
    scopeStack.push(scope as unknown as number[]);
    return scope;
  });
  scopedAllocPop.mockImplementation((scope) => {
    const popped = scopeStack.pop();
    if (popped !== (scope as unknown as number[])) {
      throw new Error("Scoped allocation mismatch");
    }
    scope.forEach((ptr) => {
      if (ptr !== null && ptr !== undefined) {
        dealloc(ptr);
      }
    });
  });

  let nextFunctionPtr = 1;
  const installSpy = vi
    .fn<
      NonNullable<WhWasmInstallerContext["installFunctionInternal"]>
    >(() => nextFunctionPtr++)
    .mockName("installFunctionInternal");
  context.installFunctionInternal = installSpy;

  const internals = createXWrapInternals(context);
  return {
    context,
    target,
    installSpy,
    scopedAllocCString,
    cstrToJs,
    dealloc,
    xGetRegistry,
    ...internals,
  };
}

describe("xwrap-internals.mjs (baseline)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("registers numeric and pointer converters for each pointer IR", () => {
    const harness32 = createInternalsHarness();
    const { ptrAdapter, argConverters, resultConverters } = harness32;
    expect(ptrAdapter(0x1fffffff)).toBe(0x1fffffff | 0);
    expect(argConverters.get("i16")?.(-1)).toBe(0xffff);
    expect(argConverters.get("f64")?.("3.5")).toBe(3.5);
    expect(resultConverters.get("i16")).toBe(argConverters.get("i16"));

    const harness64 = createInternalsHarness({
      pointerIR: "i64",
      bigIntEnabled: true,
    });
    expect(harness64.ptrAdapter(5)).toBe(5n);
    expect(harness64.argConverters.get("i64")?.(4)).toBe(4n);
    expect(harness64.argConverters.get("i64*")?.(99)).toBe(99n);
    expect(harness64.resultConverters.get("i64")).toBe(
      harness64.argConverters.get("i64"),
    );
  });

  it("converts strings and JSON with scoped allocation/deallocation", () => {
    const harness = createInternalsHarness();
    const {
      argConverters,
      resultConverters,
      scopedAllocCString,
      cstrToJs,
      dealloc,
    } = harness;

    const stringPtr = argConverters.get("string")?.("sqlite");
    expect(scopedAllocCString).toHaveBeenCalledWith("sqlite");
    expect(typeof stringPtr === "number" || typeof stringPtr === "bigint").toBe(
      true,
    );

    cstrToJs.mockReturnValueOnce("decoded");
    expect(resultConverters.get("string")?.(stringPtr ?? 0)).toBe("decoded");

    cstrToJs.mockReturnValueOnce('{"ok":true}');
    expect(resultConverters.get("json")?.(123)).toEqual({ ok: true });

    cstrToJs.mockImplementationOnce(() => {
      throw new Error("decode failure");
    });
    expect(() => resultConverters.get("string:dealloc")?.(456)).toThrowError(
      "decode failure",
    );
    expect(dealloc).toHaveBeenCalledWith(456);

    cstrToJs.mockReturnValueOnce(null);
    expect(resultConverters.get("utf8:dealloc")?.(null)).toBeNull();
    expect(dealloc).toHaveBeenCalledWith(null);
  });

  it("enforces adapter lookup helpers and conversion fallbacks", () => {
    const {
      ensureArgAdapter,
      ensureResultAdapter,
      convertArg,
      convertArgNoCheck,
      convertResult,
      convertResultNoCheck,
    } = createInternalsHarness();

    expect(() => ensureArgAdapter("missing")).toThrow(
      /Argument adapter not found/,
    );
    expect(() => ensureResultAdapter("missing")).toThrow(
      /Result adapter not found/,
    );
    expect(convertArg("int", 2.9)).toBe(2);
    expect(convertArgNoCheck(null, "value")).toBe("value");
    expect(convertResult(null, "payload")).toBe("payload");
    expect(convertResult(undefined, "payload")).toBeUndefined();
    expect(convertResultNoCheck(null, 5)).toBe(5);
  });

  it("installs and reuses function pointers via FuncPtrAdapter", () => {
    const { FuncPtrAdapter, installSpy } = createInternalsHarness();
    const callback = vi.fn();

    const singleton = new FuncPtrAdapter({
      name: "cb",
      signature: "vii",
      bindScope: "singleton",
    });
    const argv: unknown[] = [callback];
    const ptr = singleton.convertArg(callback, argv, 0);
    const secondPtr = singleton.convertArg(callback, argv, 0);
    expect(ptr).toBe(secondPtr);
    expect(installSpy).toHaveBeenCalledTimes(1);
    const passthrough = singleton.convertArg(77, argv, 0);
    expect(passthrough).toBe(77);

    const contextScoped = new FuncPtrAdapter({
      name: "cb",
      signature: "vii",
      bindScope: "context",
    });
    const ctxPtr = contextScoped.convertArg(callback, argv, 0);
    const ctxSecond = contextScoped.convertArg(callback, argv, 0);
    expect(ctxSecond).toBe(ctxPtr);

    expect(() => {
      return new FuncPtrAdapter({
        name: "cb",
        signature: "vii",
        bindScope: "invalid" as "singleton",
      });
    }).toThrow(/Invalid options\.bindScope/);
  });

  it("configures adapters via configureAdapter helper", () => {
    const { configureAdapter, resultConverters } = createInternalsHarness();
    const method = vi.fn();
    const registered = vi.fn();
    resultConverters.set("foo", registered);

    expect(
      configureAdapter(
        method,
        1,
        "foo",
        undefined,
        "resultAdapter()",
        resultConverters,
      ),
    ).toBe(registered);

    const customAdapter = vi.fn();
    expect(
      configureAdapter(
        method,
        2,
        "bar",
        customAdapter,
        "resultAdapter()",
        resultConverters,
      ),
    ).toBe(method);
    expect(resultConverters.get("bar")).toBe(customAdapter);

    configureAdapter(
      method,
      2,
      "bar",
      undefined,
      "resultAdapter()",
      resultConverters,
    );
    expect(resultConverters.has("bar")).toBe(false);

    expect(() =>
      configureAdapter(
        method,
        2,
        "baz",
        {} as unknown as () => unknown,
        "resultAdapter()",
        resultConverters,
      ),
    ).toThrow(/requires a function argument/);
    expect(() =>
      configureAdapter(
        method,
        0,
        null,
        undefined,
        "resultAdapter()",
        resultConverters,
      ),
    ).toThrow(/Invalid arguments/);
  });
});
