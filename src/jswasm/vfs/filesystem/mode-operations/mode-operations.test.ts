/**
 * Tests for mode-operations.ts
 *
 * These tests validate POSIX mode bit operations and filesystem permission checking.
 * Tests target the new TypeScript implementation to ensure behavioral parity with the original .mjs version.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, test, expect, vi, beforeEach, type Mock } from "vitest";
import { createModeOperations, type ModeOperationsFS } from "./mode-operations";
import { MODE, OPEN_FLAGS, ERRNO_CODES } from "../constants/constants";
import type { FSNode } from "../base-state/base-state";

// Helper to create a mock FS node
function createMockNode(overrides: Partial<FSNode> = {}): FSNode {
  return {
    parent: null as unknown as FSNode,
    mount:
      null as unknown as import("../base-state/base-state").FileSystemMount,
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
}

// Define a mocked version of ModeOperationsFS where methods are Vitest Mocks
type MockModeOperationsFS = Omit<
  ModeOperationsFS,
  | "isDir"
  | "lookupNode"
  | "nodePermissions"
  | "isRoot"
  | "getPath"
  | "cwd"
  | "flagsToPermissionString"
  | "isLink"
> & {
  isDir: Mock;
  lookupNode: Mock;
  nodePermissions: Mock;
  isRoot: Mock;
  getPath: Mock;
  cwd: Mock;
  flagsToPermissionString: Mock;
  isLink: Mock;
};

// Helper to create a mock FS object
function createMockFS(
  overrides: Record<string, unknown> = {},
): MockModeOperationsFS {
  return {
    root: null,
    mounts: [],
    devices: {},
    streams: [],
    nextInode: 1,
    nameTable: null,
    currentPath: "/",
    initialized: false,
    ignorePermissions: false,
    ErrnoError: class ErrnoError extends Error {
      errno: number;
      constructor(errno: number) {
        super(`Error ${errno}`);
        this.name = "ErrnoError";
        this.errno = errno;
      }
    },
    genericErrors: {},
    filesystems: null,
    syncFSRequests: 0,
    readFiles: {},
    FSStream: class {} as any,
    FSNode: class {} as any,
    // Mock methods that the mode operations will call
    isDir: vi.fn().mockReturnValue(false),
    lookupNode: vi.fn().mockImplementation(() => {
      throw { errno: ERRNO_CODES.ENOENT };
    }),
    nodePermissions: vi.fn().mockReturnValue(0),
    isRoot: vi.fn().mockReturnValue(false),
    getPath: vi.fn().mockReturnValue("/test"),
    cwd: vi.fn().mockReturnValue("/"),
    flagsToPermissionString: vi.fn().mockReturnValue("r"),
    isLink: vi.fn().mockReturnValue(false),
    ...overrides,
  } as unknown as MockModeOperationsFS;
}

describe("Mode Operations", () => {
  let mockFS: MockModeOperationsFS;
  let modeOps: ReturnType<typeof createModeOperations>;

  beforeEach(() => {
    mockFS = createMockFS();
    modeOps = createModeOperations(mockFS as unknown as ModeOperationsFS);
  });

  describe("File Type Checkers", () => {
    test("isFile correctly identifies file modes", () => {
      expect(modeOps.isFile(MODE.FILE | 0o644)).toBe(true);
      expect(modeOps.isFile(MODE.DIRECTORY | 0o755)).toBe(false);
      expect(modeOps.isFile(MODE.SYMLINK | 0o777)).toBe(false);
    });

    test("isDir correctly identifies directory modes", () => {
      expect(modeOps.isDir(MODE.DIRECTORY | 0o755)).toBe(true);
      expect(modeOps.isDir(MODE.FILE | 0o644)).toBe(false);
      expect(modeOps.isDir(MODE.SYMLINK | 0o777)).toBe(false);
    });

    test("isLink correctly identifies symlink modes", () => {
      expect(modeOps.isLink(MODE.SYMLINK | 0o777)).toBe(true);
      expect(modeOps.isLink(MODE.FILE | 0o644)).toBe(false);
      expect(modeOps.isLink(MODE.DIRECTORY | 0o755)).toBe(false);
    });

    test("isChrdev correctly identifies character device modes", () => {
      expect(modeOps.isChrdev(MODE.CHARACTER_DEVICE | 0o666)).toBe(true);
      expect(modeOps.isChrdev(MODE.FILE | 0o644)).toBe(false);
    });

    test("isBlkdev correctly identifies block device modes", () => {
      expect(modeOps.isBlkdev(MODE.BLOCK_DEVICE | 0o666)).toBe(true);
      expect(modeOps.isBlkdev(MODE.FILE | 0o644)).toBe(false);
    });

    test("isFIFO correctly identifies FIFO modes", () => {
      expect(modeOps.isFIFO(MODE.FIFO | 0o666)).toBe(true);
      expect(modeOps.isFIFO(MODE.FILE | 0o644)).toBe(false);
    });

    test("isSocket correctly identifies socket modes", () => {
      expect(modeOps.isSocket(MODE.SOCKET | 0o666)).toBe(true);
      expect(modeOps.isSocket(MODE.FILE | 0o644)).toBe(false);
    });

    test("type checkers handle invalid modes", () => {
      expect(modeOps.isFile(0)).toBe(false);
      expect(modeOps.isDir(0)).toBe(false);
      expect(modeOps.isLink(0)).toBe(false);
      expect(modeOps.isChrdev(0)).toBe(false);
      expect(modeOps.isBlkdev(0)).toBe(false);
      expect(modeOps.isFIFO(0)).toBe(false);
      expect(modeOps.isSocket(0)).toBe(false);
    });
  });

  describe("Permission String Generation", () => {
    test("flagsToPermissionString converts access modes correctly", () => {
      expect(modeOps.flagsToPermissionString(OPEN_FLAGS.O_RDONLY)).toBe("r");
      expect(modeOps.flagsToPermissionString(OPEN_FLAGS.O_WRONLY)).toBe("w");
      expect(modeOps.flagsToPermissionString(OPEN_FLAGS.O_RDWR)).toBe("rw");
    });

    test("flagsToPermissionString appends w for O_TRUNC flag", () => {
      const readWriteTrunc = OPEN_FLAGS.O_RDWR | OPEN_FLAGS.O_TRUNC;
      expect(modeOps.flagsToPermissionString(readWriteTrunc)).toBe("rww");

      const writeTrunc = OPEN_FLAGS.O_WRONLY | OPEN_FLAGS.O_TRUNC;
      expect(modeOps.flagsToPermissionString(writeTrunc)).toBe("ww");
    });

    test("flagsToPermissionString handles combinations correctly", () => {
      const complexFlags =
        OPEN_FLAGS.O_RDWR | OPEN_FLAGS.O_CREAT | OPEN_FLAGS.O_TRUNC;
      expect(modeOps.flagsToPermissionString(complexFlags)).toBe("rww");
    });
  });

  describe("Node Permission Validation", () => {
    test("nodePermissions bypasses when ignorePermissions is true", () => {
      mockFS.ignorePermissions = true;
      const node = createMockNode({ mode: 0 });
      expect(modeOps.nodePermissions(node, "rwx")).toBe(0);
    });

    test("nodePermissions validates read permissions", () => {
      mockFS.ignorePermissions = false;
      const node = createMockNode({ mode: 0o000 }); // No permissions
      expect(modeOps.nodePermissions(node, "r")).toBe(ERRNO_CODES.EACCES);

      const readableNode = createMockNode({ mode: MODE.PERMISSION_READ });
      expect(modeOps.nodePermissions(readableNode, "r")).toBe(0);
    });

    test("nodePermissions validates write permissions", () => {
      mockFS.ignorePermissions = false;
      const node = createMockNode({ mode: 0o000 }); // No permissions
      expect(modeOps.nodePermissions(node, "w")).toBe(ERRNO_CODES.EACCES);

      const writableNode = createMockNode({ mode: MODE.PERMISSION_WRITE });
      expect(modeOps.nodePermissions(writableNode, "w")).toBe(0);
    });

    test("nodePermissions validates execute permissions", () => {
      mockFS.ignorePermissions = false;
      const node = createMockNode({ mode: 0o000 }); // No permissions
      expect(modeOps.nodePermissions(node, "x")).toBe(ERRNO_CODES.EACCES);

      const executableNode = createMockNode({ mode: MODE.PERMISSION_EXECUTE });
      expect(modeOps.nodePermissions(executableNode, "x")).toBe(0);
    });

    test("nodePermissions validates combined permissions", () => {
      mockFS.ignorePermissions = false;
      const node = createMockNode({
        mode: MODE.PERMISSION_READ | MODE.PERMISSION_WRITE,
      });
      expect(modeOps.nodePermissions(node, "rw")).toBe(0); // Should succeed
      expect(modeOps.nodePermissions(node, "rx")).toBe(ERRNO_CODES.EACCES); // Missing execute
    });
  });

  describe("Filesystem Operation Permissions", () => {
    test("mayLookup validates directory access", () => {
      mockFS.isDir.mockReturnValue(false);
      const nonDirNode = createMockNode();
      expect(modeOps.mayLookup(nonDirNode)).toBe(ERRNO_CODES.ENOTDIR);

      mockFS.isDir.mockReturnValue(true);
      mockFS.nodePermissions.mockReturnValue(0);
      const dirNode = createMockNode({
        node_ops: { lookup: vi.fn() },
      });
      expect(modeOps.mayLookup(dirNode)).toBe(0);
    });

    test("mayLookup validates execute permissions", () => {
      mockFS.isDir.mockReturnValue(true);
      mockFS.nodePermissions.mockReturnValue(ERRNO_CODES.EACCES);
      const dirNode = createMockNode({
        node_ops: { lookup: vi.fn() },
      });
      expect(modeOps.mayLookup(dirNode)).toBe(ERRNO_CODES.EACCES);
    });

    test("mayLookup validates node operations", () => {
      mockFS.isDir.mockReturnValue(true);
      mockFS.nodePermissions.mockReturnValue(0);
      const dirNode = createMockNode({ node_ops: {} }); // No lookup operation
      expect(modeOps.mayLookup(dirNode)).toBe(ERRNO_CODES.EACCES);
    });

    test("mayCreate returns EEXIST when file exists", () => {
      const dirNode = createMockNode();
      const existingNode = createMockNode();
      mockFS.lookupNode.mockReturnValue(existingNode);

      expect(modeOps.mayCreate(dirNode, "existing-file")).toBe(
        ERRNO_CODES.EEXIST,
      );
    });

    test("mayCreate checks write-execute permissions", () => {
      const dirNode = createMockNode();
      mockFS.lookupNode.mockImplementation(() => {
        throw { errno: ERRNO_CODES.ENOENT }; // File doesn't exist
      });
      mockFS.nodePermissions.mockReturnValue(ERRNO_CODES.EACCES);

      expect(modeOps.mayCreate(dirNode, "new-file")).toBe(ERRNO_CODES.EACCES);
    });

    test("mayCreate succeeds when file doesn't exist and permissions allow", () => {
      const dirNode = createMockNode();
      mockFS.lookupNode.mockImplementation(() => {
        throw { errno: ERRNO_CODES.ENOENT }; // File doesn't exist
      });
      mockFS.nodePermissions.mockReturnValue(0);

      expect(modeOps.mayCreate(dirNode, "new-file")).toBe(0);
    });

    test("mayDelete validates directory type when isdir is true", () => {
      const dirNode = createMockNode();
      const fileNode = createMockNode({ mode: MODE.FILE });

      mockFS.lookupNode.mockReturnValue(fileNode);
      mockFS.nodePermissions.mockReturnValue(0);
      mockFS.isDir.mockReturnValue(false); // Node is not a directory

      // Trying to delete file when expecting directory (isdir=true)
      expect(modeOps.mayDelete(dirNode, "file", true)).toBe(
        ERRNO_CODES.ENOTDIR,
      );
    });

    test("mayDelete returns EISDIR when trying to delete directory as file", () => {
      const dirNode = createMockNode();
      const dirChildNode = createMockNode({ mode: MODE.DIRECTORY });

      mockFS.lookupNode.mockReturnValue(dirChildNode);
      mockFS.nodePermissions.mockReturnValue(0);
      mockFS.isDir.mockReturnValue(true); // Node is a directory

      // Trying to delete directory when expecting file (isdir=false)
      expect(modeOps.mayDelete(dirNode, "dir", false)).toBe(ERRNO_CODES.EISDIR);
    });

    test("mayDelete prevents deleting current working directory", () => {
      const dirNode = createMockNode();
      const cwdNode = createMockNode({ mode: MODE.DIRECTORY });

      mockFS.lookupNode.mockReturnValue(cwdNode);
      mockFS.isRoot.mockReturnValue(false);
      mockFS.getPath.mockReturnValue("/current");
      mockFS.cwd.mockReturnValue("/current");
      mockFS.nodePermissions.mockReturnValue(0);
      mockFS.isDir.mockReturnValue(true); // Node is a directory

      expect(modeOps.mayDelete(dirNode, "cwd", true)).toBe(ERRNO_CODES.EBUSY);
    });

    test("mayDelete prevents deleting root directory", () => {
      const dirNode = createMockNode();
      const rootNode = createMockNode({ mode: MODE.DIRECTORY });

      mockFS.lookupNode.mockReturnValue(rootNode);
      mockFS.isRoot.mockReturnValue(true);
      mockFS.nodePermissions.mockReturnValue(0);
      mockFS.isDir.mockReturnValue(true); // Node is a directory

      expect(modeOps.mayDelete(dirNode, "root", true)).toBe(ERRNO_CODES.EBUSY);
    });

    test("mayOpen returns ENOENT for null node", () => {
      expect(modeOps.mayOpen(null, OPEN_FLAGS.O_RDONLY)).toBe(
        ERRNO_CODES.ENOENT,
      );
    });

    test("mayOpen returns ELOOP for symlinks", () => {
      const linkNode = createMockNode({ mode: MODE.SYMLINK });
      mockFS.isLink.mockReturnValue(true); // Node is a symlink
      expect(modeOps.mayOpen(linkNode, OPEN_FLAGS.O_RDONLY)).toBe(
        ERRNO_CODES.ELOOP,
      );
    });

    test("mayOpen restricts directory opening", () => {
      const dirNode = createMockNode({ mode: MODE.DIRECTORY });
      mockFS.isLink.mockReturnValue(false); // Not a symlink
      mockFS.isDir.mockReturnValue(true); // Is a directory
      mockFS.flagsToPermissionString.mockReturnValue("r");

      // Opening directory with O_TRUNC should fail
      expect(
        modeOps.mayOpen(dirNode, OPEN_FLAGS.O_RDONLY | OPEN_FLAGS.O_TRUNC),
      ).toBe(ERRNO_CODES.EISDIR);
    });

    test("mayOpen validates node permissions", () => {
      const fileNode = createMockNode({ mode: MODE.FILE });
      mockFS.isLink.mockReturnValue(false); // Not a symlink
      mockFS.isDir.mockReturnValue(false); // Not a directory
      mockFS.flagsToPermissionString.mockReturnValue("rw");
      mockFS.nodePermissions.mockReturnValue(ERRNO_CODES.EACCES);

      expect(modeOps.mayOpen(fileNode, OPEN_FLAGS.O_RDWR)).toBe(
        ERRNO_CODES.EACCES,
      );
    });

    test("mayOpen succeeds for readable file with correct permissions", () => {
      const fileNode = createMockNode({ mode: MODE.FILE });
      mockFS.isLink.mockReturnValue(false); // Not a symlink
      mockFS.isDir.mockReturnValue(false); // Not a directory
      mockFS.flagsToPermissionString.mockReturnValue("r");
      mockFS.nodePermissions.mockReturnValue(0);

      expect(modeOps.mayOpen(fileNode, OPEN_FLAGS.O_RDONLY)).toBe(0);
    });
  });
});
