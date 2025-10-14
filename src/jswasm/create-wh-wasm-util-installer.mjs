export function createWhWasmUtilInstaller() {
    const WhWasmUtilInstaller = function (target) {
                    "use strict";
                    if (undefined === target.bigIntEnabled) {
                        target.bigIntEnabled = !!globalThis["BigInt64Array"];
                    }

                    const toss = (...args) => {
                        throw new Error(args.join(" "));
                    };

                    if (!target.exports) {
                        Object.defineProperty(target, "exports", {
                            enumerable: true,
                            configurable: true,
                            get: () => target.instance && target.instance.exports,
                        });
                    }

                    const ptrIR = target.pointerIR || "i32";
                    const ptrSizeof = (target.ptrSizeof =
                        "i32" === ptrIR
                            ? 4
                            : "i64" === ptrIR
                            ? 8
                            : toss("Unhandled ptrSizeof:", ptrIR));

                    const cache = Object.create(null);

                    cache.heapSize = 0;

                    cache.memory = null;

                    cache.freeFuncIndexes = [];

                    cache.scopedAlloc = [];

                    cache.utf8Decoder = new TextDecoder();
                    cache.utf8Encoder = new TextEncoder("utf-8");

                    target.sizeofIR = (n) => {
                        switch (n) {
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
                                return ptrSizeof;
                            default:
                                return ("" + n).endsWith("*")
                                    ? ptrSizeof
                                    : undefined;
                        }
                    };

                    const heapWrappers = function () {
                        if (!cache.memory) {
                            cache.memory =
                                target.memory instanceof WebAssembly.Memory
                                    ? target.memory
                                    : target.exports.memory;
                        } else if (
                            cache.heapSize === cache.memory.buffer.byteLength
                        ) {
                            return cache;
                        }

                        const b = cache.memory.buffer;
                        cache.HEAP8 = new Int8Array(b);
                        cache.HEAP8U = new Uint8Array(b);
                        cache.HEAP16 = new Int16Array(b);
                        cache.HEAP16U = new Uint16Array(b);
                        cache.HEAP32 = new Int32Array(b);
                        cache.HEAP32U = new Uint32Array(b);
                        if (target.bigIntEnabled) {
                            cache.HEAP64 = new BigInt64Array(b);
                            cache.HEAP64U = new BigUint64Array(b);
                        }
                        cache.HEAP32F = new Float32Array(b);
                        cache.HEAP64F = new Float64Array(b);
                        cache.heapSize = b.byteLength;
                        return cache;
                    };

                    target.heap8 = () => heapWrappers().HEAP8;

                    target.heap8u = () => heapWrappers().HEAP8U;

                    target.heap16 = () => heapWrappers().HEAP16;

                    target.heap16u = () => heapWrappers().HEAP16U;

                    target.heap32 = () => heapWrappers().HEAP32;

                    target.heap32u = () => heapWrappers().HEAP32U;

                    target.heapForSize = function (n, unsigned = true) {
                        const c =
                            cache.memory &&
                            cache.heapSize === cache.memory.buffer.byteLength
                                ? cache
                                : heapWrappers();
                        switch (n) {
                            case Int8Array:
                                return c.HEAP8;
                            case Uint8Array:
                                return c.HEAP8U;
                            case Int16Array:
                                return c.HEAP16;
                            case Uint16Array:
                                return c.HEAP16U;
                            case Int32Array:
                                return c.HEAP32;
                            case Uint32Array:
                                return c.HEAP32U;
                            case 8:
                                return unsigned ? c.HEAP8U : c.HEAP8;
                            case 16:
                                return unsigned ? c.HEAP16U : c.HEAP16;
                            case 32:
                                return unsigned ? c.HEAP32U : c.HEAP32;
                            case 64:
                                if (c.HEAP64)
                                    return unsigned ? c.HEAP64U : c.HEAP64;
                                break;
                            default:
                                if (target.bigIntEnabled) {
                                    if (n === globalThis["BigUint64Array"])
                                        return c.HEAP64U;
                                    else if (n === globalThis["BigInt64Array"])
                                        return c.HEAP64;
                                    break;
                                }
                        }
                        toss(
                            "Invalid heapForSize() size: expecting 8, 16, 32,",
                            "or (if BigInt is enabled) 64."
                        );
                    };

                    target.functionTable = function () {
                        return target.exports.__indirect_function_table;
                    };

                    target.functionEntry = function (fptr) {
                        const ft = target.functionTable();
                        return fptr < ft.length ? ft.get(fptr) : undefined;
                    };

                    target.jsFuncToWasm = function f(func, sig) {
                        if (!f._) {
                            f._ = {
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

                                uleb128Encode: function (tgt, method, n) {
                                    if (n < 128) tgt[method](n);
                                    else tgt[method](n % 128 | 128, n >> 7);
                                },

                                rxJSig: /^(\w)\((\w*)\)$/,

                                sigParams: function (sig) {
                                    const m = f._.rxJSig.exec(sig);
                                    return m ? m[2] : sig.substr(1);
                                },

                                letterType: (x) =>
                                    f._.sigTypes[x] ||
                                    toss("Invalid signature letter:", x),

                                pushSigType: (dest, letter) =>
                                    dest.push(
                                        f._.typeCodes[f._.letterType(letter)]
                                    ),
                            };
                        }
                        if ("string" === typeof func) {
                            const x = sig;
                            sig = func;
                            func = x;
                        }
                        const sigParams = f._.sigParams(sig);
                        const wasmCode = [0x01, 0x60];
                        f._.uleb128Encode(wasmCode, "push", sigParams.length);
                        for (const x of sigParams) f._.pushSigType(wasmCode, x);
                        if ("v" === sig[0]) wasmCode.push(0);
                        else {
                            wasmCode.push(1);
                            f._.pushSigType(wasmCode, sig[0]);
                        }
                        f._.uleb128Encode(wasmCode, "unshift", wasmCode.length);
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
                            {
                                e: { f: func },
                            }
                        ).exports["f"];
                    };

                    const __installFunction = function f(func, sig, scoped) {
                        if (scoped && !cache.scopedAlloc.length) {
                            toss("No scopedAllocPush() scope is active.");
                        }
                        if ("string" === typeof func) {
                            const x = sig;
                            sig = func;
                            func = x;
                        }
                        if (
                            "string" !== typeof sig ||
                            !(func instanceof Function)
                        ) {
                            toss(
                                "Invalid arguments: expecting (function,signature) " +
                                    "or (signature,function)."
                            );
                        }
                        const ft = target.functionTable();
                        const oldLen = ft.length;
                        let ptr;
                        while (cache.freeFuncIndexes.length) {
                            ptr = cache.freeFuncIndexes.pop();
                            if (ft.get(ptr)) {
                                ptr = null;
                                continue;
                            } else {
                                break;
                            }
                        }
                        if (!ptr) {
                            ptr = oldLen;
                            ft.grow(1);
                        }
                        try {
                            ft.set(ptr, func);
                            if (scoped) {
                                cache.scopedAlloc[
                                    cache.scopedAlloc.length - 1
                                ].push(ptr);
                            }
                            return ptr;
                        } catch (e) {
                            if (!(e instanceof TypeError)) {
                                if (ptr === oldLen)
                                    cache.freeFuncIndexes.push(oldLen);
                                throw e;
                            }
                        }

                        try {
                            const fptr = target.jsFuncToWasm(func, sig);
                            ft.set(ptr, fptr);
                            if (scoped) {
                                cache.scopedAlloc[
                                    cache.scopedAlloc.length - 1
                                ].push(ptr);
                            }
                        } catch (e) {
                            if (ptr === oldLen) cache.freeFuncIndexes.push(oldLen);
                            throw e;
                        }
                        return ptr;
                    };

                    target.installFunction = (func, sig) =>
                        __installFunction(func, sig, false);

                    target.scopedInstallFunction = (func, sig) =>
                        __installFunction(func, sig, true);

                    target.uninstallFunction = function (ptr) {
                        if (!ptr && 0 !== ptr) return undefined;
                        const fi = cache.freeFuncIndexes;
                        const ft = target.functionTable();
                        fi.push(ptr);
                        const rc = ft.get(ptr);
                        ft.set(ptr, null);
                        return rc;
                    };

                    target.peek = function f(ptr, type = "i8") {
                        if (type.endsWith("*")) type = ptrIR;
                        const c =
                            cache.memory &&
                            cache.heapSize === cache.memory.buffer.byteLength
                                ? cache
                                : heapWrappers();
                        const list = Array.isArray(ptr) ? [] : undefined;
                        let rc;
                        do {
                            if (list) ptr = arguments[0].shift();
                            switch (type) {
                                case "i1":
                                case "i8":
                                    rc = c.HEAP8[ptr >> 0];
                                    break;
                                case "i16":
                                    rc = c.HEAP16[ptr >> 1];
                                    break;
                                case "i32":
                                    rc = c.HEAP32[ptr >> 2];
                                    break;
                                case "float":
                                case "f32":
                                    rc = c.HEAP32F[ptr >> 2];
                                    break;
                                case "double":
                                case "f64":
                                    rc = Number(c.HEAP64F[ptr >> 3]);
                                    break;
                                case "i64":
                                    if (target.bigIntEnabled) {
                                        rc = BigInt(c.HEAP64[ptr >> 3]);
                                        break;
                                    }
                                    toss("Invalid type for peek():", type);
                                    break;
                                default:
                                    toss("Invalid type for peek():", type);
                            }
                            if (list) list.push(rc);
                        } while (list && arguments[0].length);
                        return list || rc;
                    };

                    target.poke = function (ptr, value, type = "i8") {
                        if (type.endsWith("*")) type = ptrIR;
                        const c =
                            cache.memory &&
                            cache.heapSize === cache.memory.buffer.byteLength
                                ? cache
                                : heapWrappers();
                        for (const p of Array.isArray(ptr) ? ptr : [ptr]) {
                            switch (type) {
                                case "i1":
                                case "i8":
                                    c.HEAP8[p >> 0] = value;
                                    continue;
                                case "i16":
                                    c.HEAP16[p >> 1] = value;
                                    continue;
                                case "i32":
                                    c.HEAP32[p >> 2] = value;
                                    continue;
                                case "float":
                                case "f32":
                                    c.HEAP32F[p >> 2] = value;
                                    continue;
                                case "double":
                                case "f64":
                                    c.HEAP64F[p >> 3] = value;
                                    continue;
                                case "i64":
                                    if (c.HEAP64) {
                                        c.HEAP64[p >> 3] = BigInt(value);
                                        continue;
                                    }
                                    toss("Invalid type for poke(): " + type);
                                    break;
                                default:
                                    toss("Invalid type for poke(): " + type);
                            }
                        }
                        return this;
                    };

                    target.peekPtr = (...ptr) =>
                        target.peek(1 === ptr.length ? ptr[0] : ptr, ptrIR);

                    target.pokePtr = (ptr, value = 0) =>
                        target.poke(ptr, value, ptrIR);

                    target.peek8 = (...ptr) =>
                        target.peek(1 === ptr.length ? ptr[0] : ptr, "i8");

                    target.poke8 = (ptr, value) => target.poke(ptr, value, "i8");

                    target.peek16 = (...ptr) =>
                        target.peek(1 === ptr.length ? ptr[0] : ptr, "i16");

                    target.poke16 = (ptr, value) => target.poke(ptr, value, "i16");

                    target.peek32 = (...ptr) =>
                        target.peek(1 === ptr.length ? ptr[0] : ptr, "i32");

                    target.poke32 = (ptr, value) => target.poke(ptr, value, "i32");

                    target.peek64 = (...ptr) =>
                        target.peek(1 === ptr.length ? ptr[0] : ptr, "i64");

                    target.poke64 = (ptr, value) => target.poke(ptr, value, "i64");

                    target.peek32f = (...ptr) =>
                        target.peek(1 === ptr.length ? ptr[0] : ptr, "f32");

                    target.poke32f = (ptr, value) => target.poke(ptr, value, "f32");

                    target.peek64f = (...ptr) =>
                        target.peek(1 === ptr.length ? ptr[0] : ptr, "f64");

                    target.poke64f = (ptr, value) => target.poke(ptr, value, "f64");

                    target.getMemValue = target.peek;

                    target.getPtrValue = target.peekPtr;

                    target.setMemValue = target.poke;

                    target.setPtrValue = target.pokePtr;

                    target.isPtr32 = (ptr) =>
                        "number" === typeof ptr && ptr === (ptr | 0) && ptr >= 0;

                    target.isPtr = target.isPtr32;

                    target.cstrlen = function (ptr) {
                        if (!ptr || !target.isPtr(ptr)) return null;
                        const h = heapWrappers().HEAP8U;
                        let pos = ptr;
                        for (; h[pos] !== 0; ++pos) {
                            // advance until nul terminator
                        }
                        return pos - ptr;
                    };

                    const __SAB =
                        "undefined" === typeof SharedArrayBuffer
                            ? function () {}
                            : SharedArrayBuffer;
                    const __utf8Decode = function (arrayBuffer, begin, end) {
                        return cache.utf8Decoder.decode(
                            arrayBuffer.buffer instanceof __SAB
                                ? arrayBuffer.slice(begin, end)
                                : arrayBuffer.subarray(begin, end)
                        );
                    };

                    target.cstrToJs = function (ptr) {
                        const n = target.cstrlen(ptr);
                        return n
                            ? __utf8Decode(heapWrappers().HEAP8U, ptr, ptr + n)
                            : null === n
                            ? n
                            : "";
                    };

                    target.jstrlen = function (str) {
                        if ("string" !== typeof str) return null;
                        const n = str.length;
                        let len = 0;
                        for (let i = 0; i < n; ++i) {
                            let u = str.charCodeAt(i);
                            if (u >= 0xd800 && u <= 0xdfff) {
                                u =
                                    (0x10000 + ((u & 0x3ff) << 10)) |
                                    (str.charCodeAt(++i) & 0x3ff);
                            }
                            if (u <= 0x7f) ++len;
                            else if (u <= 0x7ff) len += 2;
                            else if (u <= 0xffff) len += 3;
                            else len += 4;
                        }
                        return len;
                    };

                    target.jstrcpy = function (
                        jstr,
                        tgt,
                        offset = 0,
                        maxBytes = -1,
                        addNul = true
                    ) {
                        if (
                            !tgt ||
                            (!(tgt instanceof Int8Array) &&
                                !(tgt instanceof Uint8Array))
                        ) {
                            toss(
                                "jstrcpy() target must be an Int8Array or Uint8Array."
                            );
                        }
                        if (maxBytes < 0) maxBytes = tgt.length - offset;
                        if (!(maxBytes > 0) || !(offset >= 0)) return 0;
                        let i = 0,
                            max = jstr.length;
                        const begin = offset,
                            end = offset + maxBytes - (addNul ? 1 : 0);
                        for (; i < max && offset < end; ++i) {
                            let u = jstr.charCodeAt(i);
                            if (u >= 0xd800 && u <= 0xdfff) {
                                u =
                                    (0x10000 + ((u & 0x3ff) << 10)) |
                                    (jstr.charCodeAt(++i) & 0x3ff);
                            }
                            if (u <= 0x7f) {
                                if (offset >= end) break;
                                tgt[offset++] = u;
                            } else if (u <= 0x7ff) {
                                if (offset + 1 >= end) break;
                                tgt[offset++] = 0xc0 | (u >> 6);
                                tgt[offset++] = 0x80 | (u & 0x3f);
                            } else if (u <= 0xffff) {
                                if (offset + 2 >= end) break;
                                tgt[offset++] = 0xe0 | (u >> 12);
                                tgt[offset++] = 0x80 | ((u >> 6) & 0x3f);
                                tgt[offset++] = 0x80 | (u & 0x3f);
                            } else {
                                if (offset + 3 >= end) break;
                                tgt[offset++] = 0xf0 | (u >> 18);
                                tgt[offset++] = 0x80 | ((u >> 12) & 0x3f);
                                tgt[offset++] = 0x80 | ((u >> 6) & 0x3f);
                                tgt[offset++] = 0x80 | (u & 0x3f);
                            }
                        }
                        if (addNul) tgt[offset++] = 0;
                        return offset - begin;
                    };

                    target.cstrncpy = function (tgtPtr, srcPtr, n) {
                        if (!tgtPtr || !srcPtr)
                            toss("cstrncpy() does not accept NULL strings.");
                        if (n < 0) n = target.cstrlen(srcPtr) + 1;
                        else if (!(n > 0)) return 0;
                        const heap = target.heap8u();
                        let i = 0,
                            ch;
                        for (; i < n && (ch = heap[srcPtr + i]); ++i) {
                            heap[tgtPtr + i] = ch;
                        }
                        if (i < n) heap[tgtPtr + i++] = 0;
                        return i;
                    };

                    target.jstrToUintArray = (str, addNul = false) => {
                        return cache.utf8Encoder.encode(addNul ? str + "\0" : str);
                    };

                    const __affirmAlloc = (obj, funcName) => {
                        if (
                            !(obj.alloc instanceof Function) ||
                            !(obj.dealloc instanceof Function)
                        ) {
                            toss(
                                "Object is missing alloc() and/or dealloc() function(s)",
                                "required by",
                                funcName + "()."
                            );
                        }
                    };

                    const __allocCStr = function (
                        jstr,
                        returnWithLength,
                        allocator,
                        funcName
                    ) {
                        __affirmAlloc(target, funcName);
                        if ("string" !== typeof jstr) return null;
                        const u = cache.utf8Encoder.encode(jstr),
                            ptr = allocator(u.length + 1),
                            heap = heapWrappers().HEAP8U;
                        heap.set(u, ptr);
                        heap[ptr + u.length] = 0;
                        return returnWithLength ? [ptr, u.length] : ptr;
                    };

                    target.allocCString = (jstr, returnWithLength = false) =>
                        __allocCStr(
                            jstr,
                            returnWithLength,
                            target.alloc,
                            "allocCString()"
                        );

                    target.scopedAllocPush = function () {
                        __affirmAlloc(target, "scopedAllocPush");
                        const a = [];
                        cache.scopedAlloc.push(a);
                        return a;
                    };

                    target.scopedAllocPop = function (state) {
                        __affirmAlloc(target, "scopedAllocPop");
                        const n = arguments.length
                            ? cache.scopedAlloc.indexOf(state)
                            : cache.scopedAlloc.length - 1;
                        if (n < 0)
                            toss("Invalid state object for scopedAllocPop().");
                        if (0 === arguments.length) state = cache.scopedAlloc[n];
                        cache.scopedAlloc.splice(n, 1);
                        for (let p; (p = state.pop()); ) {
                            if (target.functionEntry(p)) {
                                target.uninstallFunction(p);
                            } else target.dealloc(p);
                        }
                    };

                    target.scopedAlloc = function (n) {
                        if (!cache.scopedAlloc.length) {
                            toss("No scopedAllocPush() scope is active.");
                        }
                        const p = target.alloc(n);
                        cache.scopedAlloc[cache.scopedAlloc.length - 1].push(p);
                        return p;
                    };

                    Object.defineProperty(target.scopedAlloc, "level", {
                        configurable: false,
                        enumerable: false,
                        get: () => cache.scopedAlloc.length,
                        set: () => {
                            toss("The 'active' property is read-only.");
                        },
                    });

                    target.scopedAllocCString = (jstr, returnWithLength = false) =>
                        __allocCStr(
                            jstr,
                            returnWithLength,
                            target.scopedAlloc,
                            "scopedAllocCString()"
                        );

                    const __allocMainArgv = function (isScoped, list) {
                        const pList = target[isScoped ? "scopedAlloc" : "alloc"](
                            (list.length + 1) * target.ptrSizeof
                        );
                        let i = 0;
                        list.forEach((e) => {
                            target.pokePtr(
                                pList + target.ptrSizeof * i++,
                                target[
                                    isScoped ? "scopedAllocCString" : "allocCString"
                                ]("" + e)
                            );
                        });
                        target.pokePtr(pList + target.ptrSizeof * i, 0);
                        return pList;
                    };

                    target.scopedAllocMainArgv = (list) =>
                        __allocMainArgv(true, list);

                    target.allocMainArgv = (list) => __allocMainArgv(false, list);

                    target.cArgvToJs = (argc, pArgv) => {
                        const list = [];
                        for (let i = 0; i < argc; ++i) {
                            const arg = target.peekPtr(
                                pArgv + target.ptrSizeof * i
                            );
                            list.push(arg ? target.cstrToJs(arg) : null);
                        }
                        return list;
                    };

                    target.scopedAllocCall = function (func) {
                        target.scopedAllocPush();
                        try {
                            return func();
                        } finally {
                            target.scopedAllocPop();
                        }
                    };

                    const __allocPtr = function (howMany, safePtrSize, method) {
                        __affirmAlloc(target, method);
                        const pIr = safePtrSize ? "i64" : ptrIR;
                        let m = target[method](
                            howMany * (safePtrSize ? 8 : ptrSizeof)
                        );
                        target.poke(m, 0, pIr);
                        if (1 === howMany) {
                            return m;
                        }
                        const a = [m];
                        for (let i = 1; i < howMany; ++i) {
                            m += safePtrSize ? 8 : ptrSizeof;
                            a[i] = m;
                            target.poke(m, 0, pIr);
                        }
                        return a;
                    };

                    target.allocPtr = (howMany = 1, safePtrSize = true) =>
                        __allocPtr(howMany, safePtrSize, "alloc");

                    target.scopedAllocPtr = (howMany = 1, safePtrSize = true) =>
                        __allocPtr(howMany, safePtrSize, "scopedAlloc");

                    target.xGet = function (name) {
                        return (
                            target.exports[name] ||
                            toss("Cannot find exported symbol:", name)
                        );
                    };

                    const __argcMismatch = (f, n) =>
                        toss(f + "() requires", n, "argument(s).");

                    target.xCall = function (fname, ...args) {
                        const f =
                            fname instanceof Function ? fname : target.xGet(fname);
                        if (!(f instanceof Function))
                            toss("Exported symbol", fname, "is not a function.");
                        if (f.length !== args.length)
                            __argcMismatch(f === fname ? f.name : fname, f.length);
                        return 2 === arguments.length && Array.isArray(arguments[1])
                            ? f.apply(null, arguments[1])
                            : f.apply(null, args);
                    };

                    cache.xWrap = Object.create(null);
                    cache.xWrap.convert = Object.create(null);

                    cache.xWrap.convert.arg = new Map();

                    cache.xWrap.convert.result = new Map();
                    const xArg = cache.xWrap.convert.arg,
                        xResult = cache.xWrap.convert.result;

                    if (target.bigIntEnabled) {
                        xArg.set("i64", (i) => BigInt(i));
                    }
                    const __xArgPtr =
                        "i32" === ptrIR
                            ? (i) => i | 0
                            : (i) => BigInt(i) | BigInt(0);
                    xArg.set("i32", __xArgPtr)
                        .set("i16", (i) => (i | 0) & 0xffff)
                        .set("i8", (i) => (i | 0) & 0xff)
                        .set("f32", (i) => Number(i).valueOf())
                        .set("float", xArg.get("f32"))
                        .set("f64", xArg.get("f32"))
                        .set("double", xArg.get("f64"))
                        .set("int", xArg.get("i32"))
                        .set("null", (i) => i)
                        .set(null, xArg.get("null"))
                        .set("**", __xArgPtr)
                        .set("*", __xArgPtr);
                    xResult
                        .set("*", __xArgPtr)
                        .set("pointer", __xArgPtr)
                        .set("number", (v) => Number(v))
                        .set("void", () => undefined)
                        .set("null", (v) => v)
                        .set(null, xResult.get("null"));

                    {
                        const copyToResult = [
                            "i8",
                            "i16",
                            "i32",
                            "int",
                            "f32",
                            "float",
                            "f64",
                            "double",
                        ];
                        if (target.bigIntEnabled) copyToResult.push("i64");
                        const adaptPtr = xArg.get(ptrIR);
                        for (const t of copyToResult) {
                            xArg.set(t + "*", adaptPtr);
                            xResult.set(t + "*", adaptPtr);
                            xResult.set(
                                t,
                                xArg.get(t) || toss("Missing arg converter:", t)
                            );
                        }
                    }

                    const __xArgString = function (v) {
                        if ("string" === typeof v)
                            return target.scopedAllocCString(v);
                        return v ? __xArgPtr(v) : null;
                    };
                    xArg.set("string", __xArgString)
                        .set("utf8", __xArgString)
                        .set("pointer", __xArgString);

                    xResult
                        .set("string", (i) => target.cstrToJs(i))
                        .set("utf8", xResult.get("string"))
                        .set("string:dealloc", (i) => {
                            try {
                                return i ? target.cstrToJs(i) : null;
                            } finally {
                                target.dealloc(i);
                            }
                        })
                        .set("utf8:dealloc", xResult.get("string:dealloc"))
                        .set("json", (i) => JSON.parse(target.cstrToJs(i)))
                        .set("json:dealloc", (i) => {
                            try {
                                return i ? JSON.parse(target.cstrToJs(i)) : null;
                            } finally {
                                target.dealloc(i);
                            }
                        });

                    const AbstractArgAdapter = class {
                        constructor(opt) {
                            this.name = opt.name || "unnamed adapter";
                        }

                        convertArg(_v, _argv, _argIndex) {
                            toss("AbstractArgAdapter must be subclassed.");
                        }
                    };

                    xArg.FuncPtrAdapter = class FuncPtrAdapter extends (
                        AbstractArgAdapter
                    ) {
                        constructor(opt) {
                            super(opt);
                            if (xArg.FuncPtrAdapter.warnOnUse) {
                                console.warn(
                                    "xArg.FuncPtrAdapter is an internal-only API",
                                    "and is not intended to be invoked from",
                                    "client-level code. Invoked with:",
                                    opt
                                );
                            }
                            this.name = opt.name || "unnamed";
                            this.signature = opt.signature;
                            if (opt.contextKey instanceof Function) {
                                this.contextKey = opt.contextKey;
                                if (!opt.bindScope) opt.bindScope = "context";
                            }
                            this.bindScope =
                                opt.bindScope ||
                                toss(
                                    "FuncPtrAdapter options requires a bindScope (explicit or implied)."
                                );
                            if (
                                FuncPtrAdapter.bindScopes.indexOf(opt.bindScope) < 0
                            ) {
                                toss(
                                    "Invalid options.bindScope (" +
                                        opt.bindMod +
                                        ") for FuncPtrAdapter. " +
                                        "Expecting one of: (" +
                                        FuncPtrAdapter.bindScopes.join(", ") +
                                        ")"
                                );
                            }
                            this.isTransient = "transient" === this.bindScope;
                            this.isContext = "context" === this.bindScope;
                            this.isPermanent = "permanent" === this.bindScope;
                            this.singleton =
                                "singleton" === this.bindScope ? [] : undefined;

                            this.callProxy =
                                opt.callProxy instanceof Function
                                    ? opt.callProxy
                                    : undefined;
                        }

                        contextKey(_argv, _argIndex) {
                            return this;
                        }

                        contextMap(key) {
                            const cm = this.__cmap || (this.__cmap = new Map());
                            let rc = cm.get(key);
                            if (undefined === rc) cm.set(key, (rc = []));
                            return rc;
                        }

                        convertArg(v, argv, argIndex) {
                            let pair = this.singleton;
                            if (!pair && this.isContext) {
                                pair = this.contextMap(
                                    this.contextKey(argv, argIndex)
                                );
                            }
                            if (pair && pair[0] === v) return pair[1];
                            if (v instanceof Function) {
                                if (this.callProxy) v = this.callProxy(v);
                                const fp = __installFunction(
                                    v,
                                    this.signature,
                                    this.isTransient
                                );
                                if (FuncPtrAdapter.debugFuncInstall) {
                                    FuncPtrAdapter.debugOut(
                                        "FuncPtrAdapter installed",
                                        this,
                                        this.contextKey(argv, argIndex),
                                        "@" + fp,
                                        v
                                    );
                                }
                                if (pair) {
                                    if (pair[1]) {
                                        if (FuncPtrAdapter.debugFuncInstall) {
                                            FuncPtrAdapter.debugOut(
                                                "FuncPtrAdapter uninstalling",
                                                this,
                                                this.contextKey(argv, argIndex),
                                                "@" + pair[1],
                                                v
                                            );
                                        }
                                        try {
                                            cache.scopedAlloc[
                                                cache.scopedAlloc.length - 1
                                            ].push(pair[1]);
                                        } catch (_e) {}
                                    }
                                    pair[0] = v;
                                    pair[1] = fp;
                                }
                                return fp;
                            } else if (
                                target.isPtr(v) ||
                                null === v ||
                                undefined === v
                            ) {
                                if (pair && pair[1] && pair[1] !== v) {
                                    if (FuncPtrAdapter.debugFuncInstall) {
                                        FuncPtrAdapter.debugOut(
                                            "FuncPtrAdapter uninstalling",
                                            this,
                                            this.contextKey(argv, argIndex),
                                            "@" + pair[1],
                                            v
                                        );
                                    }
                                    try {
                                        cache.scopedAlloc[
                                            cache.scopedAlloc.length - 1
                                        ].push(pair[1]);
                                    } catch (_e) {}
                                    pair[0] = pair[1] = v | 0;
                                }
                                return v || 0;
                            } else {
                                throw new TypeError(
                                    "Invalid FuncPtrAdapter argument type. " +
                                        "Expecting a function pointer or a " +
                                        (this.name ? this.name + " " : "") +
                                        "function matching signature " +
                                        this.signature +
                                        "."
                                );
                            }
                        }
                    };

                    xArg.FuncPtrAdapter.warnOnUse = false;

                    xArg.FuncPtrAdapter.debugFuncInstall = false;

                    xArg.FuncPtrAdapter.debugOut = console.debug.bind(console);

                    xArg.FuncPtrAdapter.bindScopes = [
                        "transient",
                        "context",
                        "singleton",
                        "permanent",
                    ];

                    const __xArgAdapterCheck = (t) =>
                        xArg.get(t) || toss("Argument adapter not found:", t);

                    const __xResultAdapterCheck = (t) =>
                        xResult.get(t) || toss("Result adapter not found:", t);

                    cache.xWrap.convertArg = (t, ...args) =>
                        __xArgAdapterCheck(t)(...args);

                    cache.xWrap.convertArgNoCheck = (t, ...args) =>
                        xArg.get(t)(...args);

                    cache.xWrap.convertResult = (t, v) =>
                        null === t
                            ? v
                            : t
                            ? __xResultAdapterCheck(t)(v)
                            : undefined;

                    cache.xWrap.convertResultNoCheck = (t, v) =>
                        null === t ? v : t ? xResult.get(t)(v) : undefined;

                    target.xWrap = function (fArg, resultType, ...argTypes) {
                        if (3 === arguments.length && Array.isArray(arguments[2])) {
                            argTypes = arguments[2];
                        }
                        if (target.isPtr(fArg)) {
                            fArg =
                                target.functionEntry(fArg) ||
                                toss(
                                    "Function pointer not found in WASM function table."
                                );
                        }
                        const fIsFunc = fArg instanceof Function;
                        const xf = fIsFunc ? fArg : target.xGet(fArg);
                        if (fIsFunc) fArg = xf.name || "unnamed function";
                        if (argTypes.length !== xf.length)
                            __argcMismatch(fArg, xf.length);
                        if (null === resultType && 0 === xf.length) {
                            return xf;
                        }
                        if (undefined !== resultType && null !== resultType)
                            __xResultAdapterCheck(resultType);
                        for (const t of argTypes) {
                            if (t instanceof AbstractArgAdapter)
                                xArg.set(t, (...args) => t.convertArg(...args));
                            else __xArgAdapterCheck(t);
                        }
                        const cxw = cache.xWrap;
                        if (0 === xf.length) {
                            return (...args) =>
                                args.length
                                    ? __argcMismatch(fArg, xf.length)
                                    : cxw.convertResult(resultType, xf.call(null));
                        }
                        return function (...args) {
                            if (args.length !== xf.length)
                                __argcMismatch(fArg, xf.length);
                            const scope = target.scopedAllocPush();
                            try {
                                let i = 0;
                                for (; i < args.length; ++i)
                                    args[i] = cxw.convertArgNoCheck(
                                        argTypes[i],
                                        args[i],
                                        args,
                                        i
                                    );
                                return cxw.convertResultNoCheck(
                                    resultType,
                                    xf.apply(null, args)
                                );
                            } finally {
                                target.scopedAllocPop(scope);
                            }
                        };
                    };

                    const __xAdapter = function (
                        func,
                        argc,
                        typeName,
                        adapter,
                        modeName,
                        xcvPart
                    ) {
                        if ("string" === typeof typeName) {
                            if (1 === argc) return xcvPart.get(typeName);
                            else if (2 === argc) {
                                if (!adapter) {
                                    xcvPart.delete(typeName);
                                    return func;
                                } else if (!(adapter instanceof Function)) {
                                    toss(modeName, "requires a function argument.");
                                }
                                xcvPart.set(typeName, adapter);
                                return func;
                            }
                        }
                        toss("Invalid arguments to", modeName);
                    };

                    target.xWrap.resultAdapter = function f(typeName, adapter) {
                        return __xAdapter(
                            f,
                            arguments.length,
                            typeName,
                            adapter,
                            "resultAdapter()",
                            xResult
                        );
                    };

                    target.xWrap.argAdapter = function f(typeName, adapter) {
                        return __xAdapter(
                            f,
                            arguments.length,
                            typeName,
                            adapter,
                            "argAdapter()",
                            xArg
                        );
                    };

                    target.xWrap.FuncPtrAdapter = xArg.FuncPtrAdapter;

                    target.xCallWrapped = function (
                        fArg,
                        resultType,
                        argTypes,
                        ...args
                    ) {
                        if (Array.isArray(arguments[3])) args = arguments[3];
                        return target
                            .xWrap(fArg, resultType, argTypes || [])
                            .apply(null, args || []);
                    };

                    target.xWrap.testConvertArg = cache.xWrap.convertArg;

                    target.xWrap.testConvertResult = cache.xWrap.convertResult;

                    return target;
                };

                WhWasmUtilInstaller.yawl = function (config) {
                    const wfetch = () =>
                        fetch(config.uri, { credentials: "same-origin" });
                    const finalThen = function (arg) {
                        if (config.wasmUtilTarget) {
                            const toss = (...args) => {
                                throw new Error(args.join(" "));
                            };
                            const tgt = config.wasmUtilTarget;
                            tgt.module = arg.module;
                            tgt.instance = arg.instance;

                            if (!tgt.instance.exports.memory) {
                                tgt.memory =
                                    (config.imports &&
                                        config.imports.env &&
                                        config.imports.env.memory) ||
                                    toss("Missing 'memory' object!");
                            }
                            if (!tgt.alloc && arg.instance.exports.malloc) {
                                const exports = arg.instance.exports;
                                tgt.alloc = function (n) {
                                    return (
                                        exports.malloc(n) ||
                                        toss("Allocation of", n, "bytes failed.")
                                    );
                                };
                                tgt.dealloc = function (m) {
                                    exports.free(m);
                                };
                            }
                            WhWasmUtilInstaller(tgt);
                        }
                        if (config.onload) config.onload(arg, config);
                        return arg;
                    };
                    const loadWasm = WebAssembly.instantiateStreaming
                        ? function loadWasmStreaming() {
                              return WebAssembly.instantiateStreaming(
                                  wfetch(),
                                  config.imports || {}
                              ).then(finalThen);
                          }
                        : function loadWasmOldSchool() {
                              return wfetch()
                                  .then((response) => response.arrayBuffer())
                                  .then((bytes) =>
                                      WebAssembly.instantiate(
                                          bytes,
                                          config.imports || {}
                                      )
                                  )
                                  .then(finalThen);
                          };
                    return loadWasm;
                }.bind(WhWasmUtilInstaller);
    return WhWasmUtilInstaller;
}
