import { PATH } from "../../../utils/path/path";
import {
  ERRNO_CODES,
  MODE,
  OPEN_FLAGS,
  STREAM_STATE_MASK,
} from "../constants/constants";
import type {
  FSNode,
  FSStream,
  FSStats,
  MutableFS,
} from "../base-state/base-state";
import type { NodeActionsOptions } from "../node-actions/node-actions";

/**
 * Extended MutableFS interface that includes the methods required by metadata operations.
 * This interface extends the base MutableFS with filesystem helper methods.
 */
export interface MetadataOperationsFS extends MutableFS {
  /** Looks up a path and returns the resolved node and path information. */
  lookupPath(
    path: string,
    options?: { follow?: boolean; follow_mount?: boolean; parent?: boolean },
  ): {
    node: FSNode;
    path: string;
  };
  /** Retrieves file status information. */
  stat(path: string, dontFollow?: boolean): FSStats;
  /** Changes file permissions. */
  chmod(path: string | FSNode, mode: number, dontFollow?: boolean): void;
  /** Changes file ownership. */
  chown(
    path: string | FSNode,
    uid: number,
    gid: number,
    dontFollow?: boolean,
  ): void;
  /** Retrieves a stream and validates the file descriptor. */
  getStreamChecked(fd: number): FSStream;
  /** Truncates a file to the specified size. */
  truncate(path: string | FSNode, len: number): void;
  /** Checks if the provided mode represents a directory. */
  isDir(mode: number): boolean;
  /** Checks if the provided mode represents a regular file. */
  isFile(mode: number): boolean;
  /** Checks if the provided mode represents a character device. */
  isChrdev(mode: number): boolean;
  /** Validates file permissions for the specified operation. */
  nodePermissions(node: FSNode, perms: string): number;
  /** Validates whether a file can be opened with the specified flags. */
  mayOpen(node: FSNode, flags: number): number;
  /** Creates a filesystem node with the specified mode and device. */
  mknod(path: string, mode: number, dev: number): FSNode;
  /** Creates a new stream for the provided node and configuration. */
  createStream(config: {
    node: FSNode;
    path: string;
    flags: number;
    seekable: boolean;
    position: number;
    stream_ops: FSNode["stream_ops"];
    ungotten: number[];
    error: boolean;
  }): FSStream;
  /** Retrieves the canonical path for the provided node. */
  getPath(node: FSNode): string;
}

/**
 * Interface defining metadata operations for filesystem nodes.
 * Provides functions for status queries, permission management,
 * ownership changes, content modification, and file access.
 */
export interface MetadataOperations {
  /** Get file/directory status, following symlinks by default */
  stat(path: string, dontFollow?: boolean): FSStats;

  /** Get file/directory status without following symlinks */
  lstat(path: string): FSStats;

  /** Change file permissions */
  chmod(path: string | FSNode, mode: number, dontFollow?: boolean): void;

  /** Change file permissions without following symlinks */
  lchmod(path: string | FSNode, mode: number): void;

  /** Change permissions using file descriptor */
  fchmod(fd: number, mode: number): void;

  /** Change file ownership */
  chown(
    path: string | FSNode,
    uid: number,
    gid: number,
    dontFollow?: boolean,
  ): void;

  /** Change ownership without following symlinks */
  lchown(path: string | FSNode, uid: number, gid: number): void;

  /** Change ownership using file descriptor */
  fchown(fd: number, uid: number, gid: number): void;

  /** Truncate file to specified size */
  truncate(path: string | FSNode, len: number): void;

  /** Truncate file using file descriptor */
  ftruncate(fd: number, len: number): void;

  /** Update file access and modification times */
  utime(path: string, atime: number, mtime: number): void;

  /** Open file with specified flags and mode */
  open(path: string | FSNode, flags: number | string, mode?: number): FSStream;
}

/**
 * Creates metadata operations that handle file status, permissions,
 * ownership, content modification, and file opening operations.
 *
 * @param FS - The mutable filesystem interface with metadata operations
 * @param options - Configuration options including path utilities and runtime module
 * @returns Object containing metadata and file access operations
 */
export function createMetadataOperations(
  FS: MetadataOperationsFS,
  { FS_modeStringToFlags, Module }: NodeActionsOptions,
): MetadataOperations {
  return {
    /**
     * Retrieves file status information.
     * @param path - File path to query
     * @param dontFollow - If true, don't follow symbolic links
     * @returns File status information
     * @throws {FS.ErrnoError} ENOENT if file doesn't exist
     * @throws {FS.ErrnoError} EPERM if getattr operation not supported
     */
    stat(path: string, dontFollow?: boolean): FSStats {
      // 1. Input handling - resolve path lookup
      const lookup = FS.lookupPath(path, { follow: !dontFollow });
      const node = lookup.node;

      // 2. Validation - ensure node exists and supports getattr
      if (!node) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }
      if (!node.node_ops.getattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }

      // 3. Output handling - return node attributes
      return node.node_ops.getattr(node);
    },

    /**
     * Retrieves file status without following symbolic links.
     * @param path - File path to query
     * @returns File status information
     */
    lstat(path: string): FSStats {
      return FS.stat(path, true);
    },

    /**
     * Changes file permissions.
     * @param path - File path or node object
     * @param mode - New permission mode
     * @param dontFollow - If true, don't follow symbolic links
     * @throws {FS.ErrnoError} EPERM if setattr operation not supported
     */
    chmod(path: string | FSNode, mode: number, dontFollow?: boolean): void {
      // 1. Input handling - resolve node from path or use directly
      let node: FSNode;
      if (typeof path === "string") {
        const lookup = FS.lookupPath(path, { follow: !dontFollow });
        node = lookup.node;
      } else {
        node = path;
      }

      // 2. Validation - ensure setattr operation is supported
      if (!node.node_ops.setattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }

      // 3. Output handling - update node attributes
      node.node_ops.setattr(node, {
        mode:
          (mode & MODE.PERMISSION_MASK) | (node.mode & ~MODE.PERMISSION_MASK),
        timestamp: Date.now(),
      });
    },

    /**
     * Changes file permissions without following symbolic links.
     * @param path - File path or node object
     * @param mode - New permission mode
     */
    lchmod(path: string | FSNode, mode: number): void {
      FS.chmod(path, mode, true);
    },

    /**
     * Changes file permissions using file descriptor.
     * @param fd - File descriptor
     * @param mode - New permission mode
     * @throws {FS.ErrnoError} EBADF if file descriptor is invalid
     */
    fchmod(fd: number, mode: number): void {
      // 1. Input handling - get stream from file descriptor
      const stream = FS.getStreamChecked(fd);

      // 2. Output handling - change permissions on stream's node
      if (stream.node) {
        FS.chmod(stream.node, mode);
      }
    },

    /**
     * Changes file ownership.
     * @param path - File path or node object
     * @param uid - User ID (note: uid/gid not actually stored in current implementation)
     * @param gid - Group ID (note: uid/gid not actually stored in current implementation)
     * @param dontFollow - If true, don't follow symbolic links
     * @throws {FS.ErrnoError} EPERM if setattr operation not supported
     */
    chown(
      path: string | FSNode,
      _uid: number,
      _gid: number,
      dontFollow?: boolean,
    ): void {
      // 1. Input handling - resolve node from path or use directly
      let node: FSNode;
      if (typeof path === "string") {
        const lookup = FS.lookupPath(path, { follow: !dontFollow });
        node = lookup.node;
      } else {
        node = path;
      }

      // 2. Validation - ensure setattr operation is supported
      if (!node.node_ops.setattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }

      // 3. Output handling - update timestamp (uid/gid not stored in this implementation)
      node.node_ops.setattr(node, {
        timestamp: Date.now(),
      });
    },

    /**
     * Changes file ownership without following symbolic links.
     * @param path - File path or node object
     * @param uid - User ID
     * @param gid - Group ID
     */
    lchown(path: string | FSNode, uid: number, gid: number): void {
      FS.chown(path, uid, gid, true);
    },

    /**
     * Changes file ownership using file descriptor.
     * @param fd - File descriptor
     * @param uid - User ID
     * @param gid - Group ID
     * @throws {FS.ErrnoError} EBADF if file descriptor is invalid
     */
    fchown(fd: number, uid: number, gid: number): void {
      // 1. Input handling - get stream from file descriptor
      const stream = FS.getStreamChecked(fd);

      // 2. Output handling - change ownership on stream's node
      if (stream.node) {
        FS.chown(stream.node, uid, gid);
      }
    },

    /**
     * Truncates file to specified length.
     * @param path - File path or node object
     * @param len - New file size
     * @throws {FS.ErrnoError} EINVAL if length is negative
     * @throws {FS.ErrnoError} EPERM if setattr operation not supported
     * @throws {FS.ErrnoError} EISDIR if path points to directory
     * @throws {FS.ErrnoError} EINVAL if path is not a regular file
     * @throws {FS.ErrnoError} EACCES if no write permission
     */
    truncate(path: string | FSNode, len: number): void {
      // 1. Input handling - validate length and resolve node
      if (len < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }

      let node: FSNode;
      if (typeof path === "string") {
        const lookup = FS.lookupPath(path, { follow: true });
        node = lookup.node;
      } else {
        node = path;
      }

      // 2. Validation - check node type and permissions
      if (!node.node_ops.setattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      if (FS.isDir(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
      }
      if (!FS.isFile(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      const errCode = FS.nodePermissions(node, "w");
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }

      // 3. Output handling - update node size
      node.node_ops.setattr(node, {
        size: len,
        timestamp: Date.now(),
      });
    },

    /**
     * Truncates file using file descriptor.
     * @param fd - File descriptor
     * @param len - New file size
     * @throws {FS.ErrnoError} EBADF if file descriptor is invalid
     * @throws {FS.ErrnoError} EINVAL if file is opened read-only
     */
    ftruncate(fd: number, len: number): void {
      // 1. Input handling - get stream and validate access mode
      const stream = FS.getStreamChecked(fd);
      if ((stream.flags & STREAM_STATE_MASK) === OPEN_FLAGS.O_RDONLY) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }

      // 2. Output handling - truncate the stream's node
      if (stream.node) {
        FS.truncate(stream.node, len);
      }
    },

    /**
     * Updates file access and modification times.
     * @param path - File path
     * @param atime - Access time (seconds since epoch)
     * @param mtime - Modification time (seconds since epoch)
     * @throws {FS.ErrnoError} ENOENT if file doesn't exist
     */
    utime(path: string, atime: number, mtime: number): void {
      // 1. Input handling - resolve node
      const lookup = FS.lookupPath(path, { follow: true });
      const node = lookup.node;

      // 2. Output handling - update timestamp to max of atime/mtime
      if (node?.node_ops?.setattr) {
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime),
        });
      }
    },

    /**
     * Opens a file with specified flags and mode.
     * @param path - File path or node object
     * @param flags - Open flags or mode string
     * @param mode - Permission mode for file creation
     * @returns File stream object
     * @throws {FS.ErrnoError} ENOENT if path is empty or file doesn't exist
     * @throws {FS.ErrnoError} EEXIST if O_EXCL and file exists
     * @throws {FS.ErrnoError} ENOTDIR if O_DIRECTORY on non-directory
     * @throws {FS.ErrnoError} EACCES if permission denied
     */
    open(
      path: string | FSNode,
      flags: number | string,
      mode?: number,
    ): FSStream {
      // 1. Input handling - validate path and normalize flags
      if (typeof path === "string" && path === "") {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }

      const normalizedFlags =
        typeof flags === "string" ? FS_modeStringToFlags(flags) : flags;

      // Handle creation mode and permission setup
      let fileMode: number | undefined;
      if (normalizedFlags & OPEN_FLAGS.O_CREAT) {
        fileMode =
          typeof mode === "undefined" ? MODE.DEFAULT_FILE_PERMISSIONS : mode;
        fileMode = (fileMode & MODE.PERMISSION_MASK) | MODE.FILE;
      } else {
        fileMode = 0;
      }

      // 2. Core processing - resolve node and handle creation
      let node: FSNode | undefined;
      let created = false;

      if (typeof path === "object") {
        node = path;
      } else {
        const normalizedPath = PATH.normalize(path);
        try {
          const lookup = FS.lookupPath(normalizedPath, {
            follow: !(normalizedFlags & OPEN_FLAGS.O_NOFOLLOW),
          });
          node = lookup.node;
        } catch (_e) {
          // File doesn't exist, may need to create
        }

        // Handle file creation
        if (normalizedFlags & OPEN_FLAGS.O_CREAT) {
          if (node) {
            if (normalizedFlags & OPEN_FLAGS.O_EXCL) {
              throw new FS.ErrnoError(ERRNO_CODES.EEXIST);
            }
          } else {
            node = FS.mknod(normalizedPath, fileMode, 0);
            created = true;
          }
        }
      }

      // Validate node exists
      if (!node) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }

      // 3. Validation - check node type and permissions
      let mutableFlags = normalizedFlags;
      if (FS.isChrdev(node.mode)) {
        // Don't truncate character devices

        mutableFlags &= ~OPEN_FLAGS.O_TRUNC;
      }

      if (mutableFlags & OPEN_FLAGS.O_DIRECTORY && !FS.isDir(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
      }

      if (!created) {
        const errCode = FS.mayOpen(node, mutableFlags);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
      }

      // Handle truncation for newly opened files
      if (mutableFlags & OPEN_FLAGS.O_TRUNC && !created) {
        FS.truncate(node, 0);
      }

      // Clean up flags that shouldn't be stored
      const cleanFlags =
        mutableFlags &
        ~(OPEN_FLAGS.O_EXCL | OPEN_FLAGS.O_TRUNC | OPEN_FLAGS.O_NOFOLLOW);

      // 4. Output handling - create and configure stream
      const stream = FS.createStream({
        node,
        path: FS.getPath(node),
        flags: cleanFlags,
        seekable: true,
        position: 0,
        stream_ops: node.stream_ops,
        ungotten: [],
        error: false,
      });

      // Call stream open operation if available
      if (stream.stream_ops.open) {
        stream.stream_ops.open(stream);
      }

      // Log read files if enabled and opened with read intent
      if (
        Module?.logReadFiles &&
        (cleanFlags & OPEN_FLAGS.O_ACCMODE) !== OPEN_FLAGS.O_WRONLY &&
        typeof path === "string"
      ) {
        if (!(path in FS.readFiles)) {
          FS.readFiles[path] = 1;
        }
      }

      return stream;
    },
  };
}
