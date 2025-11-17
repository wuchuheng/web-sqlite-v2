import type { FSNode, MutableFS } from "./base-state.d.ts";
import type { PathFsUtilities } from "../../utils/path/types.d.ts";

/**
 * Factory hooks required for building the path helper facade.
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
 * Helper facade for maintaining the filesystem path hash table.
 */
export interface PathOperations {
  lookupPath(path: string, opts?: LookupPathOptions): PathLookupResult;
  getPath(node: FSNode): string;
  hashName(parentId: number, name: string): number;
  hashAddNode(node: FSNode): void;
  hashRemoveNode(node: FSNode): void;
  lookupNode(parent: FSNode, name: string): FSNode;
  createNode(parent: FSNode, name: string, mode: number, rdev: number): FSNode;
  destroyNode(node: FSNode): void;
  isRoot(node: FSNode): boolean;
  isMountpoint(node: FSNode): boolean;
}

/**
 * Creates the path helper facade for the supplied filesystem state.
 */
export function createPathOperations(
  FS: MutableFS,
  options: PathOperationsOptions,
): PathOperations;
