/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOpfsUtil } from "./opfs-util";

describe("opfs-util", () => {
  let mockDeps: any;
  let mockRootDirectory: any;
  let mockSqlite3: any;
  let mockUtil: any;
  let mockState: any;
  let opfsUtil: any;
  let mockFileHandle: any;
  let mockDirectoryHandle: any;
  let mockSyncAccessHandle: any;

  beforeEach(() => {
    // Mocks for File System Access API
    mockSyncAccessHandle = {
      truncate: vi.fn(),
      write: vi.fn().mockReturnValue(0),
      read: vi.fn(),
      close: vi.fn(),
    };

    mockFileHandle = {
      kind: "file",
      name: "test-file",
      createSyncAccessHandle: vi.fn().mockResolvedValue(mockSyncAccessHandle),
    };

    mockDirectoryHandle = {
      kind: "directory",
      name: "test-dir",
      getDirectoryHandle: vi.fn(),
      getFileHandle: vi.fn(),
      removeEntry: vi.fn(),
      values: vi.fn(),
    };

    // Recursive structure for root
    mockRootDirectory = {
      ...mockDirectoryHandle,
      name: "root",
    };

    // Default behavior for getDirectoryHandle: return a new mock dir
    mockRootDirectory.getDirectoryHandle.mockResolvedValue(mockDirectoryHandle);
    mockRootDirectory.getFileHandle.mockResolvedValue(mockFileHandle);

    // Mock deps
    mockState = { opIds: { op1: {}, op2: {} } };
    mockUtil = {
      affirmIsDb: vi.fn(),
      affirmDbHeader: vi.fn(),
    };
    mockSqlite3 = {
      config: {
        log: vi.fn(),
      },
    };

    mockDeps = {
      state: mockState,
      util: mockUtil,
      sqlite3: mockSqlite3,
    };

    // Inject rootDirectory into the created instance manually since it's likely internal
    // But looking at the source, createOpfsUtil takes deps, but uses opfsUtil.rootDirectory which isn't passed in deps?
    // Ah, looking at the source:
    // `const opfsUtil = Object.create(null);`
    // `opfsUtil.rootDirectory` is accessed but never assigned in createOpfsUtil?
    // Wait, line 58: `let dh = opfsUtil.rootDirectory;`
    // The source code assumes `opfsUtil.rootDirectory` is set externally after creation!

    opfsUtil = createOpfsUtil(mockDeps);
    opfsUtil.rootDirectory = mockRootDirectory;
  });

  describe("randomFilename", () => {
    it("should generate a string of specified length", () => {
      const f = opfsUtil.randomFilename(10);
      expect(f).toHaveLength(10);
    });

    it("should use default length of 16", () => {
      const f = opfsUtil.randomFilename();
      expect(f).toHaveLength(16);
    });

    it("should generate different strings on subsequent calls", () => {
      const f1 = opfsUtil.randomFilename();
      const f2 = opfsUtil.randomFilename();
      expect(f1).not.toBe(f2);
    });
  });

  describe("getResolvedPath", () => {
    it("should resolve and normalize path", () => {
      const p = opfsUtil.getResolvedPath("foo/bar", false);
      expect(p).toBe("/foo/bar");
    });

    it("should split path into components if requested", () => {
      const p = opfsUtil.getResolvedPath("foo/bar", true);
      expect(p).toEqual(["foo", "bar"]);
    });

    it("should handle leading slash", () => {
      const p = opfsUtil.getResolvedPath("/foo/bar", true);
      expect(p).toEqual(["foo", "bar"]);
    });
  });

  describe("getDirForFilename", () => {
    it("should traverse directories", async () => {
      const [_dh, fn] = await opfsUtil.getDirForFilename(
        "/a/b/file.txt",
        false,
      );
      expect(mockRootDirectory.getDirectoryHandle).toHaveBeenCalledWith("a", {
        create: false,
      });
      // Since we return the same mockDirectoryHandle, it's called again on that
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith("b", {
        create: false,
      });
      expect(fn).toBe("file.txt");
    });

    it("should create directories if requested", async () => {
      await opfsUtil.getDirForFilename("/a/b/file.txt", true);
      expect(mockRootDirectory.getDirectoryHandle).toHaveBeenCalledWith("a", {
        create: true,
      });
    });
  });

  describe("mkdir", () => {
    it("should create directory successfully", async () => {
      const result = await opfsUtil.mkdir("/new/dir");
      expect(result).toBe(true);
      expect(mockRootDirectory.getDirectoryHandle).toHaveBeenCalledWith("new", {
        create: true,
      });
    });

    it("should return false on error", async () => {
      mockRootDirectory.getDirectoryHandle.mockRejectedValue(new Error("Fail"));
      const result = await opfsUtil.mkdir("/fail");
      expect(result).toBe(false);
    });
  });

  describe("entryExists", () => {
    it("should return true if file exists", async () => {
      mockDirectoryHandle.getFileHandle.mockResolvedValue(mockFileHandle);
      const result = await opfsUtil.entryExists("/exists.txt");
      expect(result).toBe(true);
    });

    it("should return false if file does not exist", async () => {
      mockDirectoryHandle.getFileHandle.mockRejectedValue(
        new Error("Not found"),
      );
      const result = await opfsUtil.entryExists("/missing.txt");
      expect(result).toBe(false);
    });
  });

  describe("treeList", () => {
    it("should list directory structure", async () => {
      // Setup an async iterator for values()
      const entries = [
        { kind: "file", name: "f1" },
        {
          kind: "directory",
          name: "d1",
          values: vi.fn().mockReturnValue((async function* () {})()),
        },
      ];

      mockRootDirectory.values.mockReturnValue(
        (async function* () {
          for (const e of entries) yield e;
        })(),
      );

      const tree = await opfsUtil.treeList();
      expect(tree.files).toContain("f1");
      expect(tree.dirs).toHaveLength(1);
    });
  });

  describe("rmfr", () => {
    it("should remove all entries in root", async () => {
      const entries = [{ kind: "file", name: "f1" }];
      mockRootDirectory.values.mockReturnValue(
        (async function* () {
          for (const e of entries) yield e;
        })(),
      );

      await opfsUtil.rmfr();
      expect(mockRootDirectory.removeEntry).toHaveBeenCalledWith("f1", {
        recurse: true,
      });
    });
  });

  describe("unlink", () => {
    it("should remove specific file", async () => {
      const result = await opfsUtil.unlink("/foo.txt");
      expect(result).toBe(true);
      expect(mockDirectoryHandle.removeEntry).toHaveBeenCalledWith("foo.txt", {
        recursive: false,
      });
    });

    it("should throw if requested on error", async () => {
      mockDirectoryHandle.removeEntry.mockRejectedValue(new Error("Fail"));
      await expect(opfsUtil.unlink("/foo.txt", false, true)).rejects.toThrow(
        "unlink(",
      );
    });

    it("should return false on error if not throwing", async () => {
      mockDirectoryHandle.removeEntry.mockRejectedValue(new Error("Fail"));
      const result = await opfsUtil.unlink("/foo.txt", false, false);
      expect(result).toBe(false);
    });
  });

  describe("traverse", () => {
    it("should traverse all entries", async () => {
      const entries = [{ kind: "file", name: "f1" }];

      mockRootDirectory.values.mockReturnValue(
        (async function* () {
          for (const e of entries) yield e;
        })(),
      );

      const callback = vi.fn().mockReturnValue(true);

      // The issue is likely that traverse is async, but doDir inside it is NOT awaited if it's not awaited in the implementation.
      // Looking at the implementation:
      // doDir(opt.directory, 0);
      // It calls doDir but does NOT await it!

      // We need to wait for the promises to settle.
      await opfsUtil.traverse({ callback, directory: mockRootDirectory });

      // Wait a tick for the un-awaited async function to run
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("importDb", () => {
    it("should import from ArrayBuffer", async () => {
      const data = new Uint8Array([1, 2, 3]).buffer;
      Object.defineProperty(data, "byteLength", { value: 3 });

      mockSyncAccessHandle.write.mockReturnValue(3);

      const n = await opfsUtil.importDb("/db.sqlite", data);

      expect(mockUtil.affirmIsDb).toHaveBeenCalled();
      expect(mockSyncAccessHandle.truncate).toHaveBeenCalledWith(0);
      expect(mockSyncAccessHandle.write).toHaveBeenCalled();
      expect(n).toBe(3);
    });

    it("should import chunked", async () => {
      const chunks = [new Uint8Array(512), undefined];
      let i = 0;
      const cb = () => Promise.resolve(chunks[i++]);

      // First chunk is 512, write returns 512
      mockSyncAccessHandle.write.mockReturnValue(512);

      const n = await opfsUtil.importDb("/db.sqlite", cb);
      expect(n).toBe(512);
    });
  });

  describe("metrics", () => {
    it("should dump metrics", () => {
      // Need to match state.opIds structure
      const metrics = {
        op1: { count: 1, time: 10, wait: 5 },
        op2: { count: 1, time: 10, wait: 5 },
        s11n: {},
      };
      const W = { postMessage: vi.fn() };

      // globalThis.location might be undefined in test env
      const originalLocation = globalThis.location;
      // @ts-expect-error Mocking global location
      globalThis.location = { href: "http://test.com" };

      try {
        opfsUtil.metrics.dump(metrics, W);
      } finally {
        globalThis.location = originalLocation;
      }

      expect(mockSqlite3.config.log).toHaveBeenCalled();
      expect(W.postMessage).toHaveBeenCalledWith({
        type: "opfs-async-metrics",
      });
    });

    it("should reset metrics", () => {
      const metrics = { op1: { count: 1, time: 10, wait: 5 }, s11n: {} };
      opfsUtil.metrics.reset(metrics);
      expect(metrics.op1.count).toBe(0);
    });
  });

  describe("debug", () => {
    it("should asyncShutdown", () => {
      const opRun = vi.fn();
      const warn = vi.fn();
      opfsUtil.debug.asyncShutdown(opRun, warn);
      expect(opRun).toHaveBeenCalledWith("opfs-async-shutdown");
      expect(warn).toHaveBeenCalled();
    });

    it("should asyncRestart", () => {
      const W = { postMessage: vi.fn() };
      const warn = vi.fn();
      opfsUtil.debug.asyncRestart(W, warn);
      expect(W.postMessage).toHaveBeenCalledWith({
        type: "opfs-async-restart",
      });
      expect(warn).toHaveBeenCalled();
    });
  });
});
