import {
  INTERNAL_STRUCT_TOKEN,
  defineReadonly,
  toss,
} from "../struct-binder-helpers/struct-binder-helpers";

export interface Sqlite3StructMemberDescriptor {
  offset: number;
  sizeof: number;
  signature: string;
  key?: string;
  name?: string;
  readOnly?: boolean;
}

export interface Sqlite3StructDefinition {
  readonly name?: string;
  readonly sizeof: number;
  readonly members: Record<string, Sqlite3StructMemberDescriptor>;
}

/** Runtime shape for struct type instances created by the factory. */
export interface StructTypeInstance extends Record<string, unknown> {
  readonly structName: string;
  readonly structInfo: Sqlite3StructDefinition;
  dispose(): void;
  lookupMember(
    memberName: string,
    tossIfNotFound?: boolean,
  ): Sqlite3StructMemberDescriptor | null;
  memberToJsString(memberName: string): string | null;
  memberIsString(memberName: string, tossIfNotFound?: boolean): boolean;
  memberKey(memberName: string): string;
  memberKeys(): string[];
  memberSignature(memberName: string, emscriptenFormat?: boolean): string;
  memoryDump(): Uint8Array | null;
  setMemberCString(memberName: string, value: string): this;
  addOnDispose(...items: Array<unknown>): this;
  readonly pointer: number | undefined;
}

/** Constructor signature shared by StructType implementations. */
export type StructTypeClass = {
  new (
    structName: string,
    structInfo: Sqlite3StructDefinition,
    token: symbol,
  ): StructTypeInstance;
  allocCString(value: string): number;
  isA(value: unknown): value is StructTypeInstance;
  hasExternalPointer(value: StructTypeInstance): boolean;
  memberKey(memberName: string): string;
};

/** Context contract required by the StructType runtime. */
export interface StructTypeContext {
  freeStruct(structCtor: StructTypeClass, instance: StructTypeInstance): void;
  lookupMember(
    structInfo: Sqlite3StructDefinition,
    memberName: string,
    tossIfNotFound?: boolean,
  ): Sqlite3StructMemberDescriptor | null;
  memberToJsString(
    instance: StructTypeInstance,
    memberName: string,
  ): string | null;
  memberIsString(
    instance: StructTypeInstance,
    memberName: string,
    tossIfNotFound?: boolean,
  ): boolean;
  memberKey(memberName: string): string;
  memberKeys(structInfo: Sqlite3StructDefinition): string[];
  memberSignature(
    instance: StructTypeInstance,
    memberName: string,
    emscriptenFormat?: boolean,
  ): string;
  setMemberCString(
    instance: StructTypeInstance,
    memberName: string,
    value: string,
  ): StructTypeInstance;
  addOnDispose(instance: StructTypeInstance, ...items: Array<unknown>): void;
  pointerOf(instance: StructTypeInstance): number | undefined;
  hasExternalPointer(instance: StructTypeInstance): boolean;
  heap(): Uint8Array;
  allocCString(value: string): number;
  setStructType(structCtor: StructTypeClass): void;
}

/**
 * Creates the base StructType constructor responsible for delegating every
 * struct operation to the shared struct binder context.
 */
export const createStructType = (
  context: StructTypeContext,
): StructTypeClass => {
  // 1. Define the StructType class whose behavior is entirely driven by the context.
  class StructType implements StructTypeInstance {
    [key: string]: unknown;
    declare public readonly structName: string;
    declare public readonly structInfo: Sqlite3StructDefinition;
    declare public readonly pointer: number | undefined;
    declare static allocCString: (value: string) => number;
    declare static isA: (value: unknown) => value is StructTypeInstance;
    declare static hasExternalPointer: (value: StructTypeInstance) => boolean;
    declare static memberKey: (memberName: string) => string;

    constructor(
      structName: string,
      structInfo: Sqlite3StructDefinition,
      token: symbol,
    ) {
      if (token !== INTERNAL_STRUCT_TOKEN) {
        toss("Do not call the StructType constructor from client-level code.");
      }
      defineReadonly(this, "structName", structName);
      defineReadonly(this, "structInfo", structInfo);
    }

    /** Releases the struct instance through the shared context. */
    dispose(): void {
      const structCtor = this.constructor as StructTypeClass;
      context.freeStruct(structCtor, this);
    }

    /** Looks up a struct member definition via the context helper. */
    lookupMember(
      memberName: string,
      tossIfNotFound = true,
    ): Sqlite3StructMemberDescriptor | null {
      return context.lookupMember(this.structInfo, memberName, tossIfNotFound);
    }

    /** Converts the given member into a string using the context helper. */
    memberToJsString(memberName: string): string | null {
      return context.memberToJsString(this, memberName);
    }

    /** Checks whether the given member represents a string value. */
    memberIsString(memberName: string, tossIfNotFound = true): boolean {
      return context.memberIsString(this, memberName, tossIfNotFound);
    }

    /** Computes a unique key for a struct member name. */
    memberKey(memberName: string): string {
      return context.memberKey(memberName);
    }

    /** Lists every member key from the struct definition. */
    memberKeys(): string[] {
      return context.memberKeys(this.structInfo);
    }

    /** Produces the signature for the requested member. */
    memberSignature(memberName: string, emscriptenFormat = false): string {
      return context.memberSignature(this, memberName, emscriptenFormat);
    }

    /** Returns a copy of the struct's memory range or null if it is missing. */
    memoryDump(): Uint8Array | null {
      const pointer = context.pointerOf(this);
      if (!pointer) {
        return null;
      }
      const size = this.structInfo.sizeof;
      const heap = context.heap();
      return new Uint8Array(heap.slice(pointer, pointer + size));
    }

    /** Writes a C-string to the specified member and enables fluent chaining. */
    setMemberCString(memberName: string, value: string): this {
      context.setMemberCString(this, memberName, value);
      return this;
    }

    /** Registers dispose callbacks for the struct instance. */
    addOnDispose(...items: Array<unknown>): this {
      context.addOnDispose(this, ...items);
      return this;
    }
  }

  // 2. Define the pointer property with the same descriptors as the JS version.
  Object.defineProperty(StructType.prototype, "pointer", {
    configurable: false,
    enumerable: false,
    get(): number | undefined {
      return context.pointerOf(this as StructTypeInstance);
    },
    set() {
      toss("Cannot assign the 'pointer' property of a struct.");
    },
  });

  // 3. Attach static helpers and expose the constructor through the context.
  defineReadonly(StructType, "allocCString", (value: string) =>
    context.allocCString(value),
  );
  defineReadonly(
    StructType,
    "isA",
    (value: unknown) => value instanceof StructType,
  );
  defineReadonly(
    StructType,
    "hasExternalPointer",
    (value: StructTypeInstance) =>
      value instanceof StructType && context.hasExternalPointer(value),
  );
  defineReadonly(StructType, "memberKey", (memberName: string) =>
    context.memberKey(memberName),
  );

  context.setStructType(StructType);
  return StructType;
};
