/**
 * Unit tests for node-metadata-operations.ts
 * Tests the metadata operations implementation after TypeScript migration
 */

import { describe, test, expect, vi, beforeEach, type Mock } from "vitest";
import { createMetadataOperations } from "./node-metadata-operations";
import { ERRNO_CODES, MODE, OPEN_FLAGS } from "../constants/constants";
import type {
  FSNode,
  FSStream,
  FSStats,
  FileSystemMount,
  FSStreamShared,
  MutableFS,
} from "../base-state/base-state";
import type { NodeActionsOptions } from "../node-actions";
import type { ErrnoError } from "../base-state/base-state";

// Helper to create a mock filesystem mount
function createMockMount(): FileSystemMount {
  return {
    type: {
      mount: vi.fn(),
      syncfs: vi.fn(),
    },
    opts: {},
    mountpoint: "/test",
    mounts: [],
    root: null as unknown as FSNode,
  };
}

// Helper to create a mock FS node
function createMockNode(overrides: Partial<FSNode> = {}): FSNode {
  const mount = createMockMount();
  const node = {
    parent: null as unknown as FSNode,
    mount,
    mounted: null,
    id: null,
    name: "test-node",
    mode: MODE.FILE | MODE.DEFAULT_FILE_PERMISSIONS,
    node_ops: {},
    stream_ops: {},
    rdev: 0,
    readMode: MODE.PERMISSION_READ,
    writeMode: MODE.PERMISSION_WRITE,
    assignId: vi.fn(),
    read: true,
    write: true,
    isFolder: false,
    isDevice: false,
    name_next: null,
    ...overrides,
  };
  mount.root = node;
  return node;
}

// Helper to create a mock FS stream
function createMockStream(overrides: Partial<FSStream> = {}): FSStream {
  return {
    shared: {} as FSStreamShared,
    node: createMockNode(),
    object: createMockNode(),
    flags: OPEN_FLAGS.O_RDONLY,
    position: 0,
    fd: 1,
    seekable: true,
    stream_ops: {},
    ungotten: [],
    error: false,
    isRead: true,
    isWrite: true,
    isAppend: false,
    getdents: null,
    ...overrides,
  };
}

// Helper to create mock stats
function createMockStats(overrides: Partial<FSStats> = {}): FSStats {
  return {
    size: 1024,
    mode: MODE.FILE | MODE.DEFAULT_FILE_PERMISSIONS,
    timestamp: Date.now() / 1000,
    ...overrides,
  };
}

// Define a mocked version of FS for testing
type MockFS = {
  lookupPath: Mock;
  getStreamChecked: Mock;
  isDir: Mock;
  isFile: Mock;
  isChrdev: Mock;
  nodePermissions: Mock;
  mayOpen: Mock;
  mknod: Mock;
  truncate: Mock;
  createStream: Mock;
  getPath: Mock;
  readFiles: Record<string, number>;
  ErrnoError: new (errno: number) => ErrnoError;
  stat: Mock;
  chmod: Mock;
  chown: Mock;
} & MutableFS;

// Helper to create mock FS
function createMockFS(): MockFS {
  const mockFS = {
    lookupPath: vi.fn(),
    getStreamChecked: vi.fn(),
    isDir: vi.fn(),
    isFile: vi.fn(),
    isChrdev: vi.fn(),
    nodePermissions: vi.fn(),
    mayOpen: vi.fn(),
    mknod: vi.fn(),
    truncate: vi.fn(),
    createStream: vi.fn(),
    getPath: vi.fn(),
    readFiles: {},
    ErrnoError: class extends Error {
      errno: number;
      constructor(errno: number) {
        super(`Mock error ${errno}`);
        this.errno = errno;
        this.name = "ErrnoError";
      }
    },
    stat: vi.fn(),
    chmod: vi.fn(),
    chown: vi.fn(),
  } as unknown as MockFS;

  // Configure default behavior for self-referential calls
  mockFS.stat.mockImplementation((path: string, dontFollow?: boolean) => {
    const lookup = mockFS.lookupPath(path, { follow: !dontFollow });
    const node = lookup.node;
    if (!node) {
      throw new mockFS.ErrnoError(ERRNO_CODES.ENOENT);
    }
    if (!node.node_ops.getattr) {
      throw new mockFS.ErrnoError(ERRNO_CODES.EPERM);
    }
    return node.node_ops.getattr(node);
  });

  mockFS.chmod.mockImplementation(
    (path: string | FSNode, mode: number, dontFollow?: boolean) => {
      let node: FSNode;
      if (typeof path === "string") {
        const lookup = mockFS.lookupPath(path, { follow: !dontFollow });
        node = lookup.node;
      } else {
        node = path;
      }
      if (!node.node_ops.setattr) {
        throw new mockFS.ErrnoError(ERRNO_CODES.EPERM);
      }
      node.node_ops.setattr(node, {
        mode:
          (mode & MODE.PERMISSION_MASK) | (node.mode & ~MODE.PERMISSION_MASK),
        timestamp: Date.now(),
      });
    },
  );

  mockFS.chown.mockImplementation(
    (
      path: string | FSNode,
      _uid: number,
      _gid: number,
      dontFollow?: boolean,
    ) => {
      let node: FSNode;
      if (typeof path === "string") {
        const lookup = mockFS.lookupPath(path, { follow: !dontFollow });
        node = lookup.node;
      } else {
        node = path;
      }
      if (!node.node_ops.setattr) {
        throw new mockFS.ErrnoError(ERRNO_CODES.EPERM);
      }
      node.node_ops.setattr(node, {
        timestamp: Date.now(),
      });
    },
  );

  return mockFS;
}

// Helper to create mock options
function createMockOptions(): NodeActionsOptions {
  return {
    FS_modeStringToFlags: vi.fn((mode: string) => {
      if (mode === "r") return OPEN_FLAGS.O_RDONLY;
      if (mode === "w") return OPEN_FLAGS.O_WRONLY | OPEN_FLAGS.O_CREAT;
      if (mode === "rw") return OPEN_FLAGS.O_RDWR;
      return OPEN_FLAGS.O_RDONLY;
    }),
    getPathFS: vi.fn(),
    Module: {
      logReadFiles: false,
    },
  };
}

describe("node-metadata-operations", () => {
  let mockFS: MockFS;
  let mockOptions: NodeActionsOptions;
  let metadataOps: ReturnType<typeof createMetadataOperations>;

  beforeEach(() => {
    mockFS = createMockFS();
    mockOptions = createMockOptions();
    metadataOps = createMetadataOperations(mockFS, mockOptions);
  });

  describe("stat operation", () => {
    test("should return stats for existing file", () => {
      // 1. Setup mock data
      const mockNode = createMockNode();
      const mockStats = createMockStats();
      mockNode.node_ops.getattr = vi.fn().mockReturnValue(mockStats);
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      // 2. Execute operation
      const result = metadataOps.stat("/test/file.txt");

      // 3. Verify results
      expect(result).toBe(mockStats);
      expect(mockFS.lookupPath).toHaveBeenCalledWith("/test/file.txt", {
        follow: true,
      });
      expect(mockNode.node_ops.getattr).toHaveBeenCalledWith(mockNode);
    });

    test("should follow symlinks by default", () => {
      const mockNode = createMockNode();
      const mockStats = createMockStats();
      mockNode.node_ops.getattr = vi.fn().mockReturnValue(mockStats);
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      metadataOps.stat("/test/file.txt");

      expect(mockFS.lookupPath).toHaveBeenCalledWith("/test/file.txt", {
        follow: true,
      });
    });

    test("should not follow symlinks when dontFollow is true", () => {
      const mockNode = createMockNode();
      const mockStats = createMockStats();
      mockNode.node_ops.getattr = vi.fn().mockReturnValue(mockStats);
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      metadataOps.stat("/test/file.txt", true);

      expect(mockFS.lookupPath).toHaveBeenCalledWith("/test/file.txt", {
        follow: false,
      });
    });

    test("should throw ENOENT for non-existent file", () => {
      const error = new mockFS.ErrnoError(ERRNO_CODES.ENOENT);
      mockFS.lookupPath.mockImplementation(() => {
        throw error;
      });

      expect(() => metadataOps.stat("/test/nonexistent.txt")).toThrow(error);
    });

    test("should throw EPERM when node lacks getattr operation", () => {
      const mockNode = createMockNode();
      // Intentionally not setting getattr operation
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      expect(() => metadataOps.stat("/test/file.txt")).toThrow("Mock error 63"); // EPERM
    });
  });

  describe("lstat operation", () => {
    test("should call stat with dontFollow=true", () => {
      const mockNode = createMockNode();
      const mockStats = createMockStats();
      mockNode.node_ops.getattr = vi.fn().mockReturnValue(mockStats);
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      const result = metadataOps.lstat("/test/file.txt");

      expect(result).toBe(mockStats);
      expect(mockFS.lookupPath).toHaveBeenCalledWith("/test/file.txt", {
        follow: false,
      });
    });
  });

  describe("chmod operations", () => {
    test("should change file permissions using path", () => {
      const mockNode = createMockNode();
      const originalMode = mockNode.mode;
      const newMode = 0o644;
      mockNode.node_ops.setattr = vi.fn();
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      metadataOps.chmod("/test/file.txt", newMode);

      expect(mockFS.lookupPath).toHaveBeenCalledWith("/test/file.txt", {
        follow: true,
      });
      expect(mockNode.node_ops.setattr).toHaveBeenCalledWith(mockNode, {
        mode:
          (newMode & MODE.PERMISSION_MASK) |
          (originalMode & ~MODE.PERMISSION_MASK),
        timestamp: expect.any(Number),
      });
    });

    test("should change file permissions using node object", () => {
      const mockNode = createMockNode();
      const originalMode = mockNode.mode;
      const newMode = 0o755;
      mockNode.node_ops.setattr = vi.fn();

      metadataOps.chmod(mockNode, newMode);

      expect(mockFS.lookupPath).not.toHaveBeenCalled();
      expect(mockNode.node_ops.setattr).toHaveBeenCalledWith(mockNode, {
        mode:
          (newMode & MODE.PERMISSION_MASK) |
          (originalMode & ~MODE.PERMISSION_MASK),
        timestamp: expect.any(Number),
      });
    });

    test("should not follow symlinks when dontFollow is true", () => {
      const mockNode = createMockNode();
      mockNode.node_ops.setattr = vi.fn();
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      metadataOps.chmod("/test/file.txt", 0o644, true);

      expect(mockFS.lookupPath).toHaveBeenCalledWith("/test/file.txt", {
        follow: false,
      });
    });

    test("should throw EPERM when node lacks setattr operation", () => {
      const mockNode = createMockNode();
      // Intentionally not setting setattr operation
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      expect(() => metadataOps.chmod("/test/file.txt", 0o644)).toThrow(
        "Mock error 63",
      ); // EPERM
    });
  });

  describe("lchmod operation", () => {
    test("should call chmod with dontFollow=true", () => {
      const mockNode = createMockNode();
      const originalMode = mockNode.mode;
      const newMode = 0o644;
      mockNode.node_ops.setattr = vi.fn();
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      metadataOps.lchmod("/test/file.txt", newMode);

      expect(mockFS.lookupPath).toHaveBeenCalledWith("/test/file.txt", {
        follow: false,
      });
      expect(mockNode.node_ops.setattr).toHaveBeenCalledWith(mockNode, {
        mode:
          (newMode & MODE.PERMISSION_MASK) |
          (originalMode & ~MODE.PERMISSION_MASK),
        timestamp: expect.any(Number),
      });
    });
  });

  describe("fchmod operation", () => {
    test("should change permissions using file descriptor", () => {
      const mockNode = createMockNode();
      const mockStream = createMockStream({ node: mockNode });
      const originalMode = mockNode.mode;
      const newMode = 0o644;
      mockNode.node_ops.setattr = vi.fn();
      mockFS.getStreamChecked.mockReturnValue(mockStream);

      metadataOps.fchmod(1, newMode);

      expect(mockFS.getStreamChecked).toHaveBeenCalledWith(1);
      expect(mockNode.node_ops.setattr).toHaveBeenCalledWith(mockNode, {
        mode:
          (newMode & MODE.PERMISSION_MASK) |
          (originalMode & ~MODE.PERMISSION_MASK),
        timestamp: expect.any(Number),
      });
    });
  });

  describe("chown operations", () => {
    test("should change ownership using path", () => {
      const mockNode = createMockNode();
      mockNode.node_ops.setattr = vi.fn();
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      metadataOps.chown("/test/file.txt", 1000, 1000);

      expect(mockFS.lookupPath).toHaveBeenCalledWith("/test/file.txt", {
        follow: true,
      });
      expect(mockNode.node_ops.setattr).toHaveBeenCalledWith(mockNode, {
        timestamp: expect.any(Number),
      });
    });

    test("should change ownership using node object", () => {
      const mockNode = createMockNode();
      mockNode.node_ops.setattr = vi.fn();

      metadataOps.chown(mockNode, 1000, 1000);

      expect(mockFS.lookupPath).not.toHaveBeenCalled();
      expect(mockNode.node_ops.setattr).toHaveBeenCalledWith(mockNode, {
        timestamp: expect.any(Number),
      });
    });

    test("should throw EPERM when node lacks setattr operation", () => {
      const mockNode = createMockNode();
      // Intentionally not setting setattr operation
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      expect(() => metadataOps.chown("/test/file.txt", 1000, 1000)).toThrow(
        "Mock error 63",
      ); // EPERM
    });
  });

  describe("lchown operation", () => {
    test("should call chown with dontFollow=true", () => {
      const mockNode = createMockNode();
      mockNode.node_ops.setattr = vi.fn();
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      metadataOps.lchown("/test/file.txt", 1000, 1000);

      expect(mockFS.lookupPath).toHaveBeenCalledWith("/test/file.txt", {
        follow: false,
      });
      expect(mockNode.node_ops.setattr).toHaveBeenCalledWith(mockNode, {
        timestamp: expect.any(Number),
      });
    });
  });

  describe("fchown operation", () => {
    test("should change ownership using file descriptor", () => {
      const mockNode = createMockNode();
      const mockStream = createMockStream({ node: mockNode });
      mockNode.node_ops.setattr = vi.fn();
      mockFS.getStreamChecked.mockReturnValue(mockStream);

      metadataOps.fchown(1, 1000, 1000);

      expect(mockFS.getStreamChecked).toHaveBeenCalledWith(1);
      expect(mockNode.node_ops.setattr).toHaveBeenCalledWith(mockNode, {
        timestamp: expect.any(Number),
      });
    });
  });

  describe("truncate operations", () => {
    test("should truncate file to specified length using path", () => {
      const mockNode = createMockNode();
      mockNode.node_ops.setattr = vi.fn();
      mockFS.lookupPath.mockReturnValue({ node: mockNode });
      mockFS.isFile.mockReturnValue(true);
      mockFS.nodePermissions.mockReturnValue(0);

      metadataOps.truncate("/test/file.txt", 512);

      expect(mockFS.lookupPath).toHaveBeenCalledWith("/test/file.txt", {
        follow: true,
      });
      expect(mockFS.isFile).toHaveBeenCalledWith(mockNode.mode);
      expect(mockFS.nodePermissions).toHaveBeenCalledWith(mockNode, "w");
      expect(mockNode.node_ops.setattr).toHaveBeenCalledWith(mockNode, {
        size: 512,
        timestamp: expect.any(Number),
      });
    });

    test("should truncate file to specified length using node object", () => {
      const mockNode = createMockNode();
      mockNode.node_ops.setattr = vi.fn();
      mockFS.isFile.mockReturnValue(true);
      mockFS.nodePermissions.mockReturnValue(0);

      metadataOps.truncate(mockNode, 256);

      expect(mockFS.lookupPath).not.toHaveBeenCalled();
      expect(mockNode.node_ops.setattr).toHaveBeenCalledWith(mockNode, {
        size: 256,
        timestamp: expect.any(Number),
      });
    });

    test("should throw EINVAL for negative length", () => {
      expect(() => metadataOps.truncate("/test/file.txt", -1)).toThrow(
        "Mock error 28",
      ); // EINVAL
    });

    test("should throw EPERM when node lacks setattr operation", () => {
      const mockNode = createMockNode();
      // Intentionally not setting setattr operation
      mockFS.lookupPath.mockReturnValue({ node: mockNode });
      mockFS.isFile.mockReturnValue(true);
      mockFS.nodePermissions.mockReturnValue(0);

      expect(() => metadataOps.truncate("/test/file.txt", 512)).toThrow(
        "Mock error 63",
      ); // EPERM
    });

    test("should throw EISDIR when trying to truncate directory", () => {
      const mockNode = createMockNode();
      mockNode.node_ops.setattr = vi.fn();
      mockFS.lookupPath.mockReturnValue({ node: mockNode });
      mockFS.isDir.mockReturnValue(true);
      mockFS.nodePermissions.mockReturnValue(0);

      expect(() => metadataOps.truncate("/test/dir", 512)).toThrow(
        "Mock error 31",
      ); // EISDIR
    });

    test("should throw EINVAL for non-regular files", () => {
      const mockNode = createMockNode();
      mockNode.node_ops.setattr = vi.fn();
      mockFS.lookupPath.mockReturnValue({ node: mockNode });
      mockFS.isDir.mockReturnValue(false);
      mockFS.isFile.mockReturnValue(false); // Not a regular file either
      mockFS.nodePermissions.mockReturnValue(0);

      expect(() => metadataOps.truncate("/test/special", 512)).toThrow(
        "Mock error 28",
      ); // EINVAL
    });
  });

  describe("ftruncate operation", () => {
    test("should truncate file using file descriptor", () => {
      const mockNode = createMockNode();
      const mockStream = createMockStream({
        node: mockNode,
        flags: OPEN_FLAGS.O_WRONLY,
      });
      mockFS.getStreamChecked.mockReturnValue(mockStream);
      // Need to mock truncate call since ftruncate calls FS.truncate internally
      mockFS.truncate = vi.fn();

      metadataOps.ftruncate(1, 512);

      expect(mockFS.getStreamChecked).toHaveBeenCalledWith(1);
      expect(mockFS.truncate).toHaveBeenCalledWith(mockNode, 512);
    });

    test("should throw EINVAL for read-only file descriptor", () => {
      const mockStream = createMockStream({ flags: OPEN_FLAGS.O_RDONLY });
      mockFS.getStreamChecked.mockReturnValue(mockStream);

      expect(() => metadataOps.ftruncate(1, 512)).toThrow("Mock error 28"); // EINVAL
    });
  });

  describe("utime operation", () => {
    test("should update file timestamps", () => {
      const mockNode = createMockNode();
      const atime = 1609459200; // 2021-01-01
      const mtime = 1609545600; // 2021-01-02
      const expectedTime = Math.max(atime, mtime);
      mockNode.node_ops.setattr = vi.fn();
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      metadataOps.utime("/test/file.txt", atime, mtime);

      expect(mockFS.lookupPath).toHaveBeenCalledWith("/test/file.txt", {
        follow: true,
      });
      expect(mockNode.node_ops.setattr).toHaveBeenCalledWith(mockNode, {
        timestamp: expectedTime,
      });
    });
  });

  describe("open operation", () => {
    test("should throw ENOENT for empty path", () => {
      expect(() => metadataOps.open("", OPEN_FLAGS.O_RDONLY)).toThrow(
        "Mock error 44",
      ); // ENOENT
    });

    test("should convert string flags to numeric", () => {
      const mockNode = createMockNode();
      mockNode.node_ops.getattr = vi.fn().mockReturnValue(createMockStats());
      mockFS.lookupPath.mockReturnValue({ node: mockNode });
      mockFS.isFile.mockReturnValue(true);
      mockFS.isChrdev.mockReturnValue(false);
      mockFS.mayOpen.mockReturnValue(0);

      const mockStream = createMockStream({ node: mockNode });
      mockFS.createStream.mockReturnValue(mockStream);
      mockFS.getPath.mockReturnValue("/test/file.txt");

      metadataOps.open("/test/file.txt", "r");

      expect(mockOptions.FS_modeStringToFlags).toHaveBeenCalledWith("r");
    });

    test("should create new file with O_CREAT flag", () => {
      const mockNode = createMockNode();
      mockNode.node_ops.getattr = vi.fn().mockReturnValue(createMockStats());
      mockFS.mknod.mockReturnValue(mockNode);
      mockFS.isFile.mockReturnValue(true);
      mockFS.isChrdev.mockReturnValue(false);
      mockFS.mayOpen.mockReturnValue(0);
      mockFS.getPath.mockReturnValue("/test/file.txt");

      const mockStream = createMockStream({ node: mockNode });
      mockFS.createStream.mockReturnValue(mockStream);

      metadataOps.open(
        "/test/newfile.txt",
        OPEN_FLAGS.O_CREAT | OPEN_FLAGS.O_WRONLY,
      );

      expect(mockFS.mknod).toHaveBeenCalledWith(
        "/test/newfile.txt",
        MODE.FILE | MODE.DEFAULT_FILE_PERMISSIONS,
        0,
      );
    });

    test("should use provided mode with O_CREAT flag", () => {
      const mockNode = createMockNode();
      mockNode.node_ops.getattr = vi.fn().mockReturnValue(createMockStats());
      mockFS.mknod.mockReturnValue(mockNode);
      mockFS.isFile.mockReturnValue(true);
      mockFS.isChrdev.mockReturnValue(false);
      mockFS.mayOpen.mockReturnValue(0);
      mockFS.getPath.mockReturnValue("/test/newfile.txt");

      const mockStream = createMockStream({ node: mockNode });
      mockFS.createStream.mockReturnValue(mockStream);

      const customMode = 0o755;
      metadataOps.open(
        "/test/newfile.txt",
        OPEN_FLAGS.O_CREAT | OPEN_FLAGS.O_WRONLY,
        customMode,
      );

      expect(mockFS.mknod).toHaveBeenCalledWith(
        "/test/newfile.txt",
        (customMode & MODE.PERMISSION_MASK) | MODE.FILE,
        0,
      );
    });

    test("should throw EEXIST when O_EXCL and file exists", () => {
      const mockNode = createMockNode();
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      expect(() =>
        metadataOps.open(
          "/test/existing.txt",
          OPEN_FLAGS.O_CREAT | OPEN_FLAGS.O_EXCL,
        ),
      ).toThrow("Mock error 20"); // EEXIST
    });

    test("should throw ENOTDIR when O_DIRECTORY on non-directory", () => {
      const mockNode = createMockNode();
      mockNode.node_ops.getattr = vi.fn().mockReturnValue(createMockStats());
      mockFS.lookupPath.mockReturnValue({ node: mockNode });
      mockFS.isDir.mockReturnValue(false);

      expect(() =>
        metadataOps.open("/test/file.txt", OPEN_FLAGS.O_DIRECTORY),
      ).toThrow("Mock error 54"); // ENOTDIR
    });

    test("should create stream with correct properties", () => {
      const mockNode = createMockNode();
      mockNode.node_ops.getattr = vi.fn().mockReturnValue(createMockStats());
      mockFS.lookupPath.mockReturnValue({ node: mockNode });
      mockFS.isFile.mockReturnValue(true);
      mockFS.isChrdev.mockReturnValue(false);
      mockFS.mayOpen.mockReturnValue(0);
      mockFS.getPath.mockReturnValue("/test/file.txt");

      const mockStream = createMockStream();
      mockFS.createStream.mockReturnValue(mockStream);

      const flags = OPEN_FLAGS.O_RDONLY;
      metadataOps.open("/test/file.txt", flags);

      expect(mockFS.createStream).toHaveBeenCalledWith({
        node: mockNode,
        path: "/test/file.txt",
        flags:
          flags &
          ~(OPEN_FLAGS.O_EXCL | OPEN_FLAGS.O_TRUNC | OPEN_FLAGS.O_NOFOLLOW),
        seekable: true,
        position: 0,
        stream_ops: mockNode.stream_ops,
        ungotten: [],
        error: false,
      });
    });

    test("should log read files when enabled", () => {
      mockOptions.Module.logReadFiles = true;
      const mockNode = createMockNode();
      mockNode.node_ops.getattr = vi.fn().mockReturnValue(createMockStats());
      mockFS.lookupPath.mockReturnValue({ node: mockNode });
      mockFS.isFile.mockReturnValue(true);
      mockFS.isChrdev.mockReturnValue(false);
      mockFS.mayOpen.mockReturnValue(0);
      mockFS.getPath.mockReturnValue("/test/file.txt");

      const mockStream = createMockStream();
      mockFS.createStream.mockReturnValue(mockStream);

      metadataOps.open("/test/file.txt", OPEN_FLAGS.O_RDONLY);

      expect(mockFS.readFiles).toHaveProperty("/test/file.txt", 1);
    });

    test("should not log write-only files", () => {
      mockOptions.Module.logReadFiles = true;
      const mockNode = createMockNode();
      mockNode.node_ops.getattr = vi.fn().mockReturnValue(createMockStats());
      mockFS.lookupPath.mockReturnValue({ node: mockNode });
      mockFS.isFile.mockReturnValue(true);
      mockFS.isChrdev.mockReturnValue(false);
      mockFS.mayOpen.mockReturnValue(0);
      mockFS.getPath.mockReturnValue("/test/file.txt");

      const mockStream = createMockStream();
      mockFS.createStream.mockReturnValue(mockStream);

      metadataOps.open("/test/file.txt", OPEN_FLAGS.O_WRONLY);

      expect(mockFS.readFiles).not.toHaveProperty("/test/file.txt");
    });
  });

  describe("integration tests", () => {
    test("should handle complex file workflow", () => {
      // Create a new file, stat it, chmod it, truncate it, then open it
      const mockNode = createMockNode();
      mockNode.node_ops.getattr = vi.fn().mockReturnValue(createMockStats());
      mockNode.node_ops.setattr = vi.fn();
      mockFS.mknod.mockReturnValue(mockNode);
      mockFS.isFile.mockReturnValue(true);
      mockFS.isChrdev.mockReturnValue(false);
      mockFS.nodePermissions.mockReturnValue(0);
      mockFS.mayOpen.mockReturnValue(0);
      mockFS.getPath.mockReturnValue("/test/workflow.txt");

      // Important: Set up lookupPath to return the proper structure
      mockFS.lookupPath.mockReturnValue({ node: mockNode });

      const mockStream = createMockStream({ node: mockNode });
      mockFS.createStream.mockReturnValue(mockStream);

      // 1. Create and open file
      const stream = metadataOps.open(
        "/test/workflow.txt",
        OPEN_FLAGS.O_CREAT | OPEN_FLAGS.O_RDWR,
      );
      expect(stream).toBe(mockStream);

      // 2. Check file stats
      const stats = metadataOps.stat("/test/workflow.txt");
      expect(stats).toBeDefined();

      // 3. Change permissions
      metadataOps.chmod("/test/workflow.txt", 0o644);
      expect(mockNode.node_ops.setattr).toHaveBeenCalled();

      // 4. Truncate file
      metadataOps.truncate("/test/workflow.txt", 1024);
      expect(mockNode.node_ops.setattr).toHaveBeenCalledWith(
        mockNode,
        expect.objectContaining({ size: 1024 }),
      );
    });
  });
});
