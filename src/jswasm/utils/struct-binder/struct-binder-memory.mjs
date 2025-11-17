import { toss } from "./struct-binder-helpers/struct-binder-helpers.js";

export const createMemoryHelpers = ({
    alloc,
    dealloc,
    log,
    memberPrefix,
    memberSuffix,
    pointerMap,
    externalPointers,
    viewHeap,
    textEncoder,
    textDecoder,
    sabCtor,
    describeMember,
    StructTypeRefAccessor,
}) => {
    const pointerOf = (instance) => pointerMap.get(instance);
    const hasExternalPointer = (instance) =>
        externalPointers.get(instance) === true;

    const validateExternalPointer = (structName, value) => {
        if (typeof value !== "number" || value !== (value | 0) || value <= 0) {
            toss("Invalid pointer value for", structName, "constructor.");
        }
        return value;
    };

    const allocStruct = (structCtor, instance, pointer) => {
        const external = pointer !== undefined;
        const addr = external ? pointer : alloc(structCtor.structInfo.sizeof);
        if (!addr) {
            toss("Allocation of", structCtor.structName, "structure failed.");
        }
        try {
            if (structCtor.debugFlags.__flags.alloc) {
                log(
                    "debug.alloc:",
                    external ? "EXTERNAL" : "",
                    structCtor.structName,
                    "instance:",
                    structCtor.structInfo.sizeof,
                    "bytes @" + addr,
                );
            }
            if (!external) {
                viewHeap().fill(0, addr, addr + structCtor.structInfo.sizeof);
            }
            pointerMap.set(instance, addr);
            if (external) externalPointers.set(instance, true);
            else externalPointers.delete(instance);
        } catch (error) {
            pointerMap.delete(instance);
            if (!external) dealloc(addr);
            throw error;
        }
    };

    const disposeHandler = (structCtor, instance, handler) => {
        try {
            if (typeof handler === "function") {
                handler.call(instance);
            } else if (
                StructTypeRefAccessor.get() &&
                handler instanceof StructTypeRefAccessor.get()
            ) {
                handler.dispose();
            } else if (typeof handler === "number") {
                dealloc(handler);
            }
        } catch (error) {
            console.warn(
                "ondispose() for",
                structCtor.structName,
                "@",
                pointerOf(instance),
                "threw. NOT propagating it.",
                error,
            );
        }
    };

    const freeStruct = (structCtor, instance) => {
        const addr = pointerMap.get(instance);
        if (!addr) return;

        pointerMap.delete(instance);
        const external = hasExternalPointer(instance);
        externalPointers.delete(instance);

        const handlers = instance.ondispose;
        if (Array.isArray(handlers)) {
            while (handlers.length) {
                disposeHandler(structCtor, instance, handlers.shift());
            }
        } else if (typeof handlers === "function") {
            disposeHandler(structCtor, instance, handlers);
        }
        delete instance.ondispose;

        if (structCtor.debugFlags.__flags.dealloc) {
            log(
                "debug.dealloc:",
                external ? "EXTERNAL" : "",
                structCtor.structName,
                "instance:",
                structCtor.structInfo.sizeof,
                "bytes @" + addr,
            );
        }
        if (!external) dealloc(addr);
    };

    const addOnDispose = (instance, ...items) => {
        if (!instance.ondispose) instance.ondispose = [];
        else if (!Array.isArray(instance.ondispose)) {
            instance.ondispose = [instance.ondispose];
        }
        instance.ondispose.push(...items);
    };

    const allocCString = (value) => {
        const encoded = textEncoder.encode(value);
        const pointer = alloc(encoded.length + 1);
        if (!pointer) toss("Allocation error while duplicating string:", value);
        const memory = viewHeap();
        memory.set(encoded, pointer);
        memory[pointer + encoded.length] = 0;
        return pointer;
    };

    const decodeCString = (memory, start) => {
        let end = start;
        while (memory[end] !== 0) end += 1;
        if (!sabCtor || !(memory.buffer instanceof sabCtor)) {
            return textDecoder.decode(memory.subarray(start, end));
        }
        return textDecoder.decode(memory.slice(start, end));
    };

    const lookupMember = (structInfo, memberName, tossIfNotFound = true) => {
        let member = structInfo.members[memberName];
        if (!member && (memberPrefix || memberSuffix)) {
            for (const candidate of Object.values(structInfo.members)) {
                if (candidate.key === memberName) {
                    member = candidate;
                    break;
                }
            }
        }
        if (!member && tossIfNotFound) {
            toss(
                describeMember(
                    structInfo.name || "anonymous struct",
                    memberName,
                ),
                "is not a mapped struct member.",
            );
        }
        return member;
    };

    const assertCStringSignature = (member) => {
        if (member.signature === "s") return;
        toss(
            "Invalid member type signature for C-string value:",
            JSON.stringify(member),
        );
    };

    return {
        pointerOf,
        hasExternalPointer,
        validateExternalPointer,
        allocStruct,
        disposeHandler,
        freeStruct,
        addOnDispose,
        allocCString,
        decodeCString,
        lookupMember,
        assertCStringSignature,
    };
};
