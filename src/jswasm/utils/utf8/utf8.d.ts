/**
 * UTF-8 encoding and decoding utilities.
 * Provides functions for converting between JavaScript strings and UTF-8 byte arrays.
 */
export type UTF8ByteArray = Uint8Array | number[];
/**
 * Converts a UTF-8 encoded byte array to a JavaScript string.
 */
export declare function UTF8ArrayToString(heapOrArray: UTF8ByteArray, idx?: number, maxBytesToRead?: number): string;
/**
 * Calculates the byte length of a string when encoded as UTF-8.
 */
export declare const lengthBytesUTF8: (str: string) => number;
/**
 * Encodes a JavaScript string as UTF-8 into a byte array.
 */
export declare const stringToUTF8Array: (str: string, heap: UTF8ByteArray, outIdx: number, maxBytesToWrite: number) => number;
/**
 * Converts a string to a byte array with UTF-8 encoding.
 */
export declare function intArrayFromString(stringy: string, dontAddNull?: boolean, length?: number): number[];
