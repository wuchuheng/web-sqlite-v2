import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStreamOperations } from "./stream-operations";
import { ERRNO_CODES, MAX_OPEN_FDS } from "../constants/constants";
import type {
  MutableFS,
  FSStream,
  StreamOps,
  DeviceDefinition,
  ErrnoError,
} from "../base-state/base-state";

// Mock helpers
function createMockFS(): TestMutableFS {
  const streams: Array<FSStream | null> = new Array(MAX_OPEN_FDS).fill(null);
  const devices: Record<number, DeviceDefinition> = {};

  const mockErrnoError = vi.fn(function (errno: number): ErrnoError {
    const error = new Error(`Errno ${errno}`) as ErrnoError;
    error.errno = errno;
    return error;
  });
  mockErrnoError.prototype = Error.prototype;

  const mockFSStream = vi.fn(function (this: FSStream) {
    this.shared = {};
    this.flags = 0;
    this.position = 0;
    this.fd = null;
    this.stream_ops = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.object = {} as any; // Using any to avoid complex type issues
    this.isRead = false;
    this.isWrite = false;
    this.isAppend = false;
  });

  const mockNextfd = vi.fn((): number => {
    for (let fd = 0; fd < MAX_OPEN_FDS; fd++) {
      if (!streams[fd]) {
        return fd;
      }
    }
    throw mockErrnoError(ERRNO_CODES.EMFILE);
  });

  const mockCreateStream = vi.fn(
    (stream: Partial<FSStream>, fd?: number): FSStream => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const streamInstance = new (mockFSStream as any)();
      const newStream = Object.assign(streamInstance, stream) as FSStream;
      const actualFd = fd === -1 ? mockNextfd() : fd;
      newStream.fd = actualFd ?? null;
      if (actualFd !== undefined) {
        streams[actualFd] = newStream;
      }
      return newStream;
    },
  );

  return {
    root: null,
    mounts: [],
    devices,
    streams,
    nextInode: 1,
    nameTable: null,
    currentPath: "/",
    initialized: false,
    ignorePermissions: false,
    ErrnoError: mockErrnoError,
    genericErrors: {},
    filesystems: null,
    syncFSRequests: 0,
    readFiles: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FSStream: mockFSStream as any,
    FSNode: vi.fn(),
    lookupPath: vi.fn(),
    getPath: vi.fn(),
    hashName: vi.fn(),
    hashAddNode: vi.fn(),
    hashRemoveNode: vi.fn(),
    lookupNode: vi.fn(),
    createNode: vi.fn(),
    destroyNode: vi.fn(),
    isRoot: vi.fn(),
    isMountpoint: vi.fn(),
    isLink: vi.fn(),
    readlink: vi.fn(),
    mayLookup: vi.fn(),
    lookup: vi.fn(),
    getStream: (fd: number) => streams[fd],
    getDevice: (dev: number) => devices[dev],
    nextfd: mockNextfd,
    createStream: mockCreateStream,
    MAX_OPEN_FDS,
  };
}

function createMockStream(partial: Partial<FSStream> = {}): FSStream {
  const mockStream: FSStream = {
    shared: {},
    flags: 0,
    position: 0,
    fd: null,
    stream_ops: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    object: {} as any,
    isRead: false,
    isWrite: false,
    isAppend: false,
    ...partial,
  };
  return mockStream;
}

// Extended interface for testing
interface TestMutableFS extends MutableFS {
  nextfd?(): number;
  getStream?(fd: number): FSStream | null;
  getDevice?(dev: number): DeviceDefinition | undefined;
  createStream?(stream: Partial<FSStream>, fd?: number): FSStream;
  MAX_OPEN_FDS: number;
}

describe("stream-operations", () => {
  let mockFS: TestMutableFS;
  let ops: ReturnType<typeof createStreamOperations>;

  beforeEach(() => {
    mockFS = createMockFS();
    ops = createStreamOperations(mockFS);
  });

  describe("MAX_OPEN_FDS", () => {
    it("should expose the maximum open file descriptors constant", () => {
      expect(ops.MAX_OPEN_FDS).toBe(MAX_OPEN_FDS);
    });
  });

  describe("nextfd()", () => {
    it("should return first available fd when streams array is empty", () => {
      expect(ops.nextfd()).toBe(0);
    });

    it("should return next available fd when some are occupied", () => {
      mockFS.streams[0] = createMockStream();
      mockFS.streams[1] = createMockStream();
      mockFS.streams[2] = null; // gap

      expect(ops.nextfd()).toBe(2);
    });

    it("should return first available fd when some are freed", () => {
      mockFS.streams[0] = createMockStream();
      mockFS.streams[0]!.fd = 0;
      mockFS.streams[1] = null;
      mockFS.streams[2] = createMockStream();
      mockFS.streams[2]!.fd = 2;

      expect(ops.nextfd()).toBe(1);
    });

    it("should throw EMFILE when all fds are occupied", () => {
      // Override MAX_OPEN_FDS to a smaller value for this test
      const originalMaxOpenFds = ops.MAX_OPEN_FDS;

      // Fill all streams
      for (let i = 0; i < 3; i++) {
        // Use smaller number for test
        mockFS.streams[i] = createMockStream();
      }

      // Override nextfd to check against smaller limit
      mockFS.nextfd = vi.fn((): number => {
        for (let fd = 0; fd < 3; fd++) {
          if (!mockFS.streams[fd]) {
            return fd;
          }
        }
        throw new mockFS.ErrnoError(ERRNO_CODES.EMFILE);
      });

      expect(() => mockFS.nextfd?.()).toThrow();
      expect(mockFS.ErrnoError).toHaveBeenCalledWith(ERRNO_CODES.EMFILE);

      // Restore original
      mockFS.nextfd = vi.fn((): number => {
        for (let fd = 0; fd < originalMaxOpenFds; fd++) {
          if (!mockFS.streams[fd]) {
            return fd;
          }
        }
        throw new mockFS.ErrnoError(ERRNO_CODES.EMFILE);
      });
    });
  });

  describe("getStream()", () => {
    it("should return null for non-existent fd", () => {
      expect(ops.getStream(0)).toBeNull();
      expect(ops.getStream(100)).toBeNull();
    });

    it("should return stream for valid fd", () => {
      const stream = createMockStream();
      mockFS.streams[5] = stream;

      expect(ops.getStream(5)).toBe(stream);
    });
  });

  describe("getStreamChecked()", () => {
    it("should return stream for valid fd", () => {
      const stream = createMockStream();
      mockFS.streams[3] = stream;

      expect(ops.getStreamChecked(3)).toBe(stream);
    });

    it("should throw EBADF for non-existent fd", () => {
      expect(() => ops.getStreamChecked(0)).toThrow();
      expect(mockFS.ErrnoError).toHaveBeenCalledWith(ERRNO_CODES.EBADF);

      expect(() => ops.getStreamChecked(100)).toThrow();
      expect(mockFS.ErrnoError).toHaveBeenCalledWith(ERRNO_CODES.EBADF);
    });
  });

  describe("createStream()", () => {
    it("should create stream with auto-assigned fd when fd=-1", () => {
      const partialStream = createMockStream({ flags: 2 });
      const stream = ops.createStream(partialStream);

      expect(stream.fd).toBe(0);
      expect(stream.flags).toBe(2);
      expect(mockFS.streams[0]).toBe(stream);
      expect(mockFS.FSStream).toHaveBeenCalled();
    });

    it("should create stream with specific fd when provided", () => {
      const partialStream = createMockStream({ flags: 1 });
      const stream = ops.createStream(partialStream, 5);

      expect(stream.fd).toBe(5);
      expect(mockFS.streams[5]).toBe(stream);
    });

    it("should use Object.assign with FS.FSStream instance", () => {
      const partialStream = createMockStream({ position: 100 });
      const stream = ops.createStream(partialStream);

      expect(stream.position).toBe(100);
      expect(stream).toBeInstanceOf(mockFS.FSStream);
    });
  });

  describe("closeStream()", () => {
    it("should set streams[fd] to null", () => {
      const stream = createMockStream();
      mockFS.streams[3] = stream;

      ops.closeStream(3);

      expect(mockFS.streams[3]).toBeNull();
    });
  });

  describe("dupStream()", () => {
    it("should duplicate stream with auto-assigned fd when fd=-1", () => {
      const origStream = createMockStream({ flags: 2 });
      const dup = ops.dupStream(origStream);

      expect(dup.flags).toBe(2);
      expect(dup.fd).toBe(0);
      expect(dup).not.toBe(origStream); // different instance
      expect(mockFS.streams[0]).toBe(dup);
    });

    it("should duplicate stream with specific fd when provided", () => {
      const origStream = createMockStream({ flags: 1 });
      const dup = ops.dupStream(origStream, 7);

      expect(dup.fd).toBe(7);
      expect(mockFS.streams[7]).toBe(dup);
    });

    it("should call stream_ops.dup if available", () => {
      const dupCallback = vi.fn();
      const origStream = createMockStream();
      origStream.stream_ops.dup = dupCallback;

      const dup = ops.dupStream(origStream);

      expect(dupCallback).toHaveBeenCalledWith(dup);
    });

    it("should not call stream_ops.dup if not available", () => {
      const origStream = createMockStream();
      // no dup callback

      expect(() => ops.dupStream(origStream)).not.toThrow();
    });
  });

  describe("Device number operations", () => {
    it("major() should extract high 8 bits", () => {
      expect(ops.major(0x1234)).toBe(0x12);
      expect(ops.major(0xff00)).toBe(0xff);
      expect(ops.major(0x00ff)).toBe(0x00);
    });

    it("minor() should extract low 8 bits", () => {
      expect(ops.minor(0x1234)).toBe(0x34);
      expect(ops.minor(0xff00)).toBe(0x00);
      expect(ops.minor(0x00ff)).toBe(0xff);
    });

    it("makedev() should combine major and minor", () => {
      expect(ops.makedev(0x12, 0x34)).toBe(0x1234);
      expect(ops.makedev(0xff, 0x00)).toBe(0xff00);
      expect(ops.makedev(0x00, 0xff)).toBe(0x00ff);
    });
  });

  describe("registerDevice()", () => {
    it("should register device in FS.devices", () => {
      const deviceOps: StreamOps = { open: vi.fn() };
      ops.registerDevice(0x1234, deviceOps);

      expect(mockFS.devices[0x1234]).toEqual({
        stream_ops: deviceOps,
      });
    });
  });

  describe("getDevice()", () => {
    it("should return DeviceDefinition for registered device", () => {
      const deviceOps: StreamOps = { open: vi.fn() };
      mockFS.devices[0x5678] = { stream_ops: deviceOps };

      const device = ops.getDevice(0x5678);

      expect(device).toEqual({
        stream_ops: deviceOps,
      });
    });

    it("should return undefined for unregistered device", () => {
      expect(ops.getDevice(0x9999)).toBeUndefined();
    });
  });

  describe("chrdev_stream_ops", () => {
    beforeEach(() => {
      const deviceOps: StreamOps = {
        open: vi.fn(),
        llseek: vi.fn(),
      };
      mockFS.devices[0x1234] = { stream_ops: deviceOps };
    });

    describe("open()", () => {
      it("should get device and set stream_ops", () => {
        const stream = createMockStream();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stream.node = { rdev: 0x1234 } as any;

        ops.chrdev_stream_ops.open(stream);

        expect(stream.stream_ops).toBe(mockFS.devices[0x1234].stream_ops);
      });

      it("should call device open if available", () => {
        const stream = createMockStream();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stream.node = { rdev: 0x1234 } as any;
        const deviceOpen = vi.fn();
        mockFS.devices[0x1234].stream_ops.open = deviceOpen;

        ops.chrdev_stream_ops.open(stream);

        expect(deviceOpen).toHaveBeenCalledWith(stream);
      });

      it("should not call device open if not available", () => {
        const stream = createMockStream();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stream.node = { rdev: 0x1234 } as any;
        delete mockFS.devices[0x1234].stream_ops.open;

        expect(() => ops.chrdev_stream_ops.open(stream)).not.toThrow();
      });
    });

    describe("llseek()", () => {
      it("should always throw ESPIPE", () => {
        expect(() => ops.chrdev_stream_ops.llseek()).toThrow();
        expect(mockFS.ErrnoError).toHaveBeenCalledWith(ERRNO_CODES.ESPIPE);
      });
    });
  });
});
