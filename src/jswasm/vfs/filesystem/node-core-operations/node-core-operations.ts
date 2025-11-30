import { PATH } from "../../../utils/path/path";
import { ERRNO_CODES, MODE } from "../constants/constants";
import type { MutableFS, FSNode } from "../base-state/base-state";
import type { NodeActionsOptions } from "../node-actions.d";

/**
 * Extended MutableFS interface that includes the methods required by core operations.
 * This interface extends the base MutableFS with filesystem helper methods.
 */
export interface CoreOperationsFS extends MutableFS {
  /** Creates a filesystem node with the specified mode and device. */
  mknod(path: string, mode: number, dev: number): FSNode;
  /** Creates a directory with the specified mode. */
  mkdir(path: string, mode: number): FSNode;
  /** Looks up a path and returns the resolved node and path information. */
  lookupPath(
    path: string,
    options?: { follow?: boolean; follow_mount?: boolean; parent?: boolean },
  ): {
    node: FSNode;
    path: string;
  };
  /** Looks up a child node by name within a parent directory. */
  lookupNode(parent: FSNode, name: string): FSNode;
  /** Checks if the provided mode represents a directory. */
  isDir(mode: number): boolean;
  /** Validates whether a new entry can be created in a directory. */
  mayCreate(parent: FSNode, name: string): number;
  /** Validates whether an entry can be deleted from a directory. */
  mayDelete(parent: FSNode, name: string, isdir: boolean): number;
  /** Checks if a node represents a mount point. */
  isMountpoint(node: FSNode): boolean;
  /** Validates node permissions for the specified operation. */
  nodePermissions(node: FSNode, perm: string): number;
  /** Removes a node from the hash table for rename operations. */
  hashRemoveNode(node: FSNode): void;
  /** Adds a node to the hash table for rename operations. */
  hashAddNode(node: FSNode): void;
  /** Destroys a filesystem node and cleans up resources. */
  destroyNode(node: FSNode): void;
  /** Gets the absolute path for a filesystem node. */
  getPath(node: FSNode): string;
}

/**
 * Core filesystem operations that handle file/directory creation,
 * manipulation, and basic operations like symlinks and renames.
 */
export interface CoreOperations {
  /** Creates a regular file with the specified mode */
  create(path: string, mode?: number): FSNode;

  /** Creates a directory with the specified mode */
  mkdir(path: string, mode?: number): FSNode;

  /** Creates directory tree recursively */
  mkdirTree(path: string, mode?: number): void;

  /** Creates a character device */
  mkdev(path: string, mode: number, dev?: number): FSNode;

  /** Creates a symbolic link */
  symlink(oldpath: string, newpath: string): FSNode;

  /** Renames a file or directory */
  rename(oldPath: string, newPath: string): void;

  /** Removes an empty directory */
  rmdir(path: string): void;

  /** Lists directory contents */
  readdir(path: string): string[];

  /** Removes a file or symbolic link */
  unlink(path: string): void;

  /** Reads a symbolic link target */
  readlink(path: string): string;
}

/**
 * Creates core filesystem operations that handle file/directory creation,
 * manipulation, and basic operations like symlinks and renames.
 *
 * @param FS - The mutable filesystem state
 * @param options - Node actions configuration options
 * @returns Core filesystem operations
 */
export function createCoreOperations(
  FS: CoreOperationsFS,
  { getPathFS, Module: _Module }: NodeActionsOptions,
): CoreOperations {
  return {
    create(path: string, mode?: number): FSNode {
      // 1. Input handling - set default mode and apply permissions
      mode = mode !== undefined ? mode : MODE.DEFAULT_FILE_PERMISSIONS;
      mode &= MODE.PERMISSION_MASK;
      mode |= MODE.FILE;

      // 2. Core processing - delegate to FS.mknod
      return FS.mknod(path, mode, 0);
    },

    mkdir(path: string, mode?: number): FSNode {
      // 1. Input handling - set default directory mode and apply permissions
      mode = mode !== undefined ? mode : MODE.DEFAULT_DIRECTORY_PERMISSIONS;
      mode &= MODE.DIR_PERMISSION_WITH_STICKY;
      mode |= MODE.DIRECTORY;

      // 2. Core processing - delegate to FS.mknod
      return FS.mknod(path, mode, 0);
    },

    mkdirTree(path: string, mode?: number): void {
      // 1. Input handling - split path into components
      const dirs = path.split("/");
      let d = "";

      // 2. Core processing - create each directory in the path
      for (let i = 0; i < dirs.length; ++i) {
        if (!dirs[i]) continue;
        d += "/" + dirs[i];
        try {
          FS.mkdir(d, mode!);
        } catch (e: unknown) {
          // 3. Error handling - ignore EEXIST (directory already exists)
          if (
            typeof e === "object" &&
            e !== null &&
            "errno" in e &&
            (e as { errno: number }).errno === ERRNO_CODES.EEXIST
          ) {
            // Directory already exists, continue
          } else {
            throw e;
          }
        }
      }
    },

    mkdev(path: string, mode: number, dev?: number): FSNode {
      // 1. Input handling - handle parameter overloading
      if (typeof dev == "undefined") {
        dev = mode;
        mode = MODE.DEFAULT_FILE_PERMISSIONS;
      }

      // 2. Core processing - apply character device flag and create
      mode |= MODE.CHARACTER_DEVICE;
      return FS.mknod(path, mode, dev);
    },

    symlink(oldpath: string, newpath: string): FSNode {
      // 1. Input handling - validate target path
      const PATH_FS = getPathFS();
      if (!PATH_FS.resolve(oldpath)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }

      // 2. Core processing - lookup parent and validate permissions
      const lookup = FS.lookupPath(newpath, { parent: true });
      const parent = lookup.node;
      if (!parent) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }
      const newname = PATH.basename(newpath);
      const errCode = FS.mayCreate(parent, newname);
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }

      // 3. Output handling - create symlink through node operations
      if (!parent.node_ops.symlink) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      return parent.node_ops.symlink(parent, newname, oldpath);
    },

    rename(oldPath: string, newPath: string): void {
      // 1. Input handling - extract path components
      const oldDirname = PATH.dirname(oldPath);
      const newDirname = PATH.dirname(newPath);
      const oldName = PATH.basename(oldPath);
      const newName = PATH.basename(newPath);
      const oldLookup = FS.lookupPath(oldPath, { parent: true });
      const newLookup = FS.lookupPath(newPath, { parent: true });
      const oldDir = oldLookup.node;
      const newDir = newLookup.node;

      // 2. Validation - ensure paths exist and are on same mount
      if (!oldDir || !newDir) throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      if (oldDir.mount !== newDir.mount) {
        throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
      }

      // 3. Core processing - lookup nodes and validate rename constraints
      const oldNode = FS.lookupNode(oldDir, oldName);
      let relative = getPathFS().relative(oldPath, newDirname);
      if (relative.charAt(0) !== ".") {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      relative = getPathFS().relative(newPath, oldDirname);
      if (relative.charAt(0) !== ".") {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
      }

      let newNode: FSNode | undefined;
      try {
        newNode = FS.lookupNode(newDir, newName);
      } catch (_e) {
        // Target doesn't exist, which is fine
      }

      // Early exit if renaming to same location
      if (oldNode === newNode) {
        return;
      }

      // 4. Permission validation
      const isdir = FS.isDir(oldNode.mode);
      let errCode = FS.mayDelete(oldDir, oldName, isdir);
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }
      errCode = newNode
        ? FS.mayDelete(newDir, newName, isdir)
        : FS.mayCreate(newDir, newName);
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }

      // 5. Operation validation - ensure rename operation is supported
      if (!oldDir.node_ops.rename) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      if (FS.isMountpoint(oldNode) || (newNode && FS.isMountpoint(newNode))) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
      }

      // 6. Cross-directory permission check
      if (newDir !== oldDir) {
        errCode = FS.nodePermissions(oldDir, "w");
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
      }

      // 7. Core operation - perform the rename with hash table management
      FS.hashRemoveNode(oldNode);
      try {
        oldDir.node_ops.rename(oldNode, newDir, newName);
        oldNode.parent = newDir;
      } finally {
        // Always restore hash entry even if rename fails
        FS.hashAddNode(oldNode);
      }
    },

    rmdir(path: string): void {
      // 1. Input handling - lookup directory and parent
      const lookup = FS.lookupPath(path, { parent: true });
      const parent = lookup.node;
      const name = PATH.basename(path);
      const node = FS.lookupNode(parent, name);

      // 2. Permission validation
      const errCode = FS.mayDelete(parent, name, true);
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }

      // 3. Operation validation - ensure rmdir is supported
      if (!parent.node_ops.rmdir) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
      }

      // 4. Core operation - perform rmdir and cleanup
      parent.node_ops.rmdir(parent, name);
      FS.destroyNode(node);
    },

    readdir(path: string): string[] {
      // 1. Input handling - lookup directory
      const lookup = FS.lookupPath(path, { follow: true });
      const node = lookup.node;

      // 2. Operation validation - ensure readdir is supported
      if (!node.node_ops.readdir) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
      }

      // 3. Core operation - delegate to node's readdir operation
      return node.node_ops.readdir(node);
    },

    unlink(path: string): void {
      // 1. Input handling - lookup file and parent
      const lookup = FS.lookupPath(path, { parent: true });
      const parent = lookup.node;
      if (!parent) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }
      const name = PATH.basename(path);
      const node = FS.lookupNode(parent, name);

      // 2. Permission validation
      const errCode = FS.mayDelete(parent, name, false);
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }

      // 3. Operation validation - ensure unlink is supported
      if (!parent.node_ops.unlink) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
      }

      // 4. Core operation - perform unlink and cleanup
      parent.node_ops.unlink(parent, name);
      FS.destroyNode(node);
    },

    readlink(path: string): string {
      // 1. Input handling - lookup symbolic link
      const PATH_FS = getPathFS();
      const lookup = FS.lookupPath(path);
      const link = lookup.node;
      if (!link) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }

      // 2. Operation validation - ensure readlink is supported
      if (!link.node_ops.readlink) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }

      // 3. Core processing - resolve link target against parent directory
      return PATH_FS.resolve(
        FS.getPath(link.parent),
        link.node_ops.readlink(link),
      );
    },
  };
}
