import { ERRNO_CODES, MODE } from "../filesystem/constants/constants";
import type {
  FSNode,
  FSStream,
  MutableFS,
  NodeOps,
  StreamOps,
} from "../filesystem/base-state/base-state";
import type { ModeOperations } from "../filesystem/mode-operations/mode-operations";

/** Mapping of directory entry names to MEMFS nodes. */
type DirectoryContents = Record<string, MemfsNode>;
/** Union of possible node contents within MEMFS. */
type MemfsContents = Uint8Array | DirectoryContents | null;

/**
 * Node representation used by MEMFS with content and timestamp metadata.
 */
export interface MemfsNode extends FSNode {
  /** File contents, directory entries, or null when empty. */
  contents: MemfsContents;
  /** Number of bytes in use for file contents. */
  usedBytes: number;
  /** Target path for symbolic links. */
  link?: string;
  /** Last modified timestamp in milliseconds. */
  timestamp: number;
}

/** Operations table describing available node and stream behaviors. */
export interface MemfsOpsTable {
  /** Operations for directory nodes and streams. */
  dir: { node: NodeOps; stream: StreamOps };
  /** Operations for regular file nodes and streams. */
  file: { node: NodeOps; stream: MemfsStreamOps };
  /** Operations for symbolic link nodes and streams. */
  link: { node: NodeOps; stream: StreamOps };
  /** Operations for character device nodes and streams. */
  chrdev: { node: NodeOps; stream: StreamOps };
}

/** Stats structure mirroring POSIX-style metadata. */
export interface MemfsStats {
  /** Device number (or node id for character devices). */
  dev: number;
  /** Inode number. */
  ino: number;
  /** Permission and type bits. */
  mode: number;
  /** Link count. */
  nlink: number;
  /** Owning user id (unused; defaults to 0). */
  uid: number;
  /** Owning group id (unused; defaults to 0). */
  gid: number;
  /** Device id for special files. */
  rdev: number;
  /** Size in bytes. */
  size: number;
  /** Access time. */
  atime: Date;
  /** Modification time. */
  mtime: Date;
  /** Change time. */
  ctime: Date;
  /** Block size for filesystem I/O. */
  blksize: number;
  /** Number of allocated blocks. */
  blocks: number;
}

/** Mutations supported by setattr on a MEMFS node. */
export interface MemfsSetAttr {
  /** Permission and type bits to assign. */
  mode?: number;
  /** Timestamp to set on the node. */
  timestamp?: number;
  /** New file size; triggers truncation or expansion. */
  size?: number;
}

/** Node-level operations implemented by MEMFS. */
export interface MemfsNodeOps extends NodeOps {
  /** Returns POSIX-like stats for a node. */
  getattr(node: MemfsNode): MemfsStats;
  /** Applies attribute updates such as mode, timestamp, or size. */
  setattr(node: MemfsNode, attr: MemfsSetAttr): void;
  /** Always throws ENOENT to indicate missing entries. */
  lookup(parent: MemfsNode, name: string): never;
  /** Creates a child node under the provided parent. */
  mknod(parent: FSNode, name: string, mode: number, dev: number): MemfsNode;
  /** Renames or moves a node, enforcing directory emptiness. */
  rename(oldNode: MemfsNode, newDir: MemfsNode, newName: string): void;
  /** Removes a file entry. */
  unlink(parent: MemfsNode, name: string): void;
  /** Removes an empty directory. */
  rmdir(parent: MemfsNode, name: string): void;
  /** Lists directory entries. */
  readdir(node: MemfsNode): string[];
  /** Creates a symbolic link. */
  symlink(parent: MemfsNode, name: string, target: string): MemfsNode;
  /** Reads the target of a symbolic link. */
  readlink(node: MemfsNode): string;
}

/** Stream instance paired with a MEMFS node. */
export interface MemfsStream extends FSStream {
  /** Node backing this stream. */
  node: MemfsNode;
}

/** Stream operations for reading, writing, and memory mapping. */
export interface MemfsStreamOps {
  /** Reads data from a stream into a buffer. */
  read(
    stream: MemfsStream,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): number;
  /** Writes data from a buffer into a stream. */
  write(
    stream: MemfsStream,
    buffer: Uint8Array | ArrayLike<number>,
    offset: number,
    length: number,
    position: number,
    canOwn?: boolean,
  ): number;
  /** Computes the next position based on whence. */
  llseek(stream: MemfsStream, offset: number, whence: number): number;
  /** Ensures the file can hold the specified range. */
  allocate(stream: MemfsStream, offset: number, length: number): void;
  /** Maps a range of the file into memory. */
  mmap(
    stream: MemfsStream,
    length: number,
    position: number,
    prot: number,
    flags: number,
  ): { ptr: number; allocated: boolean };
  /** Persists changes made via mmap back to the file. */
  msync(
    stream: MemfsStream,
    buffer: Uint8Array | ArrayLike<number>,
    offset: number,
    length: number,
    mmapFlags: number,
  ): number;
}

/** Public MEMFS API surface returned by createMEMFS. */
export interface MemfsInstance {
  /** Lazily constructed table of node and stream operations. */
  ops_table: MemfsOpsTable | null;
  /** Mounts a MEMFS instance and returns the root node. */
  mount(config: Record<string, unknown>): MemfsNode;
  /** Creates a new node with mode-specific behavior. */
  createNode(
    parent: MemfsNode | null,
    name: string,
    mode: number,
    dev: number,
  ): MemfsNode;
  /** Returns a trimmed typed array view over a file's contents. */
  getFileDataAsTypedArray(node: MemfsNode): Uint8Array;
  /** Grows a file's storage to at least the requested capacity. */
  expandFileStorage(node: MemfsNode, newCapacity: number): void;
  /** Resizes a file and truncates or extends its contents. */
  resizeFileStorage(node: MemfsNode, newSize: number): void;
  /** Node operations exposed for filesystem integration. */
  node_ops: MemfsNodeOps;
  /** Stream operations exposed for filesystem integration. */
  stream_ops: MemfsStreamOps;
}

/** Filesystem capabilities required by MEMFS from the host FS implementation. */
type MemfsFs = MutableFS &
  ModeOperations & {
    /** Stream operations to support character devices. */
    chrdev_stream_ops: StreamOps;
  };

/** Constants that govern directory flags, allocation strategy, and permissions. */
const FS_CONSTANTS = {
  DIR_MODE: MODE.DIRECTORY,
  ALL_PERMISSIONS: MODE.DEFAULT_DIRECTORY_PERMISSIONS,
  SYMLINK_MODE: MODE.SYMLINK,
  DIR_SIZE: 4096,
  MIN_CAPACITY: 256,
  CAPACITY_DOUBLING_MAX: 1024 * 1024,
  GROWTH_FACTOR_LOW: 2.0,
  GROWTH_FACTOR_HIGH: 1.125,
  EFFICIENT_COPY_THRESHOLD: 8,
} as const;

/** Whence options for seek operations. */
const SEEK_MODE = {
  SET: 0,
  CUR: 1,
  END: 2,
} as const;

/** Flags that influence mmap behavior. */
const MMAP_FLAGS = {
  MAP_PRIVATE: 2,
} as const;

/** Errno used when mmap allocation fails. */
const ERRNO_MMAP_ALLOC_FAILED = 48;

/** Checks whether a node's contents represent a Uint8Array. */
const isUint8Array = (
  value: MemfsContents | ArrayLike<number> | null,
): value is Uint8Array => value instanceof Uint8Array;

/** Retrieves typed directory contents from a node. */
const asDirectoryContents = (node: MemfsNode): DirectoryContents =>
  node.contents as DirectoryContents;

/** Returns file contents when backed by a Uint8Array, otherwise null. */
const getFileContents = (node: MemfsNode): Uint8Array | null =>
  isUint8Array(node.contents) ? node.contents : null;

/**
 * Creates and returns the MEMFS file system implementation.
 *
 * @param FS The filesystem module reference.
 * @param HEAP8 WebAssembly heap reference for Int8Array.
 * @param mmapAlloc Memory allocation function for mmap.
 * @param _zeroMemory Function to zero memory regions (unused).
 * @returns MEMFS implementation object.
 */
export function createMEMFS(
  FS: MemfsFs,
  HEAP8: Int8Array,
  mmapAlloc: (size: number) => number,
  _zeroMemory: (pointer: number, byteCount: number) => void,
): MemfsInstance {
  const MEMFS: MemfsInstance = {
    ops_table: null,

    /** Creates a root node for the mounted filesystem. */
    mount(_mount: Record<string, unknown>) {
      return MEMFS.createNode(
        null,
        "/",
        FS_CONSTANTS.DIR_MODE | FS_CONSTANTS.ALL_PERMISSIONS,
        0,
      );
    },

    /**
     * Creates a node with mode-appropriate operations and inserts it into the parent directory.
     */
    createNode(parent, name, mode, dev) {
      // 1. Input handling
      if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }

      // 2. Core processing
      if (!MEMFS.ops_table) {
        MEMFS.ops_table = {
          dir: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
              lookup: MEMFS.node_ops.lookup,
              mknod: MEMFS.node_ops.mknod,
              rename: MEMFS.node_ops.rename,
              unlink: MEMFS.node_ops.unlink,
              rmdir: MEMFS.node_ops.rmdir,
              readdir: MEMFS.node_ops.readdir,
              symlink: MEMFS.node_ops.symlink,
            },
            stream: {
              llseek: MEMFS.stream_ops.llseek,
            },
          },
          file: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
            },
            stream: {
              llseek: MEMFS.stream_ops.llseek,
              read: MEMFS.stream_ops.read,
              write: MEMFS.stream_ops.write,
              allocate: MEMFS.stream_ops.allocate,
              mmap: MEMFS.stream_ops.mmap,
              msync: MEMFS.stream_ops.msync,
            },
          },
          link: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
              readlink: MEMFS.node_ops.readlink,
            },
            stream: {},
          },
          chrdev: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
            },
            stream: FS.chrdev_stream_ops,
          },
        };
      }

      const opsTable = MEMFS.ops_table;
      if (!opsTable) {
        throw new Error("MEMFS operations table not initialised");
      }

      const node = FS.createNode(
        parent as unknown as FSNode,
        name,
        mode,
        dev,
      ) as MemfsNode;

      if (FS.isDir(node.mode)) {
        node.node_ops = opsTable.dir.node;
        node.stream_ops = opsTable.dir.stream;
        node.contents = {};
        node.usedBytes = 0;
      } else if (FS.isFile(node.mode)) {
        node.node_ops = opsTable.file.node;
        node.stream_ops = opsTable.file.stream as unknown as StreamOps;
        node.usedBytes = 0;
        node.contents = null;
      } else if (FS.isLink(node.mode)) {
        node.node_ops = opsTable.link.node;
        node.stream_ops = opsTable.link.stream;
        node.contents = null;
        node.usedBytes = 0;
      } else if (FS.isChrdev(node.mode)) {
        node.node_ops = opsTable.chrdev.node;
        node.stream_ops = opsTable.chrdev.stream;
        node.usedBytes = 0;
        node.contents = null;
      }

      node.timestamp = Date.now();

      // 3. Output handling
      if (parent) {
        const dirContents = asDirectoryContents(parent);
        dirContents[name] = node;
        parent.timestamp = node.timestamp;
      }
      return node;
    },

    /** Returns a copy of the file contents trimmed to the used byte count. */
    getFileDataAsTypedArray(node) {
      if (!node.contents) {
        return new Uint8Array(0);
      }
      if (isUint8Array(node.contents)) {
        return node.contents.subarray(0, node.usedBytes);
      }
      return new Uint8Array(node.contents as unknown as ArrayLike<number>);
    },

    /** Expands underlying storage to at least the requested capacity. */
    expandFileStorage(node, newCapacity) {
      // 1. Input handling
      const fileContents = getFileContents(node);
      const prevCapacity = fileContents ? fileContents.length : 0;
      if (prevCapacity >= newCapacity) return;

      // 2. Core processing
      // Grow quickly for small files, then taper growth to reduce wasted space.
      newCapacity = Math.max(
        newCapacity,
        (prevCapacity *
          (prevCapacity < FS_CONSTANTS.CAPACITY_DOUBLING_MAX
            ? FS_CONSTANTS.GROWTH_FACTOR_LOW
            : FS_CONSTANTS.GROWTH_FACTOR_HIGH)) >>>
          0,
      );
      if (prevCapacity !== 0) {
        newCapacity = Math.max(newCapacity, FS_CONSTANTS.MIN_CAPACITY);
      }

      const oldContents = fileContents;
      node.contents = new Uint8Array(newCapacity);

      // 3. Output handling
      if (node.usedBytes > 0 && oldContents) {
        node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
      }
    },

    /** Resizes backing storage and truncates data as needed. */
    resizeFileStorage(node, newSize) {
      // 1. Input handling
      if (node.usedBytes === newSize) return;

      // 2. Core processing
      if (newSize === 0) {
        node.contents = null;
        node.usedBytes = 0;
      } else {
        const oldContents = getFileContents(node);
        node.contents = new Uint8Array(newSize);
        if (oldContents) {
          node.contents.set(
            oldContents.subarray(0, Math.min(newSize, node.usedBytes)),
          );
        }
        node.usedBytes = newSize;
      }
    },

    /** Node-level operations delegated by the filesystem. */
    node_ops: {
      /** Returns POSIX-like metadata for a node. */
      getattr(node) {
        // 1. Input handling
        const attr: MemfsStats = {
          dev: FS.isChrdev(node.mode) ? node.id! : 1,
          ino: node.id!,
          mode: node.mode,
          nlink: 1,
          uid: 0,
          gid: 0,
          rdev: node.rdev,
          size: 0,
          atime: new Date(node.timestamp),
          mtime: new Date(node.timestamp),
          ctime: new Date(node.timestamp),
          blksize: FS_CONSTANTS.DIR_SIZE,
          blocks: 0,
        };

        // 2. Core processing
        if (FS.isDir(node.mode)) {
          attr.size = FS_CONSTANTS.DIR_SIZE;
        } else if (FS.isFile(node.mode)) {
          attr.size = node.usedBytes;
        } else if (FS.isLink(node.mode)) {
          attr.size = node.link ? node.link.length : 0;
        }

        attr.blocks = Math.ceil(attr.size / attr.blksize);

        // 3. Output handling
        return attr;
      },

      /** Applies provided attributes to a node, truncating when size changes. */
      setattr(node, attr) {
        if (attr.mode !== undefined) {
          node.mode = attr.mode;
        }
        if (attr.timestamp !== undefined) {
          node.timestamp = attr.timestamp;
        }
        if (attr.size !== undefined) {
          MEMFS.resizeFileStorage(node, attr.size);
        }
      },

      /** Throws when a path component is missing. */
      lookup(_parent, _name) {
        throw FS.genericErrors[ERRNO_CODES.ENOENT];
      },

      /** Creates a new child node under the given parent. */
      mknod(parent, name, mode, dev) {
        return MEMFS.createNode(parent as MemfsNode, name, mode, dev);
      },

      /** Renames a node, enforcing directory emptiness checks. */
      rename(oldNode, newDir, newName) {
        // 1. Input handling
        if (FS.isDir(oldNode.mode)) {
          let newNode: MemfsNode | null = null;
          try {
            newNode = FS.lookupNode(newDir, newName) as MemfsNode;
          } catch (_e) {
            newNode = null;
          }

          if (newNode && newNode.contents) {
            for (const _key in newNode.contents) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
            }
          }
        }

        // 2. Core processing
        const parentNode = oldNode.parent as MemfsNode;
        const parentContents = asDirectoryContents(parentNode);
        delete parentContents[oldNode.name];
        parentNode.timestamp = Date.now();
        oldNode.name = newName;
        const newDirContents = asDirectoryContents(newDir);
        newDirContents[newName] = oldNode;
        newDir.timestamp = parentNode.timestamp;
      },

      /** Removes a file entry from its parent directory. */
      unlink(parent, name) {
        const contents = asDirectoryContents(parent);
        delete contents[name];
        parent.timestamp = Date.now();
      },

      /** Removes a directory when it is empty. */
      rmdir(parent, name) {
        // 1. Input handling
        const node = FS.lookupNode(parent, name) as MemfsNode;
        const contents = node.contents as DirectoryContents;
        for (const _key in contents) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
        }

        // 2. Core processing
        const parentContents = asDirectoryContents(parent);
        delete parentContents[name];
        parent.timestamp = Date.now();
      },

      /** Lists directory entries including dot and dot-dot. */
      readdir(node) {
        // 1. Input handling
        const entries = [".", ".."];

        // 2. Core processing
        const contents = asDirectoryContents(node);
        for (const key of Object.keys(contents)) {
          entries.push(key);
        }

        // 3. Output handling
        return entries;
      },

      /** Creates a symbolic link pointing at the provided target. */
      symlink(parent, newname, oldpath) {
        const node = MEMFS.createNode(
          parent,
          newname,
          FS_CONSTANTS.ALL_PERMISSIONS | FS_CONSTANTS.SYMLINK_MODE,
          0,
        );
        node.link = oldpath;
        return node;
      },

      /** Reads the target of a symbolic link. */
      readlink(node) {
        if (!FS.isLink(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        return node.link as string;
      },
    },

    /** Stream-level operations for reading, writing, and mapping files. */
    stream_ops: {
      /** Reads data from a node into the provided buffer. */
      read(stream, buffer, offset, length, position) {
        // 1. Input handling
        if (position >= stream.node.usedBytes) return 0;
        const contents = getFileContents(stream.node);
        if (!contents) {
          return 0;
        }

        // 2. Core processing
        const size = Math.min(stream.node.usedBytes - position, length);
        if (size > FS_CONSTANTS.EFFICIENT_COPY_THRESHOLD) {
          buffer.set(contents.subarray(position, position + size), offset);
        } else {
          for (let i = 0; i < size; i++) {
            buffer[offset + i] = contents[position + i];
          }
        }

        // 3. Output handling
        return size;
      },

      /** Writes data into a node, growing storage when necessary. */
      write(stream, buffer, offset, length, position, canOwn) {
        // 1. Input handling
        const bufferView = buffer as { buffer?: ArrayBufferLike };
        if (bufferView.buffer === HEAP8.buffer) {
          canOwn = false;
        }
        if (!length) return 0;

        const node = stream.node;
        node.timestamp = Date.now();

        // 2. Core processing
        // Prefer borrowing slices to avoid unnecessary copies when safe.
        const bufferHasSubarray =
          typeof (buffer as { subarray?: unknown }).subarray === "function";
        const bufferHasSlice =
          typeof (buffer as { slice?: unknown }).slice === "function";
        const nodeContents = getFileContents(node);

        if (bufferHasSubarray && bufferHasSlice) {
          const typedBuffer = buffer as Uint8Array;
          if (canOwn) {
            node.contents = typedBuffer.subarray(offset, offset + length);
            node.usedBytes = length;
            return length;
          }
          if (node.usedBytes === 0 && position === 0) {
            node.contents = typedBuffer.slice(offset, offset + length);
            node.usedBytes = length;
            return length;
          }
          if (position + length <= node.usedBytes && nodeContents) {
            nodeContents.set(
              typedBuffer.subarray(offset, offset + length),
              position,
            );
            return length;
          }
        }

        MEMFS.expandFileStorage(node, position + length);
        const expandedContents = getFileContents(node);
        if (expandedContents && bufferHasSubarray) {
          expandedContents.set(
            (
              buffer as {
                subarray: (start: number, end: number) => Uint8Array;
              }
            ).subarray(offset, offset + length),
            position,
          );
        } else if (expandedContents) {
          for (let i = 0; i < length; i++) {
            expandedContents[position + i] = buffer[offset + i]!;
          }
        }

        // 3. Output handling
        node.usedBytes = Math.max(node.usedBytes, position + length);
        return length;
      },

      /** Calculates a new stream position based on a whence mode. */
      llseek(stream, offset, whence) {
        // 1. Input handling
        let position = offset;
        if (whence === SEEK_MODE.CUR) {
          position += stream.position;
        } else if (whence === SEEK_MODE.END) {
          if (FS.isFile(stream.node.mode)) {
            position += stream.node.usedBytes;
          }
        }

        // 2. Core processing
        if (position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }

        // 3. Output handling
        return position;
      },

      /** Ensures capacity for a future write range. */
      allocate(stream, offset, length) {
        MEMFS.expandFileStorage(stream.node, offset + length);
        stream.node.usedBytes = Math.max(
          stream.node.usedBytes,
          offset + length,
        );
      },

      /** Maps a file region into memory and returns the pointer and allocation flag. */
      mmap(stream, length, position, _prot, flags) {
        // 1. Input handling
        if (!FS.isFile(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }

        let ptr: number;
        let allocated: boolean;
        let contents = getFileContents(stream.node);

        // 2. Core processing
        // Reuse the underlying heap when MAP_PRIVATE is not requested and buffers already align.
        if (
          !(flags & MMAP_FLAGS.MAP_PRIVATE) &&
          contents &&
          contents.buffer === HEAP8.buffer
        ) {
          allocated = false;
          ptr = contents.byteOffset;
        } else {
          allocated = true;
          ptr = mmapAlloc(length);
          if (!ptr) {
            throw new FS.ErrnoError(ERRNO_MMAP_ALLOC_FAILED);
          }
          if (contents) {
            if (position > 0 || position + length < contents.length) {
              contents = contents.subarray(position, position + length);
            }
            HEAP8.set(contents, ptr);
          }
        }

        // 3. Output handling
        return { ptr, allocated };
      },

      /** Flushes a mapped region back to the underlying file. */
      msync(stream, buffer, offset, length, _mmapFlags) {
        MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
        return 0;
      },
    },
  };

  return MEMFS;
}
