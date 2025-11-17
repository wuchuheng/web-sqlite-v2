/**
 * Memory utility functions for WebAssembly operations
 * Provides memory initialization, zeroing, alignment, and allocation helpers.
 */

/** 64KB alignment boundary for mmap-style allocations */
const MMAP_ALIGNMENT_BYTES = 65_536;

/** Function that fills a typed array with random values. */
export type RandomFillFunction = <T extends ArrayBufferView>(view: T) => T;

/** Signature for the Emscripten built-in memalign function. */
export type BuiltinMemalign = (alignment: number, size: number) => number;

/** Allocates 64KB-aligned memory blocks. */
export type MmapAllocator = (size: number) => number;

/** Initializes the environment-specific random fill helper. */
export const initRandomFill = (): RandomFillFunction => {
  // 1. Input handling - verify `crypto.getRandomValues` exists.
  const hasCrypto =
    typeof crypto === "object" && typeof crypto.getRandomValues === "function";
  if (!hasCrypto) {
    // 3. Output handling - abort when Web Crypto is unavailable.
    throw new Error("initRandomDevice: crypto.getRandomValues not available");
  }

  // 2. Core processing - return the platform random fill handler.
  return (view) => crypto.getRandomValues(view);
};

/** Lazily initialized random fill helper. */
export let randomFill: RandomFillFunction = (view) => {
  // 1. Input handling - ensure the helper is initialized.
  randomFill = initRandomFill();
  // 2. Core processing - fill the view using the initialized helper.
  // 3. Output handling - return the filled view.
  return randomFill(view);
};

/**
 * Zeros a region of the WASM heap.
 * @param heap - Uint8Array representation of WASM memory.
 * @param address - Starting address to zero.
 * @param size - Number of bytes to clear.
 */
export const zeroMemory = (
  heap: Uint8Array,
  address: number,
  size: number,
): void => {
  // 1. Input handling - rely on typed-array bounds.
  // 2. Core processing - overwrite with 0.
  heap.fill(0, address, address + size);
  // 3. Output handling - no return value.
};

/**
 * Rounds a size up to the next alignment boundary.
 * @param size - Size to align.
 * @param alignment - Alignment boundary.
 */
export const alignMemory = (size: number, alignment: number): number => {
  // 1. Input handling - trust the caller for valid alignment.
  // 2. Core processing - compute the aligned value.
  const aligned = Math.ceil(size / alignment) * alignment;
  // 3. Output handling - return the aligned size.
  return aligned;
};

/**
 * Creates an allocator that mirrors mmap alignment semantics.
 * @param memalign - Emscripten memalign helper.
 * @param heap - Uint8Array heap array for zeroing.
 */
export const createMmapAlloc = (
  memalign: BuiltinMemalign,
  heap: Uint8Array,
): MmapAllocator => {
  return (size) => {
    // 1. Input handling - align the requested size.
    const alignedSize = alignMemory(size, MMAP_ALIGNMENT_BYTES);
    // 2. Core processing - allocate via Emscripten helper.
    const pointer = memalign(MMAP_ALIGNMENT_BYTES, alignedSize);
    // 3. Output handling - zero memory and return the pointer.
    if (pointer !== 0) {
      zeroMemory(heap, pointer, alignedSize);
    }
    return pointer;
  };
};
