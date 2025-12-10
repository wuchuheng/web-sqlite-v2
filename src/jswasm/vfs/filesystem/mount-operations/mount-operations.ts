import type { MutableFS } from "../base-state/base-state";
import type {
  FileSystemMount,
  FileSystemMountType,
  FSNode,
} from "../base-state/base-state";
import { PATH } from "../../../utils/path/path";
import { ERRNO_CODES } from "../constants/constants";

/**
 * Extended MutableFS interface that includes the methods required by mount operations.
 * This interface extends the base MutableFS with filesystem helper methods.
 */
export interface MountOperationsFS extends MutableFS {
  /** Returns the list of mounts reachable from the provided root. */
  getMounts(mount: FileSystemMount): FileSystemMount[];
  /** Looks up a path and returns the resolved node and path information. */
  lookupPath(
    path: string,
    options?: { follow_mount?: boolean; parent?: boolean },
  ): {
    node: FSNode | null;
    path: string;
  };
  /** Checks if a node represents a mount point. */
  isMountpoint(node: FSNode): boolean;
  /** Checks if the provided mode represents a directory. */
  isDir(mode: number): boolean;
  /** Validates whether a new entry can be created in a directory. */
  mayCreate(dir: FSNode, name: string): number;
  /** Destroys a filesystem node and cleans up resources. */
  destroyNode(node: FSNode): void;
}

/**
 * Logger callbacks consumed by the mount operation helpers.
 */
export interface MountOperationsOptions {
  /** Reports non-fatal issues encountered during mount handling. */
  err(message: string): void;
}

/**
 * Helper surface for working with filesystem mounts and device nodes.
 */
export interface MountOperations {
  /** Returns the list of mounts reachable from the provided root. */
  getMounts(mount: FileSystemMount): FileSystemMount[];
  /** Synchronises all mounted filesystems. */
  syncfs(populate: boolean, callback: (errCode: number | null) => void): void;
  /** Synchronises all mounted filesystems (populate defaults to false). */
  syncfs(callback: (errCode: number | null) => void): void;
  /** Mounts a filesystem implementation at the supplied path. */
  mount(
    type: FileSystemMountType,
    opts: FileSystemMount["opts"],
    mountpoint: string,
  ): FSNode;
  /** Removes a previously mounted filesystem. */
  unmount(mountpoint: string): void;
  /** Delegates lookup to the underlying node implementation. */
  lookup(parent: FSNode, name: string): FSNode;
  /** Creates a special node under the supplied path. */
  mknod(path: string, mode: number, dev: number): FSNode;
}

/**
 * Provides helpers for managing mount points and device nodes within the
 * virtual filesystem tree.
 *
 * @param FS - The mutable filesystem state instance with extended methods.
 * @param options - Configuration options including error callback.
 * @returns A mount operations interface bound to the provided filesystem.
 */
export function createMountOperations(
  FS: MountOperationsFS,
  { err }: MountOperationsOptions,
): MountOperations {
  return {
    /**
     * Recursively collects all mounts reachable from the provided mount.
     *
     * @param mount - The root mount to start collection from.
     * @returns Array containing all mounts in the hierarchy.
     */
    getMounts(mount: FileSystemMount): FileSystemMount[] {
      // 1. Input validation - none needed for basic mount input

      // 2. Core processing - recursively collect mounts
      const mounts: FileSystemMount[] = [];
      const check: FileSystemMount[] = [mount];

      while (check.length) {
        const currentMount = check.pop()!;
        mounts.push(currentMount);
        check.push(...currentMount.mounts);
      }

      // 3. Output handling - return collected mounts
      return mounts;
    },

    /**
     * Synchronizes all mounted filesystems with optional population.
     * Handles parameter overloading for backward compatibility.
     *
     * @param populate - Whether to populate from storage (optional).
     * @param callback - Completion callback with error code.
     */
    syncfs(
      populate: boolean | ((errCode: number | null) => void),
      callback?: (errCode: number | null) => void,
    ): void {
      // 1. Input handling - support parameter overloading
      if (typeof populate === "function") {
        callback = populate;
        populate = false;
      }

      // 2. Core processing - synchronize all mounts
      FS.syncFSRequests++;
      if (FS.syncFSRequests > 1) {
        err(
          `warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`,
        );
      }

      const mounts = FS.getMounts(FS.root!.mount);
      let completed = 0;

      const doCallback = (errCode: number | null): void => {
        FS.syncFSRequests--;
        callback!(errCode);
      };

      let hasErrored = false;
      const done = (errCode: number | null): void => {
        // 3. Output handling - manage completion state
        if (errCode) {
          if (!hasErrored) {
            hasErrored = true;
            return doCallback(errCode);
          }
          return;
        }

        if (++completed >= mounts.length) {
          doCallback(null);
        }
      };

      mounts.forEach((mount) => {
        if (!mount.type.syncfs) {
          return done(null);
        }
        mount.type.syncfs(mount, populate as boolean, done);
      });
    },

    /**
     * Mounts a filesystem implementation at the specified path.
     *
     * @param type - The filesystem type implementation.
     * @param opts - Mount options passed to the filesystem.
     * @param mountpoint - The path where the filesystem should be mounted.
     * @returns The root node of the mounted filesystem.
     */
    mount(
      type: FileSystemMountType,
      opts: FileSystemMount["opts"],
      mountpoint: string,
    ): FSNode {
      // 1. Input handling - validate mount configuration
      const root = mountpoint === "/";
      const pseudo = !mountpoint;
      let node: FSNode | null = null;

      if (root && FS.root) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
      } else if (!root && !pseudo) {
        const lookup = FS.lookupPath(mountpoint, {
          follow_mount: false,
        });
        mountpoint = lookup.path;
        node = lookup.node;

        if (!node) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }

        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        if (!FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
      }

      // 2. Core processing - create mount structure
      const mount: FileSystemMount = {
        type,
        opts,
        mountpoint,
        mounts: [],
        root: null as unknown as FSNode, // Will be set below
      };

      const mountRoot = type.mount(mount);
      mountRoot.mount = mount;
      mount.root = mountRoot;

      // 3. Output handling - attach to filesystem hierarchy
      if (root) {
        FS.root = mountRoot;
      } else if (node) {
        node.mounted = mount;
        if (node.mount) {
          node.mount.mounts.push(mount);
        }
      }

      return mountRoot;
    },

    /**
     * Removes a mounted filesystem and cleans up associated nodes.
     *
     * @param mountpoint - The path of the filesystem to unmount.
     */
    unmount(mountpoint: string): void {
      // 1. Input handling - validate mountpoint
      const lookup = FS.lookupPath(mountpoint, { follow_mount: false });
      if (!lookup.node || !FS.isMountpoint(lookup.node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }

      const node = lookup.node;
      const mount = node.mounted!;
      const mounts = FS.getMounts(mount);

      // 2. Core processing - cleanup name table entries
      if (FS.nameTable) {
        Object.keys(FS.nameTable).forEach((hash) => {
          let current = FS.nameTable![Number(hash)];
          while (current) {
            const next = current.name_next;
            if (mounts.includes(current.mount)) {
              FS.destroyNode(current);
            }
            current = next;
          }
        });
      }

      // 3. Output handling - detach mount
      node.mounted = null;
      const idx = node.mount.mounts.indexOf(mount);
      node.mount.mounts.splice(idx, 1);
    },

    /**
     * Delegates node lookup to the parent's node operations.
     *
     * @param parent - The parent node to lookup in.
     * @param name - The name of the child node to find.
     * @returns The found child node.
     */
    lookup(parent: FSNode, name: string): FSNode {
      // 1. Input handling - validate parameters
      if (!parent || !parent.node_ops || !parent.node_ops.lookup) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }

      // 2. Core processing - delegate to parent operations
      return parent.node_ops.lookup(parent, name);

      // 3. Output handling - direct return from delegated operation
    },

    /**
     * Creates a device node at the specified path.
     *
     * @param path - The path where the node should be created.
     * @param mode - The permission and type mode bits.
     * @param dev - The device number for device nodes.
     * @returns The newly created node.
     */
    mknod(path: string, mode: number, dev: number): FSNode {
      // 1. Input handling - validate path and parameters
      const lookup = FS.lookupPath(path, { parent: true });
      const parent = lookup.node;
      const name = PATH.basename(path);

      if (!parent) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }

      if (!name || name === "." || name === "..") {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }

      const errCode = FS.mayCreate(parent, name);
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }

      if (!parent.node_ops.mknod) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }

      // 2. Core processing - delegate node creation to parent
      return parent.node_ops.mknod(parent, name, mode, dev);

      // 3. Output handling - direct return from delegated operation
    },
  };
}
