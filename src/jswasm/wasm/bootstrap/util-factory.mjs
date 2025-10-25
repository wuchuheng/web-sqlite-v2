/**
 * Builds the set of utility helpers shared throughout the bootstrapper. These
 * helpers centralize TypedArray validation, BigInt boundary checks, and common
 * error-reporting helpers used by higher-level abstractions.
 *
 * @param {import("./util-factory.d.ts").BootstrapErrorFunctions} errorFns
 * @param {import("./util-factory.d.ts").BootstrapWasmBindings} wasm
 * @returns {import("./util-factory.d.ts").BootstrapUtilFactoryResult}
 */
export function createBootstrapUtil(errorFns, wasm) {
    const { toss3 } = errorFns;
    // The C bridge still relies on 32-bit pointers even when BigInt support is
    // compiled in. Guard the helper with a numeric-only check to avoid
    // accidental bigint coercion on comparisons.
    const isInt32 = (n) =>
        typeof n !== "bigint" &&
        !!(n === (n | 0) && n <= 0x7fffffff && n >= -0x80000000);

    const bigIntFits64 = (function () {
        let max;
        let min;
        return (value) => {
            if (!max) {
                max = BigInt("0x7fffffffffffffff");
                min = ~max;
            }
            return value >= min && value <= max;
        };
    })();

    const bigIntFits32 = (value) =>
        value >= -0x7fffffffn - 1n && value <= 0x7fffffffn;

    const bigIntFitsDouble = (function () {
        let min;
        let max;
        return (value) => {
            if (!min) {
                min = Number.MIN_SAFE_INTEGER;
                max = Number.MAX_SAFE_INTEGER;
            }
            return value >= min && value <= max;
        };
    })();

    const isTypedArray = (value) => {
        return value &&
            value.constructor &&
            isInt32(value.constructor.BYTES_PER_ELEMENT)
            ? value
            : false;
    };

    // SharedArrayBuffer isn't always available (e.g. in some test contexts).
    // Defer to a stub in that case so instanceof checks remain predictable.
    const sharedArrayBufferCtor =
        typeof SharedArrayBuffer === "undefined"
            ? function () {}
            : SharedArrayBuffer;

    const isSharedTypedArray = (typedArray) =>
        typedArray.buffer instanceof sharedArrayBufferCtor;

    const typedArrayPart = (typedArray, begin, end) =>
        isSharedTypedArray(typedArray)
            ? typedArray.slice(begin, end)
            : typedArray.subarray(begin, end);

    const isBindableTypedArray = (value) =>
        !!(
            value &&
            (value instanceof Uint8Array ||
                value instanceof Int8Array ||
                value instanceof ArrayBuffer)
        );

    const isSQLableTypedArray = isBindableTypedArray;

    const affirmBindableTypedArray = (value) =>
        isBindableTypedArray(value) ||
        toss3("Value is not of a supported TypedArray type.");

    const utf8Decoder = new TextDecoder("utf-8");
    const typedArrayToString = (typedArray, begin, end) =>
        utf8Decoder.decode(typedArrayPart(typedArray, begin, end));

    const flexibleString = (value) => {
        if (isSQLableTypedArray(value)) {
            return typedArrayToString(
                value instanceof ArrayBuffer ? new Uint8Array(value) : value,
            );
        } else if (Array.isArray(value)) {
            return value.join("");
        } else if (wasm.isPtr && wasm.cstrToJs && wasm.isPtr(value)) {
            return wasm.cstrToJs(value);
        }
        return value;
    };

    const util = {
        affirmBindableTypedArray,
        flexibleString,
        bigIntFits32,
        bigIntFits64,
        bigIntFitsDouble,
        isBindableTypedArray,
        isInt32,
        isSQLableTypedArray,
        isTypedArray,
        typedArrayToString,
        isUIThread: () =>
            globalThis.window === globalThis && !!globalThis.document,
        isSharedTypedArray,
        toss: (...args) => {
            throw new Error(args.join(" "));
        },
        toss3,
        typedArrayPart,
        // Run a lightweight signature check before assuming the buffer contains a
        // database. Corrupt or truncated sources should fail fast with a clear
        // message before hitting the WASM layer.
        affirmDbHeader: (bytes) => {
            if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
            const header = "SQLite format 3";
            if (header.length > bytes.byteLength) {
                toss3("Input does not contain an SQLite3 database header.");
            }
            for (let i = 0; i < header.length; ++i) {
                if (header.charCodeAt(i) !== bytes[i]) {
                    toss3("Input does not contain an SQLite3 database header.");
                }
            }
        },
        affirmIsDb: (bytes) => {
            if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
            const n = bytes.byteLength;
            if (n < 512 || n % 512 !== 0) {
                toss3("Byte array size", n, "is invalid for an SQLite3 db.");
            }
            util.affirmDbHeader(bytes);
        },
    };

    return { util };
}
