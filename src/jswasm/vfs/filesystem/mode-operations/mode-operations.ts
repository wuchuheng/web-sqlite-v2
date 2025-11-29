/**
 * Mode Operations - TypeScript Implementation
 *
 * Helper methods for reasoning about POSIX mode bit masks and validating
 * permissions for filesystem nodes. This module provides type-safe operations
 * for file type identification, permission checking, and filesystem access control.
 *
 * @fileoverview
 * Contains the TypeScript implementation of mode operations that were originally
 * in mode-operations.mjs. All functions maintain the same behavior and API surface
 * as the original JavaScript implementation while adding comprehensive type safety.
 */

import { ERRNO_CODES, MODE, OPEN_FLAGS } from "../constants/constants";
import type { MutableFS, FSNode } from "../base-state/base-state";

/**
 * Extended MutableFS interface that includes the methods required by mode operations.
 * This interface extends the base MutableFS with filesystem helper methods.
 */
export interface ModeOperationsFS extends MutableFS {
  isDir(mode: number): boolean;
  isLink(mode: number): boolean;
  isRoot(node: FSNode): boolean;
  getPath(node: FSNode): string;
  cwd(): string;
  flagsToPermissionString(flags: number): string;
  nodePermissions(node: FSNode, perms: string): number;
  lookupNode(parent: FSNode, name: string): FSNode;
}

/**
 * Helper methods for reasoning about POSIX mode bit masks and validating
 * permissions for filesystem nodes.
 */
export interface ModeOperations {
  isFile(mode: number): boolean;
  isDir(mode: number): boolean;
  isLink(mode: number): boolean;
  isChrdev(mode: number): boolean;
  isBlkdev(mode: number): boolean;
  isFIFO(mode: number): boolean;
  isSocket(mode: number): boolean;
  flagsToPermissionString(flag: number): string;
  nodePermissions(node: FSNode, perms: string): number;
  mayLookup(dir: FSNode): number;
  mayCreate(dir: FSNode, name: string): number;
  mayDelete(dir: FSNode, name: string, isDir: boolean): number;
  mayOpen(node: FSNode | null, flags: number): number;
}

/**
 * Produces helpers for reasoning about POSIX mode bitmasks and validating
 * permissions for filesystem nodes.
 *
 * @param {ModeOperationsFS} FS - The mutable filesystem state containing helper methods
 * @returns {ModeOperations} An object containing mode operation helper functions
 */
export function createModeOperations(FS: ModeOperationsFS): ModeOperations {
  return {
    /**
     * Checks if the provided mode represents a regular file.
     *
     * @param {number} mode - The POSIX mode bitmask to check
     * @returns {boolean} True if the mode represents a regular file, false otherwise
     */
    isFile(mode: number): boolean {
      return (mode & MODE.TYPE_MASK) === MODE.FILE;
    },

    /**
     * Checks if the provided mode represents a directory.
     *
     * @param {number} mode - The POSIX mode bitmask to check
     * @returns {boolean} True if the mode represents a directory, false otherwise
     */
    isDir(mode: number): boolean {
      return (mode & MODE.TYPE_MASK) === MODE.DIRECTORY;
    },

    /**
     * Checks if the provided mode represents a symbolic link.
     *
     * @param {number} mode - The POSIX mode bitmask to check
     * @returns {boolean} True if the mode represents a symbolic link, false otherwise
     */
    isLink(mode: number): boolean {
      return (mode & MODE.TYPE_MASK) === MODE.SYMLINK;
    },

    /**
     * Checks if the provided mode represents a character device.
     *
     * @param {number} mode - The POSIX mode bitmask to check
     * @returns {boolean} True if the mode represents a character device, false otherwise
     */
    isChrdev(mode: number): boolean {
      return (mode & MODE.TYPE_MASK) === MODE.CHARACTER_DEVICE;
    },

    /**
     * Checks if the provided mode represents a block device.
     *
     * @param {number} mode - The POSIX mode bitmask to check
     * @returns {boolean} True if the mode represents a block device, false otherwise
     */
    isBlkdev(mode: number): boolean {
      return (mode & MODE.TYPE_MASK) === MODE.BLOCK_DEVICE;
    },

    /**
     * Checks if the provided mode represents a FIFO (named pipe).
     *
     * @param {number} mode - The POSIX mode bitmask to check
     * @returns {boolean} True if the mode represents a FIFO, false otherwise
     */
    isFIFO(mode: number): boolean {
      return (mode & MODE.TYPE_MASK) === MODE.FIFO;
    },

    /**
     * Checks if the provided mode represents a socket.
     *
     * @param {number} mode - The POSIX mode bitmask to check
     * @returns {boolean} True if the mode represents a socket, false otherwise
     */
    isSocket(mode: number): boolean {
      return (mode & MODE.TYPE_MASK) === MODE.SOCKET;
    },

    /**
     * Converts open flag constants to a permission string representation.
     *
     * @param {number} flag - The open flags bitmask to convert
     * @returns {string} A string representing the permissions ("r", "w", "rw", with optional "w" for O_TRUNC)
     */
    flagsToPermissionString(flag: number): string {
      // 1. Extract access mode (read/write)
      const perms = ["r", "w", "rw"][flag & OPEN_FLAGS.O_ACCMODE];

      // 2. Add write permission for truncate flag
      if (flag & OPEN_FLAGS.O_TRUNC) {
        return perms + "w";
      }

      // 3. Return the permission string
      return perms;
    },

    /**
     * Validates whether a node has the required permissions.
     *
     * @param {FSNode} node - The filesystem node to check
     * @param {string} perms - Required permissions as a string (e.g., "r", "w", "x", "rw")
     * @returns {number} 0 if permissions are granted, error code (EACCES) if denied
     */
    nodePermissions(node: FSNode, perms: string): number {
      // 1. Bypass checks if permissions are ignored globally
      if (FS.ignorePermissions) {
        return 0;
      }

      // 2. Check read permission if required
      if (perms.includes("r") && !(node.mode & MODE.PERMISSION_READ)) {
        return ERRNO_CODES.EACCES;
      }

      // 3. Check write permission if required
      if (perms.includes("w") && !(node.mode & MODE.PERMISSION_WRITE)) {
        return ERRNO_CODES.EACCES;
      }

      // 4. Check execute permission if required
      if (perms.includes("x") && !(node.mode & MODE.PERMISSION_EXECUTE)) {
        return ERRNO_CODES.EACCES;
      }

      // 5. All required permissions are granted
      return 0;
    },

    /**
     * Validates whether a directory can be looked up (traversed).
     *
     * @param {FSNode} dir - The directory node to check
     * @returns {number} 0 if lookup is allowed, error code if denied
     */
    mayLookup(dir: FSNode): number {
      // 1. Check if the node is actually a directory
      if (!FS.isDir(dir.mode)) {
        return ERRNO_CODES.ENOTDIR;
      }

      // 2. Check execute permission for directory traversal
      const errCode = FS.nodePermissions(dir, "x");
      if (errCode) {
        return errCode;
      }

      // 3. Check if the directory supports lookup operations
      if (!dir.node_ops.lookup) {
        return ERRNO_CODES.EACCES;
      }

      // 4. Directory lookup is allowed
      return 0;
    },

    /**
     * Validates whether a new entry can be created in a directory.
     *
     * @param {FSNode} dir - The parent directory node
     * @param {string} name - The name of the entry to create
     * @returns {number} 0 if creation is allowed, error code if denied
     */
    mayCreate(dir: FSNode, name: string): number {
      // 1. Check if an entry with the same name already exists
      try {
        FS.lookupNode(dir, name);
        return ERRNO_CODES.EEXIST;
      } catch (_e) {
        // Entry doesn't exist, proceed with permission check
      }

      // 2. Check write and execute permissions on the parent directory
      return FS.nodePermissions(dir, "wx");
    },

    /**
     * Validates whether an entry can be deleted from a directory.
     *
     * @param {FSNode} dir - The parent directory node
     * @param {string} name - The name of the entry to delete
     * @param {boolean} isdir - True if deleting a directory, false for files
     * @returns {number} 0 if deletion is allowed, error code if denied
     */
    mayDelete(dir: FSNode, name: string, isDir: boolean): number {
      let node: FSNode;

      // 1. Look up the node to be deleted
      try {
        node = FS.lookupNode(dir, name);
      } catch (e: unknown) {
        return (e as { errno?: number }).errno || ERRNO_CODES.ENOENT;
      }

      // 2. Check write and execute permissions on the parent directory
      const errCode = FS.nodePermissions(dir, "wx");
      if (errCode) {
        return errCode;
      }

      // 3. Validate type-specific constraints for directories
      if (isDir) {
        if (!FS.isDir(node.mode)) {
          return ERRNO_CODES.ENOTDIR;
        }

        // Prevent deletion of root directory or current working directory
        if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
          return ERRNO_CODES.EBUSY;
        }
      } else if (FS.isDir(node.mode)) {
        // Cannot delete a directory when expecting a file
        return ERRNO_CODES.EISDIR;
      }

      // 4. Deletion is allowed
      return 0;
    },

    /**
     * Validates whether a file can be opened with the specified flags.
     *
     * @param {FSNode | null} node - The file node to open, or null for non-existent files
     * @param {number} flags - The open flags bitmask
     * @returns {number} 0 if opening is allowed, error code if denied
     */
    mayOpen(node: FSNode | null, flags: number): number {
      // 1. Check if the node exists
      if (!node) {
        return ERRNO_CODES.ENOENT;
      }

      // 2. Reject symbolic links (should be resolved before opening)
      if (FS.isLink(node.mode)) {
        return ERRNO_CODES.ELOOP;
      }

      // 3. Handle directory-specific restrictions
      if (FS.isDir(node.mode)) {
        const permString = FS.flagsToPermissionString(flags);

        // Directories can only be opened for read-only without truncate
        if (permString !== "r" || flags & OPEN_FLAGS.O_TRUNC) {
          return ERRNO_CODES.EISDIR;
        }
      }

      // 4. Check general file permissions
      return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
    },
  };
}
