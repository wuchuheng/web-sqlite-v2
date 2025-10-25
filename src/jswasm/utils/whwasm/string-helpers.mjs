/**
 * @fileoverview String and UTF-8 helpers for the wh-wasm utilities.
 */

import { assertAllocator } from "./utils.mjs";

/**
 * Adds string conversion helpers (cstrlen, cstrToJs, etc.) to the target.
 *
 * @param {import("./installer-context.mjs").WhWasmInstallerContext} context
 */
export function attachStringUtilities(context) {
    const { target, cache } = context;
    const sabCtor =
        typeof SharedArrayBuffer === "undefined"
            ? undefined
            : SharedArrayBuffer;
    const decodeUtf8 = (view, begin, end) =>
        cache.utf8Decoder.decode(
            view.buffer instanceof sabCtor
                ? view.slice(begin, end)
                : view.subarray(begin, end),
        );

    /**
     * Calculates the byte length of a null-terminated C string.
     *
     * @param {import("../../sqlite3.d.ts").WasmPointer | null} ptr
     * @returns {number | null}
     */
    target.cstrlen = (ptr) => {
        if (!ptr || !target.isPtr(ptr)) {
            return null;
        }
        const heap = context.getHeapViews().HEAP8U;
        let position = ptr;
        while (heap[position] !== 0) {
            position++;
        }
        return position - ptr;
    };

    /**
     * Converts a pointer to a UTF-8 encoded C string into a JavaScript string.
     *
     * @param {import("../../sqlite3.d.ts").WasmPointer | null} ptr
     * @returns {string | null}
     */
    target.cstrToJs = (ptr) => {
        const length = target.cstrlen(ptr);
        if (length === null) {
            return null;
        }
        if (length === 0) {
            return "";
        }
        const heap = context.getHeapViews().HEAP8U;
        return decodeUtf8(heap, ptr, ptr + length);
    };

    /**
     * Computes the UTF-8 encoded byte length of a JavaScript string.
     *
     * @param {string | null} str
     * @returns {number | null}
     */
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

    /**
     * Copies a JavaScript string into a target UTF-8 buffer.
     *
     * @param {string} jstr
     * @param {Uint8Array | Int8Array | import("../../sqlite3.d.ts").WasmPointer} tgt
     * @param {number} [offset=0]
     * @param {number} [maxBytes=-1]
     * @param {boolean} [addNul=true]
     * @returns {number}
     */
    target.jstrcpy = (jstr, tgt, offset = 0, maxBytes = -1, addNul = true) => {
        if (
            !tgt ||
            (!(tgt instanceof Int8Array) && !(tgt instanceof Uint8Array))
        ) {
            context.toss(
                "jstrcpy() target must be an Int8Array or Uint8Array.",
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

    /**
     * Copies up to `n` bytes from one C string pointer to another.
     *
     * @param {import("../../sqlite3.d.ts").WasmPointer} tgtPtr
     * @param {import("../../sqlite3.d.ts").WasmPointer} srcPtr
     * @param {number} n
     * @returns {number}
     */
    target.cstrncpy = (tgtPtr, srcPtr, n) => {
        if (!tgtPtr || !srcPtr) {
            context.toss("cstrncpy() does not accept NULL strings.");
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

    /**
     * Encodes a JavaScript string into a Uint8Array, optionally NUL-terminated.
     *
     * @param {string} str
     * @param {boolean} [addNul=false]
     * @returns {Uint8Array}
     */
    target.jstrToUintArray = (str, addNul = false) =>
        cache.utf8Encoder.encode(addNul ? `${str}\0` : str);

    const allocCStringInternal = (
        jstr,
        returnWithLength,
        allocator,
        funcName,
    ) => {
        assertAllocator(context, funcName);
        if (typeof jstr !== "string") {
            return null;
        }
        const bytes = cache.utf8Encoder.encode(jstr);
        const ptr = allocator(bytes.length + 1);
        const heap = context.getHeapViews().HEAP8U;
        heap.set(bytes, ptr);
        heap[ptr + bytes.length] = 0;
        return returnWithLength ? [ptr, bytes.length] : ptr;
    };

    context.allocCStringInternal = allocCStringInternal;

    /**
     * Allocates a UTF-8 encoded copy of a JavaScript string on the wasm heap.
     *
     * @param {string} jstr
     * @param {boolean} [returnWithLength=false]
     * @returns {import("../../sqlite3.d.ts").WasmPointer | [import("../../sqlite3.d.ts").WasmPointer, number] | null}
     */
    target.allocCString = (jstr, returnWithLength = false) =>
        allocCStringInternal(
            jstr,
            returnWithLength,
            target.alloc,
            "allocCString()",
        );
}
