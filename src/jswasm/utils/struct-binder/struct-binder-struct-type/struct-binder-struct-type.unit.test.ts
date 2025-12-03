import { describe, expect, it, vi } from "vitest";

import { INTERNAL_STRUCT_TOKEN } from "../struct-binder-helpers/struct-binder-helpers";
import { createStructType } from "./struct-binder-struct-type";

describe("struct-binder-struct-type (JS baseline)", () => {
  const makeContext = () => {
    const structInfo = {
      name: "TestStruct",
      sizeof: 4,
      members: {},
    };
    const heap = new Uint8Array([1, 2, 3, 4, 5]);
    const context = {
      freeStruct: vi.fn(),
      lookupMember: vi.fn().mockReturnValue({ name: "m" }),
      memberToJsString: vi.fn().mockReturnValue("value"),
      memberIsString: vi.fn().mockReturnValue(true),
      memberKey: vi.fn().mockReturnValue("key"),
      memberKeys: vi.fn().mockReturnValue(["a", "b"]),
      memberSignature: vi.fn().mockReturnValue("x:i"),
      setMemberCString: vi.fn((instance) => instance),
      addOnDispose: vi.fn(),
      pointerOf: vi.fn(),
      hasExternalPointer: vi.fn().mockReturnValue(false),
      heap: vi.fn().mockReturnValue(heap),
      allocCString: vi.fn().mockReturnValue(123),
      setStructType: vi.fn(),
    };
    return { context, structInfo, heap };
  };

  it("enforces the internal token when constructing", () => {
    const { context, structInfo } = makeContext();
    const StructType = createStructType(context);
    const error = expect(
      () => new StructType("Name", structInfo, Symbol("bad")),
    );
    error.toThrow(/StructType constructor/);
    const instance = new StructType("Name", structInfo, INTERNAL_STRUCT_TOKEN);
    expect(instance.structName).toBe("Name");
    expect(instance.structInfo).toBe(structInfo);
  });

  it("delegates instance methods to the context", () => {
    const { context, structInfo } = makeContext();
    const StructType = createStructType(context);
    const instance = new StructType("Name", structInfo, INTERNAL_STRUCT_TOKEN);
    instance.lookupMember("field");
    expect(context.lookupMember).toHaveBeenCalledWith(
      structInfo,
      "field",
      true,
    );
    instance.memberToJsString("field");
    expect(context.memberToJsString).toHaveBeenCalledWith(instance, "field");
    instance.memberIsString("field", false);
    expect(context.memberIsString).toHaveBeenCalledWith(
      instance,
      "field",
      false,
    );
    instance.memberKey("field");
    expect(context.memberKey).toHaveBeenCalledWith("field");
    instance.memberKeys();
    expect(context.memberKeys).toHaveBeenCalledWith(structInfo);
    instance.memberSignature("field", true);
    expect(context.memberSignature).toHaveBeenCalledWith(
      instance,
      "field",
      true,
    );
    const same1 = instance.setMemberCString("field", "abc");
    expect(context.setMemberCString).toHaveBeenCalledWith(
      instance,
      "field",
      "abc",
    );
    expect(same1).toBe(instance);
    const same2 = instance.addOnDispose("a", "b");
    expect(context.addOnDispose).toHaveBeenCalledWith(instance, "a", "b");
    expect(same2).toBe(instance);
  });

  it("exposes pointer getter/setter behavior", () => {
    const { context, structInfo } = makeContext();
    context.pointerOf.mockReturnValue(321);
    const StructType = createStructType(context);
    const instance = new StructType("Name", structInfo, INTERNAL_STRUCT_TOKEN);
    expect(instance.pointer).toBe(321);
    expect(() => {
      Reflect.set(instance, "pointer", 0);
    }).toThrow(/Cannot assign.*pointer/i);
  });

  it("returns null memory dump if pointer undefined", () => {
    const { context, structInfo } = makeContext();
    context.pointerOf.mockReturnValue(undefined);
    const StructType = createStructType(context);
    const instance = new StructType("Name", structInfo, INTERNAL_STRUCT_TOKEN);
    expect(instance.memoryDump()).toBeNull();
  });

  it("slices the heap correctly for memory dumps", () => {
    const { context, structInfo, heap } = makeContext();
    context.pointerOf.mockReturnValue(1);
    const StructType = createStructType(context);
    const instance = new StructType("Name", structInfo, INTERNAL_STRUCT_TOKEN);
    const dump = instance.memoryDump();
    expect(dump).toEqual(new Uint8Array(heap.slice(1, 5)));
  });

  it("exposes static helpers and registers the struct type", () => {
    const { context, structInfo } = makeContext();
    const StructType = createStructType(context);
    expect(context.setStructType).toHaveBeenCalledWith(StructType);
    const instance = new StructType("Name", structInfo, INTERNAL_STRUCT_TOKEN);
    expect(StructType.allocCString("abc")).toBe(123);
    expect(context.allocCString).toHaveBeenCalledWith("abc");
    expect(StructType.isA({})).toBe(false);
    expect(StructType.isA(instance)).toBe(true);
    context.hasExternalPointer.mockReturnValueOnce(true);
    expect(StructType.hasExternalPointer(instance)).toBe(true);
    StructType.memberKey("field");
    expect(context.memberKey).toHaveBeenCalledWith("field");
  });
});
