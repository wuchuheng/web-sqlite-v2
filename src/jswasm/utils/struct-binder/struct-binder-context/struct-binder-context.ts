import {
  DEBUG_FLAG_MASK,
  describeMember,
  detectLittleEndian,
  defineReadonly,
  toss,
} from "../struct-binder-helpers/struct-binder-helpers";
import type {
  Sqlite3DebugFlagController,
  Sqlite3StructBinderConfig,
  Sqlite3StructConstructor,
  Sqlite3StructDefinition,
  Sqlite3StructInstance,
  WasmPointer,
} from "../../struct-binder-factory/types.d.ts";
import type {
  StructBinderAccessorContext,
  StructSignatureHelpers,
} from "../struct-binder-accessors/struct-binder-accessors";
import type {
  StructTypeClass,
  StructTypeContext,
} from "../struct-binder-struct-type/struct-binder-struct-type";
import {
  createSignatureHelpers,
  type SignatureHelpers,
} from "../struct-binder-signatures/struct-binder-signatures";
import { createMemoryHelpers } from "../struct-binder-memory/struct-binder-memory";
import { createMemberHelpers } from "../struct-binder-members/struct-binder-members";

type HeapProvider = () => Uint8Array;
type MemoryHelpers = ReturnType<typeof createMemoryHelpers>;
type MemberHelpers = ReturnType<typeof createMemberHelpers>;
type MemoryHelperConfig = Parameters<typeof createMemoryHelpers>[0];
type MemoryStructTypeRefAccessor = MemoryHelperConfig["StructTypeRefAccessor"];
type MemberHelperConfig = Parameters<typeof createMemberHelpers>[0];
type MemberStructTypeRefAccessor = MemberHelperConfig["StructTypeRefAccessor"];

type MutableDebugFlagState = Partial<Sqlite3DebugFlagController["__flags"]>;

export interface StructBinderFactoryDebugSupport {
  __makeDebugFlags?: (
    inheritFrom?: Sqlite3DebugFlagController,
  ) => Sqlite3DebugFlagController;
  debugFlags?: Sqlite3DebugFlagController;
}

export type StructBinderContext = StructTypeContext &
  StructBinderAccessorContext &
  MemoryHelpers &
  MemberHelpers & {
    allocStruct(
      structCtor: Sqlite3StructConstructor,
      instance: Sqlite3StructInstance,
      pointer?: WasmPointer,
    ): void;
    memberKey(memberName: string): string;
    memberKeys(info: Sqlite3StructDefinition): string[];
    validateExternalPointer(
      structName: string,
      pointer: WasmPointer | undefined,
    ): WasmPointer | undefined;
    signature: SignatureHelpers & StructSignatureHelpers;
  };

const createHeapProvider = (
  heap: Sqlite3StructBinderConfig["heap"],
): HeapProvider => {
  if (typeof heap === "function") {
    return heap;
  }
  return () => new Uint8Array(heap.buffer);
};

const validateConfigFns = (
  config: Sqlite3StructBinderConfig,
  keys: Array<"alloc" | "dealloc">,
): void => {
  keys.forEach((key) => {
    if (typeof config[key] !== "function") {
      toss("Config option '" + key + "' must be a function.");
    }
  });
};

/** Ensures the config contains valid heap and allocator parameters. */
export const ensureConfig = (config: Sqlite3StructBinderConfig): void => {
  if (!config) {
    toss("StructBinderFactory requires a config object.");
  }

  const { heap } = config;
  if (!(heap instanceof WebAssembly.Memory) && typeof heap !== "function") {
    toss("config.heap must be WebAssembly.Memory instance or a function.");
  }

  validateConfigFns(config, ["alloc", "dealloc"]);
};

const applyDebugMask = (
  controller: Sqlite3DebugFlagController,
  mask: number,
): Sqlite3DebugFlagController["__flags"] => {
  if (mask < 0) {
    const mutableFlags = controller.__flags as MutableDebugFlagState;
    delete mutableFlags.getter;
    delete mutableFlags.setter;
    delete mutableFlags.alloc;
    delete mutableFlags.dealloc;
    return controller.__flags;
  }

  controller.__flags.getter = Boolean(mask & DEBUG_FLAG_MASK.getter);
  controller.__flags.setter = Boolean(mask & DEBUG_FLAG_MASK.setter);
  controller.__flags.alloc = Boolean(mask & DEBUG_FLAG_MASK.alloc);
  controller.__flags.dealloc = Boolean(mask & DEBUG_FLAG_MASK.dealloc);
  return controller.__flags;
};

/** Lazily wires debug flag factories onto the given struct binder factory. */
export const ensureDebugFlagFactories = (
  factory: StructBinderFactoryDebugSupport,
): void => {
  if (!factory.__makeDebugFlags) {
    factory.__makeDebugFlags = (
      deriveFrom: Sqlite3DebugFlagController | undefined = undefined,
    ): Sqlite3DebugFlagController => {
      const parent = deriveFrom?.__flags ?? null;
      const flags = Object.create(parent) as MutableDebugFlagState;
      const controller = ((mask?: number) => {
        if (mask === undefined) {
          return controller.__flags;
        }
        if (typeof mask !== "number") {
          toss("Debug flag mask must be numeric.");
        }
        return applyDebugMask(controller, mask);
      }) as Sqlite3DebugFlagController;
      defineReadonly(controller, "__flags", flags);
      if (!parent) controller(0);
      return controller;
    };
  }

  if (!factory.debugFlags) {
    factory.debugFlags = factory.__makeDebugFlags();
  }
};

type StructTypeRefHolder = {
  get(): StructTypeClass | null;
  set(value: StructTypeClass | null): void;
};

const createStructTypeAccessor = (): StructTypeRefHolder => {
  let StructTypeRef: StructTypeClass | null = null;
  return {
    get: () => StructTypeRef,
    set: (value) => {
      StructTypeRef = value;
    },
  };
};

const createViewHeap = (heap: HeapProvider) => (): Uint8Array => {
  const buffer = heap();
  if (!(buffer instanceof Uint8Array)) {
    toss("config.heap must resolve to a Uint8Array.");
  }
  return buffer;
};

/** Builds the struct binder context with memory helpers and signature logic. */
export const createContext = (
  config: Sqlite3StructBinderConfig,
  structBinderFactory: StructBinderFactoryDebugSupport,
): StructBinderContext => {
  ensureConfig(config);
  ensureDebugFlagFactories(structBinderFactory);

  const heap = createHeapProvider(config.heap);
  const defaultLog = console.log.bind(console);
  const log = (...items: unknown[]): void => {
    if (config.log) {
      config.log(...(items as Array<string | number | bigint | boolean>));
      return;
    }
    defaultLog(...items);
  };
  const memberPrefix = config.memberPrefix ?? "";
  const memberSuffix = config.memberSuffix ?? "";
  const bigIntEnabled =
    config.bigIntEnabled ?? Boolean(globalThis.BigInt64Array);
  const ptrSizeof = config.ptrSizeof ?? 4;
  const ptrIR = config.ptrIR ?? "i32";

  const signatureHelpers = createSignatureHelpers({
    ptrSizeof,
    ptrIR,
    bigIntEnabled,
  });
  const signature = signatureHelpers as SignatureHelpers &
    StructSignatureHelpers;
  const pointerMap = new WeakMap<object, number>();
  const externalPointers = new WeakMap<object, boolean>();
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder("utf-8");
  const sabCtor =
    typeof SharedArrayBuffer === "undefined" ? null : SharedArrayBuffer;
  const littleEndian = detectLittleEndian();
  const structTypeRefAccessor = createStructTypeAccessor();
  const structTypeRefBridge = {
    get: () => structTypeRefAccessor.get() as unknown,
  };
  const viewHeap = createViewHeap(heap);

  const allocNumber = (size: number): number => {
    const result = config.alloc(size);
    return typeof result === "bigint" ? Number(result) : result;
  };
  const deallocNumber = (pointer: number): void => {
    config.dealloc(pointer as WasmPointer);
  };

  const memoryHelpers = createMemoryHelpers({
    alloc: allocNumber,
    dealloc: deallocNumber,
    log,
    memberPrefix,
    memberSuffix,
    pointerMap,
    externalPointers,
    viewHeap,
    textEncoder,
    textDecoder,
    sabCtor,
    describeMember,
    StructTypeRefAccessor: structTypeRefBridge as MemoryStructTypeRefAccessor,
  });
  const memberHelpers = createMemberHelpers({
    memoryHelpers,
    signature,
    log,
    viewHeap,
    StructTypeRefAccessor: structTypeRefBridge as MemberStructTypeRefAccessor,
  });

  const context = {
    heap: viewHeap,
    ...memoryHelpers,
    ...memberHelpers,
    memberKey: (name: string) => memberPrefix + name + memberSuffix,
    memberKeys: (structInfo: Sqlite3StructDefinition) =>
      Object.keys(structInfo.members).map(
        (name) => memberPrefix + name + memberSuffix,
      ),
    signature,
    littleEndian,
    log,
    setStructType: (StructType: StructTypeClass) => {
      structTypeRefAccessor.set(StructType);
    },
  } as StructBinderContext;

  return context;
};

export { createSignatureHelpers };
