import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  FileSystemMount,
  NodeOps,
  StreamOps,
} from "../filesystem/base-state/base-state";
import type { MemfsInstance, MemfsNode } from "./memfs";
import { createMEMFS } from "./memfs";

type MemfsFs = {
  isBlkdev: ReturnType<typeof vi.fn<(mode: number) => boolean>>;
  isFIFO: ReturnType<typeof vi.fn<(mode: number) => boolean>>;
  isDir: ReturnType<typeof vi.fn<(mode: number) => boolean>>;
  isFile: ReturnType<typeof vi.fn<(mode: number) => boolean>>;
  isLink: ReturnType<typeof vi.fn<(mode: number) => boolean>>;
  isChrdev: ReturnType<typeof vi.fn<(mode: number) => boolean>>;
  createNode: ReturnType<
    typeof vi.fn<
      (
        parent: MemfsNode | null,
        name: string,
        mode: number,
        dev: number,
      ) => MemfsNode
    >
  >;
  ErrnoError: new (errno: number) => Error & { errno: number };
  genericErrors: Record<number, Error & { errno?: number }>;
  lookupNode: ReturnType<
    typeof vi.fn<(parent: MemfsNode, name: string) => MemfsNode>
  >;
  chrdev_stream_ops: StreamOps;
};

type TestMemfsNode = MemfsNode & {
  node_ops?: NodeOps;
  stream_ops?: StreamOps;
  mount?: FileSystemMount;
};

const createFsMock = (): MemfsFs =>
  ({
    isBlkdev: vi.fn<(mode: number) => boolean>().mockReturnValue(false),
    isFIFO: vi.fn<(mode: number) => boolean>().mockReturnValue(false),
    isDir: vi.fn<(mode: number) => boolean>().mockReturnValue(false),
    isFile: vi.fn<(mode: number) => boolean>().mockReturnValue(false),
    isLink: vi.fn<(mode: number) => boolean>().mockReturnValue(false),
    isChrdev: vi.fn<(mode: number) => boolean>().mockReturnValue(false),

    createNode: vi.fn(
      (parent: MemfsNode | null, name: string, mode: number, _dev: number) =>
        ({
          parent: parent ?? ({} as MemfsNode),
          name,
          mode,
          id: 123,
          rdev: 0,
          contents: {},
          timestamp: Date.now(),
          usedBytes: 0,
        }) as unknown as MemfsNode,
    ),
    ErrnoError: class ErrnoError extends Error {
      errno: number;
      constructor(errno: number) {
        super(`ErrnoError: ${errno}`);
        this.errno = errno;
      }
    },
    genericErrors: {
      44: Object.assign(new Error("ENOENT"), { errno: 44 }),
    },
    lookupNode: vi.fn<(parent: MemfsNode, name: string) => MemfsNode>(),
    chrdev_stream_ops: {} as StreamOps,
  }) satisfies MemfsFs;

const asMemfsNode = (node: Record<string, unknown>): TestMemfsNode =>
  node as unknown as TestMemfsNode;

describe("MEMFS", () => {
  let FS: MemfsFs;
  let HEAP8: Int8Array;
  let mmapAlloc: ReturnType<typeof vi.fn<(size: number) => number>>;
  let _zeroMemory: ReturnType<
    typeof vi.fn<(pointer: number, byteCount: number) => void>
  >;
  let memfs: MemfsInstance;

  beforeEach(() => {
    // Mock FS object with necessary methods and constants
    FS = createFsMock();

    // Mock HEAP8
    const buffer = new ArrayBuffer(1024);
    HEAP8 = new Int8Array(buffer);

    // Mock mmapAlloc
    mmapAlloc = vi.fn<(size: number) => number>().mockReturnValue(0);

    // Mock _zeroMemory
    _zeroMemory = vi.fn<(pointer: number, byteCount: number) => void>();

    memfs = createMEMFS(
      FS as unknown as Parameters<typeof createMEMFS>[0],
      HEAP8,
      mmapAlloc,
      _zeroMemory,
    );
  });

  describe("mount", () => {
    it("should create a root node", () => {
      FS.isDir.mockReturnValue(true);
      const root = memfs.mount({}) as TestMemfsNode;
      expect(FS.createNode).toHaveBeenCalledWith(null, "/", 16384 | 511, 0);
      expect(root.node_ops).toBeDefined();
      expect(root.stream_ops).toBeDefined();
    });
  });

  describe("createNode", () => {
    it("should throw error for block devices", () => {
      FS.isBlkdev.mockReturnValue(true);
      expect(() => memfs.createNode(null, "test", 0, 0)).toThrow();
    });

    it("should throw error for FIFO", () => {
      FS.isFIFO.mockReturnValue(true);
      expect(() => memfs.createNode(null, "test", 0, 0)).toThrow();
    });

    it("should create a directory node", () => {
      FS.isDir.mockReturnValue(true);
      const parent = asMemfsNode({ contents: {} });
      const node = memfs.createNode(parent, "dir", 16384, 0) as TestMemfsNode;
      expect(node.node_ops).toBeDefined();
      expect(node.contents).toEqual({});
      const contents = parent.contents as Record<string, MemfsNode>;
      expect(contents.dir).toBe(node);
    });

    it("should create a file node", () => {
      FS.isFile.mockReturnValue(true);
      const parent = asMemfsNode({ contents: {} });
      const node = memfs.createNode(parent, "file", 33188, 0) as TestMemfsNode;
      expect(node.node_ops).toBeDefined();
      expect(node.usedBytes).toBe(0);
      expect(node.contents).toBeNull();
    });

    it("should create a link node", () => {
      FS.isLink.mockReturnValue(true);
      const parent = asMemfsNode({ contents: {} });
      const node = memfs.createNode(parent, "link", 41453, 0) as TestMemfsNode; // S_IFLNK
      expect(node.node_ops).toBeDefined();
    });

    it("should create a chrdev node", () => {
      FS.isChrdev.mockReturnValue(true);
      const parent = asMemfsNode({ contents: {} });
      const node = memfs.createNode(parent, "chr", 8630, 0) as TestMemfsNode; // S_IFCHR
      expect(node.node_ops).toBeDefined();
    });
  });

  describe("getFileDataAsTypedArray", () => {
    it("should return empty array if no contents", () => {
      const node = asMemfsNode({ contents: null });
      const data = memfs.getFileDataAsTypedArray(node);
      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBe(0);
    });

    it("should return subarray of contents", () => {
      const contents = new Uint8Array([1, 2, 3, 4]);
      const node = asMemfsNode({ contents, usedBytes: 2 });
      const data = memfs.getFileDataAsTypedArray(node);
      expect(data.length).toBe(2);
      expect(data[0]).toBe(1);
      expect(data[1]).toBe(2);
    });

    it("should return contents if not subarray capable (unlikely but cover branch)", () => {
      const contents = [1, 2, 3] as unknown as Uint8Array;
      const node = asMemfsNode({ contents }); // Mocking like it doesn't have subarray
      const data = memfs.getFileDataAsTypedArray(node);
      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBe(3);
    });
  });

  describe("expandFileStorage", () => {
    it("should not expand if capacity is sufficient", () => {
      const node = asMemfsNode({ contents: new Uint8Array(10) });
      memfs.expandFileStorage(node, 5);
      expect(node.contents!.length).toBe(10);
    });

    it("should expand capacity", () => {
      const node = asMemfsNode({
        contents: new Uint8Array(10),
        usedBytes: 5,
      });
      memfs.expandFileStorage(node, 20);
      expect(node.contents!.length).toBeGreaterThanOrEqual(20);
      // Check content preservation
      // Since original was all 0, new one is also all 0, but logic is there
    });

    it("should handle initial expansion", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const node: any = { contents: null, usedBytes: 0 };
      memfs.expandFileStorage(node, 20);
      expect(node.contents.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe("resizeFileStorage", () => {
    it("should do nothing if size matches usedBytes", () => {
      const node = asMemfsNode({
        usedBytes: 10,
        contents: new Uint8Array(10),
      });
      const oldContents = node.contents;
      memfs.resizeFileStorage(node, 10);
      expect(node.contents).toBe(oldContents);
    });

    it("should clear contents if new size is 0", () => {
      const node = asMemfsNode({
        contents: new Uint8Array(10),
        usedBytes: 10,
      });
      memfs.resizeFileStorage(node, 0);
      expect(node.contents).toBeNull();
      expect(node.usedBytes).toBe(0);
    });

    it("should resize and preserve data", () => {
      const node = asMemfsNode({
        contents: new Uint8Array([1, 2, 3]),
        usedBytes: 3,
      });
      memfs.resizeFileStorage(node, 2);
      const contents = node.contents as Uint8Array;
      expect(contents.length).toBe(2);
      expect(contents[0]).toBe(1);
      expect(contents[1]).toBe(2);
      expect(node.usedBytes).toBe(2);
    });
  });

  describe("node_ops", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any;
    beforeEach(() => {
      FS.isDir.mockReturnValue(true);
      // Ensure ops_table is initialized
      memfs.mount({});
      node = {
        mode: 16877, // dir
        id: 1,
        rdev: 0,
        timestamp: Date.now(),
        contents: new Uint8Array(0),
      };
    });

    it("getattr should return correct attributes for directory", () => {
      FS.isDir.mockReturnValue(true);
      const attr = memfs.node_ops.getattr(node);
      expect(attr.mode).toBe(node.mode);
      expect(attr.size).toBe(4096); // FS_CONSTANTS.DIR_SIZE
    });

    it("getattr should return correct attributes for file", () => {
      FS.isDir.mockReturnValue(false);
      FS.isFile.mockReturnValue(true);
      const fileNode = { ...node, usedBytes: 100, mode: 33188 };
      const attr = memfs.node_ops.getattr(fileNode);
      expect(attr.size).toBe(100);
    });

    it("getattr should return correct attributes for link", () => {
      FS.isDir.mockReturnValue(false);
      FS.isLink.mockReturnValue(true);
      const linkNode = { ...node, link: "target", mode: 41453 };
      const attr = memfs.node_ops.getattr(linkNode);
      expect(attr.size).toBe(6); // length of 'target'
    });

    it("getattr should return correct attributes for chrdev", () => {
      FS.isDir.mockReturnValue(false);
      FS.isChrdev.mockReturnValue(true);
      const chrNode = { ...node, id: 99, mode: 8630 };
      const attr = memfs.node_ops.getattr(chrNode);
      expect(attr.dev).toBe(99);
    });

    it("setattr should update attributes", () => {
      const newTime = Date.now() + 1000;
      memfs.node_ops.setattr(node, { mode: 123, timestamp: newTime });
      expect(node.mode).toBe(123);
      expect(node.timestamp).toBe(newTime);
    });

    it("setattr should resize file if size provided", () => {
      const spy = vi.spyOn(memfs, "resizeFileStorage");
      memfs.node_ops.setattr(node, { size: 100 });
      expect(spy).toHaveBeenCalledWith(node, 100);
    });

    it("lookup should throw error", () => {
      expect(() => memfs.node_ops.lookup(node, "child")).toThrow();
    });

    it("mknod should call createNode", () => {
      const spy = vi.spyOn(memfs, "createNode");
      memfs.node_ops.mknod(node, "child", 123, 0);
      expect(spy).toHaveBeenCalled();
    });

    it("rename should rename node", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oldParent: any = { contents: { old: node }, timestamp: 0 };
      node.parent = oldParent;
      node.name = "old";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newDir: any = { contents: {}, timestamp: 0 };

      // Mock lookup failing (target doesn't exist)
      FS.lookupNode.mockImplementation(() => {
        throw new Error("not found");
      });

      memfs.node_ops.rename(node, newDir, "new");

      expect(oldParent.contents["old"]).toBeUndefined();
      expect(newDir.contents["new"]).toBe(node);
      expect(node.name).toBe("new");
    });

    it("rename should throw if target directory is not empty", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oldParent: any = { contents: { old: node }, timestamp: 0 };
      node.parent = oldParent;
      node.name = "old";
      FS.isDir.mockReturnValue(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targetNode: any = { contents: { existing: {} } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newDir: any = { contents: {}, timestamp: 0 };

      FS.lookupNode.mockReturnValue(targetNode);

      expect(() => memfs.node_ops.rename(node, newDir, "new")).toThrow();
    });

    it("unlink should remove file from parent", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parent: any = { contents: { file: {} }, timestamp: 0 };
      memfs.node_ops.unlink(parent, "file");
      expect(parent.contents["file"]).toBeUndefined();
    });

    it("rmdir should remove directory if empty", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parent: any = { contents: { dir: {} }, timestamp: 0 };
      const dirNode = asMemfsNode({
        contents: {},
        usedBytes: 0,
        timestamp: Date.now(),
      });
      FS.lookupNode.mockReturnValue(dirNode);

      memfs.node_ops.rmdir(parent, "dir");
      expect(parent.contents["dir"]).toBeUndefined();
    });

    it("rmdir should throw if directory not empty", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parent: any = { contents: { dir: {} }, timestamp: 0 };
      const dirNode = asMemfsNode({
        contents: { file: {} },
        usedBytes: 0,
        timestamp: Date.now(),
      });
      FS.lookupNode.mockReturnValue(dirNode);

      expect(() => memfs.node_ops.rmdir(parent, "dir")).toThrow();
    });

    it("readdir should return entries", () => {
      // Mock contents as object for directory
      node.contents = { a: {}, b: {} };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries: any = memfs.node_ops.readdir(node);
      expect(entries).toContain(".");
      expect(entries).toContain("..");
      expect(entries).toContain("a");
      expect(entries).toContain("b");
    });

    it("symlink should create symlink node", () => {
      const spy = vi.spyOn(memfs, "createNode");
      const linkNode = memfs.node_ops.symlink(node, "link", "target");
      expect(spy).toHaveBeenCalled();
      expect(linkNode.link).toBe("target");
    });

    it("readlink should return target", () => {
      FS.isLink.mockReturnValue(true);
      const linkNode = asMemfsNode({
        link: "target",
        mode: 41453,
        contents: null,
        usedBytes: 0,
        timestamp: Date.now(),
      });
      expect(memfs.node_ops.readlink(linkNode)).toBe("target");
    });

    it("readlink should throw if not a link", () => {
      FS.isLink.mockReturnValue(false);
      expect(() =>
        memfs.node_ops.readlink({} as unknown as MemfsNode),
      ).toThrow();
    });
  });

  describe("stream_ops", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stream: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any;

    beforeEach(() => {
      // Initialize ops
      memfs.mount({});
      node = {
        contents: new Uint8Array([1, 2, 3, 4, 5]),
        usedBytes: 5,
        timestamp: 0,
      };
      stream = { node, position: 0 };
    });

    it("read should read data into buffer", () => {
      const buffer = new Uint8Array(10);
      const bytesRead = memfs.stream_ops.read(stream, buffer, 0, 3, 0);
      expect(bytesRead).toBe(3);
      expect(buffer[0]).toBe(1);
      expect(buffer[1]).toBe(2);
      expect(buffer[2]).toBe(3);
    });

    it("read should return 0 if position at end", () => {
      const buffer = new Uint8Array(10);
      const bytesRead = memfs.stream_ops.read(stream, buffer, 0, 3, 5);
      expect(bytesRead).toBe(0);
    });

    it("read should use efficient copy if threshold met", () => {
      // Force efficient copy path
      // We can't easily spy on .set vs loop without deeper mocking, but we can verify result
      const largeData = new Uint8Array(20);
      for (let i = 0; i < 20; i++) largeData[i] = i;
      node.contents = largeData;
      node.usedBytes = 20;

      const buffer = new Uint8Array(20);
      const bytesRead = memfs.stream_ops.read(stream, buffer, 0, 10, 0);
      expect(bytesRead).toBe(10);
      expect(buffer[0]).toBe(0);
      expect(buffer[9]).toBe(9);
    });

    it("write should write data to node", () => {
      const buffer = new Uint8Array([10, 11]);
      const bytesWritten = memfs.stream_ops.write(
        stream,
        buffer,
        0,
        2,
        0,
        true,
      );
      expect(bytesWritten).toBe(2);
      expect(node.contents[0]).toBe(10);
      expect(node.contents[1]).toBe(11);
    });

    it("write should expand storage if needed", () => {
      const buffer = new Uint8Array([10, 11]);
      // canOwn=false ensures we hit the path that might need expansion if position+length > usedBytes
      // AND usedBytes > 0 (which it is, 5)
      // AND not rewriting existing bytes completely
      const bytesWritten = memfs.stream_ops.write(
        stream,
        buffer,
        0,
        2,
        5,
        false,
      );
      expect(bytesWritten).toBe(2);
      // node.usedBytes should be max(current, position + length) => max(5, 5+2) = 7
      expect(node.usedBytes).toBe(7);
      expect(node.contents[5]).toBe(10);
    });

    it("llseek should update position", () => {
      // SEEK_SET = 0
      let pos = memfs.stream_ops.llseek(stream, 2, 0);
      expect(pos).toBe(2);

      // SEEK_CUR = 1
      stream.position = 2;
      pos = memfs.stream_ops.llseek(stream, 1, 1);
      expect(pos).toBe(3);

      // SEEK_END = 2
      FS.isFile.mockReturnValue(true);
      pos = memfs.stream_ops.llseek(stream, -1, 2);
      expect(pos).toBe(4);
    });

    it("allocate should expand file", () => {
      memfs.stream_ops.allocate(stream, 0, 10);
      expect(node.contents.length).toBeGreaterThanOrEqual(10);
      expect(node.usedBytes).toBe(10);
    });

    it("mmap should return pointer and allocated status", () => {
      FS.isFile.mockReturnValue(true);
      mmapAlloc.mockReturnValue(100);

      const res = memfs.stream_ops.mmap(stream, 5, 0, 0, 0);

      expect(res.allocated).toBe(true);
      expect(res.ptr).toBe(100);
      expect(mmapAlloc).toHaveBeenCalledWith(5);
      // Check that data was copied to HEAP8
      expect(HEAP8[100]).toBe(1);
    });

    it("mmap should throw if not a file", () => {
      FS.isFile.mockReturnValue(false);
      expect(() => memfs.stream_ops.mmap(stream, 5, 0, 0, 0)).toThrow();
    });

    it("mmap should throw if allocation fails", () => {
      FS.isFile.mockReturnValue(true);
      mmapAlloc.mockReturnValue(0);
      expect(() => memfs.stream_ops.mmap(stream, 5, 0, 0, 0)).toThrow();
    });

    it("mmap should use existing buffer if possible", () => {
      FS.isFile.mockReturnValue(true);
      // Simulate contents being part of HEAP8
      // We need to create a node whose contents are a view of HEAP8
      const heapOffset = 200;
      node.contents = new Uint8Array(HEAP8.buffer, heapOffset, 5);

      const res = memfs.stream_ops.mmap(stream, 5, 0, 0, 0); // No MAP_PRIVATE (flag 2)

      expect(res.allocated).toBe(false);
      expect(res.ptr).toBe(heapOffset);
    });

    it("msync should call write", () => {
      const spy = vi.spyOn(memfs.stream_ops, "write");
      const buffer = new Uint8Array([1, 2]);

      memfs.stream_ops.msync(stream, buffer, 10, 2, 0);

      expect(spy).toHaveBeenCalledWith(stream, buffer, 0, 2, 10, false);
    });
  });
});
