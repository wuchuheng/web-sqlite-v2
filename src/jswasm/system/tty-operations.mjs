/**
 * TTY (Terminal) operations for SQLite WebAssembly module.
 * Handles terminal input/output and TTY device management.
 */

import { UTF8ArrayToString, intArrayFromString } from "../utils/utf8.mjs";

/** Errno constants for TTY operations. */
const ERRNO = {
    /** ENXIO: No such device or address. */
    ENXIO: 6,
    /** ENODEV: No such device. */
    ENODEV: 19,
    /** EIO: Input/output error. */
    EIO: 29,
    /** ENOPROTOOPT: Protocol not available. */
    ENOPROTOOPT: 43,
    /** ENODATA: No data available. */
    ENODATA: 60,
};

/** Terminal control character codes. */
const TTY_CHAR_CODES = {
    /** Null character. */
    NULL: 0,
    /** Newline character. */
    NEWLINE: 10,
};

/** Default terminal dimensions. */
const TTY_DEFAULT_DIMENSIONS = {
    rows: 24,
    cols: 80,
};

/**
 * Buffer for stdin character input.
 */
let FS_stdin_getChar_buffer = [];

/**
 * Get a character from stdin.
 * @returns {number|null} Character code or null if no input
 */
const FS_stdin_getChar = () => {
    // 1. Input handling
    if (!FS_stdin_getChar_buffer.length) {
        let userInput = null;
        if (
            typeof window !== "undefined" &&
            typeof window.prompt === "function"
        ) {
            userInput = window.prompt("Input: ");
            if (userInput !== null) {
                userInput += "\n";
            }
        }
        if (!userInput) {
            return null;
        }
        // 2. Core processing
        FS_stdin_getChar_buffer = intArrayFromString(userInput, true);
    }

    // 3. Output handling
    return FS_stdin_getChar_buffer.shift();
};

/**
 * TTY operations and device management.
 * Provides terminal input/output functionality for the virtual file system.
 * @param {(message: string) => void} out - Output function for normal output
 * @param {(message: string) => void} err - Output function for error output
 * @param {import("../shared/runtime-types.d.ts").RuntimeFS} FS - File system instance
 * @returns {import("../shared/runtime-types.d.ts").RuntimeTTY}
 */
export function createTTY(out, err, FS) {
    const TTY = {
        /** Array of TTY devices. */
        ttys: [],

        /** Initialize TTY system. */
        init() {},

        /** Shutdown TTY system. */
        shutdown() {},

        /**
         * Register a TTY device.
         * @param {number} dev - Device number
         * @param {import("../shared/runtime-types.d.ts").TTYDeviceOperations} ops - Device operations
         */
        register(dev, ops) {
            // 1. Input handling
            TTY.ttys[dev] = { input: [], output: [], ops: ops };

            // 2. Core processing
            FS.registerDevice(dev, TTY.stream_ops);
        },

        /** Stream operations for TTY devices. */
        stream_ops: {
            /**
             * Open a TTY stream.
             * @param {import("../vfs/filesystem/base-state.d.ts").FSStream & { tty?: import("../shared/runtime-types.d.ts").TTYDevice }} stream - Stream to open
             */
            open(stream) {
                // 1. Input handling
                const tty = TTY.ttys[stream.node.rdev];
                if (!tty) {
                    throw new FS.ErrnoError(ERRNO.ENOPROTOOPT);
                }

                // 2. Core processing
                stream.tty = tty;
                stream.seekable = false;
            },

            /**
             * Close a TTY stream.
             * @param {import("../vfs/filesystem/base-state.d.ts").FSStream & { tty?: import("../shared/runtime-types.d.ts").TTYDevice }} stream - Stream to close
             */
            close(stream) {
                stream.tty.ops.fsync(stream.tty);
            },

            /**
             * Sync a TTY stream.
             * @param {import("../vfs/filesystem/base-state.d.ts").FSStream & { tty?: import("../shared/runtime-types.d.ts").TTYDevice }} stream - Stream to sync
             */
            fsync(stream) {
                stream.tty.ops.fsync(stream.tty);
            },

            /**
             * Read from a TTY stream.
             * @param {import("../vfs/filesystem/base-state.d.ts").FSStream & { tty?: import("../shared/runtime-types.d.ts").TTYDevice }} stream - Stream to read from
             * @param {Uint8Array} buffer - Buffer to read into
             * @param {number} offset - Buffer offset
             * @param {number} length - Bytes to read
             * @param {number} _pos - Position (unused)
             * @returns {number} Bytes read
             */
            read(stream, buffer, offset, length, _pos) {
                // 1. Input handling
                if (!stream.tty || !stream.tty.ops.get_char) {
                    throw new FS.ErrnoError(ERRNO.ENODATA);
                }

                // 2. Core processing
                let bytesRead = 0;
                for (let i = 0; i < length; i++) {
                    let charCode;
                    try {
                        charCode = stream.tty.ops.get_char(stream.tty);
                    } catch (_e) {
                        throw new FS.ErrnoError(ERRNO.EIO);
                    }
                    if (charCode === undefined && bytesRead === 0) {
                        throw new FS.ErrnoError(ERRNO.ENXIO);
                    }
                    if (charCode === null || charCode === undefined) break;
                    bytesRead++;
                    buffer[offset + i] = charCode;
                }

                // 3. Output handling
                if (bytesRead) {
                    stream.node.timestamp = Date.now();
                }
                return bytesRead;
            },

            /**
             * Write to a TTY stream.
             * @param {import("../vfs/filesystem/base-state.d.ts").FSStream & { tty?: import("../shared/runtime-types.d.ts").TTYDevice }} stream - Stream to write to
             * @param {Uint8Array} buffer - Buffer to write from
             * @param {number} offset - Buffer offset
             * @param {number} length - Bytes to write
             * @param {number} _pos - Position (unused)
             * @returns {number} Bytes written
             */
            write(stream, buffer, offset, length, _pos) {
                // 1. Input handling
                if (!stream.tty || !stream.tty.ops.put_char) {
                    throw new FS.ErrnoError(ERRNO.ENODATA);
                }

                // 2. Core processing
                let bytesWritten = 0;
                try {
                    for (
                        bytesWritten = 0;
                        bytesWritten < length;
                        bytesWritten++
                    ) {
                        stream.tty.ops.put_char(
                            stream.tty,
                            buffer[offset + bytesWritten],
                        );
                    }
                } catch (_e) {
                    throw new FS.ErrnoError(ERRNO.EIO);
                }

                // 3. Output handling
                if (length) {
                    stream.node.timestamp = Date.now();
                }
                return bytesWritten;
            },
        },

        /** Default TTY operations for standard input/output. */
        default_tty_ops: {
            /**
             * Get a character from TTY.
             * @param {import("../shared/runtime-types.d.ts").TTYDevice} _tty - TTY device (unused)
             * @returns {number|null} Character code
             */
            get_char(_tty) {
                return FS_stdin_getChar();
            },

            /**
             * Put a character to TTY.
             * @param {import("../shared/runtime-types.d.ts").TTYDevice} tty - TTY device
             * @param {number} val - Character code
             */
            put_char(tty, val) {
                // 1. Input handling
                if (val === null || val === TTY_CHAR_CODES.NEWLINE) {
                    // 2. Core processing
                    out(UTF8ArrayToString(tty.output));
                    tty.output = [];
                } else {
                    if (val !== TTY_CHAR_CODES.NULL) tty.output.push(val);
                }
            },

            /**
             * Sync TTY output.
             * @param {import("../shared/runtime-types.d.ts").TTYDevice} tty - TTY device
             */
            fsync(tty) {
                // 1. Input handling
                if (tty.output && tty.output.length > 0) {
                    // 2. Core processing
                    out(UTF8ArrayToString(tty.output));
                    tty.output = [];
                }
            },

            /**
             * Get terminal settings (tcgets ioctl).
             * @param {import("../shared/runtime-types.d.ts").TTYDevice} _tty - TTY device (unused)
             * @returns {import("../shared/runtime-types.d.ts").TTYTermiosSettings} Terminal settings
             */
            ioctl_tcgets(_tty) {
                return {
                    c_iflag: 25856,
                    c_oflag: 5,
                    c_cflag: 191,
                    c_lflag: 35387,
                    c_cc: [
                        0x03, 0x1c, 0x7f, 0x15, 0x04, 0x00, 0x01, 0x00, 0x11,
                        0x13, 0x1a, 0x00, 0x12, 0x0f, 0x17, 0x16, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00,
                    ],
                };
            },

            /**
             * Set terminal settings (tcsets ioctl).
             * @param {import("../shared/runtime-types.d.ts").TTYDevice} _tty - TTY device (unused)
             * @param {number} _optional_actions - Actions (unused)
             * @param {import("../shared/runtime-types.d.ts").TTYTermiosSettings} _data - Settings data (unused)
             * @returns {number} Success code
             */
            ioctl_tcsets(_tty, _optional_actions, _data) {
                return 0;
            },

            /**
             * Get terminal window size.
             * @param {import("../shared/runtime-types.d.ts").TTYDevice} _tty - TTY device (unused)
             * @returns {number[]} Window size [rows, cols]
             */
            ioctl_tiocgwinsz(_tty) {
                return [
                    TTY_DEFAULT_DIMENSIONS.rows,
                    TTY_DEFAULT_DIMENSIONS.cols,
                ];
            },
        },

        /** Default TTY operations for error output. */
        default_tty1_ops: {
            /**
             * Put a character to error TTY.
             * @param {import("../shared/runtime-types.d.ts").TTYDevice} tty - TTY device
             * @param {number} val - Character code
             */
            put_char(tty, val) {
                // 1. Input handling
                if (val === null || val === TTY_CHAR_CODES.NEWLINE) {
                    // 2. Core processing
                    err(UTF8ArrayToString(tty.output));
                    tty.output = [];
                } else {
                    if (val !== TTY_CHAR_CODES.NULL) tty.output.push(val);
                }
            },

            /**
             * Sync error TTY output.
             * @param {import("../shared/runtime-types.d.ts").TTYDevice} tty - TTY device
             */
            fsync(tty) {
                // 1. Input handling
                if (tty.output && tty.output.length > 0) {
                    // 2. Core processing
                    err(UTF8ArrayToString(tty.output));
                    tty.output = [];
                }
            },
        },
    };

    return TTY;
}

/**
 * Export FS_stdin_getChar for backward compatibility.
 */
export { FS_stdin_getChar };
