import { createXWrapInternals } from "../xwrap-internals/xwrap-internals";
import type {
  WhWasmHelperTarget,
  WhWasmInstallerContext,
} from "../installer-context/installer-context";
import type { XWrapInternals } from "../xwrap-internals/xwrap-internals";

type FuncPtrAdapterCtor = XWrapInternals["FuncPtrAdapter"];
type FuncPtrAdapterInstance = InstanceType<FuncPtrAdapterCtor>;

type XWrapArgType = string | FuncPtrAdapterInstance | FuncPtrAdapterCtor;

type WasmExport = (...args: unknown[]) => unknown;

type XWrapResult = WasmExport;

interface XWrapFunction {
  (
    fArg: string | WasmExport | number | bigint,
    resultType?: string | null,
    ...argTypes: XWrapArgType[]
  ): XWrapResult;
  argAdapter: (
    typeName: string,
    adapter?: (value: unknown) => unknown,
  ) => unknown;
  resultAdapter: (
    typeName: string,
    adapter?: (value: unknown) => unknown,
  ) => unknown;
  FuncPtrAdapter: FuncPtrAdapterCtor;
  testConvertArg: (type: unknown, ...args: unknown[]) => unknown;
  testConvertResult: (type: unknown, value: unknown) => unknown;
}

type ExtendedTarget = WhWasmHelperTarget & {
  scopedAllocPush: () => Array<number | bigint>;
  scopedAllocPop: (scope: Array<number | bigint>) => void;
  functionEntry: (
    ptr: number | bigint,
  ) => ((...args: unknown[]) => unknown) | undefined;
  xGet: (name: string) => WasmExport;
  isPtr: (value: unknown) => boolean;
  xWrap?: XWrapFunction;
  xCallWrapped?: (
    fArg: string | number | bigint | WasmExport,
    resultType?: string | null,
    argTypes?: XWrapArgType[] | null,
    ...callArgs: unknown[]
  ) => unknown;
};

type ExtendedXWrapCache = WhWasmInstallerContext["cache"]["xWrap"] & {
  convertArg?: (type: unknown, ...args: unknown[]) => unknown;
  convertArgNoCheck?: (type: unknown, ...args: unknown[]) => unknown;
  convertResult?: (type: unknown, value: unknown) => unknown;
  convertResultNoCheck?: (type: unknown, value: unknown) => unknown;
  testConvertArg?: (type: unknown, ...args: unknown[]) => unknown;
  testConvertResult?: (type: unknown, value: unknown) => unknown;
};

/**
 * Populates the installer context target with xWrap adapters and helpers.
 *
 * @param context Installer context that owns the mutable helper target.
 */
export function attachXWrapAdapters(context: WhWasmInstallerContext): void {
  // 1. Input handling - grab typed handles for the target and cache.
  const target = context.target as ExtendedTarget;
  const cache = context.cache;

  // 2. Core processing - pull converter helpers from the internals factory.
  const {
    argConverters,
    resultConverters,
    AbstractArgAdapter,
    FuncPtrAdapter,
    ensureArgAdapter,
    ensureResultAdapter,
    convertArg,
    convertArgNoCheck,
    convertResult,
    convertResultNoCheck,
    configureAdapter,
  } = createXWrapInternals(context);

  // 3. Output handling - expose conversion helpers on the shared cache.
  const xWrapCache = cache.xWrap as ExtendedXWrapCache;
  xWrapCache.convertArg = (type, ...args) => convertArg(type, ...args);
  xWrapCache.convertArgNoCheck = (type, ...args) =>
    convertArgNoCheck(type, ...args);
  xWrapCache.convertResult = (type, value) => convertResult(type, value);
  xWrapCache.convertResultNoCheck = (type, value) =>
    convertResultNoCheck(type, value);
  xWrapCache.testConvertArg = xWrapCache.convertArg;
  xWrapCache.testConvertResult = xWrapCache.convertResult;

  const createWrappedFunction = (
    fn: WasmExport,
    fnName: string,
    resultType: string | null | undefined,
    verifiedArgTypes: unknown[],
  ): WasmExport => {
    if (fn.length === 0) {
      return (...callArgs: unknown[]) => {
        // 1. Input handling - enforce zero-arity contract.
        if (callArgs.length) {
          context.toss(`${fnName}() requires ${fn.length} argument(s).`);
        }
        // 2. Core processing - invoke the wasm function.
        const rawResult = fn();
        // 3. Output handling - convert the return value.
        return xWrapCache.convertResult!(resultType, rawResult);
      };
    }

    return (...callArgs: unknown[]) => {
      // 1. Input handling - validate argument count.
      if (callArgs.length !== fn.length) {
        context.toss(`${fnName}() requires ${fn.length} argument(s).`);
      }
      const scope = target.scopedAllocPush();
      try {
        // 2. Core processing - adapt arguments before invoking wasm.
        for (let i = 0; i < callArgs.length; ++i) {
          callArgs[i] = xWrapCache.convertArgNoCheck!(
            verifiedArgTypes[i],
            callArgs[i],
            callArgs,
            i,
          );
        }
        const rawResult = fn(...callArgs);
        // 3. Output handling - convert the raw result after execution.
        return xWrapCache.convertResultNoCheck!(resultType, rawResult);
      } finally {
        target.scopedAllocPop(scope);
      }
    };
  };

  const xWrapBase = function xWrap(
    fArg: string | WasmExport | number | bigint,
    resultType?: string | null,
    ...argTypes: XWrapArgType[]
  ): WasmExport {
    // 1. Input handling - normalize arg type declarations.
    if (argTypes.length === 1 && Array.isArray(argTypes[0])) {
      argTypes = argTypes[0] as XWrapArgType[];
    }

    let resolvedFunction: WasmExport | string | number | bigint = fArg;
    if (target.isPtr(resolvedFunction)) {
      const entry = target.functionEntry(resolvedFunction as number | bigint);
      if (!entry) {
        context.toss("Function pointer not found in WASM function table.");
      }
      resolvedFunction = entry;
    }

    const fnComponent =
      resolvedFunction instanceof Function
        ? resolvedFunction
        : target.xGet(resolvedFunction as string);
    const fnName =
      resolvedFunction instanceof Function
        ? resolvedFunction.name || "unnamed function"
        : resolvedFunction;

    if (argTypes.length !== fnComponent.length) {
      context.toss(`${fnName}() requires ${fnComponent.length} argument(s).`);
    }

    if (resultType !== undefined && resultType !== null) {
      ensureResultAdapter(resultType);
    }

    const verifiedArgTypes = argTypes.map((type) => {
      if (type instanceof AbstractArgAdapter) {
        argConverters.set(type, (value, argv, argIndex) =>
          type.convertArg(value, argv as unknown[], argIndex as number),
        );
        return type;
      }
      ensureArgAdapter(type);
      return type;
    });

    // 2. Core processing - produce a wrapped caller.
    return createWrappedFunction(
      fnComponent,
      typeof fnName === "string" ? fnName : fnComponent.name,
      resultType,
      verifiedArgTypes,
    );
  };

  const xWrap = xWrapBase as XWrapFunction;

  xWrap.resultAdapter = function resultAdapter(
    typeName: string,
    adapter?: (value: unknown) => unknown,
  ): unknown {
    return configureAdapter(
      xWrap.resultAdapter as unknown as (...args: unknown[]) => unknown,
      arguments.length,
      typeName,
      adapter,
      "resultAdapter()",
      resultConverters,
    );
  };

  xWrap.argAdapter = function argAdapter(
    typeName: string,
    adapter?: (value: unknown) => unknown,
  ): unknown {
    return configureAdapter(
      xWrap.argAdapter as unknown as (...args: unknown[]) => unknown,
      arguments.length,
      typeName,
      adapter,
      "argAdapter()",
      argConverters,
    );
  };

  xWrap.FuncPtrAdapter = FuncPtrAdapter;
  xWrap.testConvertArg = xWrapCache.testConvertArg!;
  xWrap.testConvertResult = xWrapCache.testConvertResult!;
  target.xWrap = xWrap;

  target.xCallWrapped = (fArg, resultType, argTypes, ...callArgs): unknown => {
    // 1. Input handling - detect the array signature for arguments.
    const normalizedArgs =
      callArgs.length === 1 && Array.isArray(callArgs[0])
        ? (callArgs[0] as unknown[])
        : callArgs;
    const normalizedTypes = Array.isArray(argTypes) ? argTypes : argTypes || [];
    // 2. Core processing - delegate to xWrap with normalized metadata.
    const wrapped = target.xWrap!(fArg, resultType, ...normalizedTypes);
    // 3. Output handling - invoke the wrapped function with converted args.
    return wrapped(...(normalizedArgs || []));
  };
}
