/**
 * Primitive values stored on the wh-wasm helper target.
 */
export type WhWasmPrimitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

/**
 * Recursive value hierarchy used by the helper target and cache structures.
 */
export type WhWasmValue =
  | WhWasmPrimitive
  | WhWasmValue[]
  | { [key: string]: WhWasmValue }
  | ((...args: WhWasmValue[]) => WhWasmValue)
  | ((size: number) => number)
  | ((ptr: number) => void)
  | WebAssembly.Memory
  | WebAssembly.Exports
  | WebAssembly.Module
  | TextEncoder
  | TextDecoder;

/**
 * Mutable target object that receives all wh-wasm helper methods.
 */
export interface WhWasmHelperTarget {
  /** Indicates whether 64-bit heap views should be exposed. */
  bigIntEnabled?: boolean;
  /** WebAssembly instance exposing the low-level exports. */
  instance?: { exports: WebAssembly.Exports };
  /** Direct reference to the module exports (including memory). */
  exports?: WebAssembly.Exports & { memory?: WebAssembly.Memory };
  /** Shared WebAssembly memory used by the runtime. */
  memory?: WebAssembly.Memory;
  /** Pointer intermediate representation used by helper functions. */
  pointerIR?: PointerIr;
  /** Size of a pointer expressed in bytes. */
  ptrSizeof?: PointerSizeof;
  /** Container for additional wasm utilities. */
  wasm?: WhWasmValue & { stackAlloc?: (size: number) => number };
  /** High-level utility namespace mirrored from the legacy bundle. */
  util?: { [key: string]: WhWasmValue };
  /** C API namespace emitted by runSQLite3PostLoadInit. */
  capi?: { wasm?: WhWasmValue & { stackAlloc?: (size: number) => number } };
  /** Allows arbitrary helper metadata to be stored. */
  [key: string]: WhWasmValue;
}

/**
 * Bookkeeping cache maintained by the installer context.
 */
export interface WhWasmInstallerCache {
  /** Size in bytes of the currently cached heap. */
  heapSize: number;
  /** Cached WebAssembly memory instance. */
  memory: WebAssembly.Memory | null;
  /** Function table indexes reserved for free(). */
  freeFuncIndexes: number[];
  /** Scoped allocator stack used by scoped allocation helpers. */
  scopedAlloc: number[][];
  /** UTF-8 decoder shared by the helpers. */
  utf8Decoder: TextDecoder;
  /** UTF-8 encoder shared by the helpers. */
  utf8Encoder: TextEncoder;
  /** Lazy typed-array views into the WebAssembly heap. */
  HEAP8?: Int8Array;
  /** Unsigned 8-bit heap view. */
  HEAP8U?: Uint8Array;
  /** Signed 16-bit heap view. */
  HEAP16?: Int16Array;
  /** Unsigned 16-bit heap view. */
  HEAP16U?: Uint16Array;
  /** Signed 32-bit heap view. */
  HEAP32?: Int32Array;
  /** Unsigned 32-bit heap view. */
  HEAP32U?: Uint32Array;
  /** 32-bit floating point heap view. */
  HEAP32F?: Float32Array;
  /** 64-bit floating point heap view. */
  HEAP64F?: Float64Array;
  /** Signed 64-bit heap view (when big integers are enabled). */
  HEAP64?: BigInt64Array;
  /** Unsigned 64-bit heap view (when big integers are enabled). */
  HEAP64U?: BigUint64Array;
  /** Internal xWrap conversion caches. */
  xWrap: {
    convert: {
      arg: Map<unknown, unknown>;
      result: Map<unknown, unknown>;
    };
  };
}

/**
 * Installer function signature used across the wh-wasm helpers.
 */
export type WhWasmInstaller = (
  target: WhWasmHelperTarget,
) => WhWasmHelperTarget;

type PointerIr = "i32" | "i64";
type PointerSizeof = 4 | 8;
type InstallFunction = (
  fn: (...args: WhWasmValue[]) => WhWasmValue,
  sig: string,
  scoped: boolean,
) => number;
type AllocCString = (
  value: string,
  nulTerminate: boolean,
  stackAlloc: (size: number) => number,
  signature: string,
) => number | [number, number] | null;

/**
 * Shared context object used while installing the wh-wasm helpers.
 * Encapsulates the mutable target object plus caches and pointer metadata.
 */
export class WhWasmInstallerContext {
  /** Mutable target exposing the helper API. */
  public target: WhWasmHelperTarget;
  /** Bookkeeping cache reused across helpers. */
  public cache: WhWasmInstallerCache;
  /** Pointer intermediate representation (i32 or i64). */
  public ptrIR: PointerIr;
  /** Size in bytes for the active pointer representation. */
  public ptrSizeof: PointerSizeof;
  /** Internal helper for installing functions into the table. */
  public installFunctionInternal: InstallFunction | null;
  /** Internal CString allocator provided by the string helpers. */
  public allocCStringInternal: AllocCString | null;

  /**
   * Creates a new installer context bound to the specified target.
   *
   * @param target Mutable object that receives helper methods.
   */
  constructor(target: WhWasmHelperTarget) {
    this.target = target;
    this.cache = {
      heapSize: 0,
      memory: null,
      freeFuncIndexes: [],
      scopedAlloc: [],
      utf8Decoder: new TextDecoder(),
      utf8Encoder: new TextEncoder(),
      xWrap: {
        convert: {
          arg: new Map(),
          result: new Map(),
        },
      },
    };

    const ptrIR = target.pointerIR ?? "i32";
    if (!["i32", "i64"].includes(ptrIR)) {
      this.toss("Unhandled ptrSizeof:", ptrIR);
    }
    this.ptrIR = ptrIR;
    this.ptrSizeof = ptrIR === "i32" ? 4 : 8;
    this.installFunctionInternal = null;
    this.allocCStringInternal = null;
  }

  /**
   * Throws a consistent Error with a joined message.
   *
   * @param args Message fragments that will be joined with spaces.
   * @throws {Error} Always throws with the constructed message.
   */
  toss(...args: unknown[]): never {
    throw new Error(args.join(" "));
  }

  /**
   * Resolves the active WebAssembly.Memory instance for the target.
   *
   * @returns Memory used by the target helpers.
   */
  resolveMemory(): WebAssembly.Memory {
    const { cache, target } = this;
    if (!cache.memory) {
      const memory =
        target.memory instanceof WebAssembly.Memory
          ? target.memory
          : target.exports?.memory;
      if (!memory) {
        this.toss("Missing WebAssembly.Memory on target.");
      }
      cache.memory = memory;
    }
    return cache.memory;
  }

  /**
   * Lazily constructs typed-array views over the underlying WASM heap.
   *
   * @returns Cache enriched with up-to-date typed arrays.
   */
  getHeapViews(): WhWasmInstallerCache {
    const { cache, target } = this;
    const memory = this.resolveMemory();
    if (
      cache.heapSize === memory.buffer.byteLength &&
      cache.HEAP8 &&
      cache.HEAP8U
    ) {
      return cache;
    }

    const buffer = memory.buffer;
    cache.HEAP8 = new Int8Array(buffer);
    cache.HEAP8U = new Uint8Array(buffer);
    cache.HEAP16 = new Int16Array(buffer);
    cache.HEAP16U = new Uint16Array(buffer);
    cache.HEAP32 = new Int32Array(buffer);
    cache.HEAP32U = new Uint32Array(buffer);
    cache.HEAP32F = new Float32Array(buffer);
    cache.HEAP64F = new Float64Array(buffer);
    if (target.bigIntEnabled) {
      cache.HEAP64 = new BigInt64Array(buffer);
      cache.HEAP64U = new BigUint64Array(buffer);
    } else {
      cache.HEAP64 = undefined;
      cache.HEAP64U = undefined;
    }
    cache.heapSize = buffer.byteLength;
    return cache;
  }
}
