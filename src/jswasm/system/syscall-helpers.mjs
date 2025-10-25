/**
 * Syscall Helper Utilities
 *
 * This module provides core utility functions and the SYSCALLS object
 * used throughout the syscall implementation. It includes UTF-8 conversion
 * wrappers, varargs handling, path calculation, and stream management.
 *
 * @module syscall-helpers
 */

import { SPECIAL_FLAGS, INT53_MAX, INT53_MIN } from "./errno-constants.mjs";

/**
 * Creates the SYSCALLS helper object and related utility functions
 *
 * @param {import("../shared/system-types.d.ts").SyscallFS} FS - File system implementation
 * @param {import("../shared/system-types.d.ts").PathUtilities} PATH - Path manipulation utilities
 * @param {Uint8Array} HEAPU8 - Unsigned 8-bit heap view
 * @param {Int8Array} HEAP8 - Signed 8-bit heap view
 * @param {Int16Array} HEAP16 - Signed 16-bit heap view
 * @param {Int32Array} HEAP32 - Signed 32-bit heap view
 * @param {Uint32Array} HEAPU32 - Unsigned 32-bit heap view
 * @param {BigInt64Array} HEAP64 - Signed 64-bit heap view
 * @param {(heap: Uint8Array, ptr: number, maxBytesToRead?: number) => string} UTF8ArrayToString - Convert UTF-8 byte array to string
 * @param {(value: string) => number} lengthBytesUTF8 - Calculate UTF-8 byte length of string
 * @param {(value: string, heap: Uint8Array, outPtr: number, maxBytesToWrite: number) => number} stringToUTF8Array - Convert string to UTF-8 byte array
 * @returns {import("../shared/system-types.d.ts").SyscallHelpers} Object containing SYSCALLS utilities and helper functions
 */
export function createSyscallHelpers(
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
    stringToUTF8Array,
) {
    /**
     * Converts a UTF-8 encoded string pointer to a JavaScript string
     *
     * @param {number} ptr - Pointer to UTF-8 encoded string in WASM memory
     * @param {number} [maxBytesToRead] - Maximum bytes to read
     * @returns {string} Decoded JavaScript string
     */
    const UTF8ToString = (ptr, maxBytesToRead) => {
        return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
    };

    /**
     * Converts a JavaScript string to UTF-8 bytes in WASM memory
     *
     * @param {string} str - JavaScript string to encode
     * @param {number} outPtr - Destination pointer in WASM memory
     * @param {number} maxBytesToWrite - Maximum bytes to write
     * @returns {number} Number of bytes written
     */
    const stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
        return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    };

    /**
     * Checks if a number is within the safe integer range for JavaScript
     *
     * @param {bigint} num - BigInt value to check
     * @returns {number} The number if safe, NaN otherwise
     */
    const bigintToI53Checked = (num) =>
        num < INT53_MIN || num > INT53_MAX ? NaN : Number(num);

    /**
     * Reads a 53-bit integer from a 64-bit pointer location
     * Combines 32-bit low and high parts into a JavaScript number
     *
     * @param {number} ptr - Pointer to 64-bit integer in memory
     * @returns {number} The 53-bit integer value
     */
    const readI53FromI64 = (ptr) => {
        return HEAPU32[ptr >> 2] + HEAP32[(ptr + 4) >> 2] * 4294967296;
    };

    /**
     * Gets the next 32-bit integer argument from the varargs list
     *
     * @returns {number} The next integer argument
     */
    function syscallGetVarargI() {
        // 1. Read current varargs position
        const ret = HEAP32[+SYSCALLS.varargs >> 2];

        // 2. Advance varargs pointer by 4 bytes
        SYSCALLS.varargs += 4;

        // 3. Return the value
        return ret;
    }

    /**
     * Gets the next pointer argument from the varargs list
     * Alias for syscallGetVarargI since pointers are 32-bit in this environment
     *
     * @returns {number} The next pointer argument
     */
    const syscallGetVarargP = syscallGetVarargI;

    /**
     * SYSCALLS utility object
     * Provides common operations used across all syscall implementations
     */
    const SYSCALLS = {
        /** Default poll mask for file descriptor operations */
        DEFAULT_POLLMASK: 5,

        /** Current position in varargs list (used by syscallGetVarargI/P) */
        varargs: undefined,

        /**
         * Calculates the absolute path for *at syscalls (openat, mkdirat, etc.)
         * Handles special dirfd values and relative path resolution
         *
         * @param {number} dirfd - Directory file descriptor (or AT_FDCWD)
         * @param {string} path - Relative or absolute path
         * @param {boolean} [allowEmpty=false] - Whether to allow empty path
         * @returns {string} Absolute path
         * @throws {FS.ErrnoError} If path is empty and not allowed
         */
        calculateAt(dirfd, path, allowEmpty) {
            // 1. Input validation - handle absolute paths
            if (PATH.isAbs(path)) {
                return path;
            }

            // 2. Determine base directory
            let dir;
            if (dirfd === SPECIAL_FLAGS.AT_FDCWD) {
                // Use current working directory
                dir = FS.cwd();
            } else {
                // Use the directory referenced by dirfd
                const dirstream = SYSCALLS.getStreamFromFD(dirfd);
                dir = dirstream.path;
            }

            // 3. Handle empty path
            if (path.length === 0) {
                if (!allowEmpty) {
                    throw new FS.ErrnoError(44); // ENODEV
                }
                return dir;
            }

            // 4. Join and return
            return PATH.join2(dir, path);
        },

        /**
         * Executes a stat function and writes results to a buffer
         * Converts file stat information into the POSIX stat structure format
         *
         * @param {(path: string) => ReturnType<import("../shared/system-types.d.ts").SyscallFS["stat"]>} func - Stat function (FS.stat, FS.lstat, etc.)
         * @param {string} path - File path to stat
         * @param {number} buf - Pointer to stat buffer in WASM memory
         * @returns {number} 0 on success
         */
        doStat(func, path, buf) {
            // 1. Execute stat function
            const stat = func(path);

            // 2. Write stat structure to memory buffer
            // Device ID
            HEAP32[buf >> 2] = stat.dev;
            // File mode (type and permissions)
            HEAP32[(buf + 4) >> 2] = stat.mode;
            // Number of hard links
            HEAPU32[(buf + 8) >> 2] = stat.nlink;
            // User ID
            HEAP32[(buf + 12) >> 2] = stat.uid;
            // Group ID
            HEAP32[(buf + 16) >> 2] = stat.gid;
            // Device ID (if special file)
            HEAP32[(buf + 20) >> 2] = stat.rdev;
            // File size in bytes
            HEAP64[(buf + 24) >> 3] = BigInt(stat.size);
            // Block size for filesystem I/O
            HEAP32[(buf + 32) >> 2] = 4096;
            // Number of 512B blocks allocated
            HEAP32[(buf + 36) >> 2] = stat.blocks;

            // 3. Write timestamps (split into seconds and nanoseconds)
            const atime = stat.atime.getTime();
            const mtime = stat.mtime.getTime();
            const ctime = stat.ctime.getTime();

            // Access time
            HEAP64[(buf + 40) >> 3] = BigInt(Math.floor(atime / 1000));
            HEAPU32[(buf + 48) >> 2] = (atime % 1000) * 1000 * 1000;
            // Modification time
            HEAP64[(buf + 56) >> 3] = BigInt(Math.floor(mtime / 1000));
            HEAPU32[(buf + 64) >> 2] = (mtime % 1000) * 1000 * 1000;
            // Status change time
            HEAP64[(buf + 72) >> 3] = BigInt(Math.floor(ctime / 1000));
            HEAPU32[(buf + 80) >> 2] = (ctime % 1000) * 1000 * 1000;

            // Inode number
            HEAP64[(buf + 88) >> 3] = BigInt(stat.ino);

            return 0;
        },

        /**
         * Performs memory-mapped file synchronization
         * Syncs a memory-mapped region back to the underlying file
         *
         * @param {number} addr - Starting address in WASM memory
         * @param {import("../vfs/filesystem/base-state.d.ts").FSStream} stream - File stream object
         * @param {number} len - Length of region to sync
         * @param {number} flags - Sync flags (MS_ASYNC, MS_SYNC, etc.)
         * @param {number} offset - Offset in the file
         * @returns {number} 0 on success
         * @throws {FS.ErrnoError} If stream is not a file
         */
        doMsync(addr, stream, len, flags, offset) {
            // 1. Validate stream is a file
            if (!FS.isFile(stream.node.mode)) {
                throw new FS.ErrnoError(43); // ENOTDIR
            }

            // 2. Check for MS_ASYNC flag (asynchronous sync - just return)
            if (flags & SPECIAL_FLAGS.MS_ASYNC) {
                return 0;
            }

            // 3. Copy memory buffer and sync to file
            const buffer = HEAPU8.slice(addr, addr + len);
            FS.msync(stream, buffer, offset, len, flags);

            return 0;
        },

        /**
         * Gets a file stream from a file descriptor
         * Validates the file descriptor and returns the associated stream
         *
         * @param {number} fd - File descriptor
         * @returns {ReturnType<import("../shared/system-types.d.ts").SyscallFS["getStreamChecked"]>} File stream object
         * @throws {FS.ErrnoError} If file descriptor is invalid
         */
        getStreamFromFD(fd) {
            return FS.getStreamChecked(fd);
        },

        /**
         * Converts a WASM memory pointer to a JavaScript string
         * Helper for reading string arguments from syscalls
         *
         * @param {number} ptr - Pointer to UTF-8 string in WASM memory
         * @returns {string} JavaScript string
         */
        getStr(ptr) {
            return UTF8ToString(ptr);
        },
    };

    return {
        SYSCALLS,
        syscallGetVarargI,
        syscallGetVarargP,
        bigintToI53Checked,
        readI53FromI64,
        UTF8ToString,
        stringToUTF8,
        lengthBytesUTF8,
    };
}
