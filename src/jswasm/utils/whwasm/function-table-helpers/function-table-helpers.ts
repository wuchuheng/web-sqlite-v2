/**
 * @fileoverview Function-table helpers for the wh-wasm utility installer.
 */

import type { WhWasmInstallerContext } from "../installer-context/installer-context";

type WasmPointer = number | bigint;
type JsFunction = (...args: unknown[]) => unknown;

type InstallFunctionInternal = (
  func: JsFunction | string,
  sig?: string | JsFunction,
  scoped?: boolean,
) => WasmPointer;

type JsFuncToWasm = {
  (func: JsFunction | string, sig: string | JsFunction): JsFunction;
  _cache?: JsFuncToWasmCache;
};

interface JsFuncToWasmCache {
  sigTypes: Record<string, WasmValueType>;
  typeCodes: Record<WasmValueType, number>;
  uleb128Encode(
    target: number[],
    method: "push" | "unshift",
    value: number,
  ): void;
  rxJSig: RegExp;
  sigParams(signature: string): string;
  letterType(letter: string): WasmValueType;
  pushSigType(destination: number[], letter: string): void;
}

type WasmValueType = "i32" | "i64" | "f32" | "f64";

type FunctionTableHandle = Pick<
  WebAssembly.Table,
  "length" | "grow" | "get" | "set"
> & {
  length: number;
};

interface FunctionTableTargetExtensions {
  functionTable: () => FunctionTableHandle;
  functionEntry: (pointer: number) => JsFunction | null | undefined;
  installFunction: {
    (func: JsFunction, sig?: string): WasmPointer;
    (sig: string, func: JsFunction): WasmPointer;
  };
  scopedInstallFunction: {
    (func: JsFunction, sig?: string): WasmPointer;
    (sig: string, func: JsFunction): WasmPointer;
  };
  uninstallFunction: (
    ptr: WasmPointer | null | undefined,
  ) => JsFunction | null | undefined;
  jsFuncToWasm: JsFuncToWasm;
}

type FunctionTableTarget = WhWasmInstallerContext["target"] &
  Partial<FunctionTableTargetExtensions>;

function isFunctionTableHandle(value: unknown): value is FunctionTableHandle {
  return (
    !!value &&
    typeof (value as FunctionTableHandle).grow === "function" &&
    typeof (value as FunctionTableHandle).get === "function" &&
    typeof (value as FunctionTableHandle).set === "function" &&
    typeof (value as FunctionTableHandle).length === "number"
  );
}

/**
 * Attaches helpers for manipulating the indirect function table and stores
 * the internal installer callback on the context.
 *
 * @param context - Shared installer context enriched with the WASM target.
 */
export function attachFunctionTableUtilities(
  context: WhWasmInstallerContext,
): void {
  // 1. Input handling
  const target = context.target as FunctionTableTarget;
  const installFunctionInternal = createInstallFunction(context);

  // 2. Core processing
  target.functionTable = () => {
    const table = target.exports?.__indirect_function_table;
    if (!isFunctionTableHandle(table)) {
      context.toss("Missing wasm indirect function table.");
    }
    return table;
  };

  target.functionEntry = (pointer: number) => {
    const functionTable = target.functionTable;
    if (!functionTable) {
      context.toss("functionTable helper is not available.");
    }
    const table = functionTable();
    return pointer < table.length
      ? (table.get(pointer) as JsFunction | null | undefined)
      : undefined;
  };

  target.jsFuncToWasm = createJsFuncToWasm(context);

  context.installFunctionInternal =
    installFunctionInternal as unknown as WhWasmInstallerContext["installFunctionInternal"];

  function installFunctionPublic(func: JsFunction, sig?: string): WasmPointer;
  function installFunctionPublic(sig: string, func: JsFunction): WasmPointer;
  function installFunctionPublic(
    funcOrSig: JsFunction | string,
    sigOrFunc?: string | JsFunction,
  ): WasmPointer {
    return installFunctionInternal(funcOrSig, sigOrFunc, false);
  }

  function scopedInstallFunctionPublic(
    func: JsFunction,
    sig?: string,
  ): WasmPointer;
  function scopedInstallFunctionPublic(
    sig: string,
    func: JsFunction,
  ): WasmPointer;
  function scopedInstallFunctionPublic(
    funcOrSig: JsFunction | string,
    sigOrFunc?: string | JsFunction,
  ): WasmPointer {
    return installFunctionInternal(funcOrSig, sigOrFunc, true);
  }

  target.installFunction = installFunctionPublic;
  target.scopedInstallFunction = scopedInstallFunctionPublic;

  target.uninstallFunction = createUninstallFunction(context);
  // 3. Output handling
}

function createInstallFunction(
  context: WhWasmInstallerContext,
): InstallFunctionInternal {
  const { cache } = context;
  const target = context.target as FunctionTableTarget;
  const requireFunctionTable = (): FunctionTableHandle => {
    const functionTable = target.functionTable;
    if (!functionTable) {
      context.toss("functionTable helper is not available.");
    }
    return functionTable();
  };
  const claimPointer = (table: FunctionTableHandle): number => {
    while (cache.freeFuncIndexes.length) {
      const pointer = cache.freeFuncIndexes.pop();
      if (pointer == null) {
        break;
      }
      if (!table.get(pointer)) {
        return pointer;
      }
    }
    const pointer = table.length;
    table.grow(1);
    return pointer;
  };
  const pushScopedPointer = (pointer: number) => {
    const scope = cache.scopedAlloc[cache.scopedAlloc.length - 1];
    if (!scope) {
      context.toss("No scopedAllocPush() scope is active.");
    }
    scope.push(pointer);
  };

  return (rawFunc, rawSig, scoped = false) => {
    // 1. Input handling
    if (scoped && !cache.scopedAlloc.length) {
      context.toss("No scopedAllocPush() scope is active.");
    }

    let func: JsFunction | string | undefined = rawFunc;
    let sig: string | JsFunction | undefined = rawSig;

    if (typeof func === "string") {
      const temp = sig;
      sig = func;
      func = temp as JsFunction | undefined;
    }

    if (typeof sig !== "string" || typeof func !== "function") {
      context.toss(
        "Invalid arguments: expecting (function,signature) or (signature,function).",
      );
    }
    const callableFunc = func as JsFunction;

    const table = requireFunctionTable();

    const originalLength = table.length;
    const pointer = claimPointer(table);

    // 2. Core processing
    try {
      table.set(pointer, callableFunc);
      if (scoped) {
        pushScopedPointer(pointer);
      }
      return pointer;
    } catch (error) {
      if (!(error instanceof TypeError)) {
        if (pointer === originalLength) {
          cache.freeFuncIndexes.push(pointer);
        }
        throw error;
      }
    }

    try {
      const jsFuncToWasm = target.jsFuncToWasm as JsFuncToWasm | undefined;
      const wrapped = jsFuncToWasm?.(callableFunc, sig);
      if (!wrapped) {
        context.toss("jsFuncToWasm helper is not available.");
      }
      table.set(pointer, wrapped);
      if (scoped) {
        pushScopedPointer(pointer);
      }
      // 3. Output handling
      return pointer;
    } catch (error) {
      if (pointer === originalLength) {
        cache.freeFuncIndexes.push(pointer);
      }
      throw error;
    }
  };
}

/**
 * Creates the jsFuncToWasm adapter used by the original Emscripten glue.
 *
 * @param context - Shared installer context.
 * @returns Adapter that wraps JS functions using the provided signature.
 */
function createJsFuncToWasm(context: WhWasmInstallerContext): JsFuncToWasm {
  const toss = context.toss.bind(context);
  const adapter: JsFuncToWasm = function jsFuncToWasm(func, sig) {
    const fn = jsFuncToWasm as JsFuncToWasm;
    if (!fn._cache) {
      const cache: JsFuncToWasmCache = {
        sigTypes: Object.assign(Object.create(null), {
          i: "i32",
          p: "i32",
          P: "i32",
          s: "i32",
          j: "i64",
          f: "f32",
          d: "f64",
        }) as Record<string, WasmValueType>,
        typeCodes: Object.assign(Object.create(null), {
          f64: 0x7c,
          f32: 0x7d,
          i64: 0x7e,
          i32: 0x7f,
        }) as Record<WasmValueType, number>,
        uleb128Encode(target, method, value) {
          if (value < 128) {
            target[method](value);
          } else {
            target[method](value % 128 | 128, value >> 7);
          }
        },
        rxJSig: /^(\w)\((\w*)\)$/,
        sigParams(signature) {
          const match = cache.rxJSig.exec(signature);
          return match ? match[2] : signature.substring(1);
        },
        letterType(letter) {
          const type = cache.sigTypes[letter];
          if (!type) {
            toss("Invalid signature letter:", letter);
          }
          return type as WasmValueType;
        },
        pushSigType(destination, letter) {
          const type = cache.letterType(letter);
          destination.push(cache.typeCodes[type]);
        },
      };
      fn._cache = cache;
    }
    const cache = fn._cache;
    if (!cache) {
      toss("jsFuncToWasm cache failed to initialize.");
    }

    if (typeof func === "string") {
      const temp = sig;
      sig = func;
      func = temp;
    }

    // 1. Input handling
    if (typeof sig !== "string" || typeof func !== "function") {
      toss(
        "Invalid arguments: expecting (function,signature) or (signature,function).",
      );
    }

    const callable = func as JsFunction;
    const signature = sig as string;

    const sigParams = cache.sigParams(signature);
    const wasmCode: number[] = [0x01, 0x60];
    // 2. Core processing
    cache.uleb128Encode(wasmCode, "push", sigParams.length);
    for (const param of sigParams) {
      cache.pushSigType(wasmCode, param);
    }
    if (signature[0] === "v") {
      wasmCode.push(0);
    } else {
      wasmCode.push(1);
      cache.pushSigType(wasmCode, signature[0]);
    }
    cache.uleb128Encode(wasmCode, "unshift", wasmCode.length);
    wasmCode.unshift(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01);
    wasmCode.push(
      0x02,
      0x07,
      0x01,
      0x01,
      0x65,
      0x01,
      0x66,
      0x00,
      0x00,
      0x07,
      0x05,
      0x01,
      0x01,
      0x66,
      0x00,
      0x00,
    );
    const wasmFunction = new WebAssembly.Instance(
      new WebAssembly.Module(new Uint8Array(wasmCode)),
      { e: { f: callable } },
    ).exports.f as JsFunction;
    // 3. Output handling
    return wasmFunction;
  };

  return adapter;
}

function createUninstallFunction(
  context: WhWasmInstallerContext,
): FunctionTableTargetExtensions["uninstallFunction"] {
  const { cache } = context;
  const target = context.target as FunctionTableTarget;
  return (ptr) => {
    // 1. Input handling
    if (ptr == null) {
      return undefined;
    }
    const pointer = typeof ptr === "bigint" ? Number(ptr) : (ptr as number);
    const functionTable = target.functionTable;
    if (!functionTable) {
      context.toss("functionTable helper is not available.");
    }
    const table = functionTable();

    // 2. Core processing
    cache.freeFuncIndexes.push(pointer);
    const previous = table.get(pointer) as JsFunction | null | undefined;
    table.set(pointer, null);

    // 3. Output handling
    return previous;
  };
}
