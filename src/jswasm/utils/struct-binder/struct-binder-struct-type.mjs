import {
    INTERNAL_STRUCT_TOKEN,
    defineReadonly,
    toss,
} from "./struct-binder-helpers/struct-binder-helpers";

export const createStructType = (context) => {
    class StructType {
        constructor(structName, structInfo, token) {
            if (token !== INTERNAL_STRUCT_TOKEN) {
                toss(
                    "Do not call the StructType constructor from client-level code.",
                );
            }
            defineReadonly(this, "structName", structName);
            defineReadonly(this, "structInfo", structInfo);
        }

        dispose() {
            context.freeStruct(this.constructor, this);
        }

        lookupMember(memberName, tossIfNotFound = true) {
            return context.lookupMember(
                this.structInfo,
                memberName,
                tossIfNotFound,
            );
        }

        memberToJsString(memberName) {
            return context.memberToJsString(this, memberName);
        }

        memberIsString(memberName, tossIfNotFound = true) {
            return context.memberIsString(this, memberName, tossIfNotFound);
        }

        memberKey(memberName) {
            return context.memberKey(memberName);
        }

        memberKeys() {
            return context.memberKeys(this.structInfo);
        }

        memberSignature(memberName, emscriptenFormat = false) {
            return context.memberSignature(this, memberName, emscriptenFormat);
        }

        memoryDump() {
            const pointer = context.pointerOf(this);
            if (!pointer) return null;
            const size = this.structInfo.sizeof;
            return new Uint8Array(
                context.heap().slice(pointer, pointer + size),
            );
        }

        setMemberCString(memberName, value) {
            context.setMemberCString(this, memberName, value);
            return this;
        }

        addOnDispose(...items) {
            context.addOnDispose(this, ...items);
            return this;
        }
    }

    Object.defineProperty(StructType.prototype, "pointer", {
        configurable: false,
        enumerable: false,
        get() {
            return context.pointerOf(this);
        },
        set() {
            toss("Cannot assign the 'pointer' property of a struct.");
        },
    });

    defineReadonly(StructType, "allocCString", (value) =>
        context.allocCString(value),
    );
    defineReadonly(StructType, "isA", (value) => value instanceof StructType);
    defineReadonly(
        StructType,
        "hasExternalPointer",
        (value) =>
            value instanceof StructType && context.hasExternalPointer(value),
    );
    defineReadonly(StructType, "memberKey", (memberName) =>
        context.memberKey(memberName),
    );

    context.setStructType(StructType);
    return StructType;
};
