import type {
  WhWasmHelperTarget,
  WhWasmInstallerContext,
  WhWasmValue,
} from "../installer-context/installer-context";

type ArgAdapter = (...args: unknown[]) => unknown;
type ResultAdapter = (value: unknown) => unknown;

type AdapterMap<T> = Map<unknown, T>;

type FuncPtrBindScope = "transient" | "context" | "singleton" | "permanent";

interface ArgAdapterOptions {
  name?: string;
}

interface FuncPtrAdapterOptions extends ArgAdapterOptions {
  signature: string;
  bindScope?: FuncPtrBindScope;
  contextKey?: (argv: unknown[], argIndex: number) => string;
  callProxy?: (
    fn: (...args: unknown[]) => unknown,
  ) => (...args: unknown[]) => unknown;
}

type AdapterPair = [unknown | undefined, number | bigint | undefined];
type FuncPtrAdapterCtor = new (
  options: FuncPtrAdapterOptions,
) => BaseFuncPtrAdapter;

type XWrapTarget = WhWasmHelperTarget & {
  scopedAllocCString: (value: string) => number | bigint | null;
  cstrToJs: (ptr: number | bigint | null) => string | null;
  dealloc: (ptr: number | bigint | null) => void;
  scopedAllocPush: () => Array<number | bigint>;
  scopedAllocPop: (scope: Array<number | bigint>) => void;
  functionEntry: (
    ptr: number | bigint,
  ) => ((...args: unknown[]) => unknown) | undefined;
  xGet: (name: string) => (...args: unknown[]) => unknown;
  isPtr: (value: unknown) => boolean;
};

/**
 * Abstract base class used to customise argument conversion.
 */
class AbstractArgAdapter {
  public name: string;

  constructor(options: ArgAdapterOptions) {
    this.name = options.name || "unnamed adapter";
  }

  convertArg(..._args: unknown[]): unknown {
    throw new Error("AbstractArgAdapter must be subclassed.");
  }
}

export interface XWrapInternals {
  argConverters: AdapterMap<ArgAdapter>;
  resultConverters: AdapterMap<ResultAdapter>;
  ptrAdapter: (value: unknown) => number | bigint;
  AbstractArgAdapter: typeof AbstractArgAdapter;
  FuncPtrAdapter: FuncPtrAdapterCtor;
  ensureArgAdapter: (type: unknown) => ArgAdapter;
  ensureResultAdapter: (type: unknown) => ResultAdapter;
  convertArg: (type: unknown, ...args: unknown[]) => unknown;
  convertArgNoCheck: (type: unknown, ...args: unknown[]) => unknown;
  convertResult: (type: unknown, value: unknown) => unknown;
  convertResultNoCheck: (type: unknown, value: unknown) => unknown;
  configureAdapter: (
    method: (...args: unknown[]) => unknown,
    argsLength: number,
    typeName: unknown,
    adapter: unknown,
    modeName: string,
    map: AdapterMap<ArgAdapter | ResultAdapter>,
  ) => unknown;
}

class BaseFuncPtrAdapter extends AbstractArgAdapter {
  public static warnOnUse = false;
  public static debugFuncInstall = false;
  public static debugOut: (...args: unknown[]) => void =
    console.debug.bind(console);
  public static bindScopes: FuncPtrBindScope[] = [
    "transient",
    "context",
    "singleton",
    "permanent",
  ];

  private readonly signature: string;
  private readonly isTransient: boolean;
  private readonly isContext: boolean;
  private readonly singleton?: AdapterPair;
  private readonly callProxy?: (
    fn: (...args: unknown[]) => unknown,
  ) => (...args: unknown[]) => unknown;
  private readonly installer: WhWasmInstallerContext;
  private readonly contextKeyFn?: (argv: unknown[], argIndex: number) => string;
  private contextAdapters?: Map<string, AdapterPair>;

  constructor(
    options: FuncPtrAdapterOptions,
    installer: WhWasmInstallerContext,
  ) {
    super(options);
    // 1. Options parsing - capture signature and scope preferences.
    if (BaseFuncPtrAdapter.warnOnUse) {
      console.warn(
        "xArg.FuncPtrAdapter is an internal-only API and is not intended for client code.",
        options,
      );
    }
    this.signature =
      options.signature ||
      installer.toss("FuncPtrAdapter options requires a signature.");
    const contextKey =
      typeof options.contextKey === "function" ? options.contextKey : undefined;
    const bindScope =
      options.bindScope ||
      (contextKey ? "context" : undefined) ||
      installer.toss("FuncPtrAdapter options requires a bindScope.");
    if (!BaseFuncPtrAdapter.bindScopes.includes(bindScope)) {
      installer.toss(
        "Invalid options.bindScope (",
        bindScope,
        ") for FuncPtrAdapter. Expecting one of:",
        BaseFuncPtrAdapter.bindScopes.join(", "),
      );
    }
    this.isTransient = bindScope === "transient";
    this.isContext = bindScope === "context";
    this.singleton =
      bindScope === "singleton" ? [undefined, undefined] : undefined;
    this.callProxy =
      typeof options.callProxy === "function" ? options.callProxy : undefined;
    this.installer = installer;
    this.contextKeyFn = contextKey;
  }

  contextKey(argv: unknown[], argIndex: number): string {
    return `${argv}:${argIndex}`;
  }

  private getContextKey(argv: unknown[], argIndex: number): string {
    if (this.contextKeyFn) {
      return this.contextKeyFn(argv, argIndex);
    }
    return this.contextKey(argv, argIndex);
  }

  private contextMap(key: string): AdapterPair {
    if (!this.contextAdapters) {
      this.contextAdapters = new Map();
    }
    let entry = this.contextAdapters.get(key);
    if (!entry) {
      entry = [undefined, undefined];
      this.contextAdapters.set(key, entry);
    }
    return entry;
  }

  convertArg(
    value: unknown,
    argv: unknown[],
    argIndex: number,
  ): number | bigint {
    // 1. Determine the memoization slot for the requested scope.
    const pair = this.isContext
      ? this.contextMap(this.getContextKey(argv, argIndex))
      : this.singleton;

    if (pair && pair[0] === value) {
      return (pair[1] as number | bigint) ?? 0;
    }

    const { cache } = this.installer;
    const scopedAlloc = cache.scopedAlloc as Array<Array<number | bigint>>;

    // 2. Convert JS functions into callable wasm pointers via install hooks.
    if (typeof value === "function") {
      const fnValue = value as (...args: WhWasmValue[]) => WhWasmValue;
      const proxied = this.callProxy
        ? (this.callProxy(fnValue as (...args: unknown[]) => unknown) as (
            ...args: WhWasmValue[]
          ) => WhWasmValue)
        : fnValue;
      const pointer = this.installer.installFunctionInternal!(
        proxied,
        this.signature,
        this.isTransient,
      );
      if (BaseFuncPtrAdapter.debugFuncInstall && BaseFuncPtrAdapter.debugOut) {
        BaseFuncPtrAdapter.debugOut(
          "installFunctionInternal",
          proxied,
          pointer,
        );
      }
      if (pair) {
        if (pair[1]) {
          try {
            const currentScope = scopedAlloc[scopedAlloc.length - 1];
            currentScope?.push(pair[1] ?? 0);
          } catch {
            // Ignore scope tracking errors for parity with original code.
          }
        }
        pair[0] = proxied;
        pair[1] = pointer;
      }
      return pointer;
    }

    // 3. Accept raw pointers/nullable values or throw when unsupported.
    const isPtr = (this.installer.target as XWrapTarget).isPtr;
    if (isPtr(value) || value === null || typeof value === "undefined") {
      if (pair && pair[1] && pair[1] !== value) {
        try {
          const currentScope = scopedAlloc[scopedAlloc.length - 1];
          currentScope?.push(pair[1] ?? 0);
        } catch {
          // Keep behavior aligned with loose JS runtime.
        }
        pair[0] = pair[1] = (value as number | bigint) ?? 0;
      }
      return (value as number | bigint | null | undefined) ?? 0;
    }
    throw new TypeError(
      `Invalid FuncPtrAdapter argument type. Expecting a function pointer or a ${this.name} function matching signature ${this.signature}.`,
    );
  }
}

/**
 * Internal helpers used by attachXWrapAdapters. Logic lives here so that
 * xwrap-helpers can focus on orchestration only.
 *
 * @param context Installer context used while wiring adapters.
 * @returns Converter maps, helper classes, and utility functions.
 */
export function createXWrapInternals(
  context: WhWasmInstallerContext,
): XWrapInternals {
  const target = context.target as XWrapTarget;
  const argConverters = context.cache.xWrap.convert
    .arg as AdapterMap<ArgAdapter>;
  const resultConverters = context.cache.xWrap.convert
    .result as AdapterMap<ResultAdapter>;

  // 1. Pointer handling - build the shared adapter plus optional i64 helpers.
  const ptrAdapter =
    context.ptrIR === "i32"
      ? (value: unknown): number => Number(value) | 0
      : (value: unknown): bigint =>
          BigInt(value as number | bigint) | BigInt(0);

  if (target.bigIntEnabled) {
    argConverters.set("i64", (value) => BigInt(value as number | bigint));
  }

  argConverters
    .set("i32", ptrAdapter)
    .set("i16", (value) => (Number(value) | 0) & 0xffff)
    .set("i8", (value) => (Number(value) | 0) & 0xff)
    .set("f32", (value) => Number(value).valueOf())
    .set("float", (value) => Number(value).valueOf())
    .set("f64", (value) => Number(value).valueOf())
    .set("double", (value) => Number(value).valueOf())
    .set("int", (value) => (Number(value) | 0) & 0xffffffff)
    .set("null", (value) => value)
    .set(null, (value) => value)
    .set("**", ptrAdapter)
    .set("*", ptrAdapter);

  resultConverters
    .set("*", ptrAdapter)
    .set("pointer", ptrAdapter)
    .set("number", (value) => Number(value))
    .set("void", () => undefined)
    .set("null", (value) => value)
    .set(null, (value) => value);

  // 2. Converter registration - copy numeric adapters to cover pointer variants.
  const copyThrough = [
    "i8",
    "i16",
    "i32",
    "int",
    "f32",
    "float",
    "f64",
    "double",
  ];
  if (target.bigIntEnabled) {
    copyThrough.push("i64");
  }

  for (const type of copyThrough) {
    argConverters.set(`${type}*`, ptrAdapter);
    resultConverters.set(`${type}*`, ptrAdapter);
    const adapter = argConverters.get(type);
    if (!adapter) {
      context.toss("Missing arg converter:", type);
    }
    resultConverters.set(type, adapter);
  }

  const stringArgAdapter: ArgAdapter = (value) => {
    if (typeof value === "string") {
      return target.scopedAllocCString(value);
    }
    return value ? ptrAdapter(value) : null;
  };

  argConverters
    .set("string", stringArgAdapter)
    .set("utf8", stringArgAdapter)
    .set("pointer", stringArgAdapter);

  resultConverters
    .set("string", (ptr) => target.cstrToJs(ptr as number | bigint | null))
    .set("utf8", (ptr) => target.cstrToJs(ptr as number | bigint | null))
    .set("string:dealloc", (ptr) => {
      try {
        return ptr ? target.cstrToJs(ptr as number | bigint) : null;
      } finally {
        target.dealloc(ptr as number | bigint | null);
      }
    })
    .set("utf8:dealloc", (ptr) => {
      try {
        return ptr ? target.cstrToJs(ptr as number | bigint) : null;
      } finally {
        target.dealloc(ptr as number | bigint | null);
      }
    })
    .set("json", (ptr) =>
      JSON.parse(target.cstrToJs(ptr as number | bigint | null) as string),
    )
    .set("json:dealloc", (ptr) => {
      try {
        const text = ptr ? target.cstrToJs(ptr as number | bigint) : null;
        return text ? JSON.parse(text) : null;
      } finally {
        target.dealloc(ptr as number | bigint | null);
      }
    });

  // 3. Helper factories - wire conversion utilities and configurators.
  const ensureArgAdapter = (type: unknown): ArgAdapter => {
    const adapter = argConverters.get(type);
    if (!adapter) {
      context.toss("Argument adapter not found:", type);
    }
    return adapter;
  };

  const ensureResultAdapter = (type: unknown): ResultAdapter => {
    const adapter = resultConverters.get(type);
    if (!adapter) {
      context.toss("Result adapter not found:", type);
    }
    return adapter;
  };

  const convertArg = (type: unknown, ...args: unknown[]): unknown =>
    ensureArgAdapter(type)(...args);

  const convertArgNoCheck = (type: unknown, ...args: unknown[]): unknown => {
    const adapter = argConverters.get(type);
    if (!adapter) {
      context.toss("Argument adapter not found:", type);
    }
    return adapter(...args);
  };

  const convertResult = (type: unknown, value: unknown): unknown =>
    type === null ? value : type ? ensureResultAdapter(type)(value) : undefined;

  const convertResultNoCheck = (type: unknown, value: unknown): unknown => {
    if (type === null) {
      return value;
    }
    if (!type) {
      return undefined;
    }
    const adapter = resultConverters.get(type);
    if (!adapter) {
      context.toss("Result adapter not found:", type);
    }
    return adapter(value);
  };

  const configureAdapter = (
    method: (...args: unknown[]) => unknown,
    argsLength: number,
    typeName: unknown,
    adapter: unknown,
    modeName: string,
    map: AdapterMap<ArgAdapter | ResultAdapter>,
  ): unknown => {
    if (typeof typeName === "string") {
      if (argsLength === 1) {
        return map.get(typeName);
      }
      if (argsLength === 2) {
        if (!adapter) {
          map.delete(typeName);
          return method;
        }
        if (!(adapter instanceof Function)) {
          context.toss(modeName, "requires a function argument.");
        }
        map.set(typeName, adapter as ArgAdapter | ResultAdapter);
        return method;
      }
    }
    context.toss("Invalid arguments to", modeName);
  };

  const FuncPtrAdapterClass: FuncPtrAdapterCtor = class extends BaseFuncPtrAdapter {
    constructor(options: FuncPtrAdapterOptions) {
      super(options, context);
    }
  };

  return {
    argConverters,
    resultConverters,
    ptrAdapter,
    AbstractArgAdapter,
    FuncPtrAdapter: FuncPtrAdapterClass,
    ensureArgAdapter,
    ensureResultAdapter,
    convertArg,
    convertArgNoCheck,
    convertResult,
    convertResultNoCheck,
    configureAdapter,
  };
}
