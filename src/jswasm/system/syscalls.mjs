/**
 * System Call Module - Main Entry Point
 *
 * This module provides a unified interface to all system call implementations
 * for the SQLite3 WebAssembly build. It coordinates syscalls across multiple
 * specialized modules:
 *
 * - errno-constants.mjs: Error codes and constants
 * - syscall-helpers.mjs: Core utilities and SYSCALLS object
 * - stat-syscalls.mjs: File status operations (stat, lstat, fstat, etc.)
 * - file-syscalls.mjs: File operations (open, chmod, mkdir, etc.)
 * - ioctl-syscalls.mjs: Terminal/device control operations
 *
 * The syscalls follow POSIX standards and provide the interface between
 * the SQLite WebAssembly binary and the JavaScript file system implementation.
 *
 * @module syscalls
 */

import { createSyscallHelpers } from './syscall-helpers.mjs';
import { createStatSyscalls } from './stat-syscalls.mjs';
import { createFileSyscalls } from './file-syscalls.mjs';
import { createIoctlSyscalls } from './ioctl-syscalls.mjs';

/**
 * Creates and initializes all syscall implementations
 *
 * This factory function sets up the complete syscall environment by:
 * 1. Creating helper utilities and the SYSCALLS object
 * 2. Initializing all syscall function groups
 * 3. Returning a unified interface
 *
 * All syscalls follow a consistent pattern:
 * - Return 0 on success
 * - Return negative errno value on error
 * - Throw exceptions for unexpected errors
 *
 * @param {import("../shared/system-types.d.ts").SyscallFS} FS - File system implementation with POSIX-like operations
 * @param {import("../shared/system-types.d.ts").PathUtilities} PATH - Path manipulation utilities (join, normalize, etc.)
 * @param {Uint8Array} HEAPU8 - Unsigned 8-bit WebAssembly heap view
 * @param {Int8Array} HEAP8 - Signed 8-bit WebAssembly heap view
 * @param {Int16Array} HEAP16 - Signed 16-bit WebAssembly heap view
 * @param {Int32Array} HEAP32 - Signed 32-bit WebAssembly heap view
 * @param {Uint32Array} HEAPU32 - Unsigned 32-bit WebAssembly heap view
 * @param {BigInt64Array} HEAP64 - Signed 64-bit WebAssembly heap view
 * @param {(heap: Uint8Array, ptr: number, maxBytesToRead?: number) => string} UTF8ArrayToString - Convert UTF-8 byte array to JS string
 * @param {(value: string) => number} lengthBytesUTF8 - Calculate UTF-8 byte length of string
 * @param {(value: string, heap: Uint8Array, outPtr: number, maxBytesToWrite: number) => number} stringToUTF8Array - Convert JS string to UTF-8 byte array
 * @returns {import("../shared/system-types.d.ts").UnifiedSyscalls} Object containing SYSCALLS utilities and all syscall functions
 *
 * @example
 * const syscalls = createSYSCALLS(FS, PATH, HEAPU8, HEAP8, HEAP16, HEAP32, HEAPU32, HEAP64,
 *                                  UTF8ArrayToString, lengthBytesUTF8, stringToUTF8Array);
 *
 * // Access SYSCALLS utilities
 * const path = syscalls.SYSCALLS.calculateAt(-100, "/foo/bar");
 *
 * // Call syscalls
 * const fd = syscalls.___syscall_openat(-100, pathPtr, flags, 0);
 */
export function createSYSCALLS(
    FS,
    PATH,
    HEAPU8,
    HEAP8,
    HEAP16,
    HEAP32,
    HEAPU32,
    HEAP64,
    UTF8ArrayToString,
    lengthBytesUTF8,
    stringToUTF8Array
) {
    // 1. Initialize syscall helpers and utilities
    const {
        SYSCALLS,
        syscallGetVarargI,
        syscallGetVarargP,
        bigintToI53Checked,
        readI53FromI64,
        stringToUTF8,
    } = createSyscallHelpers(
        FS,
        PATH,
        HEAPU8,
        HEAP8,
        HEAP16,
        HEAP32,
        HEAPU32,
        HEAP64,
        UTF8ArrayToString,
        lengthBytesUTF8,
        stringToUTF8Array
    );

    // 2. Initialize stat syscalls (stat, lstat, fstat, newfstatat)
    const statSyscalls = createStatSyscalls(FS, SYSCALLS);

    // 3. Initialize file operation syscalls
    const fileSyscalls = createFileSyscalls(
        FS,
        PATH,
        SYSCALLS,
        syscallGetVarargI,
        syscallGetVarargP,
        bigintToI53Checked,
        readI53FromI64,
        stringToUTF8,
        lengthBytesUTF8,
        HEAP8,
        HEAP16,
        HEAP32
    );

    // 4. Initialize ioctl syscalls (terminal control)
    const ioctlSyscalls = createIoctlSyscalls(FS, SYSCALLS, syscallGetVarargP, HEAP8, HEAP16, HEAP32);

    // 5. Return unified syscall interface
    return {
        // Core utilities
        SYSCALLS,

        // Stat syscalls (stat-syscalls.mjs)
        ___syscall_stat64: statSyscalls.___syscall_stat64,
        ___syscall_lstat64: statSyscalls.___syscall_lstat64,
        ___syscall_fstat64: statSyscalls.___syscall_fstat64,
        ___syscall_newfstatat: statSyscalls.___syscall_newfstatat,

        // File operation syscalls (file-syscalls.mjs)
        ___syscall_chmod: fileSyscalls.___syscall_chmod,
        ___syscall_fchmod: fileSyscalls.___syscall_fchmod,
        ___syscall_fchown32: fileSyscalls.___syscall_fchown32,
        ___syscall_faccessat: fileSyscalls.___syscall_faccessat,
        ___syscall_fcntl64: fileSyscalls.___syscall_fcntl64,
        ___syscall_ftruncate64: fileSyscalls.___syscall_ftruncate64,
        ___syscall_getcwd: fileSyscalls.___syscall_getcwd,
        ___syscall_mkdirat: fileSyscalls.___syscall_mkdirat,
        ___syscall_openat: fileSyscalls.___syscall_openat,
        ___syscall_readlinkat: fileSyscalls.___syscall_readlinkat,
        ___syscall_rmdir: fileSyscalls.___syscall_rmdir,
        ___syscall_unlinkat: fileSyscalls.___syscall_unlinkat,
        ___syscall_utimensat: fileSyscalls.___syscall_utimensat,

        // IOCTL syscalls (ioctl-syscalls.mjs)
        ___syscall_ioctl: ioctlSyscalls.___syscall_ioctl,
    };
}
