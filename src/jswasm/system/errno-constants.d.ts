/**
 * POSIX errno values surfaced by the WebAssembly syscall shims.
 */
export interface ErrnoConstants {
    readonly EPERM: 1;
    readonly ENOENT: 2;
    readonly EINVAL: 28;
    readonly ENOTTY: 59;
    readonly EOVERFLOW: 61;
    readonly ENOTEMPTY: 68;
    readonly ENOTDIR: 43;
    readonly ENODEV: 44;
}

/**
 * ioctl operation codes used when interacting with TTY devices.
 */
export interface IoctlOperationConstants {
    readonly TCGETS: 21505;
    readonly TCSETS: 21506;
    readonly TCSETSW: 21507;
    readonly TCSETSF: 21508;
    readonly TCSBRK: 21509;
    readonly TCXONC: 21510;
    readonly TCFLSH: 21511;
    readonly TIOCEXCL: 21512;
    readonly TIOCNXCL: 21515;
    readonly TIOCSCTTY: 21518;
    readonly TIOCGPGRP: 21519;
    readonly TIOCSPGRP: 21520;
    readonly TIOCGWINSZ: 21523;
    readonly TIOCSWINSZ: 21524;
    readonly FIONBIO: 21531;
}

/**
 * fcntl64 command constants controlling descriptor operations.
 */
export interface FcntlCommandConstants {
    readonly F_DUPFD: 0;
    readonly F_GETFD: 1;
    readonly F_SETFD: 2;
    readonly F_GETFL: 3;
    readonly F_SETFL: 4;
    readonly F_GETLK: 12;
    readonly F_SETLK: 13;
    readonly F_SETLKW: 14;
}

/**
 * Access mode bitmask values evaluated by faccessat.
 */
export interface AccessModeConstants {
    readonly F_OK: 0;
    readonly X_OK: 1;
    readonly W_OK: 2;
    readonly R_OK: 4;
}

/**
 * Special flag constants used across various filesystem syscalls.
 */
export interface SpecialFlagConstants {
    readonly AT_FDCWD: -100;
    readonly AT_SYMLINK_NOFOLLOW: 256;
    readonly AT_REMOVEDIR: 512;
    readonly AT_EMPTY_PATH: 4096;
    readonly MS_ASYNC: 1;
    readonly MS_SYNC: 2;
}

/**
 * Sentinel timestamp values for utimensat invocations.
 */
export interface UtimeValueConstants {
    readonly UTIME_NOW: 1073741823;
    readonly UTIME_OMIT: 1073741822;
}

/**
 * POSIX error code lookup table exported by the module.
 */
export declare const ERRNO: ErrnoConstants;

/**
 * ioctl operation lookup table exported by the module.
 */
export declare const IOCTL_OPS: IoctlOperationConstants;

/**
 * fcntl command lookup table exported by the module.
 */
export declare const FCNTL_CMD: FcntlCommandConstants;

/**
 * Access-mode flag lookup table exported by the module.
 */
export declare const ACCESS_MODE: AccessModeConstants;

/**
 * Miscellaneous flag lookup table exported by the module.
 */
export declare const SPECIAL_FLAGS: SpecialFlagConstants;

/**
 * Timestamp sentinel lookup table exported by the module.
 */
export declare const UTIME_VALUES: UtimeValueConstants;

/**
 * Maximum safe signed integer representable by JavaScript numbers.
 */
export declare const INT53_MAX: 9007199254740992;

/**
 * Minimum safe signed integer representable by JavaScript numbers.
 */
export declare const INT53_MIN: -9007199254740992;
