/**
 * @fileoverview Creates SQLite struct wrappers for WASM interop by orchestrating
 * the helpers exposed by the shared struct binder internals.
 */

import {
    INTERNAL_STRUCT_TOKEN,
    createContext,
    createStructType,
    normalizeStructArgs,
    validateStructDefinition,
    defineReadonly,
    defineMemberAccessors,
} from "./struct-binder-internals.mjs";

export function StructBinderFactory(config) {
    const context = createContext(config, StructBinderFactory);
    const StructType = createStructType(context);

    function StructBinder(structNameOrInfo, structInfo) {
        const { name, info } = normalizeStructArgs(
            structNameOrInfo,
            structInfo,
        );
        validateStructDefinition(name, info);

        const debugFlags = StructBinderFactory.__makeDebugFlags(
            StructBinder.debugFlags,
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
            (value) => value instanceof StructCtor,
        );
        defineReadonly(StructCtor, "memberKey", (memberName) =>
            context.memberKey(memberName),
        );
        defineReadonly(StructCtor, "memberKeys", () =>
            context.memberKeys(info),
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
            StructBinderFactory.debugFlags,
        );
    }
    return StructBinder;
}
