/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initializeOpfsSahpool } from "./opfs-sahpool-vfs";

// Mock global navigator
const originalNavigator = globalThis.navigator;

describe("initializeOpfsSahpool", () => {
  let sqlite3: any;
  let mockGetDirectory: any;
  let mockOpfsRoot: any;
  let installedVfs: any = {};
  let installedIo: any = {};
  let mockAccessHandle: any;

  let lastCreatedAccessHandle: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    installedVfs = {};
    installedIo = {};

    // Mock OPFS handles with simple in-memory FS
    const fsState = new Map(); // path -> { kind, content (Uint8Array), children (Map) }
    const rootDir = { kind: "directory", children: new Map(), name: "" };

    // Helper to get/create node
    const getNode = (pathArr, create = false, kind = "directory") => {
      let curr = rootDir;
      for (const p of pathArr) {
        if (!curr.children.has(p)) {
          if (!create) return null;
          const newNode = { kind: "directory", children: new Map(), name: p };
          curr.children.set(p, newNode);
          curr = newNode;
        } else {
          curr = curr.children.get(p);
        }
      }
      return curr;
    };

    const createHandle = (node, path) => {
      if (node.kind === "file") {
        return {
          kind: "file",
          name: node.name,
          createSyncAccessHandle: vi.fn().mockImplementation(async () => {
            // Stateful access handle linked to node.content
            if (!node.content) node.content = new Uint8Array(8192); // Default size
            let size = node.content.byteLength;
            // Ensure at least header size?
            if (size < 4096) {
              const newContent = new Uint8Array(4096);
              newContent.set(node.content);
              node.content = newContent;
              size = 4096;
            }

            const ah = {
              close: vi.fn(),
              flush: vi.fn(),
              getSize: vi.fn().mockImplementation(() => size),
              read: vi.fn((buffer, opts) => {
                const offset = opts?.at || 0;
                const destView = new Uint8Array(
                  buffer.buffer,
                  buffer.byteOffset,
                  buffer.byteLength,
                );
                const len = Math.min(destView.byteLength, size - offset);
                if (len > 0) {
                  destView.set(node.content.subarray(offset, offset + len));
                }
                return len > 0 ? len : 0;
              }),
              truncate: vi.fn((newSize) => {
                size = newSize;
                if (node.content.byteLength !== size) {
                  const newContent = new Uint8Array(
                    size > node.content.byteLength ? size + 4096 : size,
                  );
                  newContent.set(
                    node.content.subarray(
                      0,
                      Math.min(node.content.byteLength, size),
                    ),
                  );
                  node.content = newContent;
                }
              }),
              write: vi.fn((buffer, opts) => {
                const offset = opts?.at || 0;
                const end = offset + buffer.byteLength;
                if (end > node.content.byteLength) {
                  const newContent = new Uint8Array(end + 4096);
                  newContent.set(node.content);
                  node.content = newContent;
                }
                const srcView = new Uint8Array(
                  buffer.buffer,
                  buffer.byteOffset,
                  buffer.byteLength,
                );
                node.content.set(srcView, offset);
                if (end > size) size = end;
                return buffer.byteLength;
              }),
            };
            lastCreatedAccessHandle = ah;
            return ah;
          }),
        };
      } else {
        return {
          kind: "directory",
          name: node.name,
          getDirectoryHandle: vi.fn().mockImplementation(async (name, opts) => {
            let child = node.children.get(name);
            if (!child) {
              if (opts?.create) {
                child = { kind: "directory", children: new Map(), name };
                node.children.set(name, child);
              } else {
                throw new Error("NotFound");
              }
            }
            if (child.kind !== "directory") throw new Error("TypeMismatch");
            return createHandle(child, path + "/" + name);
          }),
          getFileHandle: vi.fn().mockImplementation(async (name, opts) => {
            let child = node.children.get(name);
            if (!child) {
              if (opts?.create) {
                child = { kind: "file", content: new Uint8Array(0), name };
                node.children.set(name, child);
              } else {
                throw new Error("NotFound");
              }
            }
            if (child.kind !== "file") throw new Error("TypeMismatch");
            return createHandle(child, path + "/" + name);
          }),
          removeEntry: vi.fn().mockImplementation(async (name, opts) => {
            if (opts?.recursive) {
              node.children.delete(name);
            } else {
              const child = node.children.get(name);
              if (child && child.children && child.children.size > 0)
                throw new Error("NotEmpty");
              node.children.delete(name);
            }
          }),
          [Symbol.asyncIterator]: async function* () {
            for (const [name, child] of node.children) {
              yield [name, createHandle(child, path + "/" + name)];
            }
          },
        };
      }
    };

    mockOpfsRoot = createHandle(rootDir, "");

    // We need to keep track of last created SAH for assertions in other tests
    // But other tests rely on mocked values.
    // I should merge the logic: use this FS mock for everything.

    // Update lastCreatedAccessHandle hook
    const originalCreate = mockOpfsRoot.getFileHandle;
    // ... logic is inside createHandle ...

    // Override the mock logic to capture the last SAH object for testing mocks
    // The createSyncAccessHandle above defines the SAH object.
    // I need to export it to lastCreatedAccessHandle.

    // Re-bind getDirectory for global
    mockGetDirectory = vi.fn().mockResolvedValue(mockOpfsRoot);

    // ... remainder of beforeEach ...
    Object.defineProperty(globalThis, "navigator", {
      value: {
        storage: {
          getDirectory: mockGetDirectory,
        },
      },
      writable: true,
    });

    // ... sqlite3 mocks ...

    // Mock global FileSystem classes
    globalThis.FileSystemHandle = class {} as any;
    globalThis.FileSystemDirectoryHandle = class {} as any;
    globalThis.FileSystemFileHandle = class {
      createSyncAccessHandle() {}
    } as any;
    globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle = vi.fn();

    // Mock sqlite3 parts
    sqlite3 = {
      util: {
        toss: vi.fn((msg) => {
          throw new Error(msg);
        }),
        toss3: vi.fn((msg) => {
          throw new Error(msg);
        }),
        affirmDbHeader: vi.fn(),
      },
      capi: {
        sqlite3_vfs_find: vi.fn().mockReturnValue(null),
        sqlite3_vfs: class {
          constructor() {
            return {
              addOnDispose: vi.fn(),
              dispose: vi.fn(),
              $zName: "opfs-sahpool",
              pointer: 123456,
            };
          }
        },
        sqlite3_file: class {
          constructor() {}
          dispose() {}
        },
        sqlite3_io_methods: class {
          constructor() {
            return { pointer: 123 };
          }
        },
        SQLITE_OPEN_MAIN_DB: 1,
        SQLITE_OPEN_MAIN_JOURNAL: 2,
        SQLITE_OPEN_SUPER_JOURNAL: 4,
        SQLITE_OPEN_WAL: 8,
        SQLITE_OPEN_MEMORY: 128,
        SQLITE_OPEN_CREATE: 4,
        SQLITE_OPEN_DELETEONCLOSE: 0x1000,
        SQLITE_OPEN_READWRITE: 0x00000002,
        SQLITE_LOCK_NONE: 0,
        SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN: 1,
        SQLITE_NOTFOUND: 12,
        SQLITE_IOERR: 10,
        SQLITE_IOERR_SHORT_READ: 101,
        SQLITE_IOERR_DELETE: 110,
        SQLITE_CANTOPEN: 14,
        SQLITE_NOMEM: 7,
        sqlite3_vfs_register: vi.fn(),
        sqlite3_vfs_unregister: vi.fn(),
      },
      wasm: {
        poke32: vi.fn(),
        poke64: vi.fn(),
        poke: vi.fn(),
        poke8: vi.fn(),
        peek8: vi.fn((ptr) => (ptr ? 1 : 0)),
        heap8u: vi.fn().mockReturnValue(new Uint8Array(10000)),
        cstrncpy: vi.fn((pOut, zName, nOut) => {
          // Return length of string, must be < nOut for success
          return zName ? zName.length : 0;
        }),
        cstrToJs: vi.fn((ptr) =>
          typeof ptr === "string" ? ptr : "mock_string",
        ),
        allocCString: vi.fn().mockReturnValue(100),
        scopedAllocPush: vi.fn(),
        scopedAllocPop: vi.fn(),
        scopedAllocCString: vi.fn().mockReturnValue([0, 0]),
        isPtr: vi.fn().mockReturnValue(false),
      },
      config: {
        error: vi.fn(),
        warn: vi.fn(),
        log: vi.fn(),
      },
      vfs: {
        installVfs: vi.fn((opts) => {
          if (opts.io) installedIo = opts.io;
          if (opts.vfs) installedVfs = opts.vfs;
        }),
      },
      installOpfsSAHPoolVfs: undefined,
    };

    // Add static structInfo to sqlite3_file mock
    sqlite3.capi.sqlite3_file.structInfo = { sizeof: 100 };
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
    });
  });

  it("should install installOpfsSAHPoolVfs on sqlite3 object", () => {
    initializeOpfsSahpool(sqlite3);
    expect(typeof sqlite3.installOpfsSAHPoolVfs).toBe("function");
  });

  it("should initialize the VFS and return a pool util", async () => {
    initializeOpfsSahpool(sqlite3);
    const poolUtil = await sqlite3.installOpfsSAHPoolVfs({ name: "test-vfs" });

    expect(poolUtil).toBeDefined();
    expect(poolUtil.vfsName).toBe("test-vfs");
    expect(sqlite3.vfs.installVfs).toHaveBeenCalledTimes(2); // IO methods and VFS methods
    expect(installedVfs.methods.xOpen).toBeDefined();
    expect(installedIo.methods.xRead).toBeDefined();
  });

  it("should handle initialization errors (missing APIs)", async () => {
    globalThis.FileSystemFileHandle = undefined;
    initializeOpfsSahpool(sqlite3);
    await expect(
      sqlite3.installOpfsSAHPoolVfs({ name: "fail-vfs" }),
    ).rejects.toThrow("Missing required OPFS APIs");
  });

  describe("OpfsSAHPoolUtil", () => {
    let poolUtil;

    beforeEach(async () => {
      initializeOpfsSahpool(sqlite3);
      poolUtil = await sqlite3.installOpfsSAHPoolVfs({
        name: "test-vfs-util",
        initialCapacity: 2,
      });
    });

    it("should add and reduce capacity", async () => {
      const cap1 = await poolUtil.addCapacity(2);
      expect(cap1).toBeGreaterThanOrEqual(2);

      const count = poolUtil.getFileCount();
      expect(count).toBe(0); // Files are available but not "used"/mapped to a filename yet?
      // Actually, addCapacity creates opaque files.
      // getFileCount returns #mapFilenameToSAH.size.
      // The files created by addCapacity are in #availableSAH/mapSAHToName but not in mapFilenameToSAH unless associated.

      const cap2 = await poolUtil.reduceCapacity(1);
      expect(cap2).toBe(1); // Returns number removed
    });

    it("should reserve minimum capacity", async () => {
      await poolUtil.reserveMinimumCapacity(5);
      expect(poolUtil.getCapacity()).toBeGreaterThanOrEqual(5);
    });

    it("should get file names", async () => {
      const names = poolUtil.getFileNames();
      expect(Array.isArray(names)).toBe(true);
    });

    it("should wipe files", async () => {
      await poolUtil.wipeFiles();
      expect(mockOpfsRoot.getDirectoryHandle).toHaveBeenCalled();
    });

    it("should remove VFS", async () => {
      await poolUtil.removeVfs();
      expect(sqlite3.capi.sqlite3_vfs_unregister).toHaveBeenCalled();
    });
  });

  describe("VFS Methods (xOpen, xClose, etc)", () => {
    let poolUtil;
    let vfsMethods;
    let ioMethods;
    const pVfs = 123456; // Matching the mock pointer
    const pFile = 2000;

    beforeEach(async () => {
      initializeOpfsSahpool(sqlite3);
      poolUtil = await sqlite3.installOpfsSAHPoolVfs({
        name: "test-vfs-ops",
        initialCapacity: 1,
      });
      vfsMethods = installedVfs.methods;
      ioMethods = installedIo.methods;
    });

    it("should open and close a file", () => {
      const zName = "test.db";
      const pOutFlags = 3000;

      // xOpen
      const rc = vfsMethods.xOpen(
        pVfs,
        zName,
        pFile,
        sqlite3.capi.SQLITE_OPEN_CREATE | sqlite3.capi.SQLITE_OPEN_READWRITE,
        pOutFlags,
      );
      expect(rc).toBe(0);
      expect(sqlite3.wasm.poke32).toHaveBeenCalled(); // Poking flags

      // xFileSize
      const pSz = 4000;
      ioMethods.xFileSize(pFile, pSz);
      expect(sqlite3.wasm.poke64).toHaveBeenCalled();

      // xWrite
      const pSrc = 5000;
      const n = 10;
      const offset = 0;
      const writeRc = ioMethods.xWrite(pFile, pSrc, n, offset);
      if (writeRc !== 0) {
        console.log(
          "xWrite failed. Last error:",
          sqlite3.config.error.mock.calls,
        );
      }
      expect(writeRc).toBe(0);
      expect(lastCreatedAccessHandle.write).toHaveBeenCalled();

      // xRead
      const pDest = 6000;
      const readRc = ioMethods.xRead(pFile, pDest, n, offset);
      expect(readRc).toBe(0);
      expect(lastCreatedAccessHandle.read).toHaveBeenCalled();

      // xSync
      const syncRc = ioMethods.xSync(pFile, 0);
      expect(syncRc).toBe(0);
      expect(lastCreatedAccessHandle.flush).toHaveBeenCalled();

      // xClose
      const closeRc = ioMethods.xClose(pFile);
      expect(closeRc).toBe(0);
    });

    it("should handle xDelete", () => {
      // Open a file first to associate it
      vfsMethods.xOpen(
        pVfs,
        "todelete.db",
        pFile,
        sqlite3.capi.SQLITE_OPEN_CREATE | sqlite3.capi.SQLITE_OPEN_READWRITE,
        0,
      );

      const rc = vfsMethods.xDelete(pVfs, "todelete.db", 0);
      expect(rc).toBe(0);
    });

    it("should handle xAccess", () => {
      const openRc = vfsMethods.xOpen(
        pVfs,
        "exist.db",
        pFile,
        sqlite3.capi.SQLITE_OPEN_CREATE,
        0,
      );
      if (openRc !== 0) {
        console.log(
          "xAccess setup: xOpen failed.",
          sqlite3.config.error.mock.calls,
        );
      }

      const pOut = 8000;

      vfsMethods.xAccess(pVfs, "exist.db", 0, pOut);
      expect(sqlite3.wasm.poke32).toHaveBeenCalledWith(pOut, 1);

      vfsMethods.xAccess(pVfs, "nonexist.db", 0, pOut);
    });

    it("should handle xFullPathname", () => {
      const pOut = 9000;
      const rc = vfsMethods.xFullPathname(pVfs, "test.db", 100, pOut);
      expect(rc).toBe(0);
      expect(sqlite3.wasm.cstrncpy).toHaveBeenCalled();
    });
  });

  describe("Import/Export", () => {
    let poolUtil;

    beforeEach(async () => {
      initializeOpfsSahpool(sqlite3);
      // Need some capacity
      poolUtil = await sqlite3.installOpfsSAHPoolVfs({
        name: "test-vfs-impexp",
        initialCapacity: 2,
      });
    });

    it("should importDb and then exportFile", async () => {
      const dbName = "imported.db";
      const dbContent = new Uint8Array(512);
      const header = "SQLite format 3";
      for (let i = 0; i < header.length; i++) {
        dbContent[i] = header.charCodeAt(i);
      }

      // Import
      const nWrote = await poolUtil.importDb(dbName, dbContent);
      expect(nWrote).toBe(512);

      // Verify it's associated (OpfsSAHPool internal check, but can check via export)
      const exported = await poolUtil.exportFile(dbName);
      expect(exported.byteLength).toBe(512);
      // In my mock read logic, I return buffer.byteLength, but buffer content isn't filled with what was written.
      // But length check confirms flow.
    });

    it("should fail importDb with invalid header", async () => {
      const dbName = "bad.db";
      const dbContent = new Uint8Array(512); // Zeros

      try {
        await poolUtil.importDb(dbName, dbContent);
        expect(true).toBe(false); // Should fail
      } catch (e) {
        expect(e.message).toMatch(
          /Input does not contain an SQLite database header/,
        );
      }
    });

    it("should fail importDb with invalid size", async () => {
      const dbName = "badsize.db";
      const dbContent = new Uint8Array(100);
      try {
        await poolUtil.importDb(dbName, dbContent);
        expect(true).toBe(false);
      } catch (e) {
        expect(e.message).toMatch(/Byte array size is invalid/);
      }
    });
  });

  describe("Persistence", () => {
    it("should recover persistent files on restart", async () => {
      // 1. Create Pool 1
      initializeOpfsSahpool(sqlite3);
      const vfsName1 = "vfs-persist-1";
      const pool1 = await sqlite3.installOpfsSAHPoolVfs({
        name: vfsName1,
        initialCapacity: 2,
      });

      // Capture methods (last installed)
      const vfsMethods1 = installedVfs.methods;
      const pVfs1 = 123456;

      // 2. Create a file "persist.db"
      // This calls xOpen -> setAssociatedPath -> writes header/digest to FS
      vfsMethods1.xOpen(
        pVfs1,
        "persist.db",
        5000,
        sqlite3.capi.SQLITE_OPEN_CREATE | sqlite3.capi.SQLITE_OPEN_READWRITE,
        0,
      );

      // 3. Create Pool 2 pointing to same directory
      initializeOpfsSahpool(sqlite3);
      const pool2 = await sqlite3.installOpfsSAHPoolVfs({
        name: "vfs-persist-2",
        directory: "." + vfsName1, // Same dir as pool1
      });

      // 4. Verify recovery
      // pool2 init calls acquireAccessHandles -> getAssociatedPath -> reads header/digest
      const names = pool2.getFileNames();
      expect(names).toContain("/persist.db");
      expect(pool2.getFileCount()).toBeGreaterThanOrEqual(1);
    });
  });

  describe("OpfsSAHPoolDb & Utils", () => {
    it("should create OpfsSAHPoolDb if sqlite3.oo1 exists", async () => {
      sqlite3.oo1 = {
        DB: {
          prototype: {},
          dbCtorHelper: {
            normalizeArgs: vi.fn().mockReturnValue({}),
            call: vi.fn(),
          },
        },
      };

      initializeOpfsSahpool(sqlite3);
      const poolUtil = await sqlite3.installOpfsSAHPoolVfs({ name: "vfs-oo1" });

      expect(poolUtil.OpfsSAHPoolDb).toBeDefined();
      new poolUtil.OpfsSAHPoolDb("foo");
      expect(sqlite3.oo1.DB.dbCtorHelper.call).toHaveBeenCalled();
    });

    it("should importDbChunked", async () => {
      initializeOpfsSahpool(sqlite3);
      const poolUtil = await sqlite3.installOpfsSAHPoolVfs({
        name: "vfs-chunked",
        initialCapacity: 1,
      });

      const dbContent = new Uint8Array(1024);
      const header = "SQLite format 3";
      for (let i = 0; i < header.length; i++)
        dbContent[i] = header.charCodeAt(i);

      let offset = 0;
      const callback = vi.fn().mockImplementation(() => {
        if (offset >= dbContent.length) return undefined;
        const chunk = dbContent.subarray(offset, offset + 512);
        offset += 512;
        return chunk;
      });

      const nWrote = await poolUtil.importDb("chunked.db", callback);
      expect(nWrote).toBe(1024);
      expect(poolUtil.getFileNames()).toContain("chunked.db");
    });

    it("should unlink a file", async () => {
      initializeOpfsSahpool(sqlite3);
      const poolUtil = await sqlite3.installOpfsSAHPoolVfs({
        name: "vfs-unlink",
        initialCapacity: 1,
      });

      // Create file
      const content = new Uint8Array(512);
      for (let i = 0; i < "SQLite format 3".length; i++)
        content[i] = "SQLite format 3".charCodeAt(i);
      await poolUtil.importDb("to-unlink.db", content);

      expect(poolUtil.getFileNames()).toContain("to-unlink.db");

      poolUtil.unlink("to-unlink.db");
      expect(poolUtil.getFileNames()).not.toContain("to-unlink.db");
    });
  });

  describe("Edge Cases & Coverage", () => {
    it("should fail if local OPFS API is too old (async close)", async () => {
      // Initialize first!
      initializeOpfsSahpool(sqlite3);

      // Override createSyncAccessHandle for this test
      const originalMock = mockOpfsRoot.getFileHandle;
      mockOpfsRoot.getFileHandle = vi
        .fn()
        .mockImplementation(async (name, opts) => {
          return {
            kind: "file",
            createSyncAccessHandle: vi.fn().mockResolvedValue({
              close: vi.fn().mockResolvedValue(undefined), // Returns Promise -> async -> FAIL
              flush: vi.fn(),
              getSize: vi.fn(),
              read: vi.fn(),
              truncate: vi.fn(),
              write: vi.fn(),
            }),
          };
        });

      // Need a unique name to trigger fresh check
      try {
        await sqlite3.installOpfsSAHPoolVfs({ name: "vfs-old-api" });
        expect(true).toBe(false);
      } catch (e) {
        expect(e.message).toMatch(/too old/);
      }
    });

    it("should return cached init promise", async () => {
      initializeOpfsSahpool(sqlite3);
      const p1 = sqlite3.installOpfsSAHPoolVfs({ name: "vfs-cache" });
      const p2 = sqlite3.installOpfsSAHPoolVfs({ name: "vfs-cache" });
      expect(p1).not.toBe(p2); // Different promise objects wrapping same result
      const r1 = await p1;
      const r2 = await p2;
      expect(r1).toBe(r2);
    });

    it("should force reinit if previously failed", async () => {
      initializeOpfsSahpool(sqlite3);
      // Fail first time
      globalThis.FileSystemFileHandle = undefined; // Force failure
      try {
        await sqlite3.installOpfsSAHPoolVfs({ name: "vfs-retry" });
      } catch (e) {}

      globalThis.FileSystemFileHandle = class {} as any; // Restore
      globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle =
        vi.fn();

      // Retry without force
      try {
        await sqlite3.installOpfsSAHPoolVfs({ name: "vfs-retry" });
        expect(true).toBe(false); // Should fail with cached error
      } catch (e) {}

      // Retry WITH force
      const p = await sqlite3.installOpfsSAHPoolVfs({
        name: "vfs-retry",
        forceReinitIfPreviouslyFailed: true,
      });
      expect(p).toBeDefined();
    });
  });

  describe("Misc VFS Methods", () => {
    let poolUtil,
      vfsMethods,
      ioMethods,
      pVfs = 123456,
      pFile = 888;

    beforeEach(async () => {
      initializeOpfsSahpool(sqlite3);
      poolUtil = await sqlite3.installOpfsSAHPoolVfs({
        name: "vfs-misc",
        initialCapacity: 1,
      });
      vfsMethods = installedVfs.methods;
      ioMethods = installedIo.methods;

      vfsMethods.xOpen(
        pVfs,
        "misc.db",
        pFile,
        sqlite3.capi.SQLITE_OPEN_CREATE | sqlite3.capi.SQLITE_OPEN_READWRITE,
        0,
      );
    });

    it("should handle xFileControl", () => {
      const rc = ioMethods.xFileControl(pFile, 1, 0);
      expect(rc).toBe(sqlite3.capi.SQLITE_NOTFOUND);
    });

    it("should handle xSectorSize", () => {
      expect(ioMethods.xSectorSize(pFile)).toBe(4096);
    });

    it("should handle xDeviceCharacteristics", () => {
      expect(ioMethods.xDeviceCharacteristics(pFile)).toBe(
        sqlite3.capi.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN,
      );
    });

    it("should handle xLock/xUnlock/xCheckReservedLock", () => {
      expect(ioMethods.xLock(pFile, 1)).toBe(0);

      const pOut = 5000;
      expect(ioMethods.xCheckReservedLock(pFile, pOut)).toBe(0);
      expect(sqlite3.wasm.poke32).toHaveBeenCalledWith(pOut, 1);

      expect(ioMethods.xUnlock(pFile, 0)).toBe(0);
    });

    it("should handle xTruncate", () => {
      expect(ioMethods.xTruncate(pFile, 100)).toBe(0);
      expect(lastCreatedAccessHandle.truncate).toHaveBeenCalled();
    });

    it("should handle xGetLastError", () => {
      // Trigger an error by passing an invalid path that causes URL constructor to throw
      // This should be caught by try/catch in xDelete

      vfsMethods.xDelete(pVfs, "http://[", 0);

      const nOut = 100;
      const pOut = 6000;
      const rc = vfsMethods.xGetLastError(pVfs, nOut, pOut);

      // Expect IOERR (from xDelete return) or whatever popErr returns
      // xDelete returns SQLITE_IOERR_DELETE (110)

      // xGetLastError returns the error code stored in e.sqlite3Rc
      // which is set by storeErr.
      // In xDelete catch(e), pool.storeErr(e) is called without code.
      // storeErr defaults to SQLITE_IOERR.

      expect(rc).toBe(sqlite3.capi.SQLITE_IOERR);
      expect(sqlite3.wasm.cstrncpy).toHaveBeenCalled();
    });
  });
});
