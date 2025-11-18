import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  ensureConfig,
  ensureDebugFlagFactories,
  createContext,
  type StructBinderFactoryDebugSupport,
} from "./struct-binder-context";
import { DEBUG_FLAG_MASK } from "../struct-binder-helpers/struct-binder-helpers";
import type {
  Sqlite3StructDefinition,
  Sqlite3StructMemberDescriptor,
} from "../../struct-binder-factory/types.d.ts";

type TestStructInfo = Sqlite3StructDefinition & {
  members: Record<string, Required<Sqlite3StructMemberDescriptor>>;
};

type TestInstance = {
  structInfo: TestStructInfo;
  [key: string]: unknown;
};

type RequiredDebugSupport = Required<StructBinderFactoryDebugSupport>;

const createFactory = (): RequiredDebugSupport => {
  const factory: StructBinderFactoryDebugSupport = {};
  ensureDebugFlagFactories(factory);
  return factory as RequiredDebugSupport;
};

const createHeap = () => new Uint8Array(512);

const createConfig = (heap: Uint8Array) => {
  let nextPointer = 16;
  const alloc = vi.fn((size: number) => {
    const pointer = nextPointer;
    nextPointer += size + 4;
    return pointer;
  });
  const dealloc = vi.fn();
  const log = vi.fn();
  return {
    heap: () => heap,
    alloc,
    dealloc,
    log,
    memberPrefix: "sb_",
    memberSuffix: "_x",
  };
};

const createContextUnderTest = () => {
  const heap = createHeap();
  const config = createConfig(heap);
  const factory = createFactory();
  const ctx = createContext(config, factory);
  const createMember = (
    name: string,
    signature: string,
    offset: number,
    sizeof = 8,
  ): Required<Sqlite3StructMemberDescriptor> => ({
    key: ctx.memberKey(name),
    signature,
    offset,
    sizeof,
    name,
    readOnly: false,
  });
  const structInfo: TestStructInfo = {
    name: "DummyStruct",
    sizeof: 32,
    members: {
      name: createMember("name", "s", 0, 8),
      count: createMember("count", "P(i)", 8, 8),
      ptr: createMember("ptr", "P", 16, 4),
    },
  };
  const structCtor = {
    structName: "DummyStruct",
    structInfo,
    debugFlags: factory.debugFlags,
  };
  return { ctx, config, factory, structInfo, structCtor, heap };
};

describe("ensureConfig", () => {
  it("throws when config is missing", () => {
    expect(() => ensureConfig(undefined as never)).toThrow(
      /requires a config object/i,
    );
  });

  it("throws when heap is invalid", () => {
    const invalid = {
      heap: {} as never,
      alloc: () => 0,
      dealloc: () => {},
    };
    expect(() => ensureConfig(invalid)).toThrow(/heap/);
  });

  it("throws when alloc or dealloc are missing", () => {
    const heap = new WebAssembly.Memory({ initial: 1 });
    expect(() =>
      ensureConfig({
        heap,
        // @ts-expect-error - intentionally invalid
        alloc: undefined,
        dealloc: () => {},
      }),
    ).toThrow(/alloc/);
    expect(() =>
      ensureConfig({
        heap,
        alloc: () => 0,
        // @ts-expect-error - intentionally invalid
        dealloc: undefined,
      }),
    ).toThrow(/dealloc/);
  });

  it("accepts a valid configuration", () => {
    const heap = new WebAssembly.Memory({ initial: 1 });
    expect(() =>
      ensureConfig({
        heap,
        alloc: () => 0,
        dealloc: () => {},
      }),
    ).not.toThrow();
  });
});

describe("ensureDebugFlagFactories", () => {
  it("creates controllers and default flags", () => {
    const factory = {} as RequiredDebugSupport;
    ensureDebugFlagFactories(factory);
    expect(typeof factory.__makeDebugFlags).toBe("function");
    expect(typeof factory.debugFlags).toBe("function");

    const controller = factory.__makeDebugFlags();
    controller(DEBUG_FLAG_MASK.getter | DEBUG_FLAG_MASK.alloc);
    expect(controller().getter).toBe(true);
    expect(controller().alloc).toBe(true);

    controller(-1);
    expect(controller().getter).toBeUndefined();
    expect(controller().alloc).toBeUndefined();
  });

  it("inherits flags from a parent controller", () => {
    const factory = {} as RequiredDebugSupport;
    ensureDebugFlagFactories(factory);
    const parent = factory.__makeDebugFlags();
    parent(DEBUG_FLAG_MASK.setter);
    const child = factory.__makeDebugFlags(parent);
    expect(child().setter).toBe(true);
    child(DEBUG_FLAG_MASK.dealloc);
    expect(child().dealloc).toBe(true);
    expect(parent().dealloc).toBe(false);
  });
});

describe("createContext", () => {
  let setup: ReturnType<typeof createContextUnderTest>;

  beforeEach(() => {
    setup = createContextUnderTest();
  });

  it("builds prefixed member keys and lists", () => {
    const { ctx, structInfo } = setup;
    expect(ctx.memberKey("field")).toBe("sb_field_x");
    expect(ctx.memberKeys(structInfo)).toEqual([
      "sb_name_x",
      "sb_count_x",
      "sb_ptr_x",
    ]);
  });

  it("produces member signatures and Emscripten format", () => {
    const { ctx, structInfo } = setup;
    const instance: TestInstance = { structInfo };
    expect(ctx.memberSignature(instance, "count")).toBe("P(i)");
    expect(ctx.memberSignature(instance, "count", true)).toBe("ii");
  });

  it("handles C-string members", () => {
    const { ctx, structInfo } = setup;
    const instance: TestInstance = { structInfo };
    ctx.setMemberCString(instance, "name", "hello");
    expect(ctx.memberToJsString(instance, "name")).toBe("hello");
    const nameKey = structInfo.members.name.key;
    instance[nameKey] = 0;
    expect(ctx.memberToJsString(instance, "name")).toBeNull();
  });

  it("tracks writable pointers and enforces disposal rules", () => {
    const { ctx, structInfo, structCtor } = setup;
    const instance: TestInstance = { structInfo };
    const pointer = ctx.allocStruct(structCtor as never, instance);
    expect(ctx.pointerIsWritable(instance)).toBe(pointer);
    ctx.freeStruct(structCtor as never, instance);
    expect(() => ctx.pointerIsWritable(instance)).toThrow(/disposed instance/i);
  });

  it("coerces setter values for pointer signatures", () => {
    const { ctx, factory, structInfo } = setup;
    class DummyStruct {
      pointer?: number;
      constructor(pointer?: number) {
        this.pointer = pointer;
      }
    }
    ctx.setStructType(DummyStruct as never);
    const debugController = factory.debugFlags;
    debugController(DEBUG_FLAG_MASK.setter);
    const debugFlags = debugController();
    const instance = new DummyStruct(321);
    expect(
      ctx.coerceSetterValue(
        { signature: "P" },
        instance,
        debugFlags,
        "testProp",
      ),
    ).toBe(321);
    expect(
      ctx.coerceSetterValue(
        { signature: "P" },
        new DummyStruct(),
        debugFlags,
        "testProp",
      ),
    ).toBe(0);
    expect(() =>
      ctx.coerceSetterValue(
        { signature: "P" },
        { structInfo },
        debugFlags,
        "bad",
      ),
    ).toThrow(/Invalid value/i);
  });
});
