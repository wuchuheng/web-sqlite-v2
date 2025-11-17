import {
    toss,
    isNumericValue,
} from "./struct-binder-helpers/struct-binder-helpers";

export const createMemberHelpers = ({
    memoryHelpers,
    signature,
    log,
    viewHeap,
    StructTypeRefAccessor,
}) => {
    const {
        lookupMember,
        assertCStringSignature,
        pointerOf,
        allocCString,
        addOnDispose,
        decodeCString,
    } = memoryHelpers;

    return {
        memberToJsString(instance, memberName) {
            const member = lookupMember(instance.structInfo, memberName, true);
            assertCStringSignature(member);
            const pointer = instance[member.key];
            if (!pointer) return null;
            return decodeCString(viewHeap(), pointer);
        },
        memberIsString(instance, memberName, tossIfNotFound = false) {
            const member = lookupMember(
                instance.structInfo,
                memberName,
                tossIfNotFound,
            );
            return !!(
                member &&
                member.signature.length === 1 &&
                member.signature[0] === "s"
            );
        },
        memberSignature(instance, memberName, emscriptenFormat = false) {
            const member = lookupMember(instance.structInfo, memberName, true);
            if (!emscriptenFormat) return member.signature;
            return member.signature
                .replace(/[^vipPsjfdcC]/g, "")
                .replace(/[pPscC]/g, "i");
        },
        setMemberCString(instance, memberName, value) {
            const member = lookupMember(instance.structInfo, memberName, true);
            assertCStringSignature(member);
            const pointer = allocCString(value);
            instance[member.key] = pointer;
            addOnDispose(instance, pointer);
            return instance;
        },
        pointerIsWritable(instance) {
            const pointer = pointerOf(instance);
            if (!pointer)
                toss("Cannot set struct property on disposed instance.");
            return pointer;
        },
        coerceSetterValue(descriptor, value, debugFlags, propertyLabel) {
            if (value === null) return 0;
            if (isNumericValue(value)) return value;
            const StructTypeRefValue = StructTypeRefAccessor.get();
            if (
                signature.isAutoPointer(descriptor.signature) &&
                StructTypeRefValue &&
                value instanceof StructTypeRefValue
            ) {
                const pointer = value.pointer || 0;
                if (debugFlags.setter) {
                    log("debug.setter:", propertyLabel, "resolved to", pointer);
                }
                return pointer;
            }
            toss("Invalid value for pointer-type", propertyLabel + ".");
        },
    };
};
