import { describe, it, expect, beforeEach } from "vitest";
import { createBaseState } from "./base-state";

// Import actual constants to match real behavior
import { MODE, OPEN_FLAGS, PERMISSION } from "../constants/constants.js";

describe("createBaseState", () => {
  let fs: ReturnType<typeof createBaseState>;

  beforeEach(() => {
    fs = createBaseState();
  });

  describe("MutableFS properties", () => {
    it("should initialize with correct default values", () => {
      expect(fs.root).toBeNull();
      expect(fs.mounts).toEqual([]);
      expect(fs.devices).toEqual({});
      expect(fs.streams).toEqual([]);
      expect(fs.nextInode).toBe(1);
      expect(fs.nameTable).toBeNull();
      expect(fs.currentPath).toBe("/");
      expect(fs.initialized).toBe(false);
      expect(fs.ignorePermissions).toBe(true);
      expect(fs.genericErrors).toEqual({});
      expect(fs.filesystems).toBeNull();
      expect(fs.syncFSRequests).toBe(0);
      expect(fs.readFiles).toEqual({});
    });

    it("should provide ErrnoError constructor", () => {
      expect(typeof fs.ErrnoError).toBe("function");
    });

    it("should provide FSStream constructor", () => {
      expect(typeof fs.FSStream).toBe("function");
    });

    it("should provide FSNode constructor", () => {
      expect(typeof fs.FSNode).toBe("function");
    });
  });

  describe("ErrnoError class", () => {
    it("should create error with errno", () => {
      const error = new fs.ErrnoError(2); // ENOENT
      expect(error.name).toBe("ErrnoError");
      expect(error.errno).toBe(2);
    });

    it("should maintain error properties", () => {
      const error = new fs.ErrnoError(13); // EACCES
      expect(error.errno).toBe(13);
      expect(error.name).toBe("ErrnoError");
    });
  });

  describe("FSStream class", () => {
    let stream: InstanceType<typeof fs.FSStream>;

    beforeEach(() => {
      stream = new fs.FSStream();
    });

    it("should initialize with shared state", () => {
      expect(stream.shared).toEqual({});
      expect(stream.node).toBeUndefined();
    });

    it("should delegate object property to node", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockNode = {} as any;
      stream.node = mockNode;
      expect(stream.object).toBe(mockNode);
    });

    it("should delegate object setter to node", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockNode = {} as any;
      stream.object = mockNode;
      expect(stream.node).toBe(mockNode);
    });

    it("should delegate flags to shared state", () => {
      stream.shared.flags = OPEN_FLAGS.O_RDWR;
      expect(stream.flags).toBe(OPEN_FLAGS.O_RDWR);
    });

    it("should delegate flags setter to shared state", () => {
      stream.flags = OPEN_FLAGS.O_WRONLY;
      expect(stream.shared.flags).toBe(OPEN_FLAGS.O_WRONLY);
    });

    it("should delegate position to shared state", () => {
      stream.shared.position = 100;
      expect(stream.position).toBe(100);
    });

    it("should delegate position setter to shared state", () => {
      stream.position = 200;
      expect(stream.shared.position).toBe(200);
    });

    it("should compute isRead correctly", () => {
      // Test with read-only flag
      stream.shared.flags = OPEN_FLAGS.O_RDONLY;
      expect(stream.isRead).toBe(true);

      // Test with write-only flag
      stream.shared.flags = OPEN_FLAGS.O_WRONLY;
      expect(stream.isRead).toBe(false);

      // Test with read-write flag
      stream.shared.flags = OPEN_FLAGS.O_RDWR;
      expect(stream.isRead).toBe(true);
    });

    it("should compute isWrite correctly", () => {
      // Test with read-only flag
      stream.shared.flags = OPEN_FLAGS.O_RDONLY;
      expect(stream.isWrite).toBe(false);

      // Test with write-only flag
      stream.shared.flags = OPEN_FLAGS.O_WRONLY;
      expect(stream.isWrite).toBe(true);

      // Test with read-write flag
      stream.shared.flags = OPEN_FLAGS.O_RDWR;
      expect(stream.isWrite).toBe(true);
    });

    it("should compute isAppend correctly", () => {
      // Test without append flag
      stream.shared.flags = OPEN_FLAGS.O_WRONLY;
      expect(stream.isAppend).toBe(false);

      // Test with append flag
      stream.shared.flags = OPEN_FLAGS.O_WRONLY | OPEN_FLAGS.O_APPEND;
      expect(stream.isAppend).toBe(true);
    });
  });

  describe("FSNode class", () => {
    let parentNode: InstanceType<typeof fs.FSNode>;
    let node: InstanceType<typeof fs.FSNode>;

    beforeEach(() => {
      // Create a parent node first
      parentNode = new fs.FSNode(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        null as any,
        "parent",
        MODE.DIRECTORY,
        0,
      );
      parentNode.assignId(fs);
    });

    it("should create node with provided parameters", () => {
      node = new fs.FSNode(parentNode, "test", 0o644, 0);

      expect(node.parent).toBe(parentNode);
      expect(node.mount).toBe(parentNode.mount);
      expect(node.name).toBe("test");
      expect(node.mode).toBe(0o644);
      expect(node.rdev).toBe(0);
      expect(node.id).toBeNull();
    });

    it("should self-parent when no parent provided", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node = new fs.FSNode(null as any, "root", MODE.DIRECTORY, 0);
      expect(node.parent).toBe(node);
    });

    it("should assign unique inode IDs", () => {
      const initialNextInode = fs.nextInode;

      node = new fs.FSNode(parentNode, "test1", 0o644, 0);
      node.assignId(fs);

      expect(node.id).toBe(initialNextInode);
      expect(fs.nextInode).toBe(initialNextInode + 1);
    });

    it("should handle read permission correctly", () => {
      node = new fs.FSNode(parentNode, "test", 0o644, 0);

      // Test initial read state based on mode
      const initialRead = node.read;
      expect(typeof initialRead).toBe("boolean");

      // Test setting read to false
      node.read = false;
      expect(node.read).toBe(false);

      // Test setting read to true
      node.read = true;
      expect(node.read).toBe(true);
    });

    it("should handle write permission correctly", () => {
      node = new fs.FSNode(parentNode, "test", 0o644, 0);

      // Test initial write state based on mode
      const initialWrite = node.write;
      expect(typeof initialWrite).toBe("boolean");

      // Test setting write to false
      node.write = false;
      expect(node.write).toBe(false);

      // Test setting write to true
      node.write = true;
      expect(node.write).toBe(true);
    });

    it("should identify folders correctly", () => {
      const folderNode = new fs.FSNode(parentNode, "folder", MODE.DIRECTORY, 0);
      expect(folderNode.isFolder).toBe(true);

      const fileNode = new fs.FSNode(parentNode, "file", 0o644, 0);
      expect(fileNode.isFolder).toBe(false);
    });

    it("should identify devices correctly", () => {
      const deviceNode = new fs.FSNode(
        parentNode,
        "device",
        MODE.CHARACTER_DEVICE,
        0,
      );
      expect(deviceNode.isDevice).toBe(true);

      const fileNode = new fs.FSNode(parentNode, "file", 0o644, 0);
      expect(fileNode.isDevice).toBe(false);
    });

    it("should initialize default permission modes", () => {
      node = new fs.FSNode(parentNode, "test", 0o644, 0);
      expect(node.readMode).toBe(PERMISSION.READ_EXECUTE);
      expect(node.writeMode).toBe(MODE.PERMISSION_WRITE);
    });
  });

  describe("Integration tests", () => {
    it("should maintain consistent state across operations", () => {
      const stream = new fs.FSStream();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const node = new fs.FSNode(null as any, "root", MODE.DIRECTORY, 0);

      // Test that the filesystem state remains consistent
      expect(fs.nextInode).toBe(1);
      node.assignId(fs);
      expect(fs.nextInode).toBe(2);

      // Test stream operations don't affect global state
      stream.shared.flags = OPEN_FLAGS.O_RDWR;
      expect(stream.isRead).toBe(true);
      expect(stream.isWrite).toBe(true);
      expect(fs.nextInode).toBe(2); // Unchanged
    });

    it("should handle multiple node and stream creation", () => {
      const nodes = Array.from(
        { length: 5 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_, i) => new fs.FSNode(null as any, `node${i}`, 0o644, 0),
      );

      const streams = Array.from({ length: 3 }, () => new fs.FSStream());

      // Assign IDs to nodes
      nodes.forEach((node) => node.assignId(fs));

      expect(fs.nextInode).toBe(6); // Started at 1, created 5 nodes
      expect(nodes.map((n) => n.id)).toEqual([1, 2, 3, 4, 5]);

      // Verify streams are independent
      streams.forEach((stream, i) => {
        stream.shared.flags = OPEN_FLAGS.O_RDWR;
        stream.shared.position = i * 100;
        expect(stream.flags).toBe(OPEN_FLAGS.O_RDWR);
        expect(stream.position).toBe(i * 100);
      });
    });
  });
});
