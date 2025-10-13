/**
 * UTF-8 encoding and decoding utilities.
 * Provides functions for converting between JavaScript strings and UTF-8 byte arrays.
 */

/**
 * TextDecoder instance for UTF-8 decoding.
 */
const UTF8Decoder =
    typeof TextDecoder != "undefined" ? new TextDecoder() : undefined;

/**
 * Converts a UTF-8 encoded byte array to a JavaScript string.
 *
 * @param {Uint8Array|Array} heapOrArray - The byte array containing UTF-8 encoded data.
 * @param {number} [idx=0] - Starting index in the array.
 * @param {number} [maxBytesToRead=NaN] - Maximum number of bytes to read.
 * @returns {string} The decoded string.
 */
export function UTF8ArrayToString(heapOrArray, idx = 0, maxBytesToRead = NaN) {
    var endIdx = idx + maxBytesToRead;
    var endPtr = idx;

    while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;

    if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
    }
    var str = "";

    while (idx < endPtr) {
        var u0 = heapOrArray[idx++];
        if (!(u0 & 0x80)) {
            str += String.fromCharCode(u0);
            continue;
        }
        var u1 = heapOrArray[idx++] & 63;
        if ((u0 & 0xe0) == 0xc0) {
            str += String.fromCharCode(((u0 & 31) << 6) | u1);
            continue;
        }
        var u2 = heapOrArray[idx++] & 63;
        if ((u0 & 0xf0) == 0xe0) {
            u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
        } else {
            u0 =
                ((u0 & 7) << 18) |
                (u1 << 12) |
                (u2 << 6) |
                (heapOrArray[idx++] & 63);
        }

        if (u0 < 0x10000) {
            str += String.fromCharCode(u0);
        } else {
            var ch = u0 - 0x10000;
            str += String.fromCharCode(
                0xd800 | (ch >> 10),
                0xdc00 | (ch & 0x3ff)
            );
        }
    }
    return str;
}

/**
 * Calculates the byte length of a string when encoded as UTF-8.
 *
 * @param {string} str - The string to measure.
 * @returns {number} The byte length in UTF-8 encoding.
 */
export const lengthBytesUTF8 = (str) => {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
        var c = str.charCodeAt(i);
        if (c <= 0x7f) {
            len++;
        } else if (c <= 0x7ff) {
            len += 2;
        } else if (c >= 0xd800 && c <= 0xdfff) {
            len += 4;
            ++i;
        } else {
            len += 3;
        }
    }
    return len;
};

/**
 * Encodes a JavaScript string as UTF-8 into a byte array.
 *
 * @param {string} str - The string to encode.
 * @param {Uint8Array|Array} heap - The destination byte array.
 * @param {number} outIdx - Starting index in the destination array.
 * @param {number} maxBytesToWrite - Maximum bytes to write (including null terminator).
 * @returns {number} Number of bytes written (excluding null terminator).
 */
export const stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
    // 1. Input handling
    if (!(maxBytesToWrite > 0)) return 0;

    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;

    // 2. Core processing - encode string to UTF-8
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 0xd800 && u <= 0xdfff) {
            var u1 = str.charCodeAt(++i);
            u = (0x10000 + ((u & 0x3ff) << 10)) | (u1 & 0x3ff);
        }
        if (u <= 0x7f) {
            if (outIdx >= endIdx) break;
            heap[outIdx++] = u;
        } else if (u <= 0x7ff) {
            if (outIdx + 1 >= endIdx) break;
            heap[outIdx++] = 0xc0 | (u >> 6);
            heap[outIdx++] = 0x80 | (u & 63);
        } else if (u <= 0xffff) {
            if (outIdx + 2 >= endIdx) break;
            heap[outIdx++] = 0xe0 | (u >> 12);
            heap[outIdx++] = 0x80 | ((u >> 6) & 63);
            heap[outIdx++] = 0x80 | (u & 63);
        } else {
            if (outIdx + 3 >= endIdx) break;
            heap[outIdx++] = 0xf0 | (u >> 18);
            heap[outIdx++] = 0x80 | ((u >> 12) & 63);
            heap[outIdx++] = 0x80 | ((u >> 6) & 63);
            heap[outIdx++] = 0x80 | (u & 63);
        }
    }

    // 3. Output handling - add null terminator and return length
    heap[outIdx] = 0;
    return outIdx - startIdx;
};

/**
 * Converts a string to a byte array with UTF-8 encoding.
 *
 * @param {string} stringy - The string to convert.
 * @param {boolean} [dontAddNull] - If true, don't add null terminator.
 * @param {number} [length] - Explicit length to use.
 * @returns {Array} The encoded byte array.
 */
export function intArrayFromString(stringy, dontAddNull, length) {
    // 1. Input handling
    var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
    var u8array = new Array(len);

    // 2. Core processing
    var numBytesWritten = stringToUTF8Array(
        stringy,
        u8array,
        0,
        u8array.length
    );

    // 3. Output handling
    if (dontAddNull) u8array.length = numBytesWritten;
    return u8array;
}
