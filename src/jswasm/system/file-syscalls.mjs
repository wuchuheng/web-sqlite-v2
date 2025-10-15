/**
 * File Operation System Calls
 *
 * This module implements syscalls for file and directory operations including:
 * - Permission changes (chmod, fchmod, fchown)
 * - File access checks (faccessat)
 * - File control (fcntl64)
 * - Directory operations (mkdirat, rmdir)
 * - File operations (openat, unlinkat, readlinkat)
 * - File truncation (ftruncate64)
 * - Working directory (getcwd)
 * - Time manipulation (utimensat)
 *
 * @module file-syscalls
 */

import { ERRNO, FCNTL_CMD, ACCESS_MODE, SPECIAL_FLAGS, UTIME_VALUES } from './errno-constants.mjs';

/**
 * Creates file operation syscall implementations
 *
 * @param {Object} FS - File system implementation
 * @param {Object} PATH - Path manipulation utilities
 * @param {Object} SYSCALLS - Syscall helper utilities
 * @param {Function} syscallGetVarargI - Get next integer from varargs
 * @param {Function} syscallGetVarargP - Get next pointer from varargs
 * @param {Function} bigintToI53Checked - Convert BigInt to safe integer
 * @param {Function} readI53FromI64 - Read 53-bit integer from 64-bit pointer
 * @param {Function} stringToUTF8 - Convert string to UTF-8 bytes
 * @param {Function} lengthBytesUTF8 - Get UTF-8 byte length
 * @param {Int8Array} HEAP8 - Signed 8-bit heap view
 * @param {Int16Array} HEAP16 - Signed 16-bit heap view
 * @param {Int32Array} HEAP32 - Signed 32-bit heap view
 * @returns {Object} Object containing file syscall functions
 */
export function createFileSyscalls(
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
) {
    /**
     * chmod - Change file mode (permissions)
     *
     * Changes the file mode bits (permissions) of a file specified by path.
     *
     * @param {number} path - Pointer to file path string in WASM memory
     * @param {number} mode - New file mode (permission bits)
     * @returns {number} 0 on success, negative errno on error
     *
     * @syscall chmod
     * @see https://man7.org/linux/man-pages/man2/chmod.2.html
     */
    function ___syscall_chmod(path, mode) {
        try {
            // 1. Convert path pointer to string
            path = SYSCALLS.getStr(path);

            // 2. Change file permissions
            FS.chmod(path, mode);

            // 3. Return success
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e.name === 'ErrnoError')) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * fchmod - Change file mode using file descriptor
     *
     * Changes the file mode bits (permissions) of an open file.
     *
     * @param {number} fd - File descriptor
     * @param {number} mode - New file mode (permission bits)
     * @returns {number} 0 on success, negative errno on error
     *
     * @syscall fchmod
     * @see https://man7.org/linux/man-pages/man2/fchmod.2.html
     */
    function ___syscall_fchmod(fd, mode) {
        try {
            // 1. Change file permissions via descriptor
            FS.fchmod(fd, mode);

            // 2. Return success
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e.name === 'ErrnoError')) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * fchown32 - Change file owner and group using file descriptor
     *
     * Changes the owner and group of an open file.
     *
     * @param {number} fd - File descriptor
     * @param {number} owner - New owner user ID
     * @param {number} group - New owner group ID
     * @returns {number} 0 on success, negative errno on error
     *
     * @syscall fchown32
     * @see https://man7.org/linux/man-pages/man2/fchown.2.html
     */
    function ___syscall_fchown32(fd, owner, group) {
        try {
            // 1. Change file owner and group
            FS.fchown(fd, owner, group);

            // 2. Return success
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e.name === 'ErrnoError')) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * faccessat - Check file accessibility relative to directory fd
     *
     * Checks whether the calling process can access the file specified by path.
     * Tests for existence, and optionally read, write, and execute permissions.
     *
     * @param {number} dirfd - Directory file descriptor (or AT_FDCWD)
     * @param {number} path - Pointer to file path string
     * @param {number} amode - Access mode (R_OK, W_OK, X_OK, F_OK)
     * @param {number} _flags - Flags (currently unused)
     * @returns {number} 0 on success, negative errno on error
     *
     * @syscall faccessat
     * @see https://man7.org/linux/man-pages/man2/faccessat.2.html
     */
    function ___syscall_faccessat(dirfd, path, amode, _flags) {
        try {
            // 1. Convert path and calculate absolute path
            path = SYSCALLS.getStr(path);
            path = SYSCALLS.calculateAt(dirfd, path);

            // 2. Validate access mode
            if (amode & ~7) {
                return -ERRNO.EINVAL;
            }

            // 3. Look up file
            const lookup = FS.lookupPath(path, { follow: true });
            const node = lookup.node;

            if (!node) {
                return -ERRNO.ENODEV;
            }

            // 4. Build permission string and check
            let perms = '';
            if (amode & ACCESS_MODE.R_OK) perms += 'r';
            if (amode & ACCESS_MODE.W_OK) perms += 'w';
            if (amode & ACCESS_MODE.X_OK) perms += 'x';

            if (perms && FS.nodePermissions(node, perms)) {
                return -ERRNO.ENOENT;
            }

            // 5. Return success
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e.name === 'ErrnoError')) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * fcntl64 - File control operations
     *
     * Performs various operations on an open file descriptor including:
     * - F_DUPFD: Duplicate file descriptor
     * - F_GETFD/F_SETFD: Get/set file descriptor flags
     * - F_GETFL/F_SETFL: Get/set file status flags
     * - F_GETLK/F_SETLK/F_SETLKW: Get/set file locks
     *
     * @param {number} fd - File descriptor
     * @param {number} cmd - Command to execute (F_DUPFD, F_GETFL, etc.)
     * @param {number} varargs - Pointer to variable arguments
     * @returns {number} Command-specific return value, or negative errno on error
     *
     * @syscall fcntl64
     * @see https://man7.org/linux/man-pages/man2/fcntl.2.html
     */
    function ___syscall_fcntl64(fd, cmd, varargs) {
        SYSCALLS.varargs = varargs;

        try {
            // 1. Get file stream
            const stream = SYSCALLS.getStreamFromFD(fd);
            let arg;

            // 2. Execute command
            switch (cmd) {
                case FCNTL_CMD.F_DUPFD: {
                    // Duplicate file descriptor to specific fd number
                    arg = syscallGetVarargI();
                    if (arg < 0) {
                        return -ERRNO.EINVAL;
                    }

                    // Find available fd starting from arg
                    while (FS.streams[arg]) {
                        arg++;
                    }

                    // Duplicate stream
                    const newStream = FS.dupStream(stream, arg);
                    return newStream.fd;
                }

                case FCNTL_CMD.F_GETFD:
                case FCNTL_CMD.F_SETFD:
                    // Get/set file descriptor flags (FD_CLOEXEC)
                    return 0;

                case FCNTL_CMD.F_GETFL:
                    // Get file status flags
                    return stream.flags;

                case FCNTL_CMD.F_SETFL: {
                    // Set file status flags
                    arg = syscallGetVarargI();
                    stream.flags |= arg;
                    return 0;
                }

                case FCNTL_CMD.F_GETLK: {
                    // Get lock information
                    arg = syscallGetVarargP();
                    const offset = 0;
                    // Set lock type to F_UNLCK (no lock)
                    HEAP16[(arg + offset) >> 1] = 2;
                    return 0;
                }

                case FCNTL_CMD.F_SETLK:
                case FCNTL_CMD.F_SETLKW:
                    // Set lock (not implemented, just return success)
                    return 0;

                default:
                    return -ERRNO.EINVAL;
            }
        } catch (e) {
            if (typeof FS === 'undefined' || !(e.name === 'ErrnoError')) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * ftruncate64 - Truncate file to specified length
     *
     * Truncates an open file to a specified length. If the file was previously
     * larger, the extra data is lost. If it was shorter, it is extended with
     * null bytes.
     *
     * @param {number} fd - File descriptor
     * @param {bigint} length - New file length in bytes
     * @returns {number} 0 on success, negative errno on error
     *
     * @syscall ftruncate64
     * @see https://man7.org/linux/man-pages/man2/ftruncate.2.html
     */
    function ___syscall_ftruncate64(fd, length) {
        length = bigintToI53Checked(length);

        try {
            // 1. Validate length is in safe integer range
            if (isNaN(length)) {
                return -ERRNO.EOVERFLOW;
            }

            // 2. Truncate file
            FS.ftruncate(fd, length);

            // 3. Return success
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e.name === 'ErrnoError')) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * getcwd - Get current working directory
     *
     * Returns the absolute pathname of the current working directory.
     * The path is written to the buffer pointed to by buf.
     *
     * @param {number} buf - Pointer to buffer in WASM memory
     * @param {number} size - Size of buffer
     * @returns {number} Length of path string (including null terminator) on success,
     *                   negative errno on error
     *
     * @syscall getcwd
     * @see https://man7.org/linux/man-pages/man2/getcwd.2.html
     */
    function ___syscall_getcwd(buf, size) {
        try {
            // 1. Validate size
            if (size === 0) {
                return -ERRNO.EINVAL;
            }

            // 2. Get current working directory
            const cwd = FS.cwd();
            const cwdLengthInBytes = lengthBytesUTF8(cwd) + 1;

            // 3. Check buffer size
            if (size < cwdLengthInBytes) {
                return -ERRNO.ENOTEMPTY;
            }

            // 4. Write to buffer
            stringToUTF8(cwd, buf, size);

            // 5. Return length
            return cwdLengthInBytes;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e.name === 'ErrnoError')) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * mkdirat - Create directory relative to directory fd
     *
     * Creates a new directory with the specified mode (permissions).
     * The path can be relative to a directory file descriptor.
     *
     * @param {number} dirfd - Directory file descriptor (or AT_FDCWD)
     * @param {number} path - Pointer to directory path string
     * @param {number} mode - Directory mode (permission bits)
     * @returns {number} 0 on success, negative errno on error
     *
     * @syscall mkdirat
     * @see https://man7.org/linux/man-pages/man2/mkdirat.2.html
     */
    function ___syscall_mkdirat(dirfd, path, mode) {
        try {
            // 1. Convert path and calculate absolute path
            path = SYSCALLS.getStr(path);
            path = SYSCALLS.calculateAt(dirfd, path);

            // 2. Normalize path and remove trailing slash
            path = PATH.normalize(path);
            if (path[path.length - 1] === '/') {
                path = path.substr(0, path.length - 1);
            }

            // 3. Create directory
            FS.mkdir(path, mode, 0);

            // 4. Return success
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e.name === 'ErrnoError')) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * openat - Open file relative to directory fd
     *
     * Opens a file with specified flags and optional mode. The path can be
     * relative to a directory file descriptor.
     *
     * @param {number} dirfd - Directory file descriptor (or AT_FDCWD)
     * @param {number} path - Pointer to file path string
     * @param {number} flags - File open flags (O_RDONLY, O_WRONLY, O_CREAT, etc.)
     * @param {number} varargs - Pointer to variable arguments (mode if O_CREAT)
     * @returns {number} File descriptor on success, negative errno on error
     *
     * @syscall openat
     * @see https://man7.org/linux/man-pages/man2/openat.2.html
     */
    function ___syscall_openat(dirfd, path, flags, varargs) {
        SYSCALLS.varargs = varargs;

        try {
            // 1. Convert path and calculate absolute path
            path = SYSCALLS.getStr(path);
            path = SYSCALLS.calculateAt(dirfd, path);

            // 2. Get mode if varargs present
            const mode = varargs ? syscallGetVarargI() : 0;

            // 3. Open file and return descriptor
            return FS.open(path, flags, mode).fd;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e.name === 'ErrnoError')) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * readlinkat - Read symbolic link relative to directory fd
     *
     * Reads the value of a symbolic link (the path it points to).
     * The result is placed in the buffer, NOT null-terminated.
     *
     * @param {number} dirfd - Directory file descriptor (or AT_FDCWD)
     * @param {number} path - Pointer to symbolic link path string
     * @param {number} buf - Pointer to buffer for result
     * @param {number} bufsize - Size of buffer
     * @returns {number} Number of bytes placed in buffer on success,
     *                   negative errno on error
     *
     * @syscall readlinkat
     * @see https://man7.org/linux/man-pages/man2/readlinkat.2.html
     */
    function ___syscall_readlinkat(dirfd, path, buf, bufsize) {
        try {
            // 1. Convert path and calculate absolute path
            path = SYSCALLS.getStr(path);
            path = SYSCALLS.calculateAt(dirfd, path);

            // 2. Validate buffer size
            if (bufsize <= 0) {
                return -ERRNO.EINVAL;
            }

            // 3. Read symbolic link
            const ret = FS.readlink(path);

            // 4. Calculate length to copy (minimum of bufsize and actual length)
            const len = Math.min(bufsize, lengthBytesUTF8(ret));

            // 5. Preserve character at buffer end (won't null-terminate)
            const endChar = HEAP8[buf + len];

            // 6. Write result to buffer
            stringToUTF8(ret, buf, bufsize + 1);

            // 7. Restore preserved character (no null terminator)
            HEAP8[buf + len] = endChar;

            // 8. Return length
            return len;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e.name === 'ErrnoError')) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * rmdir - Remove directory
     *
     * Removes an empty directory. The directory must be empty (contain
     * only . and .. entries).
     *
     * @param {number} path - Pointer to directory path string
     * @returns {number} 0 on success, negative errno on error
     *
     * @syscall rmdir
     * @see https://man7.org/linux/man-pages/man2/rmdir.2.html
     */
    function ___syscall_rmdir(path) {
        try {
            // 1. Convert path pointer to string
            path = SYSCALLS.getStr(path);

            // 2. Remove directory
            FS.rmdir(path);

            // 3. Return success
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e.name === 'ErrnoError')) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * unlinkat - Remove file or directory relative to directory fd
     *
     * Removes a file or directory. The AT_REMOVEDIR flag determines whether
     * to remove a directory (like rmdir) or a file (like unlink).
     *
     * @param {number} dirfd - Directory file descriptor (or AT_FDCWD)
     * @param {number} path - Pointer to file/directory path string
     * @param {number} flags - Flags (0 for file, AT_REMOVEDIR for directory)
     * @returns {number} 0 on success, negative errno on error
     *
     * @syscall unlinkat
     * @see https://man7.org/linux/man-pages/man2/unlinkat.2.html
     */
    function ___syscall_unlinkat(dirfd, path, flags) {
        try {
            // 1. Convert path and calculate absolute path
            path = SYSCALLS.getStr(path);
            path = SYSCALLS.calculateAt(dirfd, path);

            // 2. Execute appropriate operation based on flags
            if (flags === 0) {
                // Remove file
                FS.unlink(path);
            } else if (flags === SPECIAL_FLAGS.AT_REMOVEDIR) {
                // Remove directory
                FS.rmdir(path);
            } else {
                // Invalid flags
                throw new Error('Invalid flags passed to unlinkat');
            }

            // 3. Return success
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e.name === 'ErrnoError')) {
                throw e;
            }
            return -e.errno;
        }
    }

    /**
     * utimensat - Change file timestamps relative to directory fd
     *
     * Changes the access and modification times of a file.
     * Supports special values:
     * - UTIME_NOW: Set to current time
     * - UTIME_OMIT: Don't change this timestamp
     *
     * @param {number} dirfd - Directory file descriptor (or AT_FDCWD)
     * @param {number} path - Pointer to file path string
     * @param {number} times - Pointer to array of two timespec structures
     *                        (access time, modification time)
     * @param {number} _flags - Flags (currently unused)
     * @returns {number} 0 on success, negative errno on error
     *
     * @syscall utimensat
     * @see https://man7.org/linux/man-pages/man2/utimensat.2.html
     */
    function ___syscall_utimensat(dirfd, path, times, _flags) {
        try {
            // 1. Convert path and calculate absolute path
            path = SYSCALLS.getStr(path);
            path = SYSCALLS.calculateAt(dirfd, path, true);

            // 2. Determine timestamp values
            const now = Date.now();
            let atime, mtime;

            if (!times) {
                // No times specified - use current time for both
                atime = now;
                mtime = now;
            } else {
                // Parse access time
                let seconds = readI53FromI64(times);
                let nanoseconds = HEAP32[(times + 8) >> 2];

                if (nanoseconds === UTIME_VALUES.UTIME_NOW) {
                    atime = now;
                } else if (nanoseconds === UTIME_VALUES.UTIME_OMIT) {
                    atime = -1; // Don't change
                } else {
                    atime = seconds * 1000 + nanoseconds / (1000 * 1000);
                }

                // Parse modification time
                times += 16;
                seconds = readI53FromI64(times);
                nanoseconds = HEAP32[(times + 8) >> 2];

                if (nanoseconds === UTIME_VALUES.UTIME_NOW) {
                    mtime = now;
                } else if (nanoseconds === UTIME_VALUES.UTIME_OMIT) {
                    mtime = -1; // Don't change
                } else {
                    mtime = seconds * 1000 + nanoseconds / (1000 * 1000);
                }
            }

            // 3. Update times if not -1 (UTIME_OMIT)
            if (mtime !== -1 || atime !== -1) {
                FS.utime(path, atime, mtime);
            }

            // 4. Return success
            return 0;
        } catch (e) {
            if (typeof FS === 'undefined' || !(e.name === 'ErrnoError')) {
                throw e;
            }
            return -e.errno;
        }
    }

    return {
        ___syscall_chmod,
        ___syscall_fchmod,
        ___syscall_fchown32,
        ___syscall_faccessat,
        ___syscall_fcntl64,
        ___syscall_ftruncate64,
        ___syscall_getcwd,
        ___syscall_mkdirat,
        ___syscall_openat,
        ___syscall_readlinkat,
        ___syscall_rmdir,
        ___syscall_unlinkat,
        ___syscall_utimensat,
    };
}
