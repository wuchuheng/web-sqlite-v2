import type { FSNode, MutableFS } from "./base-state.d.ts";

/**
 * Configuration hooks required for re-exposing the historical FS helpers.
 */
export interface LegacyHelpersOptions {
  /** Maps read/write booleans to a POSIX mode bitmask. */
  FS_getMode(canRead: boolean, canWrite: boolean): number;
}

/**
 * Detailed description of a filesystem lookup used by the legacy helpers.
 */
export interface PathAnalysis {
  /** True when the resolved path refers to the virtual root. */
  isRoot: boolean;
  /** Indicates whether the target entry exists. */
  exists: boolean;
  /** Errno code reported when the lookup failed. */
  error: number;
  /** Final name component associated with the lookup. */
  name: string | null;
  /** Canonical path returned by the lookup. */
  path: string | null;
  /** Node resolved by the lookup, if successful. */
  object: FSNode | null;
  /** True when the parent directory exists. */
  parentExists: boolean;
  /** Canonical path to the parent directory. */
  parentPath: string | null;
  /** Node representing the parent directory. */
  parentObject: FSNode | null;
}

/**
 * Contract implemented by the compatibility helpers mirroring older FS APIs.
 */
export interface LegacyHelpers {
  /** Finds an object or returns null when the path cannot be resolved. */
  findObject(path: string, dontResolveLastLink?: boolean): FSNode | null;
  /** Performs a detailed path analysis for compatibility callers. */
  analyzePath(path: string, dontResolveLastLink?: boolean): PathAnalysis;
  /** Ensures a nested directory hierarchy exists beneath the provided parent. */
  createPath(
    parent: string | FSNode,
    path: string,
    canRead?: boolean,
    canWrite?: boolean,
  ): string;
  /** Creates a file node mirroring the legacy createFile helper. */
  createFile(
    parent: string | FSNode,
    name: string,
    properties: unknown,
    canRead: boolean,
    canWrite: boolean,
  ): FSNode;
  /** Writes data into a newly created file node. */
  createDataFile(
    parent: string | FSNode | null,
    name: string,
    data: string | ArrayLike<number> | null,
    canRead: boolean,
    canWrite: boolean,
    canOwn?: boolean,
  ): void;
  /** Registers a character device backed by optional input/output callbacks. */
  createDevice(
    parent: string | FSNode,
    name: string,
    input?: (() => number | null | undefined) | null,
    output?: ((value: number) => void) | null,
  ): FSNode;
  /** Ensures a file's contents are synchronously loaded into memory. */
  forceLoadFile(node: FSNode): boolean;
  /** Legacy helper retained for API surface compatibility (throws by design). */
  createLazyFile(): never;
}

/**
 * Restores the legacy helper API on top of the new filesystem primitives.
 */
export function createLegacyHelpers(
  FS: MutableFS,
  options: LegacyHelpersOptions,
): LegacyHelpers;
