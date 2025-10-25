/**
 * File mode bit masks matching the Emscripten FS implementation.
 */
export interface ModeConstants {
  readonly TYPE_MASK: number;
  readonly FILE: number;
  readonly DIRECTORY: number;
  readonly SYMLINK: number;
  readonly CHARACTER_DEVICE: number;
  readonly BLOCK_DEVICE: number;
  readonly FIFO: number;
  readonly SOCKET: number;
  readonly PERMISSION_READ: number;
  readonly PERMISSION_WRITE: number;
  readonly PERMISSION_EXECUTE: number;
  readonly PERMISSION_MASK: number;
  readonly DIR_PERMISSION_MASK: number;
  readonly DIR_PERMISSION_WITH_STICKY: number;
  readonly DEFAULT_FILE_PERMISSIONS: number;
  readonly DEFAULT_DIRECTORY_PERMISSIONS: number;
}

/**
 * Open flag constants mirroring libc fcntl definitions.
 */
export interface OpenFlagConstants {
  readonly O_ACCMODE: number;
  readonly O_RDONLY: number;
  readonly O_WRONLY: number;
  readonly O_RDWR: number;
  readonly O_CREAT: number;
  readonly O_EXCL: number;
  readonly O_TRUNC: number;
  readonly O_APPEND: number;
  readonly O_DIRECTORY: number;
  readonly O_NOFOLLOW: number;
  readonly O_PATH: number;
}

/**
 * Errno codes emitted by the filesystem helpers.
 */
export interface FilesystemErrnoCodes {
  readonly EPERM: number;
  readonly ENOENT: number;
  readonly EACCES: number;
  readonly EEXIST: number;
  readonly ENOTDIR: number;
  readonly ENOTEMPTY: number;
  readonly EISDIR: number;
  readonly EINVAL: number;
  readonly ELOOP: number;
  readonly EXDEV: number;
  readonly EBUSY: number;
  readonly EBADF: number;
  readonly EMFILE: number;
  readonly ESPIPE: number;
  readonly EIO: number;
  readonly ENXIO: number;
  readonly ENOTTY: number;
  readonly ENOTSUP: number;
  readonly ENODEV: number;
}

/**
 * Permission helper constants used by the filesystem layer.
 */
export interface PermissionConstants {
  readonly READ_EXECUTE: number;
}

/** POSIX-style mode bit masks describing file types and permissions. */
export declare const MODE: ModeConstants;
/** Open flag constants mirrored from libc fcntl definitions. */
export declare const OPEN_FLAGS: OpenFlagConstants;
/** Combination of bits that impact the readable/writeable checks on streams. */
export declare const STREAM_STATE_MASK: number;
/** Default maximum number of simultaneously open file descriptors. */
export declare const MAX_OPEN_FDS: number;
/** Initial major number used when auto-assigning character devices. */
export declare const DEVICE_MAJOR_BASE: number;
/** Errno codes used by the filesystem. */
export declare const ERRNO_CODES: FilesystemErrnoCodes;
/** Convenience grouping for permission checks on nodes. */
export declare const PERMISSION: PermissionConstants;
