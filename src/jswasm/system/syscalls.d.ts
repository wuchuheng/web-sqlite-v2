import type { PathUtilities, SyscallFS, UnifiedSyscalls } from "../shared/system-types.d.ts";

/**
 * Creates the unified syscall table consumed by the SQLite WebAssembly module.
 */
export declare function createSYSCALLS(
    FS: SyscallFS,
    PATH: PathUtilities,
    HEAPU8: Uint8Array,
    HEAP8: Int8Array,
    HEAP16: Int16Array,
    HEAP32: Int32Array,
    HEAPU32: Uint32Array,
    HEAP64: BigInt64Array,
    UTF8ArrayToString: (heap: Uint8Array, ptr: number, maxBytesToRead?: number) => string,
    lengthBytesUTF8: (value: string) => number,
    stringToUTF8Array: (value: string, heap: Uint8Array, outPtr: number, maxBytesToWrite: number) => number
): UnifiedSyscalls;
