/**
 * Stat-Related System Calls
 *
 * This module implements syscalls for retrieving file and directory status
 * information (stat, lstat, fstat, etc.). These syscalls follow POSIX
 * standards and return file metadata including permissions, timestamps,
 * size, and ownership.
 *
 * @module stat-syscalls
 */

import { SPECIAL_FLAGS } from "./errno-constants.mjs";

/**
 * Creates stat-related syscall implementations
 *
 * @param {import("../shared/system-types.d.ts").SyscallFS} FS - File system implementation
 * @param {import("../shared/system-types.d.ts").SyscallHelpers["SYSCALLS"]} SYSCALLS - Syscall helper utilities
 * @returns {import("../shared/system-types.d.ts").StatSyscalls} Object containing stat syscall functions
 */
export function createStatSyscalls(FS, SYSCALLS) {
    /**
     * stat64 - Get file status by path
     *
     * Returns information about a file, following symbolic links.
     * The stat buffer is populated with file metadata including:
     * - Device ID, inode number
     * - File mode (type and permissions)
     * - Number of hard links
     * - User ID and group ID
     * - File size and block allocation
     * - Access, modification, and change timestamps
     *
     * @param {number} path - Pointer to file path string in WASM memory
     * @param {number} buf - Pointer to stat buffer structure in WASM memory
     * @returns {number} 0 on success, negative errno on error
     *
     * @syscall stat64
     * @see https://man7.org/linux/man-pages/man2/stat.2.html
     */
    function ___syscall_stat64(path, buf) {
        try {
            // 1. Convert path pointer to string
            path = SYSCALLS.getStr(path);

            // 2. Execute stat and write results to buffer
            return SYSCALLS.doStat(FS.stat, path, buf);
        } catch (e) {
            // 3. Handle errors
            if (typeof FS === "undefined" || !(e.name === "ErrnoError")) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * lstat64 - Get file status by path (don't follow symlinks)
     *
     * Similar to stat64, but if the path is a symbolic link, returns
     * information about the link itself rather than the file it points to.
     *
     * @param {number} path - Pointer to file path string in WASM memory
     * @param {number} buf - Pointer to stat buffer structure in WASM memory
     * @returns {number} 0 on success, negative errno on error
     *
     * @syscall lstat64
     * @see https://man7.org/linux/man-pages/man2/lstat.2.html
     */
    function ___syscall_lstat64(path, buf) {
        try {
            // 1. Convert path pointer to string
            path = SYSCALLS.getStr(path);

            // 2. Execute lstat (no symlink following) and write results
            return SYSCALLS.doStat(FS.lstat, path, buf);
        } catch (e) {
            // 3. Handle errors
            if (typeof FS === "undefined" || !(e.name === "ErrnoError")) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * fstat64 - Get file status by file descriptor
     *
     * Returns information about an open file using its file descriptor.
     * This is useful when you already have a file open and don't want to
     * look it up by path again.
     *
     * @param {number} fd - File descriptor
     * @param {number} buf - Pointer to stat buffer structure in WASM memory
     * @returns {number} 0 on success, negative errno on error
     *
     * @syscall fstat64
     * @see https://man7.org/linux/man-pages/man2/fstat.2.html
     */
    function ___syscall_fstat64(fd, buf) {
        try {
            // 1. Get file stream from descriptor
            const stream = SYSCALLS.getStreamFromFD(fd);

            // 2. Execute stat on stream path and write results
            return SYSCALLS.doStat(FS.stat, stream.path, buf);
        } catch (e) {
            // 3. Handle errors
            if (typeof FS === "undefined" || !(e.name === "ErrnoError")) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * newfstatat - Get file status relative to directory file descriptor
     *
     * Extended stat syscall that allows relative path resolution from a
     * directory file descriptor. Supports special flags:
     * - AT_SYMLINK_NOFOLLOW: Don't follow symbolic links
     * - AT_EMPTY_PATH: Allow empty path (stat the directory itself)
     *
     * @param {number} dirfd - Directory file descriptor (or AT_FDCWD)
     * @param {number} path - Pointer to relative/absolute path string
     * @param {number} buf - Pointer to stat buffer structure in WASM memory
     * @param {number} flags - Flags controlling behavior (AT_SYMLINK_NOFOLLOW, etc.)
     * @returns {number} 0 on success, negative errno on error
     *
     * @syscall newfstatat (fstatat)
     * @see https://man7.org/linux/man-pages/man2/fstatat.2.html
     */
    function ___syscall_newfstatat(dirfd, path, buf, flags) {
        try {
            // 1. Convert path pointer to string
            path = SYSCALLS.getStr(path);

            // 2. Extract flag bits
            const nofollow = flags & SPECIAL_FLAGS.AT_SYMLINK_NOFOLLOW;
            const allowEmpty = flags & SPECIAL_FLAGS.AT_EMPTY_PATH;

            // Clear processed flags (mask out AT_SYMLINK_NOFOLLOW and AT_EMPTY_PATH)
            flags = flags & ~6400;

            // 3. Calculate absolute path relative to dirfd
            path = SYSCALLS.calculateAt(dirfd, path, allowEmpty);

            // 4. Execute stat (lstat if nofollow, stat if following links)
            return SYSCALLS.doStat(nofollow ? FS.lstat : FS.stat, path, buf);
        } catch (e) {
            // 5. Handle errors
            if (typeof FS === "undefined" || !(e.name === "ErrnoError")) {
                throw e;
            }
            return -e.errno;
        }
    }

    return {
        ___syscall_stat64,
        ___syscall_lstat64,
        ___syscall_fstat64,
        ___syscall_newfstatat,
    };
}
