/**
 * @fileoverview Scoped allocation helpers for the wh-wasm utilities.
 */

import { assertAllocator } from "./utils.mjs";

/**
 * Adds scoped allocation utilities (scopedAlloc, scopedAllocCString, etc.).
 *
 * @param {import("./installer-context.mjs").WhWasmInstallerContext} context
 */
export function attachScopedAllocators(context) {
    const { target, cache } = context;

    target.scopedAllocPush = () => {
        assertAllocator(context, "scopedAllocPush");
        const scope = [];
        cache.scopedAlloc.push(scope);
        return scope;
    };

    target.scopedAllocPop = (state) => {
        assertAllocator(context, "scopedAllocPop");
        const index =
            arguments.length === 0
                ? cache.scopedAlloc.length - 1
                : cache.scopedAlloc.indexOf(state);
        if (index < 0) {
            context.toss("Invalid state object for scopedAllocPop().");
        }
        const scope = cache.scopedAlloc.splice(index, 1)[0];
        for (let ptr; (ptr = scope.pop()); ) {
            if (target.functionEntry(ptr)) {
                target.uninstallFunction(ptr);
            } else {
                target.dealloc(ptr);
            }
        }
    };

    target.scopedAlloc = (n) => {
        if (!cache.scopedAlloc.length) {
            context.toss("No scopedAllocPush() scope is active.");
        }
        const ptr = target.alloc(n);
        cache.scopedAlloc[cache.scopedAlloc.length - 1].push(ptr);
        return ptr;
    };

    Object.defineProperty(target.scopedAlloc, "level", {
        configurable: false,
        enumerable: false,
        get: () => cache.scopedAlloc.length,
        set: () => {
            context.toss("The 'active' property is read-only.");
        },
    });

    target.scopedAllocCString = (jstr, returnWithLength = false) =>
        context.allocCStringInternal(
            jstr,
            returnWithLength,
            target.scopedAlloc,
            "scopedAllocCString()"
        );

    const allocMainArgv = (isScoped, list) => {
        const allocator = target[isScoped ? "scopedAlloc" : "alloc"];
        const allocCString =
            target[isScoped ? "scopedAllocCString" : "allocCString"];
        const ptr =
            allocator((list.length + 1) * target.ptrSizeof) || context.toss(
                "Allocation failed for argv list."
            );
        let index = 0;
        for (const entry of list) {
            target.pokePtr(
                ptr + target.ptrSizeof * index++,
                allocCString(String(entry))
            );
        }
        target.pokePtr(ptr + target.ptrSizeof * index, 0);
        return ptr;
    };

    target.scopedAllocMainArgv = (list) => allocMainArgv(true, list);
    target.allocMainArgv = (list) => allocMainArgv(false, list);

    target.cArgvToJs = (argc, argvPtr) => {
        const args = [];
        for (let i = 0; i < argc; ++i) {
            const ptr = target.peekPtr(argvPtr + target.ptrSizeof * i);
            args.push(ptr ? target.cstrToJs(ptr) : null);
        }
        return args;
    };

    target.scopedAllocCall = (fn) => {
        const scope = target.scopedAllocPush();
        try {
            return fn();
        } finally {
            target.scopedAllocPop(scope);
        }
    };

    const allocPtr = (howMany, safePtrSize, allocatorName) => {
        assertAllocator(context, allocatorName);
        const pointerIR = safePtrSize ? "i64" : context.ptrIR;
        const stride = safePtrSize ? 8 : context.ptrSizeof;
        let address = target[allocatorName](howMany * stride);
        target.poke(address, 0, pointerIR);
        if (howMany === 1) {
            return address;
        }
        const pointers = [address];
        for (let i = 1; i < howMany; ++i) {
            address += stride;
            pointers[i] = address;
            target.poke(address, 0, pointerIR);
        }
        return pointers;
    };

    target.allocPtr = (howMany = 1, safePtrSize = true) =>
        allocPtr(howMany, safePtrSize, "alloc");
    target.scopedAllocPtr = (howMany = 1, safePtrSize = true) =>
        allocPtr(howMany, safePtrSize, "scopedAlloc");

    target.xGet = (name) =>
        target.exports[name] ||
        context.toss("Cannot find exported symbol:", name);

    target.xCall = (fname, ...args) => {
        const fn =
            fname instanceof Function ? fname : target.xGet(fname);
        if (!(fn instanceof Function)) {
            context.toss("Exported symbol", fname, "is not a function.");
        }
        if (fn.length !== args.length) {
            const label = fn === fname ? fn.name : fname;
            context.toss(`${label}() requires`, fn.length, "argument(s).");
        }
        if (args.length === 1 && Array.isArray(args[0])) {
            return fn.apply(null, args[0]);
        }
        return fn.apply(null, args);
    };
}
