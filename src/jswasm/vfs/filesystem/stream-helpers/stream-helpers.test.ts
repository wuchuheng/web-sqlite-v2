/**
 * Unit tests for stream-helpers module
 * Tests the TypeScript implementation after migration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStreamHelpers } from "./stream-helpers";
import type {
  MutableFS,
  FSStream,
  FSNode,
  FileSystemMount,
} from "../base-state/base-state";
import { ERRNO_CODES, OPEN_FLAGS } from "../constants/constants";

// Mock UTF8 utilities
vi.mock("../../../utils/utf8/utf8", () => ({
  UTF8ArrayToString: vi.fn((buf: Uint8Array) => {
    // Simple ASCII decoder for testing
    return String.fromCharCode(...buf.filter((b) => b !== 0));
  }),
  lengthBytesUTF8: vi.fn((str: string) => {
    // Simple ASCII length calculation
    return new TextEncoder().encode(str).length;
  }),
  stringToUTF8Array: vi.fn(
    (str: string, buf: Uint8Array, offset: number, maxLength: number) => {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(str);
      const length = Math.min(encoded.length, maxLength - 1); // Leave space for null terminator
      buf.set(encoded.slice(0, length), offset);
      buf[offset + length] = 0; // Null terminator
      return length;
    },
  ),
}));

// Extend MutableFS interface for our mock with additional methods
interface MutableFSWithCloseStream extends MutableFS {
  closeStream: (fd: number) => void;
  isClosed: (stream: FSStream) => boolean;
  isDir: (mode: number) => boolean;
  isFile: (mode: number) => boolean;
  nodePermissions: (node: FSNode, perm: string) => number;
  lookupPath: (
    path: string,
    options?: Record<string, unknown>,
  ) => { path: string; node: FSNode | null };
  open: (path: string, flags: number, mode?: number) => FSStream;
  stat: (path: string) => { size: number; mode: number };
  close: (stream: FSStream) => void;
  read: (
    stream: FSStream,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position?: number,
  ) => number;
  write: (
    stream: FSStream,
    buffer: Uint8Array | ArrayLike<number>,
    offset: number,
    length: number,
    position?: number,
    canOwn?: boolean,
  ) => number;
  llseek: (stream: FSStream, offset: number, whence: number) => number;
}

// Helper function to create mock FS object
function createMockFS(): MutableFS {
  let nextFd = 1;

  // Error constructor defined first to avoid circular reference
  class MockErrnoError extends Error {
    errno: number;
    constructor(errno: number) {
      super("Mock error");
      this.name = "ErrnoError";
      this.errno = errno;
    }
  }

  class MockFSStream {
    fd: number | null = null;
    node?: FSNode;
    flags: number = 0;
    position: number = 0;
    seekable: boolean = false;
    shared: Record<string, unknown> = {};
    ungotten: number[] = [];
    stream_ops: Record<string, unknown> = {};
    getdents: null | undefined = null;
    object: FSNode = null as unknown as FSNode;
    isRead: boolean = false;
    isWrite: boolean = false;
    isAppend: boolean = false;
  }

  class MockFSNode {
    mode: number = 0;
    size?: number;
    parent: MockFSNode = this as unknown as MockFSNode;
    mount: FileSystemMount = null as unknown as FileSystemMount;
    mounted: FileSystemMount | null = null;
    id: number | null = null;
    name: string = "";
    node_ops: Record<string, unknown> = {};
    stream_ops: Record<string, unknown> = {};
    rdev: number = 0;
    readMode: number = 0;
    writeMode: number = 0;
    isFolder: boolean = false;
    isDevice: boolean = false;
    name_next: MockFSNode | null = null;
    read: boolean = false;
    write: boolean = false;
    isAppend: boolean = false;
    object: MockFSNode = this as unknown as MockFSNode;
    isRead: boolean = false;
    isWrite: boolean = false;
    assignId(fs: MutableFS): MockFSNode {
      this.id = fs.nextInode++;
      return this;
    }
  }

  const mockFS: MutableFSWithCloseStream = {
    // MutableFS required properties
    root: null,
    mounts: [],
    devices: {},
    streams: [],
    nextInode: 1,
    nameTable: null,
    initialized: false,
    ignorePermissions: true,
    genericErrors: {},
    filesystems: null,
    syncFSRequests: 0,
    readFiles: {},
    getPath: vi.fn(() => ""),
    hashName: vi.fn(() => 0),
    hashAddNode: vi.fn(),
    hashRemoveNode: vi.fn(),
    lookupNode: vi.fn(
      (_parent: FSNode, _name: string) => new MockFSNode() as FSNode,
    ),
    createNode: vi.fn(
      (_parent: FSNode, _name: string, _mode: number, _rdev: number) =>
        new MockFSNode() as FSNode,
    ),
    destroyNode: vi.fn((_node: FSNode) => {}),
    isRoot: vi.fn((_node: FSNode) => false),
    isMountpoint: vi.fn((_node: FSNode) => false),
    isLink: vi.fn((_mode: number) => false),
    readlink: vi.fn((_path: string) => ""),
    mayLookup: vi.fn((_parent: FSNode) => 0),
    lookup: vi.fn(
      (_parent: FSNode, _name: string) => new MockFSNode() as FSNode,
    ),

    // Stream management
    closeStream: vi.fn((_fd: number) => {
      // Mock implementation - in real code this would remove from streams array
    }),

    // Stream state checking
    isClosed: vi.fn((stream: FSStream) => stream.fd === null),

    // Node type checking
    isDir: vi.fn((mode: number) => (mode & 0o170000) === 0o040000),
    isFile: vi.fn((mode: number) => (mode & 0o170000) === 0o100000),

    // Permission checking
    nodePermissions: vi.fn((node: FSNode, perm: string) => {
      if (perm === "x" && !(node.mode & 0o111)) return ERRNO_CODES.EACCES;
      return 0;
    }),

    // Path operations
    lookupPath: vi.fn((path: string, _options?: Record<string, unknown>) => ({
      path,
      node: mockNodes[path] || null,
    })),

    // File operations
    open: vi.fn((path: string, flags: number, _mode?: number) => {
      const node = mockNodes[path];
      if (!node) {
        throw new MockErrnoError(ERRNO_CODES.ENOENT);
      }

      const stream = new MockFSStream();
      stream.fd = nextFd++;
      stream.node = node;
      stream.flags = flags;
      stream.position = 0;
      stream.seekable = true;
      stream.shared = {};
      stream.ungotten = [];

      return stream;
    }),

    stat: vi.fn((path: string) => {
      const node = mockNodes[path];
      if (!node) {
        throw new MockErrnoError(ERRNO_CODES.ENOENT);
      }
      return {
        size: (node as FSNode & { size?: number }).size || 0,
        mode: node.mode,
      };
    }),

    close: vi.fn((stream: FSStream) => {
      if (stream.stream_ops.close) {
        stream.stream_ops.close(stream);
      }
      mockFS.closeStream(stream.fd!);
      stream.fd = null;
    }),

    read: vi.fn(
      (
        stream: FSStream,
        buffer: Uint8Array,
        offset: number,
        length: number,
        position?: number,
      ) => {
        if (stream.stream_ops.read) {
          return stream.stream_ops.read(
            stream,
            buffer,
            offset,
            length,
            position || stream.position,
          );
        }
        throw new MockErrnoError(ERRNO_CODES.EINVAL);
      },
    ),

    write: vi.fn(
      (
        stream: FSStream,
        buffer: Uint8Array | ArrayLike<number>,
        offset: number,
        length: number,
        position?: number,
        canOwn?: boolean,
      ) => {
        if (stream.stream_ops.write) {
          return stream.stream_ops.write(
            stream,
            buffer,
            offset,
            length,
            position || stream.position,
            canOwn,
          );
        }
        throw new MockErrnoError(ERRNO_CODES.EINVAL);
      },
    ),

    llseek: vi.fn((stream: FSStream, offset: number, _whence: number) => {
      if (stream.stream_ops.llseek) {
        return stream.stream_ops.llseek(stream, offset, 0);
      }
      throw new MockErrnoError(ERRNO_CODES.ESPIPE);
    }),

    // Current path
    currentPath: "/",

    // Error constructors
    ErrnoError: MockErrnoError,
    FSStream: MockFSStream as new () => FSStream,
    FSNode: MockFSNode as new (
      parent: FSNode,
      name: string,
      mode: number,
      rdev: number,
    ) => FSNode,
  };

  return mockFS as MutableFSWithCloseStream as MutableFS;
}

// Mock node data for testing
const mockNodes: Record<string, FSNode> = {
  "/test.txt": {
    mode: 0o100644, // Regular file, rw-r--r--
    size: 10,
  } as unknown as FSNode,
  "/dir": {
    mode: 0o40755, // Directory, rwxr-xr-x
  } as unknown as FSNode,
};

// Helper function to create mock stream
function createMockStream(
  fs: MutableFS,
  options: Partial<{
    closed: boolean;
    seekable: boolean;
    readable: boolean;
    writable: boolean;
    isDir: boolean;
    hasOps: Partial<keyof FSStream["stream_ops"]>[];
  }> = {},
): FSStream {
  const {
    closed = false,
    seekable = true,
    readable = true,
    writable = true,
    isDir = false,
    hasOps = [],
  } = options;

  const stream = new fs.FSStream();
  stream.fd = closed ? null : 1;
  stream.node = {
    mode: isDir ? 0o40755 : 0o100644,
    size: 100,
  } as unknown as FSNode;
  stream.flags =
    readable && writable
      ? OPEN_FLAGS.O_RDWR
      : readable
        ? OPEN_FLAGS.O_RDONLY
        : OPEN_FLAGS.O_WRONLY;
  stream.position = 0;
  stream.seekable = seekable;
  stream.shared = {};
  stream.ungotten = [];
  stream.object = stream.node as FSNode;
  stream.isRead = readable;
  stream.isWrite = writable;
  stream.isAppend = false; // Could be set based on O_APPEND flag if needed

  // Mock stream operations
  stream.stream_ops = {};
  if (hasOps.includes("close")) {
    stream.stream_ops.close = vi.fn();
  }
  if (hasOps.includes("llseek")) {
    stream.stream_ops.llseek = vi.fn(
      (_: FSStream, offset: number, _whence: number) => {
        // Return the new position (simulating actual llseek behavior)
        return offset;
      },
    );
  }
  if (hasOps.includes("read")) {
    stream.stream_ops.read = vi.fn(
      (
        _stream: FSStream,
        buffer: Uint8Array,
        offset: number,
        length: number,
        _position: number,
      ) => {
        // Simulate reading some data - fill with zeros and return bytes read
        const bytesRead = Math.min(length, 10);
        for (let i = 0; i < bytesRead; i++) {
          buffer[offset + i] = i + 1; // Fill with pattern data
        }
        return bytesRead;
      },
    );
  }
  if (hasOps.includes("write")) {
    stream.stream_ops.write = vi.fn(
      (
        _stream: FSStream,
        _buffer: Uint8Array | ArrayLike<number>,
        _offset: number,
        length: number,
        _position: number,
      ) => {
        // Simulate writing data - return bytes written
        return length;
      },
    );
  }
  if (hasOps.includes("allocate")) {
    stream.stream_ops.allocate = vi.fn();
  }
  if (hasOps.includes("mmap")) {
    stream.stream_ops.mmap = vi.fn(() => ({ ptr: 0x1000, length: 1024 }));
  }
  if (hasOps.includes("msync")) {
    stream.stream_ops.msync = vi.fn(() => 0);
  }
  if (hasOps.includes("ioctl")) {
    stream.stream_ops.ioctl = vi.fn(() => 0);
  }

  return stream;
}

describe("stream-helpers", () => {
  let fs: MutableFS;
  let helpers: ReturnType<typeof createStreamHelpers>;

  beforeEach(() => {
    fs = createMockFS();
    helpers = createStreamHelpers(fs);
  });

  describe("close()", () => {
    it("should close an open stream successfully", () => {
      // 1. Setup open stream with mock operations
      const stream = createMockStream(fs, { hasOps: ["close"] });

      // 2. Close the stream
      helpers.close(stream);

      // 3. Verify stream is marked as closed
      expect(stream.fd).toBeNull();
      expect(stream.getdents).toBeNull();
      expect((fs as MutableFSWithCloseStream).closeStream).toHaveBeenCalledWith(
        1,
      );
      expect(stream.stream_ops.close).toHaveBeenCalledWith(stream);
    });

    it("should throw EBADF when closing already closed stream", () => {
      // 1. Setup closed stream
      const stream = createMockStream(fs, { closed: true });

      // 2. Attempt to close and verify error
      expect(() => helpers.close(stream)).toThrow(fs.ErrnoError);
      expect(() => helpers.close(stream)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EBADF }),
      );
    });
  });

  describe("isClosed()", () => {
    it("should return false for open stream", () => {
      // 1. Setup open stream
      const stream = createMockStream(fs, { closed: false });

      // 2. Check closed status
      expect(helpers.isClosed(stream)).toBe(false);
    });

    it("should return true for closed stream", () => {
      // 1. Setup closed stream
      const stream = createMockStream(fs, { closed: true });

      // 2. Check closed status
      expect(helpers.isClosed(stream)).toBe(true);
    });
  });

  describe("llseek()", () => {
    it("should seek to valid position successfully", () => {
      // 1. Setup seekable stream
      const stream = createMockStream(fs, { hasOps: ["llseek"] });

      // 2. Perform seek
      const newPosition = helpers.llseek(stream, 10, 0); // SEEK_SET

      // 3. Verify position updated
      expect(newPosition).toBe(10);
      expect(stream.position).toBe(10);
      expect(stream.ungotten).toEqual([]);
    });

    it("should throw EBADF for closed stream", () => {
      // 1. Setup closed stream
      const stream = createMockStream(fs, { closed: true, hasOps: ["llseek"] });

      // 2. Attempt seek and verify error
      expect(() => helpers.llseek(stream, 10, 0)).toThrow(fs.ErrnoError);
      expect(() => helpers.llseek(stream, 10, 0)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EBADF }),
      );
    });

    it("should throw ESPIPE for non-seekable stream", () => {
      // 1. Setup non-seekable stream
      const stream = createMockStream(fs, { seekable: false });

      // 2. Attempt seek and verify error
      expect(() => helpers.llseek(stream, 10, 0)).toThrow(fs.ErrnoError);
      expect(() => helpers.llseek(stream, 10, 0)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.ESPIPE }),
      );
    });

    it("should throw EINVAL for invalid whence", () => {
      // 1. Setup seekable stream with llseek operation
      const stream = createMockStream(fs, { hasOps: ["llseek"] });

      // 2. Attempt seek with invalid whence
      expect(() => helpers.llseek(stream, 10, 99)).toThrow(fs.ErrnoError);
      expect(() => helpers.llseek(stream, 10, 99)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EINVAL }),
      );
    });
  });

  describe("read()", () => {
    it("should read data successfully", () => {
      // 1. Setup readable stream
      const buffer = new Uint8Array(20);
      const stream = createMockStream(fs, { readable: true, hasOps: ["read"] });

      // 2. Perform read (without explicit position to test position update)
      const bytesRead = helpers.read(stream, buffer, 0, 10);

      // 3. Verify read operation
      expect(bytesRead).toBe(10);
      expect(stream.stream_ops.read).toHaveBeenCalledWith(
        stream,
        buffer,
        0,
        10,
        0,
      ); // Uses stream.position
      expect(stream.position).toBe(10); // Position updated for non-seeking read
    });

    it("should throw EINVAL for negative length", () => {
      // 1. Setup readable stream
      const buffer = new Uint8Array(20);
      const stream = createMockStream(fs, { readable: true });

      // 2. Attempt read with negative length
      expect(() => helpers.read(stream, buffer, 0, -1, 0)).toThrow(
        fs.ErrnoError,
      );
      expect(() => helpers.read(stream, buffer, 0, -1, 0)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EINVAL }),
      );
    });

    it("should throw EBADF for closed stream", () => {
      // 1. Setup closed stream
      const buffer = new Uint8Array(20);
      const stream = createMockStream(fs, { readable: true, closed: true });

      // 2. Attempt read and verify error
      expect(() => helpers.read(stream, buffer, 0, 10, 0)).toThrow(
        fs.ErrnoError,
      );
      expect(() => helpers.read(stream, buffer, 0, 10, 0)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EBADF }),
      );
    });

    it("should throw EBADF for write-only stream", () => {
      // 1. Setup write-only stream
      const buffer = new Uint8Array(20);
      const stream = createMockStream(fs, { readable: false, writable: true });

      // 2. Attempt read and verify error
      expect(() => helpers.read(stream, buffer, 0, 10, 0)).toThrow(
        fs.ErrnoError,
      );
      expect(() => helpers.read(stream, buffer, 0, 10, 0)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EBADF }),
      );
    });

    it("should throw EISDIR for directory", () => {
      // 1. Setup directory stream
      const buffer = new Uint8Array(20);
      const stream = createMockStream(fs, { isDir: true });

      // 2. Attempt read and verify error
      expect(() => helpers.read(stream, buffer, 0, 10, 0)).toThrow(
        fs.ErrnoError,
      );
      expect(() => helpers.read(stream, buffer, 0, 10, 0)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EISDIR }),
      );
    });
  });

  describe("write()", () => {
    it("should write data successfully", () => {
      // 1. Setup writable stream
      const buffer = new Uint8Array([1, 2, 3, 4, 5]);
      const stream = createMockStream(fs, {
        writable: true,
        hasOps: ["write"],
      });

      // 2. Perform write (without explicit position to test position update)
      const bytesWritten = helpers.write(stream, buffer, 0, 5);

      // 3. Verify write operation
      expect(bytesWritten).toBe(5);
      expect(stream.stream_ops.write).toHaveBeenCalledWith(
        stream,
        buffer,
        0,
        5,
        0,
        undefined,
      ); // Uses stream.position
      expect(stream.position).toBe(5); // Position updated for non-seeking write
    });

    it("should throw EINVAL for negative length", () => {
      // 1. Setup writable stream
      const buffer = new Uint8Array(20);
      const stream = createMockStream(fs, { writable: true });

      // 2. Attempt write with negative length
      expect(() => helpers.write(stream, buffer, 0, -1, 0)).toThrow(
        fs.ErrnoError,
      );
      expect(() => helpers.write(stream, buffer, 0, -1, 0)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EINVAL }),
      );
    });

    it("should throw EBADF for read-only stream", () => {
      // 1. Setup read-only stream
      const buffer = new Uint8Array(20);
      const stream = createMockStream(fs, { readable: true, writable: false });

      // 2. Attempt write and verify error
      expect(() => helpers.write(stream, buffer, 0, 10, 0)).toThrow(
        fs.ErrnoError,
      );
      expect(() => helpers.write(stream, buffer, 0, 10, 0)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EBADF }),
      );
    });
  });

  describe("allocate()", () => {
    it("should allocate space successfully", () => {
      // 1. Setup writable stream with allocate support
      const stream = createMockStream(fs, {
        writable: true,
        hasOps: ["allocate"],
      });

      // 2. Perform allocation
      helpers.allocate(stream, 0, 1024);

      // 3. Verify allocate operation
      expect(stream.stream_ops.allocate).toHaveBeenCalledWith(stream, 0, 1024);
    });

    it("should throw EINVAL for invalid parameters", () => {
      // 1. Setup writable stream
      const stream = createMockStream(fs, { writable: true });

      // 2. Test negative offset
      expect(() => helpers.allocate(stream, -1, 1024)).toThrow(fs.ErrnoError);
      expect(() => helpers.allocate(stream, -1, 1024)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EINVAL }),
      );

      // 3. Test zero length
      expect(() => helpers.allocate(stream, 0, 0)).toThrow(fs.ErrnoError);
      expect(() => helpers.allocate(stream, 0, 0)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EINVAL }),
      );
    });
  });

  describe("mmap()", () => {
    it("should create memory mapping successfully", () => {
      // 1. Setup readable stream with mmap support
      const stream = createMockStream(fs, { readable: true, hasOps: ["mmap"] });

      // 2. Perform mmap
      const result = helpers.mmap(stream, 1024, 0, 1, 0);

      // 3. Verify mmap operation and result
      expect(result).toEqual({ ptr: 0x1000, length: 1024 });
      expect(stream.stream_ops.mmap).toHaveBeenCalledWith(
        stream,
        1024,
        0,
        1,
        0,
      );
    });

    it("should throw EINVAL for zero length", () => {
      // 1. Setup readable stream with mmap support but zero length
      const stream = createMockStream(fs, { readable: true, hasOps: ["mmap"] });

      // 2. Attempt mmap with zero length
      expect(() => helpers.mmap(stream, 0, 0, 1, 0)).toThrow(fs.ErrnoError);
      expect(() => helpers.mmap(stream, 0, 0, 1, 0)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EINVAL }),
      );
    });
  });

  describe("msync()", () => {
    it("should sync memory mapping successfully", () => {
      // 1. Setup stream with msync support
      const buffer = new Uint8Array(1024);
      const stream = createMockStream(fs, { hasOps: ["msync"] });

      // 2. Perform msync
      const result = helpers.msync(stream, buffer, 0, 1024, 0);

      // 3. Verify msync operation
      expect(result).toBe(0);
      expect(stream.stream_ops.msync).toHaveBeenCalledWith(
        stream,
        buffer,
        0,
        1024,
        0,
      );
    });

    it("should return 0 when msync not supported", () => {
      // 1. Setup stream without msync support
      const buffer = new Uint8Array(1024);
      const stream = createMockStream(fs);

      // 2. Perform msync
      const result = helpers.msync(stream, buffer, 0, 1024, 0);

      // 3. Verify default return value
      expect(result).toBe(0);
    });
  });

  describe("ioctl()", () => {
    it("should perform ioctl operation successfully", () => {
      // 1. Setup stream with ioctl support
      const stream = createMockStream(fs, { hasOps: ["ioctl"] });

      // 2. Perform ioctl
      const result = helpers.ioctl(stream, 0x5401, 123);

      // 3. Verify ioctl operation
      expect(result).toBe(0);
      expect(stream.stream_ops.ioctl).toHaveBeenCalledWith(stream, 0x5401, 123);
    });

    it("should throw ENOTTY when ioctl not supported", () => {
      // 1. Setup stream without ioctl support
      const stream = createMockStream(fs);

      // 2. Attempt ioctl and verify error
      expect(() => helpers.ioctl(stream, 0x5401, 123)).toThrow(fs.ErrnoError);
      expect(() => helpers.ioctl(stream, 0x5401, 123)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.ENOTTY }),
      );
    });
  });

  describe("cwd()", () => {
    it("should return current working directory", () => {
      // 1. Set current path
      fs.currentPath = "/home/user";

      // 2. Get current working directory
      const cwd = helpers.cwd();

      // 3. Verify result
      expect(cwd).toBe("/home/user");
    });
  });

  describe("chdir()", () => {
    it("should change directory successfully", () => {
      // 1. Setup directory node with execute permissions
      const dirNode = {
        mode: 0o40755, // Directory with execute permissions
      } as FSNode;
      mockNodes["/valid_dir"] = dirNode;

      // 2. Change directory
      helpers.chdir("/valid_dir");

      // 3. Verify current path updated
      expect(fs.currentPath).toBe("/valid_dir");
    });

    it("should throw ENOENT for non-existent path", () => {
      // 1. Attempt to change to non-existent directory
      expect(() => helpers.chdir("/nonexistent")).toThrow(fs.ErrnoError);
      expect(() => helpers.chdir("/nonexistent")).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.ENOENT }),
      );
    });

    it("should throw ENOTDIR for non-directory path", () => {
      // 1. Attempt to change to file path
      expect(() => helpers.chdir("/test.txt")).toThrow(fs.ErrnoError);
      expect(() => helpers.chdir("/test.txt")).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.ENOTDIR }),
      );
    });

    it("should throw EACCES for directory without execute permissions", () => {
      // 1. Setup directory without execute permissions
      const dirNode = {
        mode: 0o40644, // Directory without execute permissions
      } as FSNode;
      mockNodes["/no_exec_dir"] = dirNode;

      // 2. Attempt to change to directory without execute permissions
      expect(() => helpers.chdir("/no_exec_dir")).toThrow(fs.ErrnoError);
      expect(() => helpers.chdir("/no_exec_dir")).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EACCES }),
      );
    });
  });
});
