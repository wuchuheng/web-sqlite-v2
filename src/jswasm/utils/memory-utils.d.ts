/**
 * Function that fills a typed array with random values.
 */
export type RandomFillFunction = <T extends ArrayBufferView>(view: T) => T;

/**
 * Initializes the environment-specific random fill helper.
 */
export declare const initRandomFill: () => RandomFillFunction;

/**
 * Lazily initialized random fill helper.
 */
export declare let randomFill: RandomFillFunction;

/**
 * Zeros a region of the WASM heap.
 */
export declare const zeroMemory: (
  heap: Uint8Array,
  address: number,
  size: number,
) => void;

/**
 * Rounds a size up to the next alignment boundary.
 */
export declare const alignMemory: (size: number, alignment: number) => number;

/**
 * Signature for the Emscripten built-in memalign function.
 */
export type BuiltinMemalign = (alignment: number, size: number) => number;

/**
 * Allocates 64KB-aligned memory blocks.
 */
export type MmapAllocator = (size: number) => number;

/**
 * Creates an allocator that mirrors mmap alignment semantics.
 */
export declare const createMmapAlloc: (
  memalign: BuiltinMemalign,
  heap: Uint8Array,
) => MmapAllocator;
