/**
 * IOCTL System Call - Terminal Control Operations
 *
 * This module implements the ioctl syscall, which performs device-specific
 * control operations. The primary use case is terminal (TTY) control operations
 * including:
 * - Terminal attribute get/set (tcgets, tcsets, tcsetsw, tcsetsf)
 * - Terminal control (tcsbrk, tcxonc, tcflsh)
 * - Window size operations (tiocgwinsz, tiocswinsz)
 * - Process group operations (tiocgpgrp, tiocspgrp)
 * - Non-blocking I/O control (fionbio)
 *
 * @module ioctl-syscalls
 * @see https://man7.org/linux/man-pages/man2/ioctl.2.html
 * @see https://man7.org/linux/man-pages/man3/termios.3.html
 */

import { ERRNO, IOCTL_OPS } from "./errno-constants.mjs";

/**
 * Creates ioctl syscall implementation
 *
 * @param {import("../shared/system-types.d.ts").SyscallFS} FS - File system implementation
 * @param {import("../shared/system-types.d.ts").SyscallHelpers["SYSCALLS"]} SYSCALLS - Syscall helper utilities
 * @param {() => number} syscallGetVarargP - Get next pointer from varargs
 * @param {Int8Array} HEAP8 - Signed 8-bit heap view
 * @param {Int16Array} HEAP16 - Signed 16-bit heap view
 * @param {Int32Array} HEAP32 - Signed 32-bit heap view
 * @returns {import("../shared/system-types.d.ts").IoctlSyscalls} Object containing ioctl syscall function
 */
export function createIoctlSyscalls(
    FS,
    SYSCALLS,
    syscallGetVarargP,
    HEAP8,
    HEAP16,
    HEAP32,
) {
    /**
     * ioctl - Device control operations
     *
     * Performs device-specific control operations on a file descriptor.
     * Primarily used for terminal control operations but also supports
     * file system operations.
     *
     * Terminal operations follow the termios interface, which provides
     * control over:
     * - Input processing (c_iflag)
     * - Output processing (c_oflag)
     * - Control modes (c_cflag)
     * - Local modes (c_lflag)
     * - Control characters (c_cc array)
     *
     * @param {number} fd - File descriptor
     * @param {number} op - Operation code (TCGETS, TCSETS, TIOCGWINSZ, etc.)
     * @param {number} varargs - Pointer to variable arguments (operation-specific)
     * @returns {number} Operation-specific return value, or negative errno on error
     *
     * @syscall ioctl
     */
    function ___syscall_ioctl(fd, op, varargs) {
        SYSCALLS.varargs = varargs;

        try {
            // 1. Get file stream
            const stream = SYSCALLS.getStreamFromFD(fd);
            let argp;

            // 2. Execute operation based on operation code
            switch (op) {
                case IOCTL_OPS.TCSBRK: {
                    // Send break - verify TTY
                    if (!stream.tty) {
                        return -ERRNO.ENOTTY;
                    }
                    return 0;
                }

                case IOCTL_OPS.TCGETS: {
                    // Get terminal attributes
                    if (!stream.tty) {
                        return -ERRNO.ENOTTY;
                    }

                    if (stream.tty.ops.ioctl_tcgets) {
                        // Call TTY-specific ioctl handler
                        const termios = stream.tty.ops.ioctl_tcgets(stream);
                        argp = syscallGetVarargP();

                        // Write termios structure to memory
                        HEAP32[argp >> 2] = termios.c_iflag || 0; // Input flags
                        HEAP32[(argp + 4) >> 2] = termios.c_oflag || 0; // Output flags
                        HEAP32[(argp + 8) >> 2] = termios.c_cflag || 0; // Control flags
                        HEAP32[(argp + 12) >> 2] = termios.c_lflag || 0; // Local flags

                        // Write control characters (32 bytes)
                        for (let i = 0; i < 32; i++) {
                            HEAP8[argp + i + 17] = termios.c_cc[i] || 0;
                        }
                        return 0;
                    }
                    return 0;
                }

                case IOCTL_OPS.TCXONC:
                case IOCTL_OPS.TCFLSH:
                case IOCTL_OPS.TIOCEXCL: {
                    // Flow control, flush, exclusive mode
                    if (!stream.tty) {
                        return -ERRNO.ENOTTY;
                    }
                    return 0;
                }

                case IOCTL_OPS.TCSETS:
                case IOCTL_OPS.TCSETSW:
                case IOCTL_OPS.TCSETSF: {
                    // Set terminal attributes (immediate, wait, flush)
                    if (!stream.tty) {
                        return -ERRNO.ENOTTY;
                    }

                    if (stream.tty.ops.ioctl_tcsets) {
                        argp = syscallGetVarargP();

                        // Read termios structure from memory
                        const c_iflag = HEAP32[argp >> 2];
                        const c_oflag = HEAP32[(argp + 4) >> 2];
                        const c_cflag = HEAP32[(argp + 8) >> 2];
                        const c_lflag = HEAP32[(argp + 12) >> 2];

                        // Read control characters array
                        const c_cc = [];
                        for (let i = 0; i < 32; i++) {
                            c_cc.push(HEAP8[argp + i + 17]);
                        }

                        // Call TTY-specific ioctl handler
                        return stream.tty.ops.ioctl_tcsets(stream.tty, op, {
                            c_iflag,
                            c_oflag,
                            c_cflag,
                            c_lflag,
                            c_cc,
                        });
                    }
                    return 0;
                }

                case IOCTL_OPS.TIOCGPGRP: {
                    // Get process group ID
                    if (!stream.tty) {
                        return -ERRNO.ENOTTY;
                    }
                    argp = syscallGetVarargP();
                    HEAP32[argp >> 2] = 0; // Return process group 0
                    return 0;
                }

                case IOCTL_OPS.TIOCSPGRP: {
                    // Set process group ID
                    if (!stream.tty) {
                        return -ERRNO.ENOTTY;
                    }
                    return -ERRNO.EINVAL; // Not supported
                }

                case IOCTL_OPS.FIONBIO: {
                    // Set/clear non-blocking I/O
                    argp = syscallGetVarargP();
                    return FS.ioctl(stream, op, argp);
                }

                case IOCTL_OPS.TIOCGWINSZ: {
                    // Get window size
                    if (!stream.tty) {
                        return -ERRNO.ENOTTY;
                    }

                    if (stream.tty.ops.ioctl_tiocgwinsz) {
                        const winsize = stream.tty.ops.ioctl_tiocgwinsz(
                            stream.tty,
                        );
                        argp = syscallGetVarargP();

                        // Write window size structure (rows, cols)
                        HEAP16[argp >> 1] = winsize[0];
                        HEAP16[(argp + 2) >> 1] = winsize[1];
                    }
                    return 0;
                }

                case IOCTL_OPS.TIOCSWINSZ: {
                    // Set window size
                    if (!stream.tty) {
                        return -ERRNO.ENOTTY;
                    }
                    return 0;
                }

                case IOCTL_OPS.TIOCNXCL: {
                    // Clear exclusive mode
                    if (!stream.tty) {
                        return -ERRNO.ENOTTY;
                    }
                    return 0;
                }

                default:
                    // Unknown operation
                    return -ERRNO.EINVAL;
            }
        } catch (e) {
            if (typeof FS === "undefined" || !(e.name === "ErrnoError")) {
                throw e;
            }
            return -e.errno;
        }
    }

    return {
        ___syscall_ioctl,
    };
}
