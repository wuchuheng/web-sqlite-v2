import {
    DEBUG_FLAG_MASK,
    describeMember,
    detectLittleEndian,
    defineReadonly,
    isNumericValue,
    toss,
} from "./struct-binder-helpers.mjs";
import { createSignatureHelpers } from "./struct-binder-signatures.mjs";
import { createMemoryHelpers } from "./struct-binder-memory.mjs";
import { createMemberHelpers } from "./struct-binder-members.mjs";

const ensureConfig = (config) => {
    if (!config) toss("StructBinderFactory requires a config object.");
    if (
        !(config.heap instanceof WebAssembly.Memory) &&
        typeof config.heap !== "function"
    ) {
        toss("config.heap must be WebAssembly.Memory instance or a function.");
    }
    ["alloc", "dealloc"].forEach((key) => {
        if (typeof config[key] !== "function") {
            toss("Config option '" + key + "' must be a function.");
        }
    });
};

const ensureDebugFlagFactories = (SBF) => {
    if (!SBF.__makeDebugFlags) {
        SBF.__makeDebugFlags = (deriveFrom = null) => {
            const parent = deriveFrom && deriveFrom.__flags;
            const flags = Object.create(parent || null);
            const controller = function (mask) {
                if (mask === undefined) return controller.__flags;
                if (typeof mask !== "number")
                    toss("Debug flag mask must be numeric.");
                if (mask < 0) {
                    delete controller.__flags.getter;
                    delete controller.__flags.setter;
                    delete controller.__flags.alloc;
                    delete controller.__flags.dealloc;
                } else {
                    controller.__flags.getter = Boolean(
                        mask & DEBUG_FLAG_MASK.getter,
                    );
                    controller.__flags.setter = Boolean(
                        mask & DEBUG_FLAG_MASK.setter,
                    );
                    controller.__flags.alloc = Boolean(
                        mask & DEBUG_FLAG_MASK.alloc,
                    );
                    controller.__flags.dealloc = Boolean(
                        mask & DEBUG_FLAG_MASK.dealloc,
                    );
                }
                return controller.__flags;
            };
            defineReadonly(controller, "__flags", flags);
            if (!parent) controller(0);
            return controller;
        };
    }
    if (!SBF.debugFlags) {
        SBF.debugFlags = SBF.__makeDebugFlags();
    }
};

const createContext = (config, structBinderFactory) => {
    ensureConfig(config);
    ensureDebugFlagFactories(structBinderFactory);

    const heap =
        typeof config.heap === "function"
            ? config.heap
            : () => new Uint8Array(config.heap.buffer);
    const alloc = config.alloc;
    const dealloc = config.dealloc;
    const log = config.log || console.log.bind(console);
    const memberPrefix = config.memberPrefix || "";
    const memberSuffix = config.memberSuffix || "";
    const bigIntEnabled =
        config.bigIntEnabled === undefined
            ? !!globalThis.BigInt64Array
            : !!config.bigIntEnabled;
    const ptrSizeof = config.ptrSizeof || 4;
    const ptrIR = config.ptrIR || "i32";

    const signature = createSignatureHelpers({
        ptrSizeof,
        ptrIR,
        bigIntEnabled,
    });
    const pointerMap = new WeakMap();
    const externalPointers = new WeakMap();
    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder("utf-8");
    const sabCtor =
        typeof SharedArrayBuffer !== "undefined" ? SharedArrayBuffer : null;
    const littleEndian = detectLittleEndian();
    let StructTypeRef = null;
    const StructTypeRefAccessor = {
        get: () => StructTypeRef,
        set: (value) => {
            StructTypeRef = value;
        },
    };

    const viewHeap = () => {
        const buffer = heap();
        if (!(buffer instanceof Uint8Array)) {
            toss("config.heap must resolve to a Uint8Array.");
        }
        return buffer;
    };

    const memoryHelpers = createMemoryHelpers({
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
    });
    const memberHelpers = createMemberHelpers({
        memoryHelpers,
        signature,
        log,
        viewHeap,
        StructTypeRefAccessor,
    });

    return {
        heap: viewHeap,
        ...memoryHelpers,
        ...memberHelpers,
        memberKey: (name) => memberPrefix + name + memberSuffix,
        memberKeys: (structInfo) =>
            Object.keys(structInfo.members).map(
                (name) => memberPrefix + name + memberSuffix,
            ),
        signature,
        littleEndian,
        log,
        setStructType: (StructType) => {
            StructTypeRefAccessor.set(StructType);
        },
        memberToJsString(instance, memberName) {
            const member = memoryHelpers.lookupMember(
                instance.structInfo,
                memberName,
                true,
            );
            memoryHelpers.assertCStringSignature(member);
            const pointer = instance[member.key];
            if (!pointer) return null;
            return memoryHelpers.decodeCString(viewHeap(), pointer);
        },
        memberIsString(instance, memberName, tossIfNotFound = false) {
            const member = memoryHelpers.lookupMember(
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
            const member = memoryHelpers.lookupMember(
                instance.structInfo,
                memberName,
                true,
            );
            if (!emscriptenFormat) return member.signature;
            return member.signature
                .replace(/[^vipPsjfdcC]/g, "")
                .replace(/[pPscC]/g, "i");
        },
        setMemberCString(instance, memberName, value) {
            const member = memoryHelpers.lookupMember(
                instance.structInfo,
                memberName,
                true,
            );
            memoryHelpers.assertCStringSignature(member);
            const pointer = memoryHelpers.allocCString(value);
            instance[member.key] = pointer;
            memoryHelpers.addOnDispose(instance, pointer);
            return instance;
        },
        pointerIsWritable(instance) {
            const pointer = memoryHelpers.pointerOf(instance);
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

export {
    ensureConfig,
    ensureDebugFlagFactories,
    createSignatureHelpers,
    createContext,
};
