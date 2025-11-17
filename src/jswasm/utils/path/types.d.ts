/**
 * Core path manipulation helpers mirroring Node.js semantics.
 */
export interface PathUtilities {
  /** Tests whether the provided path is absolute. */
  isAbs(path: string): boolean;
  /** Splits a path into its core components. */
  splitPath(filename: string): [string, string, string, string];
  /** Normalizes an array of path segments. */
  normalizeArray(parts: string[], allowAboveRoot: boolean): string[];
  /** Normalizes a slash-delimited path string. */
  normalize(path: string): string;
  /** Returns the directory name for the provided path. */
  dirname(path: string): string;
  /** Resolves the base name from the provided path. */
  basename(path: string): string;
  /** Joins any number of path segments with normalization. */
  join(...paths: string[]): string;
  /** Joins two path segments while normalizing separators. */
  join2(left: string, right: string): string;
}

/**
 * Minimal interface representing an Emscripten-style filesystem.
 */
export interface FileSystemLike {
  /** Returns the current working directory used for path resolution. */
  cwd(): string;
}

/**
 * File-system aware helpers that extend the core path utilities.
 */
export interface PathFsUtilities {
  /** Resolves the supplied path segments into an absolute path. */
  resolve(...segments: string[]): string;
  /** Produces a relative path from one location to another. */
  relative(from: string, to: string): string;
}

/**
 * Global path helper utilities.
 */
export declare const PATH: PathUtilities;

/**
 * Creates a path helper instance wired to an optional filesystem shim.
 */
export declare const createPathFS: (
  fs?: FileSystemLike | null,
) => PathFsUtilities;

/**
 * Default filesystem-aware path helper that operates without an explicit filesystem.
 */
export declare const PATH_FS: PathFsUtilities;
