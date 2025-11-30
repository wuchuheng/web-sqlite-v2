import { PATH } from "../../../utils/path/path";
import { ERRNO_CODES } from "../constants/constants";
import type { FSNode, MutableFS } from "../base-state/base-state";
import type { PathFsUtilities } from "../../../utils/path/types";

/**
 * Interface for options to createPathOperations.
 */
export interface PathOperationsOptions {
  /** Lazily retrieves the PATH_FS helpers used for resolution. */
  getPathFS(): PathFsUtilities;
}

/**
 * Optional flags that control how lookupPath traverses the filesystem tree.
 */
export interface LookupPathOptions {
  /** Follow mount points when encountered during traversal. */
  follow_mount?: boolean;
  /** Guard against excessive symlink recursion. */
  recurse_count?: number;
  /** Resolve the parent directory instead of the final entry. */
  parent?: boolean;
  /** Force resolution of symbolic links on the final segment. */
  follow?: boolean;
}

/** Result structure produced by lookupPath. */
export interface PathLookupResult {
  path: string;
  node: FSNode | null;
}

/**
 * Helper facade for maintaining the filesystem path hash table and performing path operations.
 */
export interface PathOperations {
  /**
   * Looks up a path in the filesystem, resolving symbolic links and mount points.
   * @param path The path to look up.
   * @param opts Optional flags to control lookup behavior.
   * @returns An object containing the resolved path and the corresponding FSNode.
   * @throws {FS.ErrnoError} If a lookup error occurs (e.g., ELOOP for excessive symlink recursion).
   */
  lookupPath(path: string, opts?: LookupPathOptions): PathLookupResult;

  /**
   * Retrieves the full path for a given filesystem node.
   * @param node The FSNode for which to get the path.
   * @returns The full path of the node.
   */
  getPath(node: FSNode): string;

  /**
   * Generates a hash for a node's name within its parent's context, used for hash table lookups.
   * @param parentId The ID of the parent node.
   * @param name The name of the node.
   * @returns The hash value.
   */
  hashName(parentId: number, name: string): number;

  /**
   * Adds a node to the filesystem's hash table.
   * @param node The node to add.
   */
  hashAddNode(node: FSNode): void;

  /**
   * Removes a node from the filesystem's hash table.
   * @param node The node to remove.
   */
  hashRemoveNode(node: FSNode): void;

  /**
   * Looks up a child node within a parent node by name, using the hash table.
   * @param parent The parent node.
   * @param name The name of the child node to look up.
   * @returns The found FSNode.
   * @throws {FS.ErrnoError} If the node is not found or permissions are denied.
   */
  lookupNode(parent: FSNode, name: string): FSNode;

  /**
   * Creates a new filesystem node and adds it to the hash table.
   * @param parent The parent node.
   * @param name The name of the new node.
   * @param mode The mode (permissions and type) of the new node.
   * @param rdev The device number for special files.
   * @returns The newly created FSNode.
   */
  createNode(parent: FSNode, name: string, mode: number, rdev: number): FSNode;

  /**
   * Destroys a filesystem node by removing it from the hash table.
   * @param node The node to destroy.
   */
  destroyNode(node: FSNode): void;

  /**
   * Checks if a given node is the root of the filesystem.
   * @param node The node to check.
   * @returns True if the node is the root, false otherwise.
   */
  isRoot(node: FSNode): boolean;

  /**
   * Checks if a given node is a mount point.
   * @param node The node to check.
   * @returns True if the node is a mount point, false otherwise.
   */
  isMountpoint(node: FSNode): boolean;
}

/**
 * Creates the path helper facade for the supplied filesystem state.
 * @param FS The mutable filesystem state object.
 * @param options Configuration options including path FS utilities factory.
 * @returns An object containing path operation functions.
 */
export function createPathOperations(
  FS: MutableFS,
  options: PathOperationsOptions,
): PathOperations {
  return {
    lookupPath(path: string, opts: LookupPathOptions = {}): PathLookupResult {
      const PATH_FS = options.getPathFS();
      path = PATH_FS.resolve(path);
      if (!path) return { path: "", node: null };

      const defaults: Required<LookupPathOptions> = {
        follow_mount: true,
        recurse_count: 0,
        parent: false,
        follow: false,
      };
      opts = { ...defaults, ...opts };

      if (opts.recurse_count! > 8) {
        throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
      }

      // Filter out empty parts, e.g., from "//a/b" or "/a/b/"
      const parts = path.split("/").filter((p) => !!p);
      let current: FSNode = FS.root!; // Assume root exists when doing lookup
      let currentPath: string = "/";

      for (let i = 0; i < parts.length; i++) {
        const isLast = i === parts.length - 1;

        if (isLast && opts.parent) {
          break; // If parent option is true and this is the last part, we're done
        }

        // Lookup the current part in the filesystem
        current = FS.lookupNode(current, parts[i]);
        currentPath = PATH.join2(currentPath, parts[i]);

        // Handle mount points
        if (FS.isMountpoint(current)) {
          if (!isLast || (isLast && opts.follow_mount)) {
            current = current.mounted!.root; // Assume mounted is always present if isMountpoint is true
          }
        }

        // Handle symbolic links
        if (!isLast || opts.follow) {
          let count = 0;
          while (FS.isLink(current.mode)) {
            const link = FS.readlink(currentPath);
            currentPath = PATH_FS.resolve(PATH.dirname(currentPath), link);
            const lookup = FS.lookupPath(currentPath, {
              ...opts, // Pass all current options, especially recurse_count
              recurse_count: opts.recurse_count! + 1,
            });
            current = lookup.node!; // Assume node is present if lookup succeeds
            if (count++ > 40) {
              throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
            }
          }
        }
      }
      return { path: currentPath, node: current };
    },

    getPath(node: FSNode): string {
      const pathSegments: string[] = [];
      let currentNode: FSNode = node;

      while (true) {
        // If we reached the root of a mounted filesystem
        if (FS.isRoot(currentNode)) {
          // If this is the actual root of the global FS (has no mount.mountpoint, or mountpoint is '/')
          // Or if this is the root of a mounted FS
          const mountpoint = currentNode.mount?.mountpoint;

          if (pathSegments.length === 0) {
            // If it's the original node and it's a root
            return mountpoint ?? "/";
          } else {
            // Prepend mountpoint to the gathered segments
            const path = pathSegments.join("/");
            if (mountpoint) {
              return mountpoint[mountpoint.length - 1] !== "/"
                ? `${mountpoint}/${path}`
                : mountpoint + path;
            }
            return "/" + path;
          }
        }
        pathSegments.unshift(currentNode.name);
        currentNode = currentNode.parent;
      }
    },

    hashName(parentId: number, name: string): number {
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
      }
      return ((parentId + hash) >>> 0) % FS.nameTable!.length;
    },

    hashAddNode(node: FSNode): void {
      const hash = FS.hashName(node.parent.id!, node.name);
      node.name_next = FS.nameTable![hash];
      FS.nameTable![hash] = node;
    },

    hashRemoveNode(node: FSNode): void {
      const hash = FS.hashName(node.parent.id!, node.name);
      if (FS.nameTable![hash] === node) {
        FS.nameTable![hash] = node.name_next;
      } else {
        let current = FS.nameTable![hash];
        while (current) {
          if (current.name_next === node) {
            current.name_next = node.name_next;
            break;
          }
          current = current.name_next;
        }
      }
    },

    lookupNode(parent: FSNode, name: string): FSNode {
      const errCode = FS.mayLookup(parent);
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }
      const hash = FS.hashName(parent.id!, name);
      for (
        let node: FSNode | null = FS.nameTable![hash];
        node;
        node = node.name_next
      ) {
        if (node.parent.id === parent.id && node.name === name) {
          return node;
        }
      }
      return FS.lookup(parent, name); // Fallback to slower lookup if not in hash table
    },

    createNode(
      parent: FSNode,
      name: string,
      mode: number,
      rdev: number,
    ): FSNode {
      const node = new FS.FSNode(parent, name, mode, rdev).assignId(FS);
      FS.hashAddNode(node);
      return node;
    },

    destroyNode(node: FSNode): void {
      FS.hashRemoveNode(node);
    },

    isRoot(node: FSNode): boolean {
      return node === node.parent;
    },

    isMountpoint(node: FSNode): boolean {
      return !!node.mounted;
    },
  };
}
