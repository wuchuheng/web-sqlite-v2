/**
 * @fileoverview Provides a high-level installer that augments the raw WASM bridge
 * with ergonomic helpers for memory management, string conversion, function table
 * manipulation, and the xWrap adapter system used throughout the SQLite browser build.
 *
 * The original Emscripten output ships these helpers as a single monolithic closure.
 * This refactor re-organises the behaviour into a small class so that responsibilities
 * are grouped and documented, while preserving the public surface that downstream
 * modules rely on.
 */

/**
 * Creates a function that enriches a WASM-facing “target” object with convenience
 * utilities. The returned function mutates the provided target in place and returns it.
 *
 * @returns {(target: object) => object} Installer function that mutates {@link target}
 *   with typed memory helpers, scoped allocators, and xWrap adapters.
 */
export function createWhWasmUtilInstaller() {
    const installWhWasmUtils = (target) =>
        new WhWasmUtilityInstaller(target).install();

    installWhWasmUtils.yawl = createYawlLoader(installWhWasmUtils);

    return installWhWasmUtils;
}

/**
 * Coordinates the installation of WASM helper methods on a target object.
 */
class WhWasmUtilityInstaller {
    /**
     * @param {object} target - The mutable WASM helper target.
     */
    constructor(target) {
        this.target = target;
        this.cache = {
            heapSize: 0,
            memory: null,
            freeFuncIndexes: [],
            scopedAlloc: [],
            utf8Decoder: new TextDecoder(),
            utf8Encoder: new TextEncoder("utf-8"),
            xWrap: Object.assign(Object.create(null), {
                convert: Object.assign(Object.create(null), {
                    arg: new Map(),
                    result: new Map(),
                }),
            }),
        };
        this.ptrIR = target.pointerIR || "i32";
        if (!["i32", "i64"].includes(this.ptrIR)) {
            this.toss("Unhandled ptrSizeof:", this.ptrIR);
        }
        this.ptrSizeof = this.ptrIR === "i32" ? 4 : 8;
    }

    /**
     * Throws consistently formatted errors.
     * @param {...any} args - Message parts.
     * @throws {Error} Always throws.
     */
    toss(...args) {
        throw new Error(args.join(" "));
    }

    /**
     * Runs all installation steps and returns the augmented target.
     *
     * @returns {object} The mutated target.
     */
    install() {
        this.applyDefaults();
        this.attachSizeHelpers();
        this.attachHeapAccessors();
        this.attachFunctionTableUtilities();
        this.attachMemoryAccessors();
        this.attachStringUtilities();
        this.attachScopedAllocators();
        this.attachXWrapAdapters();
        return this.target;
    }

    /**
     * Ensures baseline properties (exports proxy, pointer metadata, bigint flags) exist.
     */
    applyDefaults() {
        const { target } = this;

        if (typeof target.bigIntEnabled === "undefined") {
            target.bigIntEnabled = !!globalThis.BigInt64Array;
        }

        if (!target.exports) {
            Object.defineProperty(target, "exports", {
                enumerable: true,
                configurable: true,
                get: () => target.instance && target.instance.exports,
            });
        }

        target.pointerIR = this.ptrIR;
        target.ptrSizeof = this.ptrSizeof;
    }

    /**
     * Adds {@link target.sizeofIR}, maintaining the legacy pointer behaviour.
     */
    attachSizeHelpers() {
        const { target } = this;
        const ptrSize = this.ptrSizeof;

        target.sizeofIR = (identifier) => {
            switch (identifier) {
                case "i8":
                    return 1;
                case "i16":
                    return 2;
                case "i32":
                case "f32":
                case "float":
                    return 4;
                case "i64":
                case "f64":
                case "double":
                    return 8;
                case "*":
                    return ptrSize;
                default:
                    return ("" + identifier).endsWith("*")
                        ? ptrSize
                        : undefined;
            }
        };
    }

    /**
     * Resolves the active memory object, caching it for subsequent use.
     * @returns {WebAssembly.Memory} Memory backing the WASM module.
     */
    resolveMemory() {
        const { cache, target } = this;
        if (!cache.memory) {
            cache.memory =
                target.memory instanceof WebAssembly.Memory
                    ? target.memory
                    : target.exports.memory;
        }
        return cache.memory;
    }

    /**
     * Lazily constructs typed-array views over the underlying memory buffer.
     * @returns {object} Cache enriched with fresh typed-array views.
     */
    getHeapViews() {
        const { cache } = this;
        const memory = this.resolveMemory();
        if (
            cache.heapSize === memory.buffer.byteLength &&
            cache.HEAP8 &&
            cache.HEAP8U
        ) {
            return cache;
        }

        const buffer = memory.buffer;
        cache.HEAP8 = new Int8Array(buffer);
        cache.HEAP8U = new Uint8Array(buffer);
        cache.HEAP16 = new Int16Array(buffer);
        cache.HEAP16U = new Uint16Array(buffer);
        cache.HEAP32 = new Int32Array(buffer);
        cache.HEAP32U = new Uint32Array(buffer);
        cache.HEAP32F = new Float32Array(buffer);
        cache.HEAP64F = new Float64Array(buffer);
        if (this.target.bigIntEnabled) {
            cache.HEAP64 = new BigInt64Array(buffer);
            cache.HEAP64U = new BigUint64Array(buffer);
        } else {
            cache.HEAP64 = undefined;
            cache.HEAP64U = undefined;
        }
        cache.heapSize = buffer.byteLength;
        return cache;
    }

    /**
     * Adds memoised heap accessors (heap8/heap8u/heapForSize/etc.).
     */
    attachHeapAccessors() {
        const { target } = this;
        const getHeap = () => this.getHeapViews();

        target.heap8 = () => getHeap().HEAP8;
        target.heap8u = () => getHeap().HEAP8U;
        target.heap16 = () => getHeap().HEAP16;
        target.heap16u = () => getHeap().HEAP16U;
        target.heap32 = () => getHeap().HEAP32;
        target.heap32u = () => getHeap().HEAP32U;

        target.heapForSize = (sizeIndicator, unsigned = true) => {
            const heap = getHeap();
            switch (sizeIndicator) {
                case Int8Array:
                    return heap.HEAP8;
                case Uint8Array:
                    return heap.HEAP8U;
                case Int16Array:
                    return heap.HEAP16;
                case Uint16Array:
                    return heap.HEAP16U;
                case Int32Array:
                    return heap.HEAP32;
                case Uint32Array:
                    return heap.HEAP32U;
                case 8:
                    return unsigned ? heap.HEAP8U : heap.HEAP8;
                case 16:
                    return unsigned ? heap.HEAP16U : heap.HEAP16;
                case 32:
                    return unsigned ? heap.HEAP32U : heap.HEAP32;
                case 64:
                    if (heap.HEAP64) {
                        return unsigned ? heap.HEAP64U : heap.HEAP64;
                    }
                    break;
                default:
                    if (
                        this.target.bigIntEnabled &&
                        (sizeIndicator === globalThis.BigUint64Array ||
                            sizeIndicator === globalThis.BigInt64Array)
                    ) {
                        return sizeIndicator === globalThis.BigUint64Array
                            ? heap.HEAP64U
                            : heap.HEAP64;
                    }
            }
            this.toss(
                "Invalid heapForSize() size: expecting 8, 16, 32, or 64 (BigInt)."
            );
        };
    }

    /**
     * Adds helpers for manipulating the indirect function table.
     */
    attachFunctionTableUtilities() {
        const { target, cache } = this;

        target.functionTable = () => target.exports.__indirect_function_table;

        target.functionEntry = (pointer) => {
            const table = target.functionTable();
            return pointer < table.length ? table.get(pointer) : undefined;
        };

        target.jsFuncToWasm = this.createJsFuncToWasm();

        this.installFunctionInternal = (func, sig, scoped) => {
            if (scoped && !cache.scopedAlloc.length) {
                this.toss("No scopedAllocPush() scope is active.");
            }

            if (typeof func === "string") {
                const temp = sig;
                sig = func;
                func = temp;
            }

            if (typeof sig !== "string" || !(func instanceof Function)) {
                this.toss(
                    "Invalid arguments: expecting (function,signature) or (signature,function)."
                );
            }

            const table = target.functionTable();
            const freed = cache.freeFuncIndexes;
            const originalLength = table.length;
            let pointer;

            while (freed.length) {
                pointer = freed.pop();
                if (table.get(pointer)) {
                    pointer = null;
                    continue;
                }
                break;
            }

            if (pointer == null) {
                pointer = originalLength;
                table.grow(1);
            }

            try {
                table.set(pointer, func);
                if (scoped) {
                    cache.scopedAlloc[cache.scopedAlloc.length - 1].push(pointer);
                }
                return pointer;
            } catch (error) {
                if (!(error instanceof TypeError)) {
                    if (pointer === originalLength) {
                        freed.push(originalLength);
                    }
                    throw error;
                }
            }

            try {
                const wrapped = target.jsFuncToWasm(func, sig);
                table.set(pointer, wrapped);
                if (scoped) {
                    cache.scopedAlloc[cache.scopedAlloc.length - 1].push(pointer);
                }
            } catch (error) {
                if (pointer === originalLength) {
                    freed.push(originalLength);
                }
                throw error;
            }
            return pointer;
        };

        target.installFunction = (func, sig) =>
            this.installFunctionInternal(func, sig, false);

        target.scopedInstallFunction = (func, sig) =>
            this.installFunctionInternal(func, sig, true);

        target.uninstallFunction = (ptr) => {
            if (ptr == null && ptr !== 0) {
                return undefined;
            }
            const table = target.functionTable();
            cache.freeFuncIndexes.push(ptr);
            const previous = table.get(ptr);
            table.set(ptr, null);
            return previous;
        };
    }

    /**
     * Builds the legacy jsFuncToWasm adapter (slightly reformatted for readability).
     * @returns {Function} jsFuncToWasm function.
     */
    createJsFuncToWasm() {
        const toss = this.toss.bind(this);
        return function jsFuncToWasm(func, sig) {
            const fn = jsFuncToWasm;
            if (!fn._cache) {
                fn._cache = {
                    sigTypes: Object.assign(Object.create(null), {
                        i: "i32",
                        p: "i32",
                        P: "i32",
                        s: "i32",
                        j: "i64",
                        f: "f32",
                        d: "f64",
                    }),
                    typeCodes: Object.assign(Object.create(null), {
                        f64: 0x7c,
                        f32: 0x7d,
                        i64: 0x7e,
                        i32: 0x7f,
                    }),
                    uleb128Encode(tgt, method, n) {
                        if (n < 128) {
                            tgt[method](n);
                        } else {
                            tgt[method](n % 128 | 128, n >> 7);
                        }
                    },
                    rxJSig: /^(\w)\((\w*)\)$/,
                    sigParams(signature) {
                        const match = fn._cache.rxJSig.exec(signature);
                        return match ? match[2] : signature.substr(1);
                    },
                    letterType(letter) {
                        const type = fn._cache.sigTypes[letter];
                        return type || toss("Invalid signature letter:", letter);
                    },
                    pushSigType(dest, letter) {
                        dest.push(
                            fn._cache.typeCodes[fn._cache.letterType(letter)]
                        );
                    },
                };
            }

            if (typeof func === "string") {
                const temp = sig;
                sig = func;
                func = temp;
            }

            const sigParams = fn._cache.sigParams(sig);
            const wasmCode = [0x01, 0x60];
            fn._cache.uleb128Encode(wasmCode, "push", sigParams.length);
            for (const param of sigParams) {
                fn._cache.pushSigType(wasmCode, param);
            }
            if (sig[0] === "v") {
                wasmCode.push(0);
            } else {
                wasmCode.push(1);
                fn._cache.pushSigType(wasmCode, sig[0]);
            }
            fn._cache.uleb128Encode(wasmCode, "unshift", wasmCode.length);
            wasmCode.unshift(
                0x00,
                0x61,
                0x73,
                0x6d,
                0x01,
                0x00,
                0x00,
                0x00,
                0x01
            );
            wasmCode.push(
                0x02,
                0x07,
                0x01,
                0x01,
                0x65,
                0x01,
                0x66,
                0x00,
                0x00,
                0x07,
                0x05,
                0x01,
                0x01,
                0x66,
                0x00,
                0x00
            );
            return new WebAssembly.Instance(
                new WebAssembly.Module(new Uint8Array(wasmCode)),
                { e: { f: func } }
            ).exports.f;
        };
    }

    /**
     * Adds pointer-aware peek/poke helpers and numeric inspections.
     */
    attachMemoryAccessors() {
        const { target } = this;
        const ptrIR = this.ptrIR;
        const readValue = (ptr, type) => {
            const heap = this.getHeapViews();
            switch (type) {
                case "i1":
                case "i8":
                    return heap.HEAP8[ptr >> 0];
                case "i16":
                    return heap.HEAP16[ptr >> 1];
                case "i32":
                    return heap.HEAP32[ptr >> 2];
                case "float":
                case "f32":
                    return heap.HEAP32F[ptr >> 2];
                case "double":
                case "f64":
                    return Number(heap.HEAP64F[ptr >> 3]);
                case "i64":
                    if (this.target.bigIntEnabled) {
                        return BigInt(heap.HEAP64[ptr >> 3]);
                    }
                    this.toss("Invalid type for peek():", type);
                    break;
                default:
                    this.toss("Invalid type for peek():", type);
            }
        };

        const writeValue = (ptr, value, type) => {
            const heap = this.getHeapViews();
            switch (type) {
                case "i1":
                case "i8":
                    heap.HEAP8[ptr >> 0] = value;
                    return;
                case "i16":
                    heap.HEAP16[ptr >> 1] = value;
                    return;
                case "i32":
                    heap.HEAP32[ptr >> 2] = value;
                    return;
                case "float":
                case "f32":
                    heap.HEAP32F[ptr >> 2] = value;
                    return;
                case "double":
                case "f64":
                    heap.HEAP64F[ptr >> 3] = value;
                    return;
                case "i64":
                    if (heap.HEAP64) {
                        heap.HEAP64[ptr >> 3] = BigInt(value);
                        return;
                    }
                    this.toss("Invalid type for poke():", type);
                    break;
                default:
                    this.toss("Invalid type for poke():", type);
            }
        };

        target.peek = (ptr, type = "i8") => {
            const requests = Array.isArray(ptr) ? ptr : [ptr];
            const resolvedType = type.endsWith("*") ? ptrIR : type;
            const results = requests.map((address) =>
                readValue(address, resolvedType)
            );
            return Array.isArray(ptr) ? results : results[0];
        };

        target.poke = (ptr, value, type = "i8") => {
            const targets = Array.isArray(ptr) ? ptr : [ptr];
            const resolvedType = type.endsWith("*") ? ptrIR : type;
            for (const address of targets) {
                writeValue(address, value, resolvedType);
            }
            return target;
        };

        target.peekPtr = (...args) =>
            target.peek(args.length === 1 ? args[0] : args, ptrIR);
        target.pokePtr = (ptr, value = 0) => target.poke(ptr, value, ptrIR);
        target.peek8 = (...args) =>
            target.peek(args.length === 1 ? args[0] : args, "i8");
        target.poke8 = (ptr, value) => target.poke(ptr, value, "i8");
        target.peek16 = (...args) =>
            target.peek(args.length === 1 ? args[0] : args, "i16");
        target.poke16 = (ptr, value) => target.poke(ptr, value, "i16");
        target.peek32 = (...args) =>
            target.peek(args.length === 1 ? args[0] : args, "i32");
        target.poke32 = (ptr, value) => target.poke(ptr, value, "i32");
        target.peek64 = (...args) =>
            target.peek(args.length === 1 ? args[0] : args, "i64");
        target.poke64 = (ptr, value) => target.poke(ptr, value, "i64");
        target.peek32f = (...args) =>
            target.peek(args.length === 1 ? args[0] : args, "f32");
        target.poke32f = (ptr, value) => target.poke(ptr, value, "f32");
        target.peek64f = (...args) =>
            target.peek(args.length === 1 ? args[0] : args, "f64");
        target.poke64f = (ptr, value) => target.poke(ptr, value, "f64");

        target.getMemValue = target.peek;
        target.getPtrValue = target.peekPtr;
        target.setMemValue = target.poke;
        target.setPtrValue = target.pokePtr;

        target.isPtr32 = (ptr) =>
            typeof ptr === "number" && ptr === (ptr | 0) && ptr >= 0;
        target.isPtr = target.isPtr32;
    }

    /**
     * Adds string conversion helpers (cstrlen, cstrToJs, jstrlen, jstrcpy ...).
     */
    attachStringUtilities() {
        const { target, cache } = this;
        const sabCtor =
            typeof SharedArrayBuffer === "undefined" ? undefined : SharedArrayBuffer;
        const decodeUtf8 = (view, begin, end) =>
            cache.utf8Decoder.decode(
                view.buffer instanceof sabCtor
                    ? view.slice(begin, end)
                    : view.subarray(begin, end)
            );

        target.cstrlen = (ptr) => {
            if (!ptr || !target.isPtr(ptr)) {
                return null;
            }
            const heap = this.getHeapViews().HEAP8U;
            let position = ptr;
            while (heap[position] !== 0) {
                position++;
            }
            return position - ptr;
        };

        target.cstrToJs = (ptr) => {
            const length = target.cstrlen(ptr);
            if (length === null) {
                return null;
            }
            if (length === 0) {
                return "";
            }
            const heap = this.getHeapViews().HEAP8U;
            return decodeUtf8(heap, ptr, ptr + length);
        };

        target.jstrlen = (str) => {
            if (typeof str !== "string") return null;
            let length = 0;
            for (let i = 0; i < str.length; ++i) {
                let code = str.charCodeAt(i);
                if (code >= 0xd800 && code <= 0xdfff) {
                    code =
                        (0x10000 + ((code & 0x3ff) << 10)) |
                        (str.charCodeAt(++i) & 0x3ff);
                }
                if (code <= 0x7f) length += 1;
                else if (code <= 0x7ff) length += 2;
                else if (code <= 0xffff) length += 3;
                else length += 4;
            }
            return length;
        };

        target.jstrcpy = (
            jstr,
            tgt,
            offset = 0,
            maxBytes = -1,
            addNul = true
        ) => {
            if (
                !tgt ||
                (!(tgt instanceof Int8Array) && !(tgt instanceof Uint8Array))
            ) {
                this.toss(
                    "jstrcpy() target must be an Int8Array or Uint8Array."
                );
            }
            if (maxBytes < 0) {
                maxBytes = tgt.length - offset;
            }
            if (!(maxBytes > 0) || !(offset >= 0)) {
                return 0;
            }

            const begin = offset;
            const end = offset + maxBytes - (addNul ? 1 : 0);
            for (let i = 0; i < jstr.length && offset < end; ++i) {
                let code = jstr.charCodeAt(i);
                if (code >= 0xd800 && code <= 0xdfff) {
                    code =
                        (0x10000 + ((code & 0x3ff) << 10)) |
                        (jstr.charCodeAt(++i) & 0x3ff);
                }
                if (code <= 0x7f) {
                    tgt[offset++] = code;
                } else if (code <= 0x7ff) {
                    if (offset + 1 >= end) break;
                    tgt[offset++] = 0xc0 | (code >> 6);
                    tgt[offset++] = 0x80 | (code & 0x3f);
                } else if (code <= 0xffff) {
                    if (offset + 2 >= end) break;
                    tgt[offset++] = 0xe0 | (code >> 12);
                    tgt[offset++] = 0x80 | ((code >> 6) & 0x3f);
                    tgt[offset++] = 0x80 | (code & 0x3f);
                } else {
                    if (offset + 3 >= end) break;
                    tgt[offset++] = 0xf0 | (code >> 18);
                    tgt[offset++] = 0x80 | ((code >> 12) & 0x3f);
                    tgt[offset++] = 0x80 | ((code >> 6) & 0x3f);
                    tgt[offset++] = 0x80 | (code & 0x3f);
                }
            }

            if (addNul) {
                tgt[offset++] = 0;
            }
            return offset - begin;
        };

        target.cstrncpy = (tgtPtr, srcPtr, n) => {
            if (!tgtPtr || !srcPtr) {
                this.toss("cstrncpy() does not accept NULL strings.");
            }
            if (n < 0) {
                n = target.cstrlen(srcPtr) + 1;
            } else if (!(n > 0)) {
                return 0;
            }

            const heap = target.heap8u();
            let i = 0;
            let ch;
            for (; i < n && (ch = heap[srcPtr + i]); ++i) {
                heap[tgtPtr + i] = ch;
            }
            if (i < n) {
                heap[tgtPtr + i++] = 0;
            }
            return i;
        };

        target.jstrToUintArray = (str, addNul = false) =>
            cache.utf8Encoder.encode(addNul ? `${str}\0` : str);

        target.allocCString = (jstr, returnWithLength = false) =>
            this.allocCStringInternal(
                jstr,
                returnWithLength,
                target.alloc,
                "allocCString()"
            );
    }

    /**
     * Ensures the target exposes alloc/dealloc before scoped alloc calls.
     * @param {string} funcName - Name used in the error message.
     */
    assertAllocator(funcName) {
        const { target } = this;
        if (
            !(target.alloc instanceof Function) ||
            !(target.dealloc instanceof Function)
        ) {
            this.toss(
                "Object is missing alloc() and/or dealloc() function(s) required by",
                funcName
            );
        }
    }

    /**
     * Shared implementation for allocCString / scopedAllocCString.
     * @param {string} jstr - JavaScript string to copy.
     * @param {boolean} returnWithLength - Whether to return [ptr, length].
     * @param {Function} allocator - Allocation function.
     * @param {string} funcName - Context for error reporting.
     * @returns {number|[number, number]|null} Pointer (or tuple) or null.
     */
    allocCStringInternal(jstr, returnWithLength, allocator, funcName) {
        this.assertAllocator(funcName);
        if (typeof jstr !== "string") {
            return null;
        }
        const bytes = this.cache.utf8Encoder.encode(jstr);
        const ptr = allocator(bytes.length + 1);
        const heap = this.getHeapViews().HEAP8U;
        heap.set(bytes, ptr);
        heap[ptr + bytes.length] = 0;
        return returnWithLength ? [ptr, bytes.length] : ptr;
    }

    /**
     * Adds scoped allocation helpers and argv utilities.
     */
    attachScopedAllocators() {
        const { target, cache } = this;

        target.scopedAllocPush = () => {
            this.assertAllocator("scopedAllocPush");
            const scope = [];
            cache.scopedAlloc.push(scope);
            return scope;
        };

        target.scopedAllocPop = (state) => {
            this.assertAllocator("scopedAllocPop");
            const index =
                arguments.length === 0
                    ? cache.scopedAlloc.length - 1
                    : cache.scopedAlloc.indexOf(state);
            if (index < 0) {
                this.toss("Invalid state object for scopedAllocPop().");
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
                this.toss("No scopedAllocPush() scope is active.");
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
                this.toss("The 'active' property is read-only.");
            },
        });

        target.scopedAllocCString = (jstr, returnWithLength = false) =>
            this.allocCStringInternal(
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
                allocator((list.length + 1) * target.ptrSizeof) || this.toss(
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
            this.assertAllocator(allocatorName);
            const pointerIR = safePtrSize ? "i64" : this.ptrIR;
            const stride = safePtrSize ? 8 : this.ptrSizeof;
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
            target.exports[name] || this.toss("Cannot find exported symbol:", name);

        target.xCall = (fname, ...args) => {
            const fn =
                fname instanceof Function ? fname : target.xGet(fname);
            if (!(fn instanceof Function)) {
                this.toss("Exported symbol", fname, "is not a function.");
            }
            if (fn.length !== args.length) {
                this.toss(
                    (fn === fname ? fn.name : fname) + "() requires",
                    fn.length,
                    "argument(s)."
                );
            }
            if (args.length === 1 && Array.isArray(args[0])) {
                return fn.apply(null, args[0]);
            }
            return fn.apply(null, args);
        };
    }

    /**
     * Populates xWrap argument/result adapters and associated helpers.
     */
    attachXWrapAdapters() {
        const { target, cache } = this;
        const argConverters = cache.xWrap.convert.arg;
        const resultConverters = cache.xWrap.convert.result;
        const ptrAdapter =
            this.ptrIR === "i32"
                ? (value) => value | 0
                : (value) => BigInt(value) | BigInt(0);

        if (target.bigIntEnabled) {
            argConverters.set("i64", (value) => BigInt(value));
        }

        argConverters
            .set("i32", ptrAdapter)
            .set("i16", (value) => (value | 0) & 0xffff)
            .set("i8", (value) => (value | 0) & 0xff)
            .set("f32", (value) => Number(value).valueOf())
            .set("float", (value) => Number(value).valueOf())
            .set("f64", (value) => Number(value).valueOf())
            .set("double", (value) => Number(value).valueOf())
            .set("int", (value) => (value | 0) & 0xffffffff)
            .set("null", (value) => value)
            .set(null, (value) => value)
            .set("**", ptrAdapter)
            .set("*", ptrAdapter);

        resultConverters
            .set("*", ptrAdapter)
            .set("pointer", ptrAdapter)
            .set("number", (value) => Number(value))
            .set("void", () => undefined)
            .set("null", (value) => value)
            .set(null, (value) => value);

        const copyThrough = [
            "i8",
            "i16",
            "i32",
            "int",
            "f32",
            "float",
            "f64",
            "double",
        ];
        if (target.bigIntEnabled) {
            copyThrough.push("i64");
        }
        for (const type of copyThrough) {
            argConverters.set(`${type}*`, ptrAdapter);
            resultConverters.set(`${type}*`, ptrAdapter);
            resultConverters.set(
                type,
                argConverters.get(type) ||
                    this.toss("Missing arg converter:", type)
            );
        }

        const stringArgAdapter = (value) => {
            if (typeof value === "string") {
                return target.scopedAllocCString(value);
            }
            return value ? ptrAdapter(value) : null;
        };

        argConverters
            .set("string", stringArgAdapter)
            .set("utf8", stringArgAdapter)
            .set("pointer", stringArgAdapter);

        resultConverters
            .set("string", (ptr) => target.cstrToJs(ptr))
            .set("utf8", (ptr) => target.cstrToJs(ptr))
            .set("string:dealloc", (ptr) => {
                try {
                    return ptr ? target.cstrToJs(ptr) : null;
                } finally {
                    target.dealloc(ptr);
                }
            })
            .set("utf8:dealloc", (ptr) => {
                try {
                    return ptr ? target.cstrToJs(ptr) : null;
                } finally {
                    target.dealloc(ptr);
                }
            })
            .set("json", (ptr) => JSON.parse(target.cstrToJs(ptr)))
            .set("json:dealloc", (ptr) => {
                try {
                    return ptr ? JSON.parse(target.cstrToJs(ptr)) : null;
                } finally {
                    target.dealloc(ptr);
                }
            });

        /**
         * Abstract base class used to customise argument conversion.
         */
        class AbstractArgAdapter {
            constructor(options) {
                this.name = options.name || "unnamed adapter";
            }

            convertArg() {
                throw new Error("AbstractArgAdapter must be subclassed.");
            }
        }

        const installer = this;
        class FuncPtrAdapter extends AbstractArgAdapter {
            constructor(options) {
                super(options);
                if (FuncPtrAdapter.warnOnUse) {
                    console.warn(
                        "xArg.FuncPtrAdapter is an internal-only API and is not intended for client code.",
                        options
                    );
                }
                this.signature =
                    options.signature ||
                    installer.toss(
                        "FuncPtrAdapter options requires a signature."
                    );
                if (options.contextKey instanceof Function) {
                    this.contextKey = options.contextKey;
                    if (!options.bindScope) {
                        options.bindScope = "context";
                    }
                }
                this.bindScope =
                    options.bindScope ||
                    installer.toss(
                        "FuncPtrAdapter options requires a bindScope."
                    );
                if (!FuncPtrAdapter.bindScopes.includes(this.bindScope)) {
                    installer.toss(
                        "Invalid options.bindScope (",
                        options.bindScope,
                        ") for FuncPtrAdapter. Expecting one of:",
                        FuncPtrAdapter.bindScopes.join(", ")
                    );
                }
                this.isTransient = this.bindScope === "transient";
                this.isContext = this.bindScope === "context";
                this.singleton = this.bindScope === "singleton" ? [] : undefined;
                this.callProxy =
                    options.callProxy instanceof Function
                        ? options.callProxy
                        : undefined;
            }

            contextKey(argv, argIndex) {
                return `${argv}:${argIndex}`;
            }

            contextMap(key) {
                const map = this.__contextMap || (this.__contextMap = new Map());
                let entry = map.get(key);
                if (entry === undefined) {
                    map.set(key, (entry = []));
                }
                return entry;
            }

            convertArg(value, argv, argIndex) {
                const pair = this.isContext
                    ? this.contextMap(this.contextKey(argv, argIndex))
                    : this.singleton;
                if (pair && pair[0] === value) {
                    return pair[1];
                }
                if (value instanceof Function) {
                    const callback = this.callProxy
                        ? this.callProxy(value)
                        : value;
                    const pointer = installer.installFunctionInternal(
                        callback,
                        this.signature,
                        this.isTransient
                    );
                    if (pair) {
                        if (pair[1]) {
                            try {
                                cache.scopedAlloc[
                                    cache.scopedAlloc.length - 1
                                ].push(pair[1]);
                            } catch (_error) {
                                // If no scope is active, just fall through.
                            }
                        }
                        pair[0] = callback;
                        pair[1] = pointer;
                    }
                    return pointer;
                }
                if (
                    target.isPtr(value) ||
                    value === null ||
                    typeof value === "undefined"
                ) {
                    if (pair && pair[1] && pair[1] !== value) {
                        try {
                            cache.scopedAlloc[
                                cache.scopedAlloc.length - 1
                            ].push(pair[1]);
                        } catch (_error) {}
                        pair[0] = pair[1] = value | 0;
                    }
                    return value || 0;
                }
                throw new TypeError(
                    `Invalid FuncPtrAdapter argument type. Expecting a function pointer or a ${this.name} function matching signature ${this.signature}.`
                );
            }
        }

        FuncPtrAdapter.warnOnUse = false;
        FuncPtrAdapter.debugFuncInstall = false;
        FuncPtrAdapter.debugOut = console.debug.bind(console);
        FuncPtrAdapter.bindScopes = [
            "transient",
            "context",
            "singleton",
            "permanent",
        ];

        const ensureArgAdapter = (type) =>
            argConverters.get(type) ||
            this.toss("Argument adapter not found:", type);
        const ensureResultAdapter = (type) =>
            resultConverters.get(type) ||
            this.toss("Result adapter not found:", type);

        cache.xWrap.convertArg = (type, ...args) =>
            ensureArgAdapter(type)(...args);
        cache.xWrap.convertArgNoCheck = (type, ...args) =>
            argConverters.get(type)(...args);
        cache.xWrap.convertResult = (type, value) =>
            type === null
                ? value
                : type
                ? ensureResultAdapter(type)(value)
                : undefined;
        cache.xWrap.convertResultNoCheck = (type, value) =>
            type === null ? value : type ? resultConverters.get(type)(value) : undefined;

        target.xWrap = function xWrap(fArg, resultType, ...argTypes) {
            if (arguments.length === 3 && Array.isArray(arguments[2])) {
                argTypes = arguments[2];
            }

            if (target.isPtr(fArg)) {
                fArg =
                    target.functionEntry(fArg) ||
                    this.toss("Function pointer not found in WASM function table.");
            }

            const fn =
                fArg instanceof Function ? fArg : target.xGet(fArg);
            const fnName = fArg instanceof Function ? fArg.name || "unnamed function" : fArg;

            if (argTypes.length !== fn.length) {
                this.toss(fnName + "() requires", fn.length, "argument(s).");
            }

            if (resultType !== undefined && resultType !== null) {
                ensureResultAdapter(resultType);
            }

            const verifiedArgTypes = argTypes.map((type) => {
                if (type instanceof AbstractArgAdapter) {
                    argConverters.set(
                        type,
                        (...args) => type.convertArg(...args)
                    );
                    return type;
                }
                ensureArgAdapter(type);
                return type;
            });

            if (fn.length === 0) {
                return (...callArgs) => {
                    if (callArgs.length) {
                        this.toss(fnName + "() requires", fn.length, "argument(s).");
                    }
                    return cache.xWrap.convertResult(resultType, fn.call(null));
                };
            }

            return (...callArgs) => {
                if (callArgs.length !== fn.length) {
                    this.toss(fnName + "() requires", fn.length, "argument(s).");
                }
                const scope = target.scopedAllocPush();
                try {
                    for (let i = 0; i < callArgs.length; ++i) {
                        callArgs[i] = cache.xWrap.convertArgNoCheck(
                            verifiedArgTypes[i],
                            callArgs[i],
                            callArgs,
                            i
                        );
                    }
                    return cache.xWrap.convertResultNoCheck(
                        resultType,
                        fn.apply(null, callArgs)
                    );
                } finally {
                    target.scopedAllocPop(scope);
                }
            };
        };

        const configureAdapter = (
            method,
            argsLength,
            typeName,
            adapter,
            modeName,
            map
        ) => {
            if (typeof typeName === "string") {
                if (argsLength === 1) {
                    return map.get(typeName);
                }
                if (argsLength === 2) {
                    if (!adapter) {
                        map.delete(typeName);
                        return method;
                    }
                    if (!(adapter instanceof Function)) {
                        this.toss(modeName, "requires a function argument.");
                    }
                    map.set(typeName, adapter);
                    return method;
                }
            }
            this.toss("Invalid arguments to", modeName);
        };

        target.xWrap.resultAdapter = function resultAdapter(typeName, adapter) {
            return configureAdapter(
                target.xWrap.resultAdapter,
                arguments.length,
                typeName,
                adapter,
                "resultAdapter()",
                resultConverters
            );
        };

        target.xWrap.argAdapter = function argAdapter(typeName, adapter) {
            return configureAdapter(
                target.xWrap.argAdapter,
                arguments.length,
                typeName,
                adapter,
                "argAdapter()",
                argConverters
            );
        };

        target.xWrap.FuncPtrAdapter = FuncPtrAdapter;
        target.xCallWrapped = (
            fArg,
            resultType,
            argTypes,
            ...callArgs
        ) => {
            if (Array.isArray(arguments[3])) {
                callArgs = arguments[3];
            }
            return target
                .xWrap(fArg, resultType, argTypes || [])
                .apply(null, callArgs || []);
        };

        target.xWrap.testConvertArg = cache.xWrap.convertArg;
        target.xWrap.testConvertResult = cache.xWrap.convertResult;
    }
}

/**
 * Builds a loader helper that mirrors the original yawl() helper while using
 * the new installer implementation under the hood.
 *
 * @param {(target: object) => object} install - Installer returned by createWhWasmUtilInstaller.
 * @returns {(config: object) => () => Promise<WebAssembly.WebAssemblyInstantiatedSource>} Factory returning
 *   a function that loads and instantiates the WASM module.
 */
function createYawlLoader(install) {
    return function yawl(config) {
        const options = config && typeof config === "object" ? config : {};
        const fetchWasm = () =>
            fetch(options.uri, { credentials: "same-origin" });

        const finalize = (result) => {
            if (options.wasmUtilTarget) {
                const target = options.wasmUtilTarget;
                const toss = (...args) => {
                    throw new Error(args.join(" "));
                };
                target.module = result.module;
                target.instance = result.instance;

                if (!target.instance.exports.memory) {
                    target.memory =
                        (options.imports &&
                            options.imports.env &&
                            options.imports.env.memory) ||
                        toss("Missing 'memory' object!");
                }
                if (!target.alloc && result.instance.exports.malloc) {
                    const wasmExports = result.instance.exports;
                    target.alloc = (n) =>
                        wasmExports.malloc(n) ||
                        toss("Allocation of", n, "bytes failed.");
                    target.dealloc = (ptr) => wasmExports.free(ptr);
                }
                install(target);
            }
            if (options.onload) {
                options.onload(result, options);
            }
            return result;
        };

        const instantiate = () => {
            if (
                typeof WebAssembly.instantiateStreaming === "function" &&
                !(options.noStreaming instanceof Function
                    ? options.noStreaming()
                    : options.noStreaming)
            ) {
                return WebAssembly.instantiateStreaming(
                    fetchWasm(),
                    options.imports || {}
                ).then(finalize);
            }
            return fetchWasm()
                .then((response) => response.arrayBuffer())
                .then((bytes) =>
                    WebAssembly.instantiate(bytes, options.imports || {})
                )
                .then(finalize);
        };

        return instantiate;
    };
}
