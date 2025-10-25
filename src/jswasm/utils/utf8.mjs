/**
 * UTF-8 encoding and decoding utilities.
 * Provides functions for converting between JavaScript strings and UTF-8 byte arrays.
 */

/** UTF-8 encoding constants and bit masks. */
const UTF8_CONSTANTS = {
    /** Maximum single-byte character value (0-127). */
    MAX_SINGLE_BYTE: 0x7f,
    /** Maximum two-byte character value. */
    MAX_TWO_BYTES: 0x7ff,
    /** Maximum three-byte character value. */
    MAX_THREE_BYTES: 0xffff,
    /** Maximum code point value (BMP limit). */
    MAX_BMP: 0x10000,
    /** High surrogate start. */
    HIGH_SURROGATE_START: 0xd800,
    /** High surrogate end. */
    HIGH_SURROGATE_END: 0xdfff,
    /** Low surrogate start. */
    LOW_SURROGATE_START: 0xdc00,
    /** Surrogate offset for code point calculation. */
    SURROGATE_OFFSET: 0x10000,
    /** Surrogate mask. */
    SURROGATE_MASK: 0x3ff,
};

/** UTF-8 byte sequence prefixes and masks. */
const UTF8_BYTE_MASKS = {
    /** Single-byte character mask (0xxxxxxx). */
    SINGLE_BYTE_MASK: 0x80,
    /** Two-byte prefix (110xxxxx). */
    TWO_BYTE_PREFIX: 0xc0,
    /** Two-byte check mask. */
    TWO_BYTE_MASK: 0xe0,
    /** Three-byte prefix (1110xxxx). */
    THREE_BYTE_PREFIX: 0xe0,
    /** Three-byte check mask. */
    THREE_BYTE_MASK: 0xf0,
    /** Four-byte prefix (11110xxx). */
    FOUR_BYTE_PREFIX: 0xf0,
    /** Continuation byte prefix (10xxxxxx). */
    CONTINUATION_PREFIX: 0x80,
    /** Continuation byte mask. */
    CONTINUATION_MASK: 63,
    /** Two-byte data mask. */
    TWO_BYTE_DATA_MASK: 31,
    /** Three-byte data mask. */
    THREE_BYTE_DATA_MASK: 15,
    /** Four-byte data mask. */
    FOUR_BYTE_DATA_MASK: 7,
};

/** Minimum length threshold for using TextDecoder optimization. */
const TEXT_DECODER_THRESHOLD = 16;

/**
 * TextDecoder instance for UTF-8 decoding.
 */
const UTF8Decoder =
    typeof TextDecoder !== "undefined" ? new TextDecoder() : undefined;

/**
 * Converts a UTF-8 encoded byte array to a JavaScript string.
 *
 * @param {import("./utf8.d.ts").UTF8ByteArray} heapOrArray - The byte array containing UTF-8 encoded data.
 * @param {number} [idx=0] - Starting index in the array.
 * @param {number} [maxBytesToRead=NaN] - Maximum number of bytes to read.
 * @returns {string} The decoded string.
 */
export function UTF8ArrayToString(heapOrArray, idx = 0, maxBytesToRead = NaN) {
    // 1. Input handling
    const endIdx = idx + maxBytesToRead;
    let endPtr = idx;

    // Find the end of the string (null terminator or max bytes)
    while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;

    // 2. Core processing - use TextDecoder for longer strings if available
    if (
        endPtr - idx > TEXT_DECODER_THRESHOLD &&
        heapOrArray.buffer &&
        UTF8Decoder
    ) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
    }

    // Manual UTF-8 decoding for shorter strings or when TextDecoder unavailable
    let decodedString = "";

    while (idx < endPtr) {
        let byte0 = heapOrArray[idx++];

        // 2.1 Single-byte character (ASCII)
        if (!(byte0 & UTF8_BYTE_MASKS.SINGLE_BYTE_MASK)) {
            decodedString += String.fromCharCode(byte0);
            continue;
        }

        // 2.2 Multi-byte character
        const byte1 = heapOrArray[idx++] & UTF8_BYTE_MASKS.CONTINUATION_MASK;

        if (
            (byte0 & UTF8_BYTE_MASKS.TWO_BYTE_MASK) ===
            UTF8_BYTE_MASKS.TWO_BYTE_PREFIX
        ) {
            // Two-byte character
            decodedString += String.fromCharCode(
                ((byte0 & UTF8_BYTE_MASKS.TWO_BYTE_DATA_MASK) << 6) | byte1,
            );
            continue;
        }

        const byte2 = heapOrArray[idx++] & UTF8_BYTE_MASKS.CONTINUATION_MASK;

        if (
            (byte0 & UTF8_BYTE_MASKS.THREE_BYTE_MASK) ===
            UTF8_BYTE_MASKS.THREE_BYTE_PREFIX
        ) {
            // Three-byte character
            byte0 =
                ((byte0 & UTF8_BYTE_MASKS.THREE_BYTE_DATA_MASK) << 12) |
                (byte1 << 6) |
                byte2;
        } else {
            // Four-byte character
            byte0 =
                ((byte0 & UTF8_BYTE_MASKS.FOUR_BYTE_DATA_MASK) << 18) |
                (byte1 << 12) |
                (byte2 << 6) |
                (heapOrArray[idx++] & UTF8_BYTE_MASKS.CONTINUATION_MASK);
        }

        // 2.3 Convert code point to character(s)
        if (byte0 < UTF8_CONSTANTS.MAX_BMP) {
            decodedString += String.fromCharCode(byte0);
        } else {
            // Surrogate pair for code points outside BMP
            const codePoint = byte0 - UTF8_CONSTANTS.MAX_BMP;
            decodedString += String.fromCharCode(
                UTF8_CONSTANTS.HIGH_SURROGATE_START | (codePoint >> 10),
                UTF8_CONSTANTS.LOW_SURROGATE_START |
                    (codePoint & UTF8_CONSTANTS.SURROGATE_MASK),
            );
        }
    }

    // 3. Output handling
    return decodedString;
}

/**
 * Calculates the byte length of a string when encoded as UTF-8.
 *
 * @param {string} str - The string to measure.
 * @returns {number} The byte length in UTF-8 encoding.
 */
export const lengthBytesUTF8 = (str) => {
    // 1. Input handling
    let totalBytes = 0;

    // 2. Core processing - calculate byte length for each character
    for (let i = 0; i < str.length; ++i) {
        const charCode = str.charCodeAt(i);

        if (charCode <= UTF8_CONSTANTS.MAX_SINGLE_BYTE) {
            totalBytes++;
        } else if (charCode <= UTF8_CONSTANTS.MAX_TWO_BYTES) {
            totalBytes += 2;
        } else if (
            charCode >= UTF8_CONSTANTS.HIGH_SURROGATE_START &&
            charCode <= UTF8_CONSTANTS.HIGH_SURROGATE_END
        ) {
            // Surrogate pair (4 bytes)
            totalBytes += 4;
            ++i; // Skip the next character (low surrogate)
        } else {
            totalBytes += 3;
        }
    }

    // 3. Output handling
    return totalBytes;
};

/**
 * Encodes a JavaScript string as UTF-8 into a byte array.
 *
 * @param {string} str - The string to encode.
 * @param {import("./utf8.d.ts").UTF8ByteArray} heap - The destination byte array.
 * @param {number} outIdx - Starting index in the destination array.
 * @param {number} maxBytesToWrite - Maximum bytes to write (including null terminator).
 * @returns {number} Number of bytes written (excluding null terminator).
 */
export const stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
    // 1. Input handling
    if (!(maxBytesToWrite > 0)) return 0;

    const startIdx = outIdx;
    const endIdx = outIdx + maxBytesToWrite - 1;

    // 2. Core processing - encode string to UTF-8
    for (let i = 0; i < str.length; ++i) {
        let codePoint = str.charCodeAt(i);

        // 2.1 Handle surrogate pairs
        if (
            codePoint >= UTF8_CONSTANTS.HIGH_SURROGATE_START &&
            codePoint <= UTF8_CONSTANTS.HIGH_SURROGATE_END
        ) {
            const lowSurrogate = str.charCodeAt(++i);
            codePoint =
                (UTF8_CONSTANTS.SURROGATE_OFFSET +
                    ((codePoint & UTF8_CONSTANTS.SURROGATE_MASK) << 10)) |
                (lowSurrogate & UTF8_CONSTANTS.SURROGATE_MASK);
        }

        // 2.2 Encode based on character range
        if (codePoint <= UTF8_CONSTANTS.MAX_SINGLE_BYTE) {
            // Single-byte character (ASCII)
            if (outIdx >= endIdx) break;
            heap[outIdx++] = codePoint;
        } else if (codePoint <= UTF8_CONSTANTS.MAX_TWO_BYTES) {
            // Two-byte character
            if (outIdx + 1 >= endIdx) break;
            heap[outIdx++] = UTF8_BYTE_MASKS.TWO_BYTE_PREFIX | (codePoint >> 6);
            heap[outIdx++] =
                UTF8_BYTE_MASKS.CONTINUATION_PREFIX |
                (codePoint & UTF8_BYTE_MASKS.CONTINUATION_MASK);
        } else if (codePoint <= UTF8_CONSTANTS.MAX_THREE_BYTES) {
            // Three-byte character
            if (outIdx + 2 >= endIdx) break;
            heap[outIdx++] =
                UTF8_BYTE_MASKS.THREE_BYTE_PREFIX | (codePoint >> 12);
            heap[outIdx++] =
                UTF8_BYTE_MASKS.CONTINUATION_PREFIX |
                ((codePoint >> 6) & UTF8_BYTE_MASKS.CONTINUATION_MASK);
            heap[outIdx++] =
                UTF8_BYTE_MASKS.CONTINUATION_PREFIX |
                (codePoint & UTF8_BYTE_MASKS.CONTINUATION_MASK);
        } else {
            // Four-byte character
            if (outIdx + 3 >= endIdx) break;
            heap[outIdx++] =
                UTF8_BYTE_MASKS.FOUR_BYTE_PREFIX | (codePoint >> 18);
            heap[outIdx++] =
                UTF8_BYTE_MASKS.CONTINUATION_PREFIX |
                ((codePoint >> 12) & UTF8_BYTE_MASKS.CONTINUATION_MASK);
            heap[outIdx++] =
                UTF8_BYTE_MASKS.CONTINUATION_PREFIX |
                ((codePoint >> 6) & UTF8_BYTE_MASKS.CONTINUATION_MASK);
            heap[outIdx++] =
                UTF8_BYTE_MASKS.CONTINUATION_PREFIX |
                (codePoint & UTF8_BYTE_MASKS.CONTINUATION_MASK);
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
    const byteLength = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
    const byteArray = new Array(byteLength);

    // 2. Core processing
    const numBytesWritten = stringToUTF8Array(
        stringy,
        byteArray,
        0,
        byteArray.length,
    );

    // 3. Output handling
    if (dontAddNull) byteArray.length = numBytesWritten;
    return byteArray;
}
