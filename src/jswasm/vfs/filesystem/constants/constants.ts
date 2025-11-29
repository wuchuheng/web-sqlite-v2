/**
 * Shared constants for the virtual filesystem implementation. Each value is
 * extracted from the original Emscripten configuration so helper modules can
 * use descriptive identifiers instead of relying on magic numbers.
 */

/**
 * File mode bit masks matching the Emscripten FS implementation.
 */
export interface ModeConstants {
  /** Mask for extracting the file type bits from a mode value. */
  readonly TYPE_MASK: number;
  /** Regular file bit. */
  readonly FILE: number;
  /** Directory bit. */
  readonly DIRECTORY: number;
  /** Symbolic link bit. */
  readonly SYMLINK: number;
  /** Character device bit. */
  readonly CHARACTER_DEVICE: number;
  /** Block device bit. */
  readonly BLOCK_DEVICE: number;
  /** FIFO bit. */
  readonly FIFO: number;
  /** Socket bit. */
  readonly SOCKET: number;
  /** Read permission bits for user/group/other. */
  readonly PERMISSION_READ: number;
  /** Write permission bits for user/group/other. */
  readonly PERMISSION_WRITE: number;
  /** Execute permission bits for user/group/other. */
  readonly PERMISSION_EXECUTE: number;
  /** Mask that preserves the permission bits when updating type. */
  readonly PERMISSION_MASK: number;
  /** Permission mask used for directories (sticky bit allowed). */
  readonly DIR_PERMISSION_MASK: number;
  /** Directory mask that keeps permission + sticky bits. */
  readonly DIR_PERMISSION_WITH_STICKY: number;
  /** Default permission bits for newly created files (rw-rw-rw-). */
  readonly DEFAULT_FILE_PERMISSIONS: number;
  /** Default permission bits for newly created directories (rwxrwxrwx). */
  readonly DEFAULT_DIRECTORY_PERMISSIONS: number;
}

/**
 * Open flag constants mirroring libc fcntl definitions.
 */
export interface OpenFlagConstants {
  /** Access mode mask (read/write bits). */
  readonly O_ACCMODE: number;
  /** Open for read only. */
  readonly O_RDONLY: number;
  /** Open for write only. */
  readonly O_WRONLY: number;
  /** Open for read/write. */
  readonly O_RDWR: number;
  /** Create file if it does not exist. */
  readonly O_CREAT: number;
  /** Error if O_CREAT and the file already exists. */
  readonly O_EXCL: number;
  /** Truncate the file to length 0. */
  readonly O_TRUNC: number;
  /** Append on each write. */
  readonly O_APPEND: number;
  /** Require the path to resolve to a directory. */
  readonly O_DIRECTORY: number;
  /** Do not follow symbolic links. */
  readonly O_NOFOLLOW: number;
  /** Obtain a file descriptor without actually opening the file. */
  readonly O_PATH: number;
}

/**
 * Errno codes emitted by the filesystem helpers.
 */
export interface FilesystemErrnoCodes {
  /** Operation not permitted. */
  readonly EPERM: number;
  /** No such file or directory. */
  readonly ENOENT: number;
  /** Permission denied. */
  readonly EACCES: number;
  /** File exists. */
  readonly EEXIST: number;
  /** Not a directory. */
  readonly ENOTDIR: number;
  /** Directory not empty. */
  readonly ENOTEMPTY: number;
  /** File is a directory. */
  readonly EISDIR: number;
  /** Invalid argument. */
  readonly EINVAL: number;
  /** Too many levels of symbolic links. */
  readonly ELOOP: number;
  /** Cross-device link (different mount points). */
  readonly EXDEV: number;
  /** Device or resource busy. */
  readonly EBUSY: number;
  /** Bad file descriptor. */
  readonly EBADF: number;
  /** Too many open files. */
  readonly EMFILE: number;
  /** Illegal seek (e.g. on pipes or character devices). */
  readonly ESPIPE: number;
  /** I/O error. */
  readonly EIO: number;
  /** No such device or address. */
  readonly ENXIO: number;
  /** Inappropriate ioctl for device. */
  readonly ENOTTY: number;
  /** Operation not supported. */
  readonly ENOTSUP: number;
  /** Function not implemented on this node/device. */
  readonly ENODEV: number;
}

/**
 * Permission helper constants used by the filesystem layer.
 */
export interface PermissionConstants {
  /** Combined read + execute bits typically required for directory traversal. */
  readonly READ_EXECUTE: number;
}

/** POSIX-style mode bit masks describing file types and permissions. */
export const MODE: ModeConstants = {
  /** Mask for extracting the file type bits from a mode value. */
  TYPE_MASK: 0o170000,
  /** Regular file bit. */
  FILE: 0o100000,
  /** Directory bit. */
  DIRECTORY: 0o040000,
  /** Symbolic link bit. */
  SYMLINK: 0o120000,
  /** Character device bit. */
  CHARACTER_DEVICE: 0o020000,
  /** Block device bit. */
  BLOCK_DEVICE: 0o060000,
  /** FIFO bit. */
  FIFO: 0o010000,
  /** Socket bit. */
  SOCKET: 0o140000,
  /** Read permission bits for user/group/other. */
  PERMISSION_READ: 0o444,
  /** Write permission bits for user/group/other. */
  PERMISSION_WRITE: 0o222,
  /** Execute permission bits for user/group/other. */
  PERMISSION_EXECUTE: 0o111,
  /** Mask that preserves the permission bits when updating type. */
  PERMISSION_MASK: 0o7777,
  /** Permission mask used for directories (sticky bit allowed). */
  DIR_PERMISSION_MASK: 0o777,
  /** Directory mask that keeps permission + sticky bits. */
  DIR_PERMISSION_WITH_STICKY: 0o1777,
  /** Default permission bits for newly created files (rw-rw-rw-). */
  DEFAULT_FILE_PERMISSIONS: 0o666,
  /** Default permission bits for newly created directories (rwxrwxrwx). */
  DEFAULT_DIRECTORY_PERMISSIONS: 0o777,
} as const;

/** Open flag constants mirrored from libc fcntl definitions. */
export const OPEN_FLAGS: OpenFlagConstants = {
  /** Access mode mask (read/write bits). */
  O_ACCMODE: 0o3,
  /** Open for read only. */
  O_RDONLY: 0,
  /** Open for write only. */
  O_WRONLY: 1,
  /** Open for read/write. */
  O_RDWR: 2,
  /** Create file if it does not exist. */
  O_CREAT: 0o100,
  /** Error if O_CREAT and the file already exists. */
  O_EXCL: 0o200,
  /** Truncate the file to length 0. */
  O_TRUNC: 0o1000,
  /** Append on each write. */
  O_APPEND: 0o2000,
  /** Require the path to resolve to a directory. */
  O_DIRECTORY: 0o200000,
  /** Do not follow symbolic links. */
  O_NOFOLLOW: 0o400000,
  /** Obtain a file descriptor without actually opening the file. */
  O_PATH: 0o10000000,
} as const;

/** Combination of bits that impact the readable/writeable checks on streams. */
export const STREAM_STATE_MASK: number =
  OPEN_FLAGS.O_PATH | OPEN_FLAGS.O_ACCMODE;

/** Default maximum number of simultaneously open file descriptors. */
export const MAX_OPEN_FDS: number = 4096;

/** Initial major number used when auto-assigning character devices. */
export const DEVICE_MAJOR_BASE: number = 64;

/**
 * Errno codes used by the filesystem. These mirror the values shipped by
 * Emscripten's FS implementation so higher level code can continue matching on
 * numeric errno values.
 */
export const ERRNO_CODES: FilesystemErrnoCodes = {
  /** Operation not permitted. */
  EPERM: 63,
  /** No such file or directory. */
  ENOENT: 44,
  /** Permission denied. */
  EACCES: 2,
  /** File exists. */
  EEXIST: 20,
  /** Not a directory. */
  ENOTDIR: 54,
  /** Directory not empty. */
  ENOTEMPTY: 55,
  /** File is a directory. */
  EISDIR: 31,
  /** Invalid argument. */
  EINVAL: 28,
  /** Too many levels of symbolic links. */
  ELOOP: 32,
  /** Cross-device link (different mount points). */
  EXDEV: 75,
  /** Device or resource busy. */
  EBUSY: 10,
  /** Bad file descriptor. */
  EBADF: 8,
  /** Too many open files. */
  EMFILE: 33,
  /** Illegal seek (e.g. on pipes or character devices). */
  ESPIPE: 70,
  /** I/O error. */
  EIO: 29,
  /** No such device or address. */
  ENXIO: 6,
  /** Inappropriate ioctl for device. */
  ENOTTY: 59,
  /** Operation not supported. */
  ENOTSUP: 138,
  /** Function not implemented on this node/device. */
  ENODEV: 43,
} as const;

/** Convenience grouping for permission checks on nodes. */
export const PERMISSION: PermissionConstants = {
  /** Combined read + execute bits typically required for directory traversal. */
  READ_EXECUTE: MODE.PERMISSION_READ | MODE.PERMISSION_EXECUTE,
} as const;
