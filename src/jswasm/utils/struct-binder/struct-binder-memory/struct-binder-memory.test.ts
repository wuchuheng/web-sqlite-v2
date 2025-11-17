import { describe, expect, test, vi } from "vitest";
import { createMemoryHelpers } from "./struct-binder-memory";

type StructCtorStub = {
  structName: string;
  structInfo: {
    sizeof: number;
    members: Record<
      string,
      {
        key: string;
        signature: string;
      }
    >;
  };
  debugFlags: {
    __flags: {
      alloc?: boolean;
      dealloc?: boolean;
    };
  };
};

type StructInfoStub = {
  name: string;
  sizeof: number;
  members: Record<string, { key: string; signature: string }>;
};

const createStructCtor = (
  overrides?: Partial<StructCtorStub["structInfo"]>,
): StructCtorStub => ({
  structName: "ExampleStruct",
  structInfo: {
    sizeof: 16,
    members: {},
    ...overrides,
  },
  debugFlags: {
    __flags: {
      alloc: false,
      dealloc: false,
    },
  },
});

const createMemoryTestEnv = (options?: {
  memberPrefix?: string;
  memberSuffix?: string;
}) => {
  const heapBuffer = new Uint8Array(1024);
  let nextPointer = 1;
  const pointerMap = new Map<object, number>();
  const externalPointers = new Map<object, boolean>();
  const log = vi.fn();
  const describeMember = (structName: string, memberName: string) =>
    `${structName}::${memberName}`;
  const structDisposed = { count: 0 };

  class StructRef {
    dispose() {
      structDisposed.count += 1;
    }
  }

  let structTypeRefCtor: typeof StructRef | null = StructRef;
  const StructTypeRefAccessor = {
    get: () => structTypeRefCtor,
    set: (value: typeof StructRef | null) => {
      structTypeRefCtor = value;
    },
  };

  const alloc = vi.fn((size: number) => {
    const pointer = nextPointer;
    nextPointer += size;
    return pointer;
  });
  const deallocated: number[] = [];
  const dealloc = vi.fn((pointer: number) => {
    deallocated.push(pointer);
  });

  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder("utf-8");
  const sabCtor =
    typeof SharedArrayBuffer !== "undefined" ? SharedArrayBuffer : null;

  const memoryHelpers = createMemoryHelpers({
    alloc,
    dealloc,
    log,
    memberPrefix: options?.memberPrefix ?? "",
    memberSuffix: options?.memberSuffix ?? "",
    pointerMap,
    externalPointers,
    viewHeap: () => heapBuffer,
    textEncoder,
    textDecoder,
    sabCtor,
    describeMember,
    StructTypeRefAccessor,
  });

  return {
    memoryHelpers,
    alloc,
    dealloc,
    deallocated,
    pointerMap,
    externalPointers,
    heapBuffer,
    describeMember,
    structDisposed,
    textDecoder,
    textEncoder,
    StructTypeRefAccessor,
    createStructRef: () =>
      new (StructTypeRefAccessor.get() as typeof StructRef)(),
  };
};

describe("struct-binder-memory helpers", () => {
  test("allocStruct zeroes memory and records pointer", () => {
    const env = createMemoryTestEnv();
    const structCtor = createStructCtor({ sizeof: 8 });
    const instance = {};
    env.heapBuffer.fill(0xff);

    env.memoryHelpers.allocStruct(structCtor, instance);
    const pointer = env.pointerMap.get(instance);

    expect(pointer).toBeDefined();
    expect(pointer).toBeGreaterThan(0);
    expect(env.heapBuffer.slice(pointer!, pointer! + 8)).toEqual(
      new Uint8Array(8),
    );
  });

  test("allocStruct honors external pointer flag", () => {
    const env = createMemoryTestEnv();
    const structCtor = createStructCtor({ sizeof: 4 });
    const instance = {};
    const externalPointer = 42;

    env.memoryHelpers.allocStruct(structCtor, instance, externalPointer);

    expect(env.pointerMap.get(instance)).toBe(externalPointer);
    expect(env.externalPointers.get(instance)).toBe(true);
    env.memoryHelpers.freeStruct(structCtor, instance);
    expect(env.deallocated).not.toContain(externalPointer);
  });

  test("freeStruct disposes handlers and deallocates non-external memory", () => {
    const env = createMemoryTestEnv();
    const structCtor = createStructCtor();
    const disposableSpy = vi.fn();
    const instance = {};

    env.memoryHelpers.allocStruct(structCtor, instance);
    const pointer = env.pointerMap.get(instance)!;
    const structRef = env.createStructRef();
    env.memoryHelpers.addOnDispose(instance, disposableSpy, structRef, 999);

    env.memoryHelpers.freeStruct(structCtor, instance);

    expect(env.pointerMap.get(instance)).toBeUndefined();
    expect(disposableSpy).toHaveBeenCalled();
    expect(env.structDisposed.count).toBe(1);
    expect(env.deallocated).toContain(pointer);
    expect(env.deallocated).toContain(999);
  });

  test("allocCString writes null-terminated data", () => {
    const env = createMemoryTestEnv();
    const pointer = env.memoryHelpers.allocCString("hello");

    const buffer = env.heapBuffer.subarray(pointer, pointer + 6);
    expect(buffer[5]).toBe(0);
    expect(
      env.textDecoder.decode(env.heapBuffer.subarray(pointer, pointer + 5)),
    ).toBe("hello");
  });

  test("decodeCString reads SharedArrayBuffer-backed memory", () => {
    const env = createMemoryTestEnv();
    if (!env.memoryHelpers) return;

    const shared = new SharedArrayBuffer(32);
    const view = new Uint8Array(shared);
    const encoded = new TextEncoder().encode("viewer");
    view.set(encoded, 0);
    view[encoded.length] = 0;

    const result = env.memoryHelpers.decodeCString(view, 0);
    expect(result).toBe("viewer");
  });

  test("lookupMember uses member key fallback and throws when missing", () => {
    const env = createMemoryTestEnv({ memberPrefix: "pref_" });
    const structInfo: StructInfoStub = {
      name: "PrefStruct",
      sizeof: 16,
      members: {
        foo: { key: "pref_bar", signature: "s" },
      },
    };

    const member = env.memoryHelpers.lookupMember(structInfo, "pref_bar");
    expect(member?.key).toBe("pref_bar");

    expect(() =>
      env.memoryHelpers.lookupMember(structInfo, "missing"),
    ).toThrow();
  });

  test("assertCStringSignature enforces string signature", () => {
    const env = createMemoryTestEnv();
    env.memoryHelpers.assertCStringSignature({
      key: "foo",
      signature: "s",
    });

    expect(() =>
      env.memoryHelpers.assertCStringSignature({
        key: "foo",
        signature: "i",
      }),
    ).toThrow();
  });

  test("validateExternalPointer accepts only positive integers", () => {
    const env = createMemoryTestEnv();
    expect(env.memoryHelpers.validateExternalPointer("struct", 10)).toBe(10);
    expect(() =>
      env.memoryHelpers.validateExternalPointer("struct", -1),
    ).toThrow();
    expect(() =>
      env.memoryHelpers.validateExternalPointer(
        "struct",
        "NaN" as unknown as number,
      ),
    ).toThrow();
  });
});
