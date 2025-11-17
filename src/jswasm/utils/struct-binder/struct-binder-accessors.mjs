import {
    RX_SIG_FUNCTION,
    RX_SIG_SIMPLE,
    describeMember,
    toss,
} from "./struct-binder-helpers/struct-binder-helpers.js";

const validateStructDefinition = (structName, structInfo) => {
    if (!structInfo || typeof structInfo !== "object") {
        toss("Struct definition is required for", structName);
    }
    if (!structInfo.members || typeof structInfo.members !== "object") {
        toss("Struct", structName, "is missing member descriptions.");
    }

    let lastMember = null;
    Object.keys(structInfo.members).forEach((key) => {
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
    });

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

const validateMemberSignature = (structCtor, memberName, key, signature) => {
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

const defineMemberAccessors = (structCtor, memberName, descriptor, context) => {
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
        get() {
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
            const result = view[getterName](0, context.littleEndian);
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
                : function setStructMember(value) {
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
                      view[setterName](
                          0,
                          wrapValue(resolvedValue),
                          context.littleEndian,
                      );
                  },
    });
};

const normalizeStructArgs = (structNameOrInfo, structInfo) => {
    let name = structNameOrInfo;
    let info = structInfo;
    if (info === undefined) {
        info = structNameOrInfo;
        name = info && info.name;
    } else if (info && !info.name) {
        info.name = name;
    }
    if (!name) toss("Struct name is required.");
    return { name, info };
};

export {
    validateStructDefinition,
    validateMemberSignature,
    defineMemberAccessors,
    normalizeStructArgs,
};
