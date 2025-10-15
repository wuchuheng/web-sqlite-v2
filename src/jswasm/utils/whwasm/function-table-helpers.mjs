/**
 * @fileoverview Function-table helpers for the wh-wasm utility installer.
 */

/**
 * Attaches helpers for manipulating the indirect function table and stores
 * the internal installer callback on the context.
 *
 * @param {import("./installer-context.mjs").WhWasmInstallerContext} context
 */
export function attachFunctionTableUtilities(context) {
    const { target, cache } = context;

    target.functionTable = () => target.exports.__indirect_function_table;

    target.functionEntry = (pointer) => {
        const table = target.functionTable();
        return pointer < table.length ? table.get(pointer) : undefined;
    };

    target.jsFuncToWasm = createJsFuncToWasm(context);

    context.installFunctionInternal = (func, sig, scoped) => {
        if (scoped && !cache.scopedAlloc.length) {
            context.toss("No scopedAllocPush() scope is active.");
        }

        if (typeof func === "string") {
            const temp = sig;
            sig = func;
            func = temp;
        }

        if (typeof sig !== "string" || !(func instanceof Function)) {
            context.toss(
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
        context.installFunctionInternal(func, sig, false);

    target.scopedInstallFunction = (func, sig) =>
        context.installFunctionInternal(func, sig, true);

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
 * Creates the jsFuncToWasm adapter used by the original Emscripten glue.
 *
 * @param {import("./installer-context.mjs").WhWasmInstallerContext} context
 * @returns {(func: Function|string, sig: string) => Function}
 */
function createJsFuncToWasm(context) {
    const toss = context.toss.bind(context);
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
