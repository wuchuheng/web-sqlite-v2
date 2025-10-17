/**
 * Types for UTF-8 helper utilities shared by the SQLite WebAssembly bundle.
 */

export type UTF8ByteArray = Uint8Array | number[];

/** Converts a UTF-8 encoded byte array to a JavaScript string. */
export function UTF8ArrayToString(
    heapOrArray: UTF8ByteArray,
    idx?: number,
    maxBytesToRead?: number
): string;

/** Calculates the number of bytes required to encode a string in UTF-8. */
export function lengthBytesUTF8(str: string): number;

/**
 * Writes the UTF-8 representation of `str` into `heap` starting at `outIdx`.
 *
 * @returns Number of bytes written, excluding the trailing null terminator.
 */
export function stringToUTF8Array(
    str: string,
    heap: UTF8ByteArray,
    outIdx: number,
    maxBytesToWrite: number
): number;
