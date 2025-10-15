/**
 * @fileoverview Creates SQLite struct wrappers for WASM interop.
 * The refactor keeps the public API identical while organising the internals
 * into small helpers for clarity and easier maintenance.
 */

const DEBUG_FLAG_MASK = {
    getter: 0x01,
    setter: 0x02,
    alloc: 0x04,
    dealloc: 0x08,
};

const RX_SIG_SIMPLE = /^[ipPsjfdcC]$/;
const RX_SIG_FUNCTION = /^[vipPsjfdcC]\([ipPsjfdcC]*\)$/;
const INTERNAL_STRUCT_TOKEN = Symbol("StructTypeInternal");

const toss = (...parts) => {
    throw new Error(parts.join(" "));
};

const defineReadonly = (target, key, value) =>
    Object.defineProperty(target, key, {
        configurable: false,
        enumerable: false,
        writable: false,
        value,
    });

const describeMember = (structName, memberKey) =>
    `${structName}::${memberKey}`;

const isNumericValue = (value) =>
    typeof value === "number"
        ? Number.isFinite(value)
        : typeof value === "bigint" ||
          (value instanceof Number && Number.isFinite(value.valueOf()));

const detectLittleEndian = () => {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true);
    return new Int16Array(buffer)[0] === 256;
};

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
                if (typeof mask !== "number") toss("Debug flag mask must be numeric.");
                if (mask < 0) {
                    delete controller.__flags.getter;
                    delete controller.__flags.setter;
                    delete controller.__flags.alloc;
                    delete controller.__flags.dealloc;
                } else {
                    controller.__flags.getter = Boolean(mask & DEBUG_FLAG_MASK.getter);
                    controller.__flags.setter = Boolean(mask & DEBUG_FLAG_MASK.setter);
                    controller.__flags.alloc = Boolean(mask & DEBUG_FLAG_MASK.alloc);
                    controller.__flags.dealloc = Boolean(mask & DEBUG_FLAG_MASK.dealloc);
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

const createSignatureHelpers = ({ ptrSizeof, ptrIR, bigIntEnabled }) => {
    const BigInt64ArrayCtor = globalThis.BigInt64Array;
    const ensureBigInt = () => {
        if (!bigIntEnabled || !BigInt64ArrayCtor) {
            toss("BigInt64Array is not available.");
        }
    };

    const glyphFor = (signature) =>
        signature && signature.length > 1 && signature[1] === "("
            ? "p"
            : signature
            ? signature[0]
            : undefined;

    return {
        glyphFor,
        isAutoPointer: (signature) => signature === "P",
        irFor(signature) {
            switch (glyphFor(signature)) {
                case "c":
                case "C":
                    return "i8";
                case "i":
                    return "i32";
                case "p":
                case "P":
                case "s":
                    return ptrIR;
                case "j":
                    return "i64";
                case "f":
                    return "float";
                case "d":
                    return "double";
                default:
                    toss("Unhandled signature IR:", signature);
            }
        },
        getterFor(signature) {
            switch (glyphFor(signature)) {
                case "p":
                case "P":
                case "s":
                    if (ptrSizeof === 8) {
                        ensureBigInt();
                        return "getBigInt64";
                    }
                    return "getInt32";
                case "i":
                    return "getInt32";
                case "c":
                    return "getInt8";
                case "C":
                    return "getUint8";
                case "j":
                    ensureBigInt();
                    return "getBigInt64";
                case "f":
                    return "getFloat32";
                case "d":
                    return "getFloat64";
                default:
                    toss("Unhandled DataView getter for signature:", signature);
            }
        },
        setterFor(signature) {
            switch (glyphFor(signature)) {
                case "p":
                case "P":
                case "s":
                    if (ptrSizeof === 8) {
                        ensureBigInt();
                        return "setBigInt64";
                    }
                    return "setInt32";
                case "i":
                    return "setInt32";
                case "c":
                    return "setInt8";
                case "C":
                    return "setUint8";
                case "j":
                    ensureBigInt();
                    return "setBigInt64";
                case "f":
                    return "setFloat32";
                case "d":
                    return "setFloat64";
                default:
                    toss("Unhandled DataView setter for signature:", signature);
            }
        },
        wrapForSet(signature) {
            switch (glyphFor(signature)) {
                case "i":
                case "f":
                case "c":
                case "C":
                case "d":
                    return Number;
                case "j":
                    ensureBigInt();
                    return BigInt;
                case "p":
                case "P":
                case "s":
                    if (ptrSizeof === 8) {
                        ensureBigInt();
                        return BigInt;
                    }
                    return Number;
                default:
                    toss("Unhandled setter wrapper for signature:", signature);
            }
        },
    };
};

const createContext = (config) => {
    ensureConfig(config);
    ensureDebugFlagFactories(StructBinderFactory);

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

    const viewHeap = () => {
        const buffer = heap();
        if (!(buffer instanceof Uint8Array)) {
            toss("config.heap must resolve to a Uint8Array.");
        }
        return buffer;
    };

    const pointerOf = (instance) => pointerMap.get(instance);
    const hasExternalPointer = (instance) =>
        externalPointers.get(instance) === true;

    const validateExternalPointer = (structName, value) => {
        if (
            typeof value !== "number" ||
            value !== (value | 0) ||
            value <= 0
        ) {
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
                    "bytes @" + addr
                );
            }
            if (!external) {
                viewHeap().fill(
                    0,
                    addr,
                    addr + structCtor.structInfo.sizeof
                );
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
            } else if (StructTypeRef && handler instanceof StructTypeRef) {
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
                error
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
                "bytes @" + addr
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
                describeMember(structInfo.name || "anonymous struct", memberName),
                "is not a mapped struct member."
            );
        }
        return member;
    };

    const assertCStringSignature = (member) => {
        if (member.signature === "s") return;
        toss(
            "Invalid member type signature for C-string value:",
            JSON.stringify(member)
        );
    };

    return {
        heap: viewHeap,
        allocStruct,
        freeStruct,
        allocCString,
        addOnDispose,
        pointerOf,
        hasExternalPointer,
        validateExternalPointer,
        memberKey: (name) => memberPrefix + name + memberSuffix,
        memberKeys: (structInfo) =>
            Object.keys(structInfo.members).map(
                (name) => memberPrefix + name + memberSuffix
            ),
        lookupMember,
        assertCStringSignature,
        signature,
        littleEndian,
        log,
        setStructType: (StructType) => {
            StructTypeRef = StructType;
        },
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
                tossIfNotFound
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
            if (!pointer) toss("Cannot set struct property on disposed instance.");
            return pointer;
        },
        coerceSetterValue(descriptor, value, debugFlags, propertyLabel) {
            if (value === null) return 0;
            if (isNumericValue(value)) return value;
            if (
                signature.isAutoPointer(descriptor.signature) &&
                StructTypeRef &&
                value instanceof StructTypeRef
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

const createStructType = (context) => {
    class StructType {
        constructor(structName, structInfo, token) {
            if (token !== INTERNAL_STRUCT_TOKEN) {
                toss(
                    "Do not call the StructType constructor from client-level code."
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
                tossIfNotFound
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
            return context.memberSignature(
                this,
                memberName,
                emscriptenFormat
            );
        }

        memoryDump() {
            const pointer = context.pointerOf(this);
            if (!pointer) return null;
            const size = this.structInfo.sizeof;
            return new Uint8Array(
                context.heap().slice(pointer, pointer + size)
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
        context.allocCString(value)
    );
    defineReadonly(StructType, "isA", (value) => value instanceof StructType);
    defineReadonly(StructType, "hasExternalPointer", (value) =>
        value instanceof StructType && context.hasExternalPointer(value)
    );
    defineReadonly(
        StructType,
        "memberKey",
        (memberName) => context.memberKey(memberName)
    );

    context.setStructType(StructType);
    return StructType;
};

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
                    member.signature
                );
            }
        } else {
            if (member.sizeof % 4 !== 0) {
                console.warn(
                    "Invalid struct member description =",
                    member,
                    "from",
                    structInfo
                );
                toss(
                    structName,
                    "member",
                    key,
                    "sizeof is not aligned. sizeof=" + member.sizeof
                );
            }
            if (member.offset % 4 !== 0) {
                console.warn(
                    "Invalid struct member description =",
                    member,
                    "from",
                    structInfo
                );
                toss(
                    structName,
                    "member",
                    key,
                    "offset is not aligned. offset=" + member.offset
                );
            }
        }
        if (!lastMember || lastMember.offset < member.offset) {
            lastMember = member;
        }
    });

    if (!lastMember) {
        toss("No member property descriptions found.");
    } else if (
        structInfo.sizeof <
        lastMember.offset + lastMember.sizeof
    ) {
        toss(
            "Invalid struct config:",
            structName,
            "max member offset (" + lastMember.offset + ") ",
            "extends past end of struct (sizeof=" + structInfo.sizeof + ")."
        );
    }
};

const validateMemberSignature = (structCtor, memberName, key, signature) => {
    if (Object.prototype.hasOwnProperty.call(structCtor.prototype, key)) {
        toss(
            structCtor.structName,
            "already has a property named",
            key + "."
        );
    }
    if (!RX_SIG_SIMPLE.test(signature) && !RX_SIG_FUNCTION.test(signature)) {
        toss(
            "Malformed signature for",
            describeMember(structCtor.structName, memberName) + ":",
            signature
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
                    descriptor.sizeof
                );
            }
            const view = new DataView(
                context.heap().buffer,
                pointer + descriptor.offset,
                descriptor.sizeof
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
                              value
                          );
                      }
                      const pointer = context.pointerIsWritable(this);
                      const resolvedValue = context.coerceSetterValue(
                          descriptor,
                          value,
                          debugFlags,
                          propertyLabel
                      );
                      const view = new DataView(
                          context.heap().buffer,
                          pointer + descriptor.offset,
                          descriptor.sizeof
                      );
                      view[setterName](
                          0,
                          wrapValue(resolvedValue),
                          context.littleEndian
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

export function StructBinderFactory(config) {
    const context = createContext(config);
    const StructType = createStructType(context);

    function StructBinder(structNameOrInfo, structInfo) {
        const { name, info } = normalizeStructArgs(
            structNameOrInfo,
            structInfo
        );
        validateStructDefinition(name, info);

        const debugFlags = StructBinderFactory.__makeDebugFlags(
            StructBinder.debugFlags
        );

        class StructCtor extends StructType {
            constructor(externalPointer) {
                const pointer =
                    arguments.length > 0
                        ? context.validateExternalPointer(name, externalPointer)
                        : undefined;
                super(name, info, INTERNAL_STRUCT_TOKEN);
                context.allocStruct(this.constructor, this, pointer);
            }
        }

        defineReadonly(StructCtor, "debugFlags", debugFlags);
        defineReadonly(
            StructCtor,
            "isA",
            (value) => value instanceof StructCtor
        );
        defineReadonly(
            StructCtor,
            "memberKey",
            (memberName) => context.memberKey(memberName)
        );
        defineReadonly(
            StructCtor,
            "memberKeys",
            () => context.memberKeys(info)
        );
        defineReadonly(StructCtor, "methodInfoForKey", () => undefined);
        defineReadonly(StructCtor, "structInfo", info);
        defineReadonly(StructCtor, "structName", name);
        defineReadonly(StructCtor.prototype, "debugFlags", debugFlags);

        Object.entries(info.members).forEach(([memberName, descriptor]) => {
            defineMemberAccessors(StructCtor, memberName, descriptor, context);
        });

        return StructCtor;
    }

    StructBinder.StructType = StructType;
    StructBinder.config = config;
    StructBinder.allocCString = (value) => context.allocCString(value);
    if (!StructBinder.debugFlags) {
        StructBinder.debugFlags = StructBinderFactory.__makeDebugFlags(
            StructBinderFactory.debugFlags
        );
    }
    return StructBinder;
}
