/**
 * Scoped allocation helpers for the wh-wasm utility installer.
 */

import { assertAllocator } from "../utils/utils";
import type {
  WhWasmHelperTarget,
  WhWasmInstallerContext,
} from "../installer-context/installer-context";

type JsFunction = (...args: unknown[]) => unknown;
type PointerAllocatorName = "alloc" | "scopedAlloc";

type ScopedAllocatorTarget = WhWasmHelperTarget & {
  alloc: (size: number) => number;
  dealloc: (pointer: number) => void;
  allocCString: (value: string) => number;
  scopedAllocPush?: () => number[];
  scopedAllocPop?: (scope?: number[]) => void;
  scopedAlloc?: ((size: number) => number) & { level?: number };
  scopedAllocCString?: (
    value: string,
    returnWithLength?: boolean,
  ) => number | [number, number] | null;
  scopedAllocMainArgv?: (values: unknown[]) => number;
  allocMainArgv?: (values: unknown[]) => number;
  cArgvToJs?: (argc: number, argvPtr: number) => (string | null)[];
  scopedAllocCall?: <T>(fn: () => T) => T;
  allocPtr?: (howMany?: number, safePtrSize?: boolean) => number | number[];
  scopedAllocPtr?: (
    howMany?: number,
    safePtrSize?: boolean,
  ) => number | number[];
  xGet?: (name: string) => JsFunction;
  xCall?: (fname: string | JsFunction, ...args: unknown[]) => unknown;
  functionEntry: (pointer: number) => JsFunction | null | undefined;
  uninstallFunction: (pointer: number) => JsFunction | null | undefined;
  pokePtr: (address: number, value: number | bigint) => void;
  peekPtr: (address: number) => number;
  poke: (address: number, value: number | bigint, type?: string) => void;
  cstrToJs: (pointer: number) => string | null;
  ptrSizeof: number;
  exports?: Record<string, unknown>;
};

const allocArgvTable = (
  target: ScopedAllocatorTarget,
  context: WhWasmInstallerContext,
  isScoped: boolean,
  list: unknown[],
): number => {
  const allocator = target[isScoped ? "scopedAlloc" : "alloc"]!;
  const allocCString =
    target[isScoped ? "scopedAllocCString" : "allocCString"]!;
  const tableSize = (list.length + 1) * target.ptrSizeof;
  const ptr =
    allocator(tableSize) || context.toss("Allocation failed for argv list.");
  let index = 0;

  const toPointer = (value: number | [number, number] | null): number =>
    Array.isArray(value) ? value[0] : (value ?? 0);

  for (const entry of list) {
    const pointer = toPointer(allocCString(String(entry)));
    target.pokePtr(ptr + target.ptrSizeof * index++, pointer);
  }
  target.pokePtr(ptr + target.ptrSizeof * index, 0);
  return ptr;
};

const allocPointerSlots = (
  context: WhWasmInstallerContext,
  target: ScopedAllocatorTarget,
  howMany: number,
  safePtrSize: boolean,
  allocatorName: PointerAllocatorName,
): number | number[] => {
  assertAllocator(context, allocatorName);
  const pointerIR = safePtrSize ? "i64" : context.ptrIR;
  const stride = safePtrSize ? 8 : context.ptrSizeof;
  let address = target[allocatorName]!(howMany * stride);

  target.poke(address, 0, pointerIR);
  if (howMany === 1) {
    return address;
  }

  const pointers = [address];
  for (let i = 1; i < howMany; ++i) {
    address += stride;
    pointers.push(address);
    target.poke(address, 0, pointerIR);
  }
  return pointers;
};

/**
 * Adds scoped allocation helpers that mirror the legacy installer behaviour.
 *
 * @param context Installer context that exposes allocator metadata and caches.
 */
export function attachScopedAllocators(context: WhWasmInstallerContext): void {
  const target = context.target as ScopedAllocatorTarget;
  const { cache } = context;

  target.scopedAllocPush = () => {
    assertAllocator(context, "scopedAllocPush");
    const scope: number[] = [];
    cache.scopedAlloc.push(scope);
    return scope;
  };

  target.scopedAllocPop = (state?: number[]) => {
    assertAllocator(context, "scopedAllocPop");
    const index = cache.scopedAlloc.indexOf(state as number[]);
    if (index < 0) {
      context.toss("Invalid state object for scopedAllocPop().");
    }
    const scope = cache.scopedAlloc.splice(index, 1)[0];
    for (let ptr = scope.pop(); ptr != null; ptr = scope.pop()) {
      if (target.functionEntry(ptr)) {
        target.uninstallFunction(ptr);
      } else {
        target.dealloc(ptr);
      }
    }
  };

  const scopedAlloc = (size: number): number => {
    if (!cache.scopedAlloc.length) {
      context.toss("No scopedAllocPush() scope is active.");
    }
    const ptr = target.alloc(size);
    cache.scopedAlloc[cache.scopedAlloc.length - 1].push(ptr);
    return ptr;
  };

  target.scopedAlloc = scopedAlloc as ScopedAllocatorTarget["scopedAlloc"];
  Object.defineProperty(target.scopedAlloc, "level", {
    configurable: false,
    enumerable: false,
    get: () => cache.scopedAlloc.length,
    set: () => {
      context.toss("The 'active' property is read-only.");
    },
  });

  target.scopedAllocCString = (jstr: string, returnWithLength = false) =>
    context.allocCStringInternal!(
      jstr,
      returnWithLength,
      target.scopedAlloc!,
      "scopedAllocCString()",
    );

  target.scopedAllocMainArgv = (list: unknown[]) =>
    allocArgvTable(target, context, true, list);
  target.allocMainArgv = (list: unknown[]) =>
    allocArgvTable(target, context, false, list);

  target.cArgvToJs = (argc: number, argvPtr: number) => {
    const args: (string | null)[] = [];
    for (let i = 0; i < argc; ++i) {
      const ptr = target.peekPtr(argvPtr + target.ptrSizeof * i);
      args.push(ptr ? target.cstrToJs(ptr) : null);
    }
    return args;
  };

  target.scopedAllocCall = <T>(fn: () => T): T => {
    const scope = target.scopedAllocPush!();
    try {
      return fn();
    } finally {
      target.scopedAllocPop!(scope);
    }
  };

  target.allocPtr = (howMany = 1, safePtrSize = true) =>
    allocPointerSlots(context, target, howMany, safePtrSize, "alloc");
  target.scopedAllocPtr = (howMany = 1, safePtrSize = true) =>
    allocPointerSlots(context, target, howMany, safePtrSize, "scopedAlloc");

  target.xGet = (name: string) => {
    const exported = target.exports?.[name];
    if (!exported) {
      context.toss("Cannot find exported symbol:", name);
    }
    return exported as JsFunction;
  };

  target.xCall = (fname: string | JsFunction, ...args: unknown[]): unknown => {
    const fn = fname instanceof Function ? fname : target.xGet!(fname);
    if (!(fn instanceof Function)) {
      context.toss("Exported symbol", fname, "is not a function.");
    }
    if (fn.length !== args.length) {
      const label = fn === fname ? fn.name : fname;
      context.toss(`${label}() requires`, fn.length, "argument(s).");
    }
    if (args.length === 1 && Array.isArray(args[0])) {
      return fn(...(args[0] as unknown[]));
    }
    return fn(...args);
  };
}
