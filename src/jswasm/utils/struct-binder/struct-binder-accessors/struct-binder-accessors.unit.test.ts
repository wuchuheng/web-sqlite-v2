import { describe, expect, it } from "vitest";
import {
  defineMemberAccessors,
  normalizeStructArgs,
  validateMemberSignature,
  validateStructDefinition,
} from "./struct-binder-accessors";
import type {
  StructBinderAccessorContext,
  StructDefinition,
  StructSignatureHelpers,
} from "./struct-binder-accessors";

type TestContext = StructBinderAccessorContext & {
  heap: () => Uint8Array;
  pointerOf: (instance: object) => number;
  pointerIsWritable: (instance: object) => number;
  coerceSetterValue: (
    descriptor: Record<string, unknown>,
    value: unknown,
  ) => unknown;
  signature: StructSignatureHelpers;
  log: (...args: unknown[]) => void;
  littleEndian: boolean;
};

const createStructConstructor = () => {
  type StructCtor = {
    prototype: {
      debugFlags: { __flags: Record<string, boolean> };
    };
    structName: string;
    memberKey: (name: string) => string;
    new (): Record<string, unknown>;
  };

  const ctor = function (
    this: Record<string, unknown>,
  ) {} as unknown as StructCtor;
  ctor.structName = "TestStruct";
  ctor.memberKey = (name) => `_${name}`;
  ctor.prototype.debugFlags = {
    __flags: {
      getter: false,
      setter: false,
      alloc: false,
      dealloc: false,
    },
  };
  return ctor;
};

const createTestContext = () => {
  const buffer = new ArrayBuffer(64);
  const heapView = new Uint8Array(buffer);
  const pointerMap = new WeakMap<object, number>();
  const logEntries: unknown[][] = [];
  const signature: StructSignatureHelpers = {
    getterFor: () => "getInt32",
    setterFor: () => "setInt32",
    wrapForSet: () => (value: unknown) => value,
    irFor: (sig: string) => sig,
  };

  const context: TestContext & {
    assignPointer: (instance: object, pointer: number) => void;
    getLog: () => unknown[][];
  } = {
    heap: () => heapView,
    pointerOf(instance: object) {
      const pointer = pointerMap.get(instance);
      if (pointer === undefined) throw new Error("Pointer not set");
      return pointer;
    },
    pointerIsWritable(instance: object) {
      const pointer = pointerMap.get(instance);
      if (pointer === undefined) throw new Error("Pointer not set");
      return pointer;
    },
    coerceSetterValue: (_descriptor, value) => value,
    signature,
    log: (...args) => logEntries.push([...args]),
    littleEndian: true,
    assignPointer(instance: object, pointer: number) {
      pointerMap.set(instance, pointer);
    },
    getLog: () => logEntries,
  };

  return context;
};

describe("struct-binder-accessors", () => {
  describe("validateStructDefinition", () => {
    it("accepts valid, aligned structs", () => {
      const info = {
        name: "Aligned",
        sizeof: 8,
        members: {
          value: { sizeof: 4, offset: 0, signature: "i" },
        },
      };
      expect(() => validateStructDefinition("Aligned", info)).not.toThrow();
    });

    it("throws when members are missing or misaligned", () => {
      const missingMembers = {
        name: "Missing",
        sizeof: 4,
      } as StructDefinition;
      expect(() =>
        validateStructDefinition("Missing", missingMembers),
      ).toThrow();

      const badMember = {
        name: "Bad",
        sizeof: 8,
        members: {
          field: { sizeof: 2, offset: 1, signature: "i" },
        },
      };
      expect(() => validateStructDefinition("Bad", badMember)).toThrow();

      const pastStruct = {
        name: "Past",
        sizeof: 4,
        members: {
          field: { sizeof: 8, offset: 0, signature: "i" },
        },
      };
      expect(() => validateStructDefinition("Past", pastStruct)).toThrow();
    });
  });

  describe("validateMemberSignature", () => {
    it("rejects duplicate member keys", () => {
      const ctor = createStructConstructor();
      Object.defineProperty(ctor.prototype, "_value", {
        value: 0,
        enumerable: false,
      });
      expect(() =>
        validateMemberSignature(ctor, "value", "_value", "i"),
      ).toThrow();
    });

    it("rejects malformed signatures", () => {
      const ctor = createStructConstructor();
      expect(() =>
        validateMemberSignature(ctor, "value", "_value", "z"),
      ).toThrow();
    });
  });

  describe("defineMemberAccessors", () => {
    it("wires getters/setters and respects debug logging", () => {
      const context = createTestContext();
      const ctor = createStructConstructor();
      ctor.prototype.debugFlags.__flags.getter = true;
      ctor.prototype.debugFlags.__flags.setter = true;
      const descriptor = { sizeof: 4, offset: 0, signature: "i" };
      defineMemberAccessors(ctor, "value", descriptor, context);

      const instance = new ctor();
      context.assignPointer(instance, 0);
      const buffer = new DataView(context.heap().buffer);
      buffer.setInt32(0, 23, context.littleEndian);
      expect(instance._value).toBe(23);

      instance._value = 42;
      expect(buffer.getInt32(0, context.littleEndian)).toBe(42);

      const logs = context.getLog();
      expect(logs.length).toBeGreaterThan(0);
      expect((logs[0][0] as string).startsWith("debug.getter")).toBe(true);
    });

    it("throws when setter is read-only", () => {
      const context = createTestContext();
      const ctor = createStructConstructor();
      const descriptor = {
        sizeof: 4,
        offset: 0,
        signature: "i",
        readOnly: true,
      };
      defineMemberAccessors(ctor, "value", descriptor, context);

      const instance = new ctor();
      context.assignPointer(instance, 0);
      expect(() => {
        (instance as Record<string, unknown>)._value = 1;
      }).toThrow();
    });
  });

  describe("normalizeStructArgs", () => {
    it("uses structName when info lacks a name", () => {
      const info = { members: {}, sizeof: 0 } as StructDefinition;
      const normalized = normalizeStructArgs("Named", info);
      expect(normalized.name).toBe("Named");
      expect(normalized.info.name).toBe("Named");
    });

    it("returns the supplied info when it already has a name", () => {
      const info = {
        name: "PreNamed",
        members: {},
        sizeof: 0,
      } as StructDefinition;
      const normalized = normalizeStructArgs(info);
      expect(normalized.name).toBe("PreNamed");
      expect(normalized.info).toBe(info);
    });

    it("throws when no name is provided", () => {
      expect(() => normalizeStructArgs({} as StructDefinition)).toThrow(
        "Struct name is required.",
      );
    });
  });
});
