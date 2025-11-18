import { beforeEach, describe, expect, it } from "vitest";
import type {
  Sqlite3StructBinderConfig,
  Sqlite3StructInstance,
} from "../../struct-binder-factory/types.d.ts";
import { StructBinderFactory } from "./struct-binder-factory";

const createConfig = (): Sqlite3StructBinderConfig => {
  const buffer = new ArrayBuffer(1024);
  const heapView = new Uint8Array(buffer);
  let offset = 8;

  return {
    heap: () => heapView,
    alloc(size: number) {
      if (offset + size > heapView.byteLength) {
        throw new Error("Out of memory");
      }
      const pointer = offset;
      offset += size;
      return pointer;
    },
    dealloc() {
      return undefined;
    },
    ptrSizeof: 4,
    ptrIR: "i32",
  };
};

const structInfo = {
  name: "Point",
  sizeof: 16,
  members: {
    x: { signature: "i", offset: 0, sizeof: 4 },
    y: { signature: "i", offset: 4, sizeof: 4 },
    child: { signature: "P", offset: 8, sizeof: 4 },
  },
};

describe("StructBinderFactory", () => {
  beforeEach(() => {
    StructBinderFactory.debugFlags?.(-1);
    StructBinderFactory.debugFlags?.(0);
  });

  it("throws when config is missing or invalid", () => {
    expect(() => StructBinderFactory(undefined as never)).toThrow(
      "StructBinderFactory requires a config object.",
    );
    const partialConfig = {
      heap: () => new Uint8Array(4),
      alloc: () => 0,
    };
    expect(() => StructBinderFactory(partialConfig as never)).toThrow(
      "Config option 'dealloc' must be a function.",
    );
  });

  it("creates a struct with readable and writable members", () => {
    const config = createConfig();
    const binder = StructBinderFactory(config);
    const StructCtor = binder(structInfo);
    const instance = new StructCtor() as Sqlite3StructInstance & {
      x: number;
      y: number;
    };

    instance.x = 42;
    instance.y = 7;
    expect(instance.x).toBe(42);
    expect(instance.y).toBe(7);

    instance.dispose();
  });

  it("exposes struct metadata helpers", () => {
    const binder = StructBinderFactory({
      ...createConfig(),
      memberPrefix: "__",
      memberSuffix: "__",
    });
    const StructCtor = binder(structInfo);
    const instance = new StructCtor();

    expect(StructCtor.structInfo).toBe(structInfo);
    expect(StructCtor.structName).toBe("Point");
    expect(StructCtor.isA(instance)).toBe(true);
    expect(StructCtor.isA({})).toBe(false);
    expect(StructCtor.memberKeys(structInfo)).toEqual([
      "__x__",
      "__y__",
      "__child__",
    ]);
    expect(StructCtor.memberKey("x")).toBe("__x__");

    instance.dispose();
  });

  it("provides debug flag controllers on the factory and struct", () => {
    const binder = StructBinderFactory(createConfig());
    const StructCtor = binder(structInfo);

    const factoryFlags = StructBinderFactory.debugFlags?.();
    expect(factoryFlags).toMatchObject({
      getter: false,
      setter: false,
      alloc: false,
      dealloc: false,
    });

    StructBinderFactory.debugFlags?.(0x01 | 0x02 | 0x04 | 0x08);

    const ctorFlags = StructCtor.debugFlags?.();
    expect(ctorFlags).toMatchObject({
      getter: true,
      setter: true,
      alloc: true,
      dealloc: true,
    });

    expect(StructCtor.prototype.debugFlags?.()).toBe(ctorFlags);
  });
});
