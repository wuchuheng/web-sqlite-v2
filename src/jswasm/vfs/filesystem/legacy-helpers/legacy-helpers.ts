import { PATH } from "../../../utils/path/path";
import {
  DEVICE_MAJOR_BASE,
  ERRNO_CODES,
  MODE,
  OPEN_FLAGS,
} from "../constants/constants";
import type { MutableFS, FSNode, FSStream } from "../base-state/base-state";

/**
 * Configuration hooks required for re-exposing the historical FS helpers.
 */
export interface LegacyHelpersOptions {
  /** Maps read/write booleans to a POSIX mode bitmask. */
  FS_getMode(canRead: boolean, canWrite: boolean): number;
}

/**
 * Extended MutableFS interface with filesystem operation methods.
 */
export interface ExtendedMutableFS extends MutableFS {
  /** Analyze a filesystem path and return detailed information. */
  analyzePath(path: string, dontResolveLastLink?: boolean): PathAnalysis;
  /** Look up a path in the filesystem. */
  lookupPath(
    path: string,
    options?: { parent?: boolean; follow?: boolean },
  ): {
    path: string;
    node: FSNode;
  };
  /** Get the path string for a filesystem node. */
  getPath(node: FSNode): string;
  /** Create a directory. */
  mkdir(path: string): void;
  /** Create a filesystem node. */
  create(path: string, mode: number): FSNode;
  /** Change the permissions of a filesystem node. */
  chmod(node: FSNode, mode: number): void;
  /** Open a file and return a stream. */
  open(node: FSNode, flags: number): FSStream;
  /** Write data to a stream. */
  write(
    stream: FSStream,
    buffer: ArrayLike<number>,
    offset: number,
    length: number,
    position?: number,
    canOwn?: boolean,
  ): number;
  /** Close a stream. */
  close(stream: FSStream): void;
  /** Create device registry for major number tracking. */
  createDevice: { major?: number };
  /** Make a device number. */
  makedev(major: number, minor: number): number;
  /** Register a device with the filesystem. */
  registerDevice(dev: number, deviceDef: unknown): void;
  /** Create a device node. */
  mkdev(path: string, mode: number, dev: number): FSNode;
}

/**
 * Extended FSNode interface with additional properties.
 */
export interface ExtendedFSNode extends FSNode {
  /** Symbolic link target if this is a link. */
  link?: string;
  /** File contents if this node has data. */
  contents?: Uint8Array | ArrayLike<number>;
  /** Node timestamp. */
  timestamp?: number;
  /** Device output buffer. */
  buffer?: number[];
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
  forceLoadFile(node: ExtendedFSNode): boolean;
  /** Legacy helper retained for API surface compatibility (throws by design). */
  createLazyFile(): never;
}

/**
 * Restores legacy compatibility helpers that mirror historical FS APIs used by
 * older Emscripten callers while delegating work to the modern helpers.
 *
 * @param FS - The mutable filesystem state to operate on
 * @param options - Configuration options for legacy helper behavior
 * @returns An object containing all legacy helper methods
 */
export function createLegacyHelpers(
  FS: ExtendedMutableFS,
  { FS_getMode }: LegacyHelpersOptions,
): LegacyHelpers {
  return {
    findObject(path: string, dontResolveLastLink?: boolean): FSNode | null {
      // 1. Input handling
      const ret = FS.analyzePath(path, dontResolveLastLink);

      // 2. Core processing
      const exists = ret.exists;

      // 3. Output handling
      if (!exists) {
        return null;
      }
      return ret.object;
    },

    analyzePath(path: string, dontResolveLastLink?: boolean): PathAnalysis {
      // 1. Input handling - attempt to resolve the full path first
      try {
        const lookup = FS.lookupPath(path, {
          follow: !dontResolveLastLink,
        });
        path = lookup.path;
      } catch (_e) {
        // Path resolution failed, continue with original path
      }

      // 2. Core processing - initialize result structure
      const ret: PathAnalysis = {
        isRoot: false,
        exists: false,
        error: 0,
        name: null,
        path: null,
        object: null,
        parentExists: false,
        parentPath: null,
        parentObject: null,
      };

      // 3. Core processing - attempt parent lookup
      try {
        let lookup = FS.lookupPath(path, { parent: true });
        ret.parentExists = true;
        ret.parentPath = lookup.path;
        ret.parentObject = lookup.node;
        ret.name = PATH.basename(path);

        // 4. Core processing - attempt full path lookup
        lookup = FS.lookupPath(path, {
          follow: !dontResolveLastLink,
        });
        ret.exists = true;
        ret.path = lookup.path;
        ret.object = lookup.node;
        ret.name = lookup.node.name;
        ret.isRoot = lookup.path === "/";
      } catch (e) {
        // 5. Error handling - extract errno if available
        const error = e as { errno?: number };
        ret.error = error.errno || 0;
      }

      // 6. Output handling
      return ret;
    },

    createPath(
      parent: string | FSNode,
      path: string,
      _canRead?: boolean,
      _canWrite?: boolean,
    ): string {
      // 1. Input handling - normalize parent to string path
      const initialParentPath =
        typeof parent === "string" ? parent : FS.getPath(parent);

      // 2. Core processing - split path and create directories
      const parts = path.split("/").reverse();
      let currentPath = initialParentPath;

      while (parts.length) {
        const part = parts.pop();
        if (!part) continue; // Skip empty parts

        currentPath = PATH.join2(currentPath, part);

        // 3. Directory creation - ignore errors for existing directories
        try {
          FS.mkdir(currentPath);
        } catch (_e) {
          // Directory already exists or creation failed
        }
      }

      // 4. Output handling
      return currentPath;
    },

    createFile(
      parent: string | FSNode,
      name: string,
      _properties: unknown,
      canRead: boolean,
      canWrite: boolean,
    ): FSNode {
      // 1. Input handling - construct full path
      const fullPath = PATH.join2(
        typeof parent === "string" ? parent : FS.getPath(parent),
        name,
      );

      // 2. Core processing - determine file mode
      const mode = FS_getMode(canRead, canWrite);

      // 3. Output handling - create and return the file node
      return FS.create(fullPath, mode);
    },

    createDataFile(
      parent: string | FSNode | null,
      name: string,
      data: string | ArrayLike<number> | null,
      canRead: boolean,
      canWrite: boolean,
      canOwn?: boolean,
    ): void {
      // 1. Input handling - construct full path
      let path = name;
      if (parent) {
        const parentPath =
          typeof parent === "string" ? parent : FS.getPath(parent);
        path = name ? PATH.join2(parentPath, name) : parentPath;
      }

      // 2. Core processing - create file and set mode
      const mode = FS_getMode(canRead, canWrite);
      const node = FS.create(path, mode);

      // 3. Data processing - handle different data types
      if (data) {
        let processedData: ArrayLike<number>;

        if (typeof data === "string") {
          // Convert string to character array
          const arr = new Array(data.length);
          for (let i = 0, len = data.length; i < len; ++i) {
            arr[i] = data.charCodeAt(i);
          }
          processedData = arr;
        } else {
          processedData = data;
        }

        // 4. Core processing - prepare file for writing
        FS.chmod(node, mode | MODE.PERMISSION_WRITE);
        const stream = FS.open(
          node,
          OPEN_FLAGS.O_WRONLY | OPEN_FLAGS.O_CREAT | OPEN_FLAGS.O_TRUNC,
        );

        // 5. Core processing - write data to file
        FS.write(stream, processedData, 0, processedData.length, 0, canOwn);

        // 6. Cleanup - close stream and restore permissions
        FS.close(stream);
        FS.chmod(node, mode);
      }
    },

    createDevice(
      parent: string | FSNode,
      name: string,
      input?: (() => number | null | undefined) | null,
      output?: ((value: number) => void) | null,
    ): FSNode {
      // 1. Input handling - construct device path and mode
      const path = PATH.join2(
        typeof parent === "string" ? parent : FS.getPath(parent),
        name,
      );
      const mode = FS_getMode(!!input, !!output);

      // 2. Core processing - manage device major numbers
      FS.createDevice.major ??= DEVICE_MAJOR_BASE;
      const major = FS.createDevice.major++;
      const dev = FS.makedev(major, 0);

      // 3. Core processing - register device with stream operations
      FS.registerDevice(dev, {
        open(stream: FSStream) {
          // 3.1 Open operation - mark stream as non-seekable
          stream.seekable = false;
        },

        close(stream: FSStream) {
          // 3.2 Close operation - output newline if stream has pending data
          if (output && stream.ungotten && stream.ungotten.length > 0) {
            output(0x0a); // newline character
          }
        },

        read(
          stream: FSStream,
          buffer: Uint8Array | number[],
          offset: number,
          length: number,
        ) {
          // 3.3 Read operation - read from input callback
          let bytesRead = 0;

          for (let i = 0; i < length; i++) {
            let result: number | null | undefined;

            try {
              result = input?.();
            } catch (_e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }

            // Handle EOF conditions
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
            }
            if (result === null || result === undefined) break;

            bytesRead++;
            buffer[offset + i] = result;
          }

          // Update timestamp if data was read
          if (bytesRead && stream.node) {
            (stream.node as ExtendedFSNode).timestamp = Date.now();
          }

          return bytesRead;
        },

        write(
          stream: FSStream,
          buffer: ArrayLike<number>,
          offset: number,
          length: number,
        ) {
          // 3.4 Write operation - write to output callback
          for (let i = 0; i < length; i++) {
            try {
              output?.(buffer[offset + i]);
            } catch (_e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
          }

          // Update timestamp if data was written
          if (length && stream.node) {
            (stream.node as ExtendedFSNode).timestamp = Date.now();
          }

          return length;
        },
      });

      // 4. Output handling - create and return device node
      return FS.mkdev(path, mode, dev);
    },

    forceLoadFile(obj: ExtendedFSNode): boolean {
      // 1. Input handling - check file types that don't need loading
      if (obj.isDevice || obj.isFolder || obj.link || obj.contents) {
        return true;
      }

      // 2. Environment detection - check for XMLHttpRequest support
      if (typeof XMLHttpRequest !== "undefined") {
        throw new Error(
          "Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.",
        );
      }

      // 3. Error handling - throw I/O error for unsupported lazy loading
      throw new FS.ErrnoError(ERRNO_CODES.EIO);
    },

    createLazyFile(): never {
      // This method is deprecated by design and always throws
      throw new Error(
        "createLazyFile is deprecated. Use --embed-file or --preload-file in emcc.",
      );
    },
  };
}
