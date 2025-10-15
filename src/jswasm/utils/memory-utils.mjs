/**
 * Memory utility functions for WebAssembly operations
 * Provides memory initialization, zeroing, alignment, and allocation helpers
 */

/** 64KB alignment boundary for mmap-style allocations */
const MMAP_ALIGNMENT_BYTES = 65536;

/**
 * Initialize random fill function using crypto.getRandomValues
 * @returns {Function} Function that fills a view with random values
 * @throws {Error} If crypto.getRandomValues is not available
 */
export const initRandomFill = () => {
    // 1. Input validation
    if (
        typeof crypto === "object" &&
        typeof crypto["getRandomValues"] === "function"
    ) {
        // 2. Core processing - return crypto random fill function
        return (view) => crypto.getRandomValues(view);
    } else {
        // 3. Output handling - abort if not available
        throw new Error(
            "initRandomDevice: crypto.getRandomValues not available"
        );
    }
};

/**
 * Lazily initialized random fill function
 * First call initializes the function, subsequent calls use cached version
 * @param {TypedArray} view - Typed array view to fill with random values
 * @returns {TypedArray} The filled view
 */
export let randomFill = (view) => {
    // 1. Input handling - initialize on first call
    randomFill = initRandomFill();

    // 2. Core processing - call initialized function
    // 3. Output handling
    return randomFill(view);
};

/**
 * Zero out a region of memory in HEAPU8
 * @param {Uint8Array} HEAPU8 - Uint8 heap array
 * @param {number} address - Starting address to zero
 * @param {number} size - Number of bytes to zero
 */
export const zeroMemory = (HEAPU8, address, size) => {
    // 1. Input validation (implicit through fill)
    // 2. Core processing - fill with zeros
    HEAPU8.fill(0, address, address + size);
    // 3. Output handling - void return
};

/**
 * Align a size to a given alignment boundary
 * Rounds up to the nearest multiple of alignment
 * @param {number} size - Size to align
 * @param {number} alignment - Alignment boundary (must be power of 2)
 * @returns {number} Aligned size
 */
export const alignMemory = (size, alignment) => {
    // 1. Input handling (implicit)
    // 2. Core processing - calculate aligned size
    return Math.ceil(size / alignment) * alignment;
};

/**
 * Allocate memory with mmap-style alignment
 * Allocates 64KB-aligned memory blocks and zeros them
 * @param {Function} _emscripten_builtin_memalign - Emscripten memalign function
 * @param {Uint8Array} HEAPU8 - Uint8 heap array for zeroing
 * @param {number} size - Size to allocate (will be aligned to 64KB)
 * @returns {number} Pointer to allocated memory, or 0 on failure
 */
export const createMmapAlloc = (_emscripten_builtin_memalign, HEAPU8) => {
    return (size) => {
        // 1. Input handling - align size to 64KB
        const alignedSize = alignMemory(size, MMAP_ALIGNMENT_BYTES);

        // 2. Core processing - allocate aligned memory
        const ptr = _emscripten_builtin_memalign(
            MMAP_ALIGNMENT_BYTES,
            alignedSize
        );

        // 3. Output handling - zero memory and return pointer
        if (ptr) {
            zeroMemory(HEAPU8, ptr, alignedSize);
        }
        return ptr;
    };
};
