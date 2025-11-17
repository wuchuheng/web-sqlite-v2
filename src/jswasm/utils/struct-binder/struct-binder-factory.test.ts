import { describe, expect, it } from "vitest";
import { StructBinderFactory } from "./struct-binder-factory-wrapper.ts";

interface StructBinderFactoryConfig {
  heap: WebAssembly.Memory | (() => Uint8Array);
  alloc(size: number): number;
  dealloc(pointer: number): void;
  log?: (...items: unknown[]) => void;
  memberPrefix?: string;
  memberSuffix?: string;
  bigIntEnabled?: boolean;
  ptrSizeof?: number;
  ptrIR?: string;
}

const createConfig = (): StructBinderFactoryConfig => {
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
    const instance = new StructCtor();

    instance.x = 42;
    instance.y = 7;
    expect(instance.x).toBe(42);
    expect(instance.y).toBe(7);

    instance.dispose();
  });
});
