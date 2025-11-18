import {
  toss,
  isNumericValue,
} from "../struct-binder-helpers/struct-binder-helpers";

type StructInfoMember = {
  key: string;
  signature: string;
};

type StructInfo = {
  members: Record<string, StructInfoMember>;
};

export type StructInstance = {
  structInfo: StructInfo;
  [key: string]: unknown;
};

type MemoryHelpers = {
  lookupMember(
    structInfo: StructInfo,
    memberName: string,
    tossIfNotFound?: boolean,
  ): StructInfoMember | null;
  assertCStringSignature(member: StructInfoMember): void;
  pointerOf(instance: StructInstance): number | undefined;
  allocCString(value: string): number;
  addOnDispose(instance: StructInstance, pointer: number): void;
  decodeCString(heap: Uint8Array, pointer: number): string;
};

type SignatureHelper = {
  isAutoPointer(signature: string): boolean;
};

type StructRefValue = {
  pointer?: number;
};

type StructTypeRefConstructor = {
  new (...args: unknown[]): StructRefValue;
};

type StructTypeRefAccessor = {
  get(): StructTypeRefConstructor | null;
};

type DebugFlags = {
  setter?: boolean;
};

type MemberHelpersConfig = {
  memoryHelpers: MemoryHelpers;
  signature: SignatureHelper;
  log: (...items: unknown[]) => void;
  viewHeap(): Uint8Array;
  StructTypeRefAccessor: StructTypeRefAccessor;
};

export const createMemberHelpers = (config: MemberHelpersConfig) => {
  const { memoryHelpers, signature, log, viewHeap, StructTypeRefAccessor } =
    config;
  const {
    lookupMember,
    assertCStringSignature,
    pointerOf,
    allocCString,
    addOnDispose,
    decodeCString,
  } = memoryHelpers;

  const getRequiredMember = (
    instance: StructInstance,
    memberName: string,
  ): StructInfoMember => {
    const member = lookupMember(instance.structInfo, memberName, true);
    if (!member) {
      toss("Struct member", memberName, "is not mapped.");
    }
    return member as StructInfoMember;
  };

  const memberToJsString = (
    instance: StructInstance,
    memberName: string,
  ): string | null => {
    const member = getRequiredMember(instance, memberName);
    assertCStringSignature(member);
    const pointer = instance[member.key] as number | undefined;
    if (!pointer) return null;
    return decodeCString(viewHeap(), pointer);
  };

  const memberIsString = (
    instance: StructInstance,
    memberName: string,
    tossIfNotFound = false,
  ) => {
    const member = lookupMember(
      instance.structInfo,
      memberName,
      tossIfNotFound,
    );
    return Boolean(
      member && member.signature.length === 1 && member.signature[0] === "s",
    );
  };

  const memberSignature = (
    instance: StructInstance,
    memberName: string,
    emscriptenFormat = false,
  ) => {
    const member = getRequiredMember(instance, memberName);
    if (!emscriptenFormat) return member.signature;
    return member.signature
      .replace(/[^vipPsjfdcC]/g, "")
      .replace(/[pPscC]/g, "i");
  };

  const setMemberCString = (
    instance: StructInstance,
    memberName: string,
    value: string,
  ) => {
    const member = getRequiredMember(instance, memberName);
    assertCStringSignature(member);
    const pointer = allocCString(value);
    instance[member.key] = pointer;
    addOnDispose(instance, pointer);
    return instance;
  };

  const pointerIsWritable = (instance: StructInstance) => {
    const pointer = pointerOf(instance);
    if (!pointer) toss("Cannot set struct property on disposed instance.");
    return pointer;
  };

  const coerceSetterValue = (
    descriptor: { signature: string },
    value: unknown,
    debugFlags: DebugFlags = {},
    propertyLabel = "member",
  ) => {
    if (value === null) return 0;
    if (isNumericValue(value)) return value;

    const StructTypeRefValue = StructTypeRefAccessor.get();
    if (
      signature.isAutoPointer(descriptor.signature) &&
      StructTypeRefValue &&
      value instanceof StructTypeRefValue
    ) {
      const pointer = value.pointer ?? 0;
      if (debugFlags.setter) {
        log("debug.setter:", propertyLabel, "resolved to", pointer);
      }
      return pointer;
    }

    toss("Invalid value for pointer-type", propertyLabel + ".");
  };

  return {
    memberToJsString,
    memberIsString,
    memberSignature,
    setMemberCString,
    pointerIsWritable,
    coerceSetterValue,
  };
};
