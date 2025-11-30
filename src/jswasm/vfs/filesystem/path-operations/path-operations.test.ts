/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPathOperations } from "./path-operations";
import { ERRNO_CODES } from "../constants/constants";

// Mock FSNode
class MockFSNode {
  id: number;
  name: string;
  parent: MockFSNode;
  mode: number;
  mounted?: { root: MockFSNode };
  name_next?: MockFSNode;
  mount?: { mountpoint: string };
  node_ops: any = {};
  stream_ops: any = {};
  rdev: number = 0;
  readMode: number = 0;
  writeMode: number = 0;
  read: boolean = true;
  write: boolean = true;
  isFolder: boolean = false;
  isDevice: boolean = false;

  constructor(parent: MockFSNode, name: string, mode: number, id: number) {
    this.parent = parent;
    this.name = name;
    this.mode = mode;
    this.id = id;
  }

  assignId(_fs: MockMutableFS) {
    return this;
  }
}

// Mock MutableFS
class MockMutableFS {
  root: MockFSNode;
  nameTable: Array<MockFSNode | undefined>;
  public nextId: number = 0;

  static readonly S_IFDIR = 0o040000;
  static readonly S_IFREG = 0o100000;
  static readonly S_IFLNK = 0o120000;
  static readonly ERRNO_CODES = ERRNO_CODES;

  // Properties assigned by createPathOperations
  lookupPath: any;
  getPath: any;
  hashName: any;
  hashAddNode: any;
  hashRemoveNode: any;
  createNode: any;
  destroyNode: any;
  isRoot: any;
  isMountpoint: any;

  constructor() {
    this.root = new MockFSNode(
      null as any,
      "",
      MockMutableFS.S_IFDIR,
      this.nextId++,
    );
    this.root.parent = this.root;
    this.root.mount = { mountpoint: "/" };
    this.nameTable = new Array(100).fill(undefined);
    const tempHashName = (parentId: number, name: string) => {
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
      }
      return ((parentId + hash) >>> 0) % this.nameTable.length;
    };
    this.nameTable[tempHashName(this.root.parent.id, this.root.name)] =
      this.root;
  }

  lookupNode = vi.fn((parent: MockFSNode, name: string): MockFSNode => {
    const hash = this.hashName ? this.hashName(parent.id, name) : 0;
    for (let node = this.nameTable[hash]; node; node = node.name_next) {
      if (node.parent.id === parent.id && node.name === name) {
        return node;
      }
    }
    throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
  });

  isLink = vi.fn((mode: number) => (mode & 0o170000) === MockMutableFS.S_IFLNK);

  readlink = vi.fn((_path: string): string => {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
  });

  mayLookup = vi.fn((_parent: MockFSNode) => 0);

  FSNode = MockFSNode;

  ErrnoError = class extends Error {
    errno: number;
    constructor(errno: number) {
      super(`ErrnoError: ${errno}`);
      this.errno = errno;
      Object.setPrototypeOf(this, new.target.prototype);
    }
  };

  lookup = vi.fn((_parent: MockFSNode, _name: string) => {
    throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
  });
}

const MockPath = {
  join2: vi.fn((...args: string[]) => {
    const parts = args.flatMap((arg) => (arg || "").split("/").filter(Boolean));
    if (parts.length === 0) return "/";
    const joined = parts.join("/");
    return args[0]?.startsWith("/") ? `/${joined}` : joined;
  }),
  dirname: vi.fn((path: string | undefined) => {
    if (!path || path === "/") return "/";
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return "/";
    parts.pop();
    return parts.length === 0 ? "/" : `/${parts.join("/")}`;
  }),
  resolve: vi.fn((base: string | undefined, target: string | undefined) => {
    base = base === undefined ? "/" : base;
    target = target === undefined ? "" : target;
    const combinedPath = MockPath.join2(base, target);
    const parts = combinedPath.split("/").filter(Boolean);
    const resolvedParts: string[] = [];
    for (const part of parts) {
      if (part === "..") {
        resolvedParts.pop();
      } else if (part !== ".") {
        resolvedParts.push(part);
      }
    }
    return `/${resolvedParts.join("/")}`;
  }),
  relative: vi.fn((_from: string, to: string) => {
    return to;
  }),
};

let FS: MockMutableFS;
let PATH_OPS: ReturnType<typeof createPathOperations>;

describe("createPathOperations", () => {
  beforeEach(() => {
    FS = new MockMutableFS();
    PATH_OPS = createPathOperations(FS as any, {
      getPathFS: () => MockPath as any,
    });
    FS.lookupPath = PATH_OPS.lookupPath;
    FS.getPath = PATH_OPS.getPath;
    FS.hashName = PATH_OPS.hashName;
    FS.hashAddNode = PATH_OPS.hashAddNode;
    FS.hashRemoveNode = PATH_OPS.hashRemoveNode;
    FS.lookupNode = PATH_OPS.lookupNode as any;
    FS.createNode = PATH_OPS.createNode;
    FS.destroyNode = PATH_OPS.destroyNode;
    FS.isRoot = PATH_OPS.isRoot;
    FS.isMountpoint = PATH_OPS.isMountpoint;

    vi.clearAllMocks();
  });

  describe("lookupPath", () => {
    it("should resolve a simple absolute path", () => {
      const dir1 = FS.createNode(
        FS.root as any,
        "dir1",
        MockMutableFS.S_IFDIR,
        0,
      );
      const file1 = FS.createNode(dir1, "file1.txt", MockMutableFS.S_IFREG, 0);
      const result = PATH_OPS.lookupPath("/dir1/file1.txt");
      expect(result.path).toBe("/dir1/file1.txt");
      expect(result.node).toBe(file1);
    });

    it("should resolve a relative path from root", () => {
      const dir1 = FS.createNode(
        FS.root as any,
        "dir1",
        MockMutableFS.S_IFDIR,
        0,
      );
      const file1 = FS.createNode(dir1, "file1.txt", MockMutableFS.S_IFREG, 0);
      const result = PATH_OPS.lookupPath("dir1/file1.txt");
      expect(result.path).toBe("/dir1/file1.txt");
      expect(result.node).toBe(file1);
    });

    it('should handle ".." in path correctly', () => {
      const dir1 = FS.createNode(
        FS.root as any,
        "dir1",
        MockMutableFS.S_IFDIR,
        0,
      );
      const dir2 = FS.createNode(dir1, "dir2", MockMutableFS.S_IFDIR, 0);
      const fileInDir1 = FS.createNode(
        dir1,
        "file_in_dir1.txt",
        MockMutableFS.S_IFREG,
        0,
      );
      FS.createNode(dir2, "file2.txt", MockMutableFS.S_IFREG, 0);
      const result = PATH_OPS.lookupPath("/dir1/dir2/../file_in_dir1.txt");
      expect(result.path).toBe("/dir1/file_in_dir1.txt");
      expect(result.node).toBe(fileInDir1);
    });

    it("should throw ErrnoError for non-existent path", () => {
      expect(() => PATH_OPS.lookupPath("/nonexistent")).toThrow(FS.ErrnoError);
      expect(() => PATH_OPS.lookupPath("/dir1/nonexistent")).toThrow(
        FS.ErrnoError,
      );
    });

    it("should handle parent option", () => {
      const dir1 = FS.createNode(
        FS.root as any,
        "dir1",
        MockMutableFS.S_IFDIR,
        0,
      );
      FS.createNode(dir1, "file1.txt", MockMutableFS.S_IFREG, 0);
      const result = PATH_OPS.lookupPath("/dir1/file1.txt", { parent: true });
      expect(result.path).toBe("/dir1");
      expect(result.node).toBe(dir1);
    });

    it("should follow mount points", () => {
      const mountDir = FS.createNode(
        FS.root as any,
        "mnt",
        MockMutableFS.S_IFDIR,
        0,
      );
      const mountedRoot = new MockFSNode(
        mountDir,
        "",
        MockMutableFS.S_IFDIR,
        FS.nextId++,
      );
      const mountedFile = new MockFSNode(
        mountedRoot,
        "data.txt",
        MockMutableFS.S_IFREG,
        FS.nextId++,
      );
      mountedRoot.parent = mountDir;
      mountDir.mounted = { root: mountedRoot };
      FS.hashAddNode(mountedFile);
      const result = PATH_OPS.lookupPath("/mnt/data.txt");
      expect(result.path).toBe("/mnt/data.txt");
      expect(result.node).toBe(mountedFile);
    });

    it("should throw ELOOP for excessive symlink recursion", () => {
      FS.createNode(FS.root as any, "link1", MockMutableFS.S_IFLNK, 0);
      FS.createNode(FS.root as any, "link2", MockMutableFS.S_IFLNK, 0);

      FS.readlink.mockImplementation((path) => {
        if (path === "/link1") return "/link2";
        if (path === "/link2") return "/link1";
        return "";
      });

      vi.spyOn(FS, "isLink").mockImplementation(
        (mode) => (mode & 0o170000) === MockMutableFS.S_IFLNK,
      );

      expect(() => PATH_OPS.lookupPath("/link1", { follow: true })).toThrow(
        new FS.ErrnoError(ERRNO_CODES.ELOOP),
      );
    });

    it("should follow symlinks on the final segment with follow option", () => {
      const targetFile = FS.createNode(
        FS.root as any,
        "target.txt",
        MockMutableFS.S_IFREG,
        0,
      );
      FS.createNode(FS.root as any, "symlink", MockMutableFS.S_IFLNK, 0);
      FS.readlink.mockImplementation((path) => {
        if (path === "/symlink") return "/target.txt";
        return "";
      });
      vi.spyOn(FS, "isLink").mockImplementation(
        (mode) => mode === MockMutableFS.S_IFLNK,
      );
      const result = PATH_OPS.lookupPath("/symlink", { follow: true });
      expect(result.path).toBe("/target.txt");
      expect(result.node).toBe(targetFile);
    });
  });

  describe("getPath", () => {
    it('should return "/" for root node', () => {
      expect(PATH_OPS.getPath(FS.root as any)).toBe("/");
    });

    it("should return correct path for a child node", () => {
      const dir1 = FS.createNode(FS.root, "dir1", MockMutableFS.S_IFDIR, 0);
      const file1 = FS.createNode(dir1, "file1.txt", MockMutableFS.S_IFREG, 0);
      expect(PATH_OPS.getPath(file1 as any)).toBe("/dir1/file1.txt");
    });

    it("should return correct path for a deeply nested node", () => {
      const dir1 = FS.createNode(FS.root, "dir1", MockMutableFS.S_IFDIR, 0);
      const dir2 = FS.createNode(dir1, "dir2", MockMutableFS.S_IFDIR, 0);
      const file1 = FS.createNode(dir2, "file1.txt", MockMutableFS.S_IFREG, 0);
      expect(PATH_OPS.getPath(file1 as any)).toBe("/dir1/dir2/file1.txt");
    });

    it("should handle mount point in path reconstruction", () => {
      const mountDir = FS.createNode(FS.root, "mnt", MockMutableFS.S_IFDIR, 0);
      const mountedRoot = new MockFSNode(
        mountDir,
        "",
        MockMutableFS.S_IFDIR,
        FS.nextId++,
      );
      const mountedFile = new MockFSNode(
        mountedRoot,
        "data.txt",
        MockMutableFS.S_IFREG,
        FS.nextId++,
      );
      mountedRoot.parent = mountDir;
      mountDir.mounted = { root: mountedRoot };
      FS.hashAddNode(mountedFile);
      const result = PATH_OPS.getPath(mountedFile as any);
      expect(result).toBe("/mnt//data.txt");
    });
  });

  describe("hash table operations", () => {
    it("should generate consistent hash for node names", () => {
      const hash1 = PATH_OPS.hashName(FS.root.id, "test");
      const hash2 = PATH_OPS.hashName(FS.root.id, "test");
      const hash3 = PATH_OPS.hashName(FS.root.id, "another");
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    it("should add and lookup node correctly", () => {
      const dir1 = FS.createNode(
        FS.root as any,
        "dir1",
        MockMutableFS.S_IFDIR,
        0,
      );
      expect(PATH_OPS.lookupNode(FS.root as any, "dir1")).toBe(dir1);
    });

    it("should remove node correctly", () => {
      const dir1 = FS.createNode(
        FS.root as any,
        "dir1",
        MockMutableFS.S_IFDIR,
        0,
      );
      PATH_OPS.destroyNode(dir1);
      expect(() => PATH_OPS.lookupNode(FS.root as any, "dir1")).toThrow(
        FS.ErrnoError,
      );
    });

    it("should handle hash collisions", () => {
      const originalHashNameImpl = FS.hashName;
      vi.spyOn(FS, "hashName").mockImplementation((parentId, name) => {
        if (name === "col1" || name === "col2") return 1;
        return originalHashNameImpl(parentId, name);
      });
      const node1 = FS.createNode(
        FS.root as any,
        "col1",
        MockMutableFS.S_IFDIR,
        0,
      );
      const node2 = FS.createNode(
        FS.root as any,
        "col2",
        MockMutableFS.S_IFDIR,
        0,
      );
      expect(FS.nameTable[1]).toBe(node2);
      expect(node2.name_next).toBe(node1);
      expect(PATH_OPS.lookupNode(FS.root as any, "col1")).toBe(node1);
      expect(PATH_OPS.lookupNode(FS.root as any, "col2")).toBe(node2);
      PATH_OPS.destroyNode(node1);
      expect(FS.nameTable[1]).toBe(node2);
      expect(node2.name_next).toBeUndefined();
      expect(PATH_OPS.lookupNode(FS.root as any, "col2")).toBe(node2);
      expect(() => PATH_OPS.lookupNode(FS.root as any, "col1")).toThrow(
        FS.ErrnoError,
      );
      const node1_recreated = FS.createNode(
        FS.root as any,
        "col1",
        MockMutableFS.S_IFDIR,
        0,
      );
      expect(FS.nameTable[1]).toBe(node1_recreated);
      expect(node1_recreated.name_next).toBe(node2);
      PATH_OPS.destroyNode(node2);
      expect(FS.nameTable[1]).toBe(node1_recreated);
      expect(node1_recreated.name_next).toBeUndefined();
    });

    it("should throw ErrnoError if mayLookup fails", () => {
      FS.mayLookup.mockReturnValue(ERRNO_CODES.EACCES);
      expect(() => PATH_OPS.lookupNode(FS.root as any, "somefile")).toThrow(
        new FS.ErrnoError(ERRNO_CODES.EACCES),
      );
    });
  });

  describe("createNode and destroyNode", () => {
    it("should create a node and add it to the hash table", () => {
      const node = PATH_OPS.createNode(
        FS.root as any,
        "newdir",
        MockMutableFS.S_IFDIR,
        0,
      );
      expect(node.name).toBe("newdir");
      expect(node.parent).toBe(FS.root);
      expect(PATH_OPS.lookupNode(FS.root as any, "newdir")).toBe(node);
    });

    it("should destroy a node and remove it from the hash table", () => {
      const node = PATH_OPS.createNode(
        FS.root as any,
        "todelete",
        MockMutableFS.S_IFREG,
        0,
      );
      expect(PATH_OPS.lookupNode(FS.root as any, "todelete")).toBe(node);
      PATH_OPS.destroyNode(node);
      expect(() => PATH_OPS.lookupNode(FS.root as any, "todelete")).toThrow(
        FS.ErrnoError,
      );
    });
  });

  describe("isRoot and isMountpoint", () => {
    it("should correctly identify the root node", () => {
      const dir1 = FS.createNode(
        FS.root as any,
        "dir1",
        MockMutableFS.S_IFDIR,
        0,
      );
      expect(PATH_OPS.isRoot(FS.root as any)).toBe(true);
      expect(PATH_OPS.isRoot(dir1 as any)).toBe(false);
    });

    it("should correctly identify a mount point", () => {
      const dir1 = FS.createNode(
        FS.root as any,
        "dir1",
        MockMutableFS.S_IFDIR,
        0,
      );
      expect(PATH_OPS.isMountpoint(dir1 as any)).toBe(false);
      dir1.mounted = {
        root: new MockFSNode(dir1, "", MockMutableFS.S_IFDIR, FS.nextId++),
      };
      expect(PATH_OPS.isMountpoint(dir1 as any)).toBe(true);
    });
  });
});
