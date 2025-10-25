import type {
    BuiltinMemalign,
    MmapAllocator,
    RandomFillFunction,
} from "./memory-utils.d.ts";

/** 64KB alignment boundary for mmap-style allocations */
const MMAP_ALIGNMENT_BYTES = 65536;

/**
 * Initialize random fill function using crypto.getRandomValues.
 */
export const initRandomFill = (): RandomFillFunction => {
    if (
        typeof crypto === "object" &&
        typeof crypto.getRandomValues === "function"
    ) {
        return <T extends ArrayBufferView>(view: T): T => {
            return crypto.getRandomValues(
                view as unknown as
                    | Int8Array
                    | Uint8Array
                    | Int16Array
                    | Uint16Array
                    | Int32Array
                    | Uint32Array
                    | BigInt64Array
                    | BigUint64Array
                    | Float32Array
                    | Float64Array,
            ) as unknown as T;
        };
    }

    throw new Error("initRandomDevice: crypto.getRandomValues not available");
};

/**
 * Lazily initialized random fill function. The first invocation resolves the
 * environment specific helper and subsequent calls reuse the cached instance.
 */
export let randomFill: RandomFillFunction = <T extends ArrayBufferView>(
    view: T,
): T => {
    randomFill = initRandomFill();
    return randomFill(view);
};

/**
 * Zero out a region of memory in HEAPU8.
 */
export const zeroMemory = (
    heap: Uint8Array,
    address: number,
    size: number,
): void => {
    heap.fill(0, address, address + size);
};

/**
 * Align a size to a given alignment boundary.
 */
export const alignMemory = (size: number, alignment: number): number => {
    return Math.ceil(size / alignment) * alignment;
};

/**
 * Allocate memory with mmap-style alignment.
 */
export const createMmapAlloc = (
    emscriptenBuiltinMemalign: BuiltinMemalign,
    heap: Uint8Array,
): MmapAllocator => {
    return (size) => {
        const alignedSize = alignMemory(size, MMAP_ALIGNMENT_BYTES);
        const pointer = emscriptenBuiltinMemalign(
            MMAP_ALIGNMENT_BYTES,
            alignedSize,
        );

        if (pointer) {
            zeroMemory(heap, pointer, alignedSize);
        }

        return pointer;
    };
};
