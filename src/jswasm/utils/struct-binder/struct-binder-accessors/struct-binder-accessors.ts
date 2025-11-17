import {
  RX_SIG_FUNCTION,
  RX_SIG_SIMPLE,
  describeMember,
  toss,
} from "../struct-binder-helpers/struct-binder-helpers.js";

export type StructMemberDescriptor = {
  key?: string;
  name?: string;
  sizeof: number;
  offset: number;
  signature: string;
  readOnly?: boolean;
};

export type StructDefinition = {
  name?: string;
  sizeof: number;
  members: Record<string, StructMemberDescriptor>;
};

export type StructDefinitionWithName = StructDefinition & { name: string };

export type AccessorDebugFlags = {
  getter?: boolean;
  setter?: boolean;
  alloc?: boolean;
  dealloc?: boolean;
};

export type StructPrototype = {
  debugFlags: {
    __flags: AccessorDebugFlags;
  };
} & Record<string, unknown>;

export type StructConstructor = {
  prototype: StructPrototype;
  structName: string;
  memberKey(memberName: string): string;
};

type DataViewAccessor = (byteOffset: number, littleEndian?: boolean) => unknown;
type DataViewWriter = (
  byteOffset: number,
  value: unknown,
  littleEndian?: boolean,
) => void;

export type StructSignatureHelpers = {
  getterFor(signature: string): keyof DataView;
  setterFor(signature: string): keyof DataView | undefined;
  wrapForSet(signature: string): (value: unknown) => unknown;
  irFor(signature: string): string;
};

export type StructBinderAccessorContext = {
  heap(): Uint8Array;
  pointerOf(instance: object): number;
  pointerIsWritable(instance: object): number;
  coerceSetterValue(
    descriptor: StructMemberDescriptor,
    value: unknown,
    debugFlags: AccessorDebugFlags,
    propertyLabel: string,
  ): unknown;
  signature: StructSignatureHelpers;
  log(...values: unknown[]): void;
  littleEndian: boolean;
};

export const validateStructDefinition = (
  structName: string,
  structInfo: StructDefinition,
): void => {
  if (!structInfo || typeof structInfo !== "object") {
    toss("Struct definition is required for", structName);
  }
  if (!structInfo.members || typeof structInfo.members !== "object") {
    toss("Struct", structName, "is missing member descriptions.");
  }

  let lastMember: StructMemberDescriptor | null = null;
  for (const key of Object.keys(structInfo.members)) {
    const member = structInfo.members[key];
    if (!member.sizeof) {
      toss(structName, "member", key, "is missing sizeof.");
    } else if (member.sizeof === 1) {
      if (member.signature !== "c" && member.signature !== "C") {
        toss(
          "Unexpected sizeof==1 member",
          describeMember(structInfo.name || structName, key),
          "with signature",
          member.signature,
        );
      }
    } else {
      if (member.sizeof % 4 !== 0) {
        console.warn(
          "Invalid struct member description =",
          member,
          "from",
          structInfo,
        );
        toss(
          structName,
          "member",
          key,
          "sizeof is not aligned. sizeof=" + member.sizeof,
        );
      }
      if (member.offset % 4 !== 0) {
        console.warn(
          "Invalid struct member description =",
          member,
          "from",
          structInfo,
        );
        toss(
          structName,
          "member",
          key,
          "offset is not aligned. offset=" + member.offset,
        );
      }
    }
    if (!lastMember || lastMember.offset < member.offset) {
      lastMember = member;
    }
  }

  if (!lastMember) {
    toss("No member property descriptions found.");
  } else if (structInfo.sizeof < lastMember.offset + lastMember.sizeof) {
    toss(
      "Invalid struct config:",
      structName,
      "max member offset (" + lastMember.offset + ") ",
      "extends past end of struct (sizeof=" + structInfo.sizeof + ").",
    );
  }
};

export const validateMemberSignature = (
  structCtor: StructConstructor,
  memberName: string,
  key: string,
  signature: string,
): void => {
  if (Object.prototype.hasOwnProperty.call(structCtor.prototype, key)) {
    toss(structCtor.structName, "already has a property named", key + ".");
  }
  if (!RX_SIG_SIMPLE.test(signature) && !RX_SIG_FUNCTION.test(signature)) {
    toss(
      "Malformed signature for",
      describeMember(structCtor.structName, memberName) + ":",
      signature,
    );
  }
};

export const defineMemberAccessors = (
  structCtor: StructConstructor,
  memberName: string,
  descriptor: StructMemberDescriptor,
  context: StructBinderAccessorContext,
): void => {
  const key = structCtor.memberKey(memberName);
  validateMemberSignature(structCtor, memberName, key, descriptor.signature);

  descriptor.key = key;
  descriptor.name = memberName;

  const propertyLabel = describeMember(structCtor.structName, key);
  const getterName = context.signature.getterFor(descriptor.signature);
  const setterName = descriptor.readOnly
    ? undefined
    : context.signature.setterFor(descriptor.signature);
  const wrapValue =
    setterName && context.signature.wrapForSet(descriptor.signature);
  const debugFlags = structCtor.prototype.debugFlags.__flags;
  const ir = context.signature.irFor(descriptor.signature);

  Object.defineProperty(structCtor.prototype, key, {
    configurable: false,
    enumerable: false,
    get(this: object) {
      const pointer = context.pointerOf(this);
      if (debugFlags.getter) {
        context.log(
          "debug.getter:",
          getterName,
          "for",
          ir,
          propertyLabel,
          "@",
          pointer,
          "+",
          descriptor.offset,
          "sz",
          descriptor.sizeof,
        );
      }
      const view = new DataView(
        context.heap().buffer,
        pointer + descriptor.offset,
        descriptor.sizeof,
      );
      const getter = view[getterName] as DataViewAccessor;
      const result = getter.call(view, 0, context.littleEndian);
      if (debugFlags.getter) {
        context.log("debug.getter:", propertyLabel, "result =", result);
      }
      return result;
    },
    set:
      setterName === undefined
        ? () => {
            toss(propertyLabel, "is read-only.");
          }
        : function setStructMember(this: object, value: unknown) {
            if (debugFlags.setter) {
              context.log(
                "debug.setter:",
                setterName,
                "for",
                ir,
                propertyLabel,
                "@",
                context.pointerOf(this),
                "+",
                descriptor.offset,
                "sz",
                descriptor.sizeof,
                value,
              );
            }
            const pointer = context.pointerIsWritable(this);
            const resolvedValue = context.coerceSetterValue(
              descriptor,
              value,
              debugFlags,
              propertyLabel,
            );
            const view = new DataView(
              context.heap().buffer,
              pointer + descriptor.offset,
              descriptor.sizeof,
            );
            const setter = view[setterName!] as DataViewWriter;
            setter.call(
              view,
              0,
              wrapValue!(resolvedValue),
              context.littleEndian,
            );
          },
  });
};

export const normalizeStructArgs = (
  structNameOrInfo: string | StructDefinition,
  structInfo?: StructDefinition,
): { name: string; info: StructDefinitionWithName } => {
  let name: string | undefined =
    typeof structNameOrInfo === "string" ? structNameOrInfo : undefined;
  let info = structInfo;

  if (info === undefined) {
    info = structNameOrInfo as StructDefinition;
    name = info?.name;
  } else if (!info.name && typeof structNameOrInfo === "string") {
    info.name = structNameOrInfo;
  }

  if (!info) toss("Struct definition is required.");
  const finalName = name ?? info.name;
  if (!finalName) toss("Struct name is required.");
  info.name = finalName;

  return {
    name: finalName!,
    info: info as StructDefinitionWithName,
  };
};
