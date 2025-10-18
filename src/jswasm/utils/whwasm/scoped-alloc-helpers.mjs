/**
 * @fileoverview Scoped allocation helpers for the wh-wasm utilities.
 */

import { assertAllocator } from "./utils.mjs";

/**
 * Adds scoped allocation utilities (scopedAlloc, scopedAllocCString, etc.).
 *
 * @param {import("./installer-context.d.ts").WhWasmInstallerContext} context
 */
export function attachScopedAllocators(context) {
    const { target, cache } = context;

    /**
     * Pushes a new scoped allocation frame onto the stack.
     *
     * @returns {number[]}
     */
    target.scopedAllocPush = () => {
        assertAllocator(context, "scopedAllocPush");
        const scope = [];
        cache.scopedAlloc.push(scope);
        return scope;
    };

    /**
     * Pops a scoped allocation frame and frees any resources owned by it.
     *
     * @param {number[] | undefined} [state]
     * @returns {void}
     */
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

    /**
     * Allocates memory that will be freed when the current scope is popped.
     *
     * @param {number} n
     * @returns {import("../../sqlite3.d.ts").WasmPointer}
     */
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

    /**
     * Allocates a scoped CString using the current allocation frame.
     *
     * @param {string} jstr
     * @param {boolean} [returnWithLength=false]
     * @returns {import("../../sqlite3.d.ts").WasmPointer | [import("../../sqlite3.d.ts").WasmPointer, number] | null}
     */
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

    /**
     * Allocates an argv-style pointer array bound to the scoped allocator.
     *
     * @param {unknown[]} list
     * @returns {import("../../sqlite3.d.ts").WasmPointer}
     */
    target.scopedAllocMainArgv = (list) => allocMainArgv(true, list);
    /**
     * Allocates an argv-style pointer array using the general allocator.
     *
     * @param {unknown[]} list
     * @returns {import("../../sqlite3.d.ts").WasmPointer}
     */
    target.allocMainArgv = (list) => allocMainArgv(false, list);

    /**
     * Converts argc/argv data into a JavaScript array of strings.
     *
     * @param {number} argc
     * @param {import("../../sqlite3.d.ts").WasmPointer} argvPtr
     * @returns {(string | null)[]}
     */
    target.cArgvToJs = (argc, argvPtr) => {
        const args = [];
        for (let i = 0; i < argc; ++i) {
            const ptr = target.peekPtr(argvPtr + target.ptrSizeof * i);
            args.push(ptr ? target.cstrToJs(ptr) : null);
        }
        return args;
    };

    /**
     * Executes the callback while automatically unwinding scoped allocations.
     *
     * @template T
     * @param {() => T} fn
     * @returns {T}
     */
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

    /**
     * Allocates pointer slots using the general allocator.
     *
     * @param {number} [howMany=1]
     * @param {boolean} [safePtrSize=true]
     * @returns {import("../../sqlite3.d.ts").WasmPointer | import("../../sqlite3.d.ts").WasmPointer[]}
     */
    target.allocPtr = (howMany = 1, safePtrSize = true) =>
        allocPtr(howMany, safePtrSize, "alloc");
    /**
     * Allocates pointer slots tracked by the scoped allocator.
     *
     * @param {number} [howMany=1]
     * @param {boolean} [safePtrSize=true]
     * @returns {import("../../sqlite3.d.ts").WasmPointer | import("../../sqlite3.d.ts").WasmPointer[]}
     */
    target.scopedAllocPtr = (howMany = 1, safePtrSize = true) =>
        allocPtr(howMany, safePtrSize, "scopedAlloc");

    /**
     * Looks up an exported wasm symbol by name.
     *
     * @param {string} name
     * @returns {(...args: unknown[]) => unknown}
     */
    target.xGet = (name) =>
        target.exports[name] ||
        context.toss("Cannot find exported symbol:", name);

    /**
     * Invokes an exported wasm function by name.
     *
     * @param {string | ((...args: unknown[]) => unknown)} fname
     * @param {...unknown} args
     * @returns {unknown}
     */
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
