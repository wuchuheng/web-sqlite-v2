import { describe, expect, it, vi } from "vitest";
import { createMemberHelpers } from "./struct-binder-members";
import type { StructInstance } from "./struct-binder-members";

const createTestContext = () => {
  const decodeMap = new Map<number, string>();
  let nextPointer = 100;
  const disposeLog: number[] = [];

  const structInfo = {
    name: "MockStruct",
    members: {
      stringMember: { signature: "s", key: "stringMemberPtr" },
      mixedMember: { signature: "si", key: "mixedMemberPtr" },
      pointerMember: { signature: "P", key: "pointerMemberPtr" },
    },
  } as const;

  class StructRefValue {
    pointer: number;
    constructor(...args: unknown[]) {
      const first = args[0];
      this.pointer = typeof first === "number" ? first : 0;
    }
  }

  const memoryHelpers = {
    lookupMember(
      info: typeof structInfo,
      memberName: string,
      tossIfNotFound = true,
    ) {
      const member = info.members[memberName as keyof typeof info.members];
      if (!member && tossIfNotFound) {
        throw new Error("Missing struct member");
      }
      return member ?? null;
    },
    assertCStringSignature(member: { signature: string }) {
      if (member.signature !== "s") {
        throw new Error("Invalid C-string signature");
      }
    },
    pointerOf(instance: Record<string, unknown>) {
      const pointer = instance.pointer;
      return typeof pointer === "number" ? pointer : 0;
    },
    allocCString(value: string) {
      const pointer = nextPointer++;
      decodeMap.set(pointer, value);
      return pointer;
    },
    addOnDispose(_instance: Record<string, unknown>, pointer: number) {
      disposeLog.push(pointer);
    },
    decodeCString(_heap: Uint8Array, pointer: number) {
      return decodeMap.get(pointer) ?? "";
    },
  };

  const signature = {
    isAutoPointer(sig: string) {
      return sig === "P" || sig === "p";
    },
  };

  const log = vi.fn();
  const StructTypeRefAccessor = {
    get: () => StructRefValue,
  };

  const helpers = createMemberHelpers({
    memoryHelpers,
    signature,
    log,
    viewHeap: () => new Uint8Array(16),
    StructTypeRefAccessor,
  });

  return {
    helpers,
    structInfo,
    decodeMap,
    disposeLog,
    log,
    StructRefValue,
  };
};

describe("createMemberHelpers", () => {
  it("decodes string members and returns null for zero pointers", () => {
    const { helpers, structInfo, decodeMap } = createTestContext();
    const pointer = 123;
    decodeMap.set(pointer, "hello");
    const instance: StructInstance = {
      structInfo,
      stringMemberPtr: pointer,
    };

    expect(helpers.memberToJsString(instance, "stringMember")).toBe("hello");
    instance.stringMemberPtr = 0;
    expect(helpers.memberToJsString(instance, "stringMember")).toBeNull();
  });

  it("identifies string members and respects tossIfNotFound", () => {
    const { helpers, structInfo } = createTestContext();
    const instance: StructInstance = { structInfo };

    expect(helpers.memberIsString(instance, "stringMember")).toBe(true);
    expect(helpers.memberIsString(instance, "missingMember", false)).toBe(
      false,
    );
  });

  it("returns raw and emscripten-style signatures", () => {
    const { helpers, structInfo } = createTestContext();
    const instance: StructInstance = { structInfo };

    expect(helpers.memberSignature(instance, "mixedMember")).toBe("si");
    expect(helpers.memberSignature(instance, "mixedMember", true)).toBe("ii");
  });

  it("writes C strings, records disposal, and returns the instance", () => {
    const { helpers, structInfo, disposeLog } = createTestContext();
    const instance: StructInstance = { structInfo };

    const result = helpers.setMemberCString(instance, "stringMember", "foo");
    const pointer = instance.stringMemberPtr as number;

    expect(result).toBe(instance);
    expect(typeof pointer).toBe("number");
    expect(disposeLog).toContain(pointer);
  });

  it("validates pointer writability", () => {
    const { helpers, structInfo } = createTestContext();
    const disposedInstance: StructInstance = {
      structInfo,
      pointer: 0,
    };
    const liveInstance: StructInstance = {
      structInfo,
      pointer: 42,
    };

    expect(() => helpers.pointerIsWritable(disposedInstance)).toThrow(
      "Cannot set struct property on disposed instance.",
    );
    expect(helpers.pointerIsWritable(liveInstance)).toBe(42);
  });

  it("coerces setter values and logs pointer resolution", () => {
    const { helpers, log, StructRefValue } = createTestContext();

    expect(
      helpers.coerceSetterValue({ signature: "P" }, null, {}, "child"),
    ).toBe(0);
    expect(helpers.coerceSetterValue({ signature: "P" }, 5, {}, "child")).toBe(
      5,
    );

    const pointerInstance = new StructRefValue(555);
    const pointer = helpers.coerceSetterValue(
      { signature: "P" },
      pointerInstance,
      { setter: true },
      "child",
    );

    expect(pointer).toBe(555);
    expect(log).toHaveBeenCalledWith(
      "debug.setter:",
      "child",
      "resolved to",
      555,
    );
    expect(() =>
      helpers.coerceSetterValue({ signature: "P" }, "bad", {}, "child"),
    ).toThrow("Invalid value for pointer-type child.");
  });
});
