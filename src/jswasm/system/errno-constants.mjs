/**
 * Errno Constants - POSIX error codes and ioctl operation constants
 *
 * This module defines all error codes and ioctl operation constants used
 * throughout the syscall implementation. These values follow POSIX standards
 * and Linux ioctl conventions.
 *
 * @module errno-constants
 */

/**
 * POSIX Error Codes (errno values)
 * These are returned as negative values from syscall implementations
 */
export const ERRNO = {
    /** EPERM: Operation not permitted */
    EPERM: 1,
    /** ENOENT: No such file or directory */
    ENOENT: 2,
    /** EINVAL: Invalid argument */
    EINVAL: 28,
    /** ENOTTY: Not a typewriter (not a TTY device) */
    ENOTTY: 59,
    /** EOVERFLOW: Value too large for defined data type */
    EOVERFLOW: 61,
    /** ENOTEMPTY: Directory not empty */
    ENOTEMPTY: 68,
    /** ENOTDIR: Not a directory */
    ENOTDIR: 43,
    /** ENODEV: No such device */
    ENODEV: 44,
};

/**
 * TTY ioctl Operation Codes
 * These constants represent terminal control operations (ioctl commands)
 * following the Linux termios interface
 */
export const IOCTL_OPS = {
    /** TCGETS: Get terminal attributes */
    TCGETS: 21505,
    /** TCSETS: Set terminal attributes */
    TCSETS: 21506,
    /** TCSETSW: Set terminal attributes (wait for output to drain) */
    TCSETSW: 21507,
    /** TCSETSF: Set terminal attributes (wait and flush) */
    TCSETSF: 21508,
    /** TCSBRK: Send break */
    TCSBRK: 21509,
    /** TCXONC: Flow control */
    TCXONC: 21510,
    /** TCFLSH: Flush terminal */
    TCFLSH: 21511,
    /** TIOCEXCL: Set exclusive mode */
    TIOCEXCL: 21512,
    /** TIOCNXCL: Clear exclusive mode */
    TIOCNXCL: 21515,
    /** TIOCSCTTY: Set controlling terminal */
    TIOCSCTTY: 21518,
    /** TIOCGPGRP: Get process group */
    TIOCGPGRP: 21519,
    /** TIOCSPGRP: Set process group */
    TIOCSPGRP: 21520,
    /** TIOCGWINSZ: Get window size */
    TIOCGWINSZ: 21523,
    /** TIOCSWINSZ: Set window size */
    TIOCSWINSZ: 21524,
    /** FIONBIO: Set/clear non-blocking I/O */
    FIONBIO: 21531,
};

/**
 * fcntl Command Codes
 * File control operations for the fcntl64 syscall
 */
export const FCNTL_CMD = {
    /** F_DUPFD: Duplicate file descriptor */
    F_DUPFD: 0,
    /** F_GETFD: Get file descriptor flags */
    F_GETFD: 1,
    /** F_SETFD: Set file descriptor flags */
    F_SETFD: 2,
    /** F_GETFL: Get file status flags */
    F_GETFL: 3,
    /** F_SETFL: Set file status flags */
    F_SETFL: 4,
    /** F_GETLK: Get record locking info */
    F_GETLK: 12,
    /** F_SETLK: Set record lock */
    F_SETLK: 13,
    /** F_SETLKW: Set record lock (wait) */
    F_SETLKW: 14,
};

/**
 * File Access Mode Bits
 * Used by faccessat syscall to test file accessibility
 */
export const ACCESS_MODE = {
    /** F_OK: File exists */
    F_OK: 0,
    /** X_OK: Execute permission */
    X_OK: 1,
    /** W_OK: Write permission */
    W_OK: 2,
    /** R_OK: Read permission */
    R_OK: 4,
};

/**
 * Special Flag Values
 */
export const SPECIAL_FLAGS = {
    /** AT_FDCWD: Use current working directory for relative paths */
    AT_FDCWD: -100,
    /** AT_SYMLINK_NOFOLLOW: Don't follow symbolic links */
    AT_SYMLINK_NOFOLLOW: 256,
    /** AT_REMOVEDIR: Remove directory instead of file */
    AT_REMOVEDIR: 512,
    /** AT_EMPTY_PATH: Allow empty pathname */
    AT_EMPTY_PATH: 4096,
    /** MS_ASYNC: Asynchronous memory sync */
    MS_ASYNC: 1,
    /** MS_SYNC: Synchronous memory sync */
    MS_SYNC: 2,
};

/**
 * Special Time Values for utimensat
 */
export const UTIME_VALUES = {
    /** UTIME_NOW: Set timestamp to current time */
    UTIME_NOW: 1073741823,
    /** UTIME_OMIT: Don't change timestamp */
    UTIME_OMIT: 1073741822,
};

/**
 * Safe Integer Range Constants
 * JavaScript's Number.MAX_SAFE_INTEGER and Number.MIN_SAFE_INTEGER
 */
export const INT53_MAX = 9007199254740992;
export const INT53_MIN = -9007199254740992;
