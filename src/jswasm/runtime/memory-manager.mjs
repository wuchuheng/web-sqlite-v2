/**
 * Memory management utilities for WebAssembly heap and memory operations.
 * Handles memory view updates, heap resizing, and memory allocation.
 *
 * @module runtime/memory-manager
 */

import { alignMemory } from "../utils/memory-utils/memory-utils.js";

/**
 * Creates a memory manager for WebAssembly heap operations.
 *
 * @param {WebAssembly.Memory} wasmMemory - The WebAssembly memory instance
 * @param {import("../shared/runtime-types.d.ts").RuntimeModule} Module - The Emscripten module object
 * @returns {import("../shared/runtime-types.d.ts").MemoryManager} Memory management functions and heap views
 */
export function createMemoryManager(wasmMemory, Module) {
    let HEAP8, HEAPU8, HEAP16, HEAP32, HEAPU32, HEAP64;

    /**
     * Updates all typed array views to point to the current WebAssembly memory buffer.
     * Must be called after memory growth operations.
     */
    function updateMemoryViews() {
        // 1. Get current memory buffer
        const b = wasmMemory.buffer;

        // 2. Create and assign all typed array views
        Module["HEAP8"] = HEAP8 = new Int8Array(b);
        Module["HEAP16"] = HEAP16 = new Int16Array(b);
        Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
        Module["HEAPU16"] = new Uint16Array(b);
        Module["HEAP32"] = HEAP32 = new Int32Array(b);
        Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
        Module["HEAPF32"] = new Float32Array(b);
        Module["HEAPF64"] = new Float64Array(b);
        Module["HEAP64"] = HEAP64 = new BigInt64Array(b);
        Module["HEAPU64"] = new BigUint64Array(b);
    }

    /**
     * Gets the maximum heap size (2GB for 32-bit addressing).
     *
     * @returns {number} Maximum heap size in bytes
     */
    function getHeapMax() {
        return 2147483648;
    }

    /**
     * Attempts to grow WebAssembly memory to accommodate the requested size.
     *
     * @param {number} size - Target size in bytes
     * @returns {number} 1 if successful, undefined if failed
     */
    function growMemory(size) {
        // 1. Calculate required pages
        const b = wasmMemory.buffer;
        const pages = ((size - b.byteLength + 65535) / 65536) | 0;

        // 2. Attempt to grow memory
        try {
            wasmMemory.grow(pages);
            updateMemoryViews();
            return 1;
        } catch (_e) {
            // Growth failed, return undefined
        }
    }

    /**
     * Creates the emscripten_resize_heap function.
     *
     * @returns {(requestedSize: number) => boolean} Heap resize function
     */
    function createResizeHeapFunction() {
        /**
         * Resizes the WebAssembly heap to accommodate the requested size.
         * Implements Emscripten's heap growth strategy with multiple attempts.
         *
         * @param {number} requestedSize - Requested heap size in bytes
         * @returns {boolean} True if resize succeeded, false otherwise
         */
        return function _emscripten_resize_heap(requestedSize) {
            // 1. Validate requested size
            const oldSize = HEAPU8.length;
            requestedSize >>>= 0;

            const maxHeapSize = getHeapMax();
            if (requestedSize > maxHeapSize) {
                return false;
            }

            // 2. Try progressive growth strategies
            for (let cutDown = 1; cutDown <= 4; cutDown *= 2) {
                // Calculate overgrown size with safety margin
                let overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
                overGrownHeapSize = Math.min(
                    overGrownHeapSize,
                    requestedSize + 100663296,
                );

                // Align to 64KB page boundary
                const newSize = Math.min(
                    maxHeapSize,
                    alignMemory(
                        Math.max(requestedSize, overGrownHeapSize),
                        65536,
                    ),
                );

                // Attempt growth
                const replacement = growMemory(newSize);
                if (replacement) {
                    return true;
                }
            }

            // 3. All growth attempts failed
            return false;
        };
    }

    // Initialize memory views
    updateMemoryViews();

    // Return memory manager API
    return {
        updateMemoryViews,
        createResizeHeapFunction,
        get HEAP8() {
            return HEAP8;
        },
        get HEAPU8() {
            return HEAPU8;
        },
        get HEAP16() {
            return HEAP16;
        },
        get HEAP32() {
            return HEAP32;
        },
        get HEAPU32() {
            return HEAPU32;
        },
        get HEAP64() {
            return HEAP64;
        },
    };
}

/**
 * Initializes WebAssembly memory with the specified initial size.
 *
 * @param {import("../shared/runtime-types.d.ts").RuntimeModule} Module - The Emscripten module object
 * @param {number} [initialMemory=16777216] - Initial memory size in bytes (default 16MB)
 * @returns {WebAssembly.Memory} The initialized WebAssembly memory instance
 */
export function initializeWasmMemory(Module, initialMemory = 16777216) {
    // 1. Use existing memory if provided
    if (Module["wasmMemory"]) {
        return Module["wasmMemory"];
    }

    // 2. Create new WebAssembly memory
    const INITIAL_MEMORY = Module["INITIAL_MEMORY"] || initialMemory;

    return new WebAssembly.Memory({
        initial: INITIAL_MEMORY / 65536,
        maximum: 32768, // 2GB maximum (32768 * 64KB)
    });
}
