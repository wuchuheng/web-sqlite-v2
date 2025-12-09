import { describe, it, expect, vi, beforeEach } from "vitest";
import { createVfsSyncWrappers } from "./vfs-sync-wrappers";
// import type { VfsSyncWrapperDeps } from "../../../shared/opfs-vfs-installer";

describe("vfs-sync-wrappers", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let deps: any;
  let mockWasm: any;
  let mockCapi: any;
  let mockState: any;
  let mockOpRun: any;
  let mockMTimeStart: any;
  let mockMTimeEnd: any;
  let mockOpfsIoMethods: any;
  let mockRandomFilename: any;
  let mockOpenFiles: any;
  let mockSqlite3File: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  beforeEach(() => {
    mockWasm = {
      cstrToJs: vi.fn((ptr) => (ptr === 100 ? "test.db" : "unknown")),
      poke: vi.fn(),
      cstrncpy: vi.fn((_pOut, _zName, nOut) => {
        return nOut > 5 ? 5 : nOut; // Mock copying logic
      }),
      isPtr: vi.fn((val) => typeof val === "number" && val !== 0),
    };

    mockCapi = {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      sqlite3_file: class MockSqlite3File {
        pointer: any;
        constructor(ptr: any) {
          this.pointer = ptr;
        }
      },
      /* eslint-enable @typescript-eslint/no-explicit-any */
      SQLITE_CANTOPEN: 14,
      sqlite3_uri_boolean: vi.fn(() => 0),
      SQLITE_OPEN_CREATE: 0x00000004,
      SQLITE_OPEN_READONLY: 0x00000001,
      SQLITE_LOCK_NONE: 0,
    };
    mockSqlite3File = mockCapi.sqlite3_file;

    mockState = {
      opfsFlags: {
        OPFS_UNLOCK_ASAP: 1,
        OPFS_UNLINK_BEFORE_OPEN: 2,
      },
      fileBufferSize: 4096,
      sabFileBufView: new Uint8Array(4096),
    };

    mockOpRun = vi.fn(() => 0);
    mockMTimeStart = vi.fn();
    mockMTimeEnd = vi.fn();

    mockOpfsIoMethods = {
      pointer: 12345,
    };

    mockRandomFilename = vi.fn(() => "random_file.db");
    mockOpenFiles = {};

    deps = {
      wasm: mockWasm,
      capi: mockCapi,
      state: mockState,
      opRun: mockOpRun,
      mTimeStart: mockMTimeStart,
      mTimeEnd: mockMTimeEnd,
      opfsIoMethods: mockOpfsIoMethods,
      randomFilename: mockRandomFilename,
      __openFiles: mockOpenFiles,
    };
  });

  it("should create wrappers object", () => {
    const wrappers = createVfsSyncWrappers(deps);
    expect(wrappers).toHaveProperty("xAccess");
    expect(wrappers).toHaveProperty("xOpen");
    expect(wrappers).toHaveProperty("xDelete");
  });

  it("xAccess should check file accessibility", () => {
    const wrappers = createVfsSyncWrappers(deps);
    const pVfs = 1;
    const zName = 100; // "test.db"
    const flags = 0;
    const pOut = 200;

    // Success case
    mockOpRun.mockReturnValue(0); // 0 usually means success/exists in opRun context here
    wrappers.xAccess(pVfs, zName, flags, pOut);

    expect(mockMTimeStart).toHaveBeenCalledWith("xAccess");
    expect(mockWasm.cstrToJs).toHaveBeenCalledWith(zName);
    expect(mockOpRun).toHaveBeenCalledWith("xAccess", "test.db");
    // If opRun returns 0 (success/exists), poke 1 (true)
    expect(mockWasm.poke).toHaveBeenCalledWith(pOut, 1, "i32");
    expect(mockMTimeEnd).toHaveBeenCalled();

    // Failure case
    mockOpRun.mockReturnValue(1); // Non-zero return
    wrappers.xAccess(pVfs, zName, flags, pOut);
    // If opRun returns 1 (fail), poke 0 (false)
    expect(mockWasm.poke).toHaveBeenCalledWith(pOut, 0, "i32");
  });

  it("xCurrentTime should return Julian day", () => {
    const wrappers = createVfsSyncWrappers(deps);
    const pVfs = 1;
    const pOut = 200;

    wrappers.xCurrentTime(pVfs, pOut);
    expect(mockWasm.poke).toHaveBeenCalledWith(
      pOut,
      expect.any(Number),
      "double",
    );
    const callArgs = mockWasm.poke.mock.calls[0];
    expect(callArgs[1]).toBeGreaterThan(2440587.5); // Greater than epoch
  });

  it("xCurrentTimeInt64 should return Unix time in ms", () => {
    const wrappers = createVfsSyncWrappers(deps);
    const pVfs = 1;
    const pOut = 200;

    wrappers.xCurrentTimeInt64(pVfs, pOut);
    expect(mockWasm.poke).toHaveBeenCalledWith(pOut, expect.any(Number), "i64");
  });

  it("xDelete should delete a file", () => {
    const wrappers = createVfsSyncWrappers(deps);
    const pVfs = 1;
    const zName = 100;
    const doSyncDir = 1;

    mockOpRun.mockReturnValue(0);
    const rc = wrappers.xDelete(pVfs, zName, doSyncDir);

    expect(mockMTimeStart).toHaveBeenCalledWith("xDelete");
    expect(mockOpRun).toHaveBeenCalledWith(
      "xDelete",
      "test.db",
      doSyncDir,
      false,
    );
    expect(mockMTimeEnd).toHaveBeenCalled();
    expect(rc).toBe(0);
  });

  it("xFullPathname should copy filename", () => {
    const wrappers = createVfsSyncWrappers(deps);
    const pVfs = 1;
    const zName = 100;
    const nOut = 10;
    const pOut = 200;

    const rc = wrappers.xFullPathname(pVfs, zName, nOut, pOut);
    expect(mockWasm.cstrncpy).toHaveBeenCalledWith(pOut, zName, nOut);
    expect(rc).toBe(0);
  });

  it("xFullPathname should return error if buffer too small", () => {
    const wrappers = createVfsSyncWrappers(deps);
    const pVfs = 1;
    const zName = 100;
    const nOut = 2; // Too small (mock returns 5 copied)
    const pOut = 200;

    mockWasm.cstrncpy.mockReturnValue(5); // Copied 5 bytes
    const rc = wrappers.xFullPathname(pVfs, zName, nOut, pOut);
    expect(rc).toBe(mockCapi.SQLITE_CANTOPEN);
  });

  it("xGetLastError should return 0", () => {
    const wrappers = createVfsSyncWrappers(deps);
    expect(wrappers.xGetLastError(0, 0, 0)).toBe(0);
  });

  describe("xOpen", () => {
    it("should handle random filename", () => {
      const wrappers = createVfsSyncWrappers(deps);
      const pVfs = 1;
      const zName = 0; // null pointer -> random
      const pFile = 500;
      const flags =
        mockCapi.SQLITE_OPEN_CREATE | mockCapi.SQLITE_OPEN_READWRITE;
      const pOutFlags = 600;

      wrappers.xOpen(pVfs, zName, pFile, flags, pOutFlags);

      expect(mockRandomFilename).toHaveBeenCalled();
      expect(mockOpRun).toHaveBeenCalledWith(
        "xOpen",
        pFile,
        "random_file.db",
        flags,
        0,
      );
    });

    it("should handle existing filename and URI flags", () => {
      const wrappers = createVfsSyncWrappers(deps);
      const pVfs = 1;
      const zName = 100;
      const pFile = 500;
      const flags =
        mockCapi.SQLITE_OPEN_CREATE | mockCapi.SQLITE_OPEN_READWRITE;
      const pOutFlags = 600;

      // Mock URI flags
      /* eslint-disable @typescript-eslint/no-explicit-any */
      mockCapi.sqlite3_uri_boolean.mockImplementation(
        (_name: any, param: any) => {
          if (param === "opfs-unlock-asap") return 1;
          return 0;
        },
      );
      /* eslint-enable @typescript-eslint/no-explicit-any */

      wrappers.xOpen(pVfs, zName, pFile, flags, pOutFlags);

      expect(mockCapi.sqlite3_uri_boolean).toHaveBeenCalledWith(
        zName,
        "opfs-unlock-asap",
        0,
      );
      expect(mockOpRun).toHaveBeenCalledWith(
        "xOpen",
        pFile,
        "test.db",
        flags,
        mockState.opfsFlags.OPFS_UNLOCK_ASAP,
      );
    });

    it("should initialize file handle on success", () => {
      const wrappers = createVfsSyncWrappers(deps);
      const pVfs = 1;
      const zName = 100;
      const pFile = 500;
      const flags =
        mockCapi.SQLITE_OPEN_CREATE | mockCapi.SQLITE_OPEN_READWRITE;
      const pOutFlags = 600;

      mockOpRun.mockReturnValue(0); // Success

      wrappers.xOpen(pVfs, zName, pFile, flags, pOutFlags);

      expect(mockOpenFiles[pFile]).toBeDefined();
      expect(mockOpenFiles[pFile].fid).toBe(pFile);
      expect(mockOpenFiles[pFile].filename).toBe("test.db");
      expect(mockOpenFiles[pFile].sab).toBeInstanceOf(SharedArrayBuffer);
      expect(mockOpenFiles[pFile].sq3File).toBeInstanceOf(mockSqlite3File);
      expect(mockOpenFiles[pFile].sq3File.$pMethods).toBe(
        mockOpfsIoMethods.pointer,
      );
    });

    it("should handle read-only flag output", () => {
      const wrappers = createVfsSyncWrappers(deps);
      const pVfs = 1;
      const zName = 100;
      const pFile = 500;
      // Read only flag, NO create flag
      const flags = mockCapi.SQLITE_OPEN_READONLY;
      const pOutFlags = 600;

      mockOpRun.mockReturnValue(0);

      wrappers.xOpen(pVfs, zName, pFile, flags, pOutFlags);

      expect(mockWasm.poke).toHaveBeenCalledWith(
        pOutFlags,
        mockCapi.SQLITE_OPEN_READONLY,
        "i32",
      );
      expect(mockOpenFiles[pFile].readOnly).toBe(true);
    });
  });
});
