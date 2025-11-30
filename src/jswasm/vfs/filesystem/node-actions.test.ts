/**
 * Tests for node-actions.mjs
 *
 * These tests validate high-level filesystem node operations like file creation,
 * directory manipulation, symlinks, and file metadata operations.
 * Tests ensure the NodeActions facade correctly delegates to the underlying FS
 * and proper error handling.
 */

import { describe, test, expect, vi, beforeEach, type Mock } from "vitest";
import { createNodeActions } from "./node-actions";
import type { NodeActions } from "./node-actions";
import { ERRNO_CODES, MODE, OPEN_FLAGS } from "./constants/constants";
import type {
  FSNode,
  FSStream,
  FSStats,
  FileSystemMount,
  FSStreamShared,
} from "./base-state/base-state";
import type { NodeActionsOptions } from "./node-actions";
import type { ErrnoError } from "./base-state/base-state";

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
  // Set the mount root to the node itself
  mount.root = node;
  return node;
}

// Helper to create a mock FS stream
function createMockStream(overrides: Partial<FSStream> = {}): FSStream {
  return {
    shared: {} as FSStreamShared, // Required field for FSStream type
    node: createMockNode(),
    object: createMockNode(), // Required field for FSStream type
    flags: OPEN_FLAGS.O_RDONLY,
    position: 0,
    fd: null, // Required field for FSStream type
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

// Define a mocked version of FS for testing
type MockFS = {
  mknod: Mock;
  mkdir: Mock;
  lookupPath: Mock;
  mayCreate: Mock;
  lookupNode: Mock;
  mayDelete: Mock;
  mayOpen: Mock;
  isDir: Mock;
  isFile: Mock;
  isChrdev: Mock;
  isMountpoint: Mock;
  nodePermissions: Mock;
  destroyNode: Mock;
  getPath: Mock;
  createStream: Mock;
  getStreamChecked: Mock;
  stat: Mock;
  hashRemoveNode: Mock;
  hashAddNode: Mock;
  truncate: Mock;
  chmod: Mock;
  chown: Mock;
  ErrnoError: new (errno: number) => ErrnoError;
};

// Helper to create a mock FS object
function createMockFS(overrides: Record<string, unknown> = {}): MockFS {
  return {
    mknod: vi.fn().mockReturnValue(createMockNode()),
    mkdir: vi.fn().mockReturnValue(createMockNode()),
    lookupPath: vi.fn().mockReturnValue({ node: createMockNode() }),
    mayCreate: vi.fn().mockReturnValue(0),
    lookupNode: vi.fn().mockReturnValue(createMockNode()),
    mayDelete: vi.fn().mockReturnValue(0),
    mayOpen: vi.fn().mockReturnValue(0),
    isDir: vi.fn().mockReturnValue(false),
    isFile: vi.fn().mockReturnValue(true),
    isChrdev: vi.fn().mockReturnValue(false),
    isMountpoint: vi.fn().mockReturnValue(false),
    nodePermissions: vi.fn().mockReturnValue(0),
    destroyNode: vi.fn(),
    getPath: vi.fn().mockReturnValue("/test"),
    createStream: vi.fn().mockReturnValue(createMockStream()),
    getStreamChecked: vi.fn().mockReturnValue(createMockStream()),
    stat: vi.fn().mockReturnValue({ mode: MODE.FILE } as FSStats),
    hashRemoveNode: vi.fn(),
    hashAddNode: vi.fn(),
    truncate: vi.fn(),
    chmod: vi.fn(),
    chown: vi.fn(),
    ErrnoError: class ErrnoError extends Error {
      errno: number;
      constructor(errno: number) {
        super(`Error ${errno}`);
        this.name = "ErrnoError";
        this.errno = errno;
      }
    },
    ...overrides,
  } as unknown as MockFS;
}

describe("Node Actions", () => {
  let mockFS: MockFS;
  let nodeActions: NodeActions;
  let mockPathFS: { resolve: Mock; relative: Mock };
  let mockOptions: NodeActionsOptions;

  beforeEach(() => {
    mockPathFS = {
      resolve: vi.fn().mockReturnValue("/resolved/path"),
      relative: vi.fn().mockReturnValue("./relative/path"),
    };

    mockFS = createMockFS();
    mockOptions = {
      FS_modeStringToFlags: vi.fn().mockReturnValue(OPEN_FLAGS.O_RDONLY),
      getPathFS: () => mockPathFS,
      Module: { logReadFiles: false },
    };
    nodeActions = createNodeActions(mockFS, mockOptions);
  });

  describe("File Creation Operations", () => {
    test("create creates file with default permissions", () => {
      const mockNode = createMockNode();
      mockFS.mknod.mockReturnValue(mockNode);

      const result = nodeActions.create("/test-file");

      expect(mockFS.mknod).toHaveBeenCalledWith(
        "/test-file",
        MODE.DEFAULT_FILE_PERMISSIONS | MODE.FILE,
        0,
      );
      expect(result).toBe(mockNode);
    });

    test("create creates file with custom permissions", () => {
      const mockNode = createMockNode();
      mockFS.mknod.mockReturnValue(mockNode);

      nodeActions.create("/test-file", 0o750);

      expect(mockFS.mknod).toHaveBeenCalledWith(
        "/test-file",
        (0o750 & MODE.PERMISSION_MASK) | MODE.FILE,
        0,
      );
    });

    test("mkdir creates directory with default permissions", () => {
      const mockNode = createMockNode({ mode: MODE.DIRECTORY });
      mockFS.mknod.mockReturnValue(mockNode);

      const result = nodeActions.mkdir("/test-dir");

      expect(mockFS.mknod).toHaveBeenCalledWith(
        "/test-dir",
        MODE.DEFAULT_DIRECTORY_PERMISSIONS | MODE.DIRECTORY,
        0,
      );
      expect(result).toBe(mockNode);
    });

    test("mkdirTree creates directory hierarchy", () => {
      const mockNode = createMockNode({ mode: MODE.DIRECTORY });
      mockFS.mkdir.mockReturnValue(mockNode);

      nodeActions.mkdirTree("/path/to/nested/dir", 0o755);

      expect(mockFS.mkdir).toHaveBeenCalledWith("/path", 0o755);
      expect(mockFS.mkdir).toHaveBeenCalledWith("/path/to", 0o755);
      expect(mockFS.mkdir).toHaveBeenCalledWith("/path/to/nested", 0o755);
      expect(mockFS.mkdir).toHaveBeenCalledWith("/path/to/nested/dir", 0o755);
    });

    test("mkdirTree handles existing directories gracefully", () => {
      mockFS.mkdir.mockImplementation(() => {
        throw { errno: ERRNO_CODES.EEXIST };
      });

      expect(() => nodeActions.mkdirTree("/existing/path")).not.toThrow();
    });

    test("mkdev creates character device", () => {
      const mockNode = createMockNode({ mode: MODE.CHARACTER_DEVICE });
      mockFS.mknod.mockReturnValue(mockNode);

      const result = nodeActions.mkdev("/test-dev", 0o666, 123);

      expect(mockFS.mknod).toHaveBeenCalledWith(
        "/test-dev",
        MODE.DEFAULT_FILE_PERMISSIONS | MODE.CHARACTER_DEVICE,
        123,
      );
      expect(result).toBe(mockNode);
    });
  });

  describe("Status Operations", () => {
    test("stat returns file status with following symlinks", () => {
      const node = createMockNode();
      const stats = { mode: MODE.FILE, size: 1024 } as FSStats;

      mockFS.lookupPath.mockReturnValue({ node });
      const mockGetattrOp = vi.fn().mockReturnValue(stats);
      node.node_ops.getattr = mockGetattrOp;

      const result = nodeActions.stat("/test-file");

      expect(mockFS.lookupPath).toHaveBeenCalledWith("/test-file", {
        follow: true,
      });
      expect(mockGetattrOp).toHaveBeenCalledWith(node);
      expect(result).toBe(stats);
    });

    test("lstat returns file status without following symlinks", () => {
      const node = createMockNode();
      const stats = { mode: MODE.FILE } as FSStats;

      mockFS.lookupPath.mockReturnValue({ node });
      mockFS.stat.mockReturnValue(stats);

      const result = nodeActions.lstat("/test-file");

      expect(mockFS.stat).toHaveBeenCalledWith("/test-file", true);
      expect(result).toBe(stats);
    });
  });

  describe("Permission Operations", () => {
    test("chmod changes file mode", () => {
      const node = createMockNode();

      mockFS.lookupPath.mockReturnValue({ node });
      const mockSetattrOp = vi.fn();
      node.node_ops.setattr = mockSetattrOp;

      nodeActions.chmod("/test-file", 0o644);

      expect(mockSetattrOp).toHaveBeenCalledWith(node, {
        mode:
          (0o644 & MODE.PERMISSION_MASK) | (MODE.FILE & ~MODE.PERMISSION_MASK),
        timestamp: expect.any(Number),
      });
    });

    test("fchmod changes file mode via file descriptor", () => {
      const stream = createMockStream();
      const mockSetattrOp = vi.fn();
      if (stream.node) {
        stream.node.node_ops.setattr = mockSetattrOp;
      }

      mockFS.getStreamChecked.mockReturnValue(stream);
      // Mock the internal chmod call that fchmod makes
      mockFS.chmod.mockImplementation((node, mode) => {
        // Simulate the actual chmod implementation
        if (node && node.node_ops.setattr) {
          node.node_ops.setattr(node, {
            mode:
              (mode & MODE.PERMISSION_MASK) |
              (node.mode & ~MODE.PERMISSION_MASK),
            timestamp: expect.any(Number),
          });
        }
      });

      nodeActions.fchmod(1, 0o644);

      expect(mockFS.getStreamChecked).toHaveBeenCalledWith(1);
      expect(mockFS.chmod).toHaveBeenCalledWith(stream.node, 0o644);
      if (stream.node) {
        expect(mockSetattrOp).toHaveBeenCalledWith(stream.node, {
          mode: expect.any(Number),
          timestamp: expect.any(Number),
        });
      }
    });
  });

  describe("Content Operations", () => {
    test("truncate throws EINVAL when length is negative", () => {
      expect(() => nodeActions.truncate("/test-file", -1)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EINVAL }),
      );
    });

    test("ftruncate throws EINVAL when descriptor is read-only", () => {
      const stream = createMockStream({ flags: OPEN_FLAGS.O_RDONLY });

      mockFS.getStreamChecked.mockReturnValue(stream);

      expect(() => nodeActions.ftruncate(1, 256)).toThrow(
        expect.objectContaining({ errno: ERRNO_CODES.EINVAL }),
      );
    });

    test("utime updates file timestamps", () => {
      const node = createMockNode();
      const mockSetattrOp = vi.fn();
      node.node_ops.setattr = mockSetattrOp;

      mockFS.lookupPath.mockReturnValue({ node });

      nodeActions.utime("/test-file", 1000000, 2000000);

      expect(mockSetattrOp).toHaveBeenCalledWith(node, {
        timestamp: 2000000, // max of atime and mtime
      });
    });
  });
});
