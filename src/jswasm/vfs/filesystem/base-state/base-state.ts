import {
  MODE,
  OPEN_FLAGS,
  STREAM_STATE_MASK,
  PERMISSION,
} from "../constants/constants";

/**
 * Error subtype thrown by filesystem helpers when an errno is required.
 */
export interface ErrnoError extends Error {
  /** Numeric errno describing the failure reason. */
  errno: number;
}

/**
 * Metadata describing a filesystem node or stream.
 */
export interface FSStats {
  /** File size in bytes when available. */
  size?: number;
  /** POSIX mode mask associated with the entry. */
  mode?: number;
  /** Last modification timestamp expressed in seconds. */
  timestamp?: number;
}

/**
 * Shared state stored on every stream instance.
 */
export interface FSStreamShared {
  /** Open flags associated with the stream. */
  flags?: number;
  /** Current read/write position for the stream. */
  position?: number;
}

/**
 * Operations exposed by stream helpers for interacting with a node.
 */
export interface StreamOps {
  /** Invoked when the stream is opened. */
  open?(stream: FSStream): void;
  /** Invoked when the stream is closed. */
  close?(stream: FSStream): void;
  /** Performs a seek operation on the stream. */
  llseek?(stream: FSStream, offset: number, whence: number): number;
  /** Reads bytes into the provided buffer. */
  read?(
    stream: FSStream,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): number;
  /** Writes bytes from the provided buffer. */
  write?(
    stream: FSStream,
    buffer: Uint8Array | ArrayLike<number>,
    offset: number,
    length: number,
    position: number,
    canOwn?: boolean,
  ): number;
  /** Allocates bytes within the stream if supported. */
  allocate?(stream: FSStream, offset: number, length: number): void;
  /** Maps the stream into memory. */
  mmap?(
    stream: FSStream,
    length: number,
    position: number,
    prot: number,
    flags: number,
  ): { ptr: number; length: number };
  /** Synchronises the stream contents back to storage. */
  msync?(
    stream: FSStream,
    buffer: Uint8Array | ArrayLike<number>,
    offset: number,
    length: number,
    mmapFlags: number,
  ): number;
  /** Handles IOCTL operations issued against the stream. */
  ioctl?(stream: FSStream, cmd: number, arg: number): number;
  /** Creates a duplicate descriptor for the stream. */
  dup?(stream: FSStream): void;
}

/**
 * Operations available on nodes within the filesystem tree.
 */
export interface NodeOps {
  /** Looks up a child entry with the provided name. */
  lookup?(parent: FSNode, name: string): FSNode;
  /** Creates a child node underneath the specified parent. */
  mknod?(parent: FSNode, name: string, mode: number, dev: number): FSNode;
  /** Creates a symbolic link pointing at the provided target. */
  symlink?(parent: FSNode, name: string, target: string): FSNode;
  /** Renames the node into a new directory with a different name. */
  rename?(node: FSNode, newDir: FSNode, newName: string): void;
  /** Removes a child directory. */
  rmdir?(parent: FSNode, name: string): void;
  /** Lists directory entries for the node. */
  readdir?(node: FSNode): string[];
  /** Removes a non-directory child. */
  unlink?(parent: FSNode, name: string): void;
  /** Resolves the target of a symbolic link. */
  readlink?(node: FSNode): string;
  /** Retrieves stats associated with the node. */
  getattr?(node: FSNode): FSStats;
  /** Updates stats on the node using a partial structure. */
  setattr?(node: FSNode, stats: Partial<FSStats>): void;
}

/**
 * Filesystem type that can be mounted under the virtual filesystem.
 */
export interface FileSystemMountType {
  /** Mounts the filesystem at the provided mount descriptor. */
  mount(mount: FileSystemMount): FSNode;
  /** Synchronises the filesystem and optionally populates state. */
  syncfs?(
    mount: FileSystemMount,
    populate: boolean,
    done: (errCode: number | null) => void,
  ): void;
}

/**
 * Mount descriptor linking a filesystem implementation to a path.
 */
export interface FileSystemMount {
  /** Filesystem implementation backing the mount. */
  type: FileSystemMountType;
  /** Arbitrary options passed when mounting. */
  opts: Record<string, unknown>;
  /** Absolute mount point path. */
  mountpoint: string;
  /** Nested mounts underneath this mount point. */
  mounts: FileSystemMount[];
  /** Root node of the filesystem exposed at the mount. */
  root: FSNode;
}

/**
 * Definition used for registering a character device with the filesystem.
 */
export interface DeviceDefinition {
  /** Stream operations used by the registered device. */
  stream_ops: StreamOps;
}

/**
 * Node structure describing an entry within the virtual filesystem.
 */
export interface FSNode {
  /** Parent node or self when acting as the root. */
  parent: FSNode;
  /** Mount descriptor associated with the node. */
  mount: FileSystemMount;
  /** Mount mounted on top of this node, if any. */
  mounted: FileSystemMount | null;
  /** Unique inode identifier or null until assigned. */
  id: number | null;
  /** Basename of the node. */
  name: string;
  /** POSIX mode flag representing node type and permissions. */
  mode: number;
  /** Operations available on the node. */
  node_ops: NodeOps;
  /** Stream operations used when opening the node. */
  stream_ops: StreamOps;
  /** Device identifier when representing a special file. */
  rdev: number;
  /** Bitmask representing read permissions. */
  readMode: number;
  /** Bitmask representing write permissions. */
  writeMode: number;
  /** Assigns a unique inode identifier using the provided FS instance. */
  assignId(fs: MutableFS): FSNode;
  /** Indicates whether the node is readable. */
  read: boolean;
  /** Indicates whether the node is writable. */
  write: boolean;
  /** Indicates whether the node represents a directory. */
  isFolder: boolean;
  /** Indicates whether the node represents a device. */
  isDevice: boolean;
  /** Next node in name table hash collision chain. */
  name_next: FSNode | null;
}

/**
 * Stream instance associated with an open file descriptor.
 */
export interface FSStream {
  /** Shared state container mirrored across duplicates. */
  shared: FSStreamShared;
  /** Node that the stream operates on. */
  node?: FSNode;
  /** Open flags used when creating the stream. */
  flags: number;
  /** Current read/write position. */
  position: number;
  /** File descriptor assigned to the stream or null prior to registration. */
  fd: number | null;
  /** Optional canonical path reference. */
  path?: string;
  /** Indicates whether the stream supports seeking. */
  seekable?: boolean;
  /** Stream operations available for the node. */
  stream_ops: StreamOps;
  /** Stack of bytes pushed back onto the stream. */
  ungotten?: number[];
  /** Indicates whether the stream has encountered an error. */
  error?: boolean;
  /** Placeholder used when reading directory entries. */
  getdents?: null;
  /** Node associated with the descriptor. */
  object: FSNode;
  /** True when the stream permits reading. */
  isRead: boolean;
  /** True when the stream permits writing. */
  isWrite: boolean;
  /** True when the stream is in append mode. */
  isAppend: boolean;
}

/**
 * Mutable filesystem state shared across the helper modules.
 */
export interface MutableFS {
  /** Root node of the virtual filesystem. */
  root: FSNode | null;
  /** Mount table registered with the filesystem. */
  mounts: FileSystemMount[];
  /** Registered character devices keyed by device number. */
  devices: Record<number, DeviceDefinition>;
  /** Active stream table keyed by file descriptor. */
  streams: Array<FSStream | null>;
  /** Next inode number to assign when creating nodes. */
  nextInode: number;
  /** Lookup table used for fast inode resolution. */
  nameTable: Array<FSNode | null> | null;
  /** Current working directory. */
  currentPath: string;
  /** Indicates whether the filesystem has been initialised. */
  initialized: boolean;
  /** Flag controlling whether permission checks are enforced. */
  ignorePermissions: boolean;
  /** Errno-aware error constructor used by the helpers. */
  ErrnoError: new (errno: number) => ErrnoError;
  /** Pre-created error instances keyed by errno. */
  genericErrors: Record<number, ErrnoError>;
  /** Map of registered filesystem implementations. */
  filesystems: Record<string, unknown> | null;
  /** Number of outstanding syncFS requests. */
  syncFSRequests: number;
  /** Cache of files read from the network. */
  readFiles: Record<string, number>;
  /** Constructor used when creating new stream instances. */
  FSStream: new () => FSStream;
  /** Constructor used when creating new node instances. */
  FSNode: new (
    parent: FSNode,
    name: string,
    mode: number,
    rdev: number,
  ) => FSNode;
}

/**
 * Creates the mutable filesystem state container that other helper modules
 * extend in order to expose POSIX-like filesystem behaviors.
 *
 * @returns {MutableFS} A fresh filesystem state object with default values
 */
export function createBaseState(): MutableFS {
  // 1. Initialize basic filesystem state properties
  const baseState: Partial<MutableFS> = {
    root: null,
    mounts: [],
    devices: {},
    streams: [],
    nextInode: 1,
    nameTable: null,
    currentPath: "/",
    initialized: false,
    ignorePermissions: true,
    genericErrors: {},
    filesystems: null,
    syncFSRequests: 0,
    readFiles: {},
  };

  // 2. Create the ErrnoError constructor with proper error handling
  baseState.ErrnoError = class ErrnoError implements ErrnoError {
    public readonly name = "ErrnoError";
    public errno: number;

    constructor(errno: number) {
      this.errno = errno;
    }
  } as new (errno: number) => ErrnoError;

  // 3. Create the FSStream constructor with shared state delegation
  baseState.FSStream = class FSStream implements FSStream {
    public shared: FSStreamShared = {};
    private _node?: FSNode;
    private _fd: number | null = null;
    private _path?: string;
    public seekable?: boolean;
    public stream_ops: StreamOps = {};
    public ungotten?: number[];
    public error?: boolean;
    public getdents?: null;

    // 3.1 Implement object property getter/setter for node mapping
    get object(): FSNode {
      return this._node!;
    }

    set object(val: FSNode) {
      this._node = val;
    }

    // 3.2 Implement flags property with shared state delegation
    get flags(): number {
      return this.shared.flags || 0;
    }

    set flags(val: number) {
      this.shared.flags = val;
    }

    // 3.3 Implement position property with shared state delegation
    get position(): number {
      return this.shared.position || 0;
    }

    set position(val: number) {
      this.shared.position = val;
    }

    // 3.4 Implement computed properties for stream mode detection
    get isRead(): boolean {
      return (this.flags & STREAM_STATE_MASK) !== OPEN_FLAGS.O_WRONLY;
    }

    get isWrite(): boolean {
      return (this.flags & STREAM_STATE_MASK) !== OPEN_FLAGS.O_RDONLY;
    }

    get isAppend(): boolean {
      return (this.flags & OPEN_FLAGS.O_APPEND) !== 0;
    }

    // 3.5 Implement fd property getter/setter
    get fd(): number | null {
      return this._fd;
    }

    set fd(val: number | null) {
      this._fd = val;
    }

    // 3.6 Implement path property getter/setter
    get path(): string | undefined {
      return this._path;
    }

    set path(val: string | undefined) {
      this._path = val;
    }

    // 3.7 Provide access to the internal node
    get node(): FSNode | undefined {
      return this._node;
    }

    set node(val: FSNode | undefined) {
      this._node = val;
    }
  };

  // 4. Create the FSNode constructor with filesystem integration
  baseState.FSNode = class FSNode implements FSNode {
    public parent: FSNode;
    public mount: FileSystemMount;
    public mounted: FileSystemMount | null = null;
    public id: number | null = null;
    public name: string;
    public mode: number;
    public node_ops: NodeOps = {};
    public stream_ops: StreamOps = {};
    public rdev: number;
    public readonly readMode = PERMISSION.READ_EXECUTE;
    public readonly writeMode = MODE.PERMISSION_WRITE;
    public name_next: FSNode | null = null;

    constructor(parent: FSNode, name: string, mode: number, rdev: number) {
      // 4.1 Handle self-parenting for root nodes
      if (!parent) {
        parent = this as FSNode;
      }

      this.parent = parent;
      this.mount = parent.mount;
      this.name = name;
      this.mode = mode;
      this.rdev = rdev;
    }

    // 4.2 Implement inode assignment with automatic numbering
    assignId(fs: MutableFS): FSNode {
      this.id = fs.nextInode++;
      return this;
    }

    // 4.3 Implement read permission getter/setter with mode manipulation
    get read(): boolean {
      return (this.mode & this.readMode) === this.readMode;
    }

    set read(val: boolean) {
      if (val) {
        this.mode |= this.readMode;
      } else {
        this.mode &= ~this.readMode;
      }
    }

    // 4.4 Implement write permission getter/setter with mode manipulation
    get write(): boolean {
      return (this.mode & this.writeMode) === this.writeMode;
    }

    set write(val: boolean) {
      if (val) {
        this.mode |= this.writeMode;
      } else {
        this.mode &= ~this.writeMode;
      }
    }

    // 4.5 Implement computed properties for node type detection
    get isFolder(): boolean {
      return (this.mode & MODE.TYPE_MASK) === MODE.DIRECTORY;
    }

    get isDevice(): boolean {
      return (this.mode & MODE.TYPE_MASK) === MODE.CHARACTER_DEVICE;
    }
  };

  // 5. Return the complete base state object
  return baseState as MutableFS;
}
