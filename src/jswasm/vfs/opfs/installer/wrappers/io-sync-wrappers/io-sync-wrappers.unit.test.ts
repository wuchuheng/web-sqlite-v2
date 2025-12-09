import { describe, it, expect, vi, beforeEach } from "vitest";
import { createIoSyncWrappers } from "./io-sync-wrappers";
import type {
  IoSyncWrapperDeps,
  IoSyncWrappers,
} from "../../../../../shared/opfs-vfs-installer";

describe("io-sync-wrappers", () => {
  let deps: IoSyncWrapperDeps;
  let wrappers: IoSyncWrappers;
  let mockWasmHeap: Uint8Array;
  let mockSabView: Uint8Array;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let openFiles: Record<number, any>;

  beforeEach(() => {
    mockWasmHeap = new Uint8Array(1024);
    mockSabView = new Uint8Array(1024);
    openFiles = {};

    deps = {
      wasm: {
        poke: vi.fn(),
        heap8u: vi.fn(() => mockWasmHeap),
      } as unknown as IoSyncWrapperDeps["wasm"],

      capi: {
        SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN: 0x00000008,
        SQLITE_NOTFOUND: 12,
        SQLITE_IOERR: 10,
        SQLITE_IOERR_SHORT_READ: 10 | (2 << 8),
        SQLITE_IOERR_READ: 10 | (1 << 8),
        SQLITE_IOERR_WRITE: 10 | (3 << 8),
        SQLITE_LOCK_NONE: 0,
        SQLITE_LOCK_SHARED: 1,
        SQLITE_LOCK_RESERVED: 2,
        SQLITE_LOCK_PENDING: 3,
        SQLITE_LOCK_EXCLUSIVE: 4,
      } as unknown as IoSyncWrapperDeps["capi"],

      state: {
        s11n: {
          deserialize: vi.fn(() => [100]), // Default size
        },
        sq3Codes: {
          SQLITE_IOERR: 10,
        },
      } as unknown as IoSyncWrapperDeps["state"],
      opRun: vi.fn(() => 0),
      mTimeStart: vi.fn(),
      mTimeEnd: vi.fn(),
      error: vi.fn(),
      __openFiles: openFiles,
    };

    wrappers = createIoSyncWrappers(deps);
  });

  describe("xCheckReservedLock", () => {
    it("should return 0 and poke result", () => {
      const pFile = 1;
      const pOut = 2;
      const result = wrappers.xCheckReservedLock(pFile, pOut);
      expect(result).toBe(0);
      expect(deps.wasm.poke).toHaveBeenCalledWith(pOut, 0, "i32");
    });
  });

  describe("xClose", () => {
    it("should close file and cleanup resources", () => {
      const pFile = 1;
      const mockDispose = vi.fn();
      openFiles[pFile] = { sq3File: { dispose: mockDispose } };

      const result = wrappers.xClose(pFile);

      expect(result).toBe(0);
      expect(openFiles[pFile]).toBeUndefined();
      expect(deps.opRun).toHaveBeenCalledWith("xClose", pFile);
      expect(mockDispose).toHaveBeenCalled();
      expect(deps.mTimeStart).toHaveBeenCalledWith("xClose");
      expect(deps.mTimeEnd).toHaveBeenCalled();
    });

    it("should return early if file not open", () => {
      const pFile = 999;
      const result = wrappers.xClose(pFile);
      expect(result).toBe(0);
      expect(deps.opRun).not.toHaveBeenCalled();
    });
  });

  describe("xDeviceCharacteristics", () => {
    it("should return SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN", () => {
      const result = wrappers.xDeviceCharacteristics(1);
      expect(result).toBe(deps.capi.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN);
    });
  });

  describe("xFileControl", () => {
    it("should return SQLITE_NOTFOUND", () => {
      const result = wrappers.xFileControl(1, 2, 3);
      expect(result).toBe(deps.capi.SQLITE_NOTFOUND);
    });
  });

  describe("xFileSize", () => {
    it("should get file size successfully", () => {
      const pFile = 1;
      const pSz64 = 2;

      const result = wrappers.xFileSize(pFile, pSz64);

      expect(result).toBe(0);
      expect(deps.opRun).toHaveBeenCalledWith("xFileSize", pFile);
      expect(deps.state.s11n!.deserialize).toHaveBeenCalled();
      expect(deps.wasm.poke).toHaveBeenCalledWith(pSz64, BigInt(100), "i64");
    });

    it("should handle error during processing", () => {
      const pFile = 1;
      const pSz64 = 2;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (deps.state.s11n!.deserialize as any).mockImplementation(() => {
        throw new Error("Fail");
      });

      const result = wrappers.xFileSize(pFile, pSz64);

      expect(result).toBe(deps.state.sq3Codes.SQLITE_IOERR);
      expect(deps.error).toHaveBeenCalled();
    });
  });

  describe("xLock", () => {
    it("should acquire lock if not held", () => {
      const pFile = 1;
      const lockType = deps.capi.SQLITE_LOCK_SHARED;
      openFiles[pFile] = { lockType: 0 };

      const result = wrappers.xLock(pFile, lockType);

      expect(result).toBe(0);
      expect(deps.opRun).toHaveBeenCalledWith("xLock", pFile, lockType);
      expect(openFiles[pFile].lockType).toBe(lockType);
    });

    it("should update local lock state if already held", () => {
      const pFile = 1;
      const lockType = deps.capi.SQLITE_LOCK_EXCLUSIVE;
      openFiles[pFile] = { lockType: deps.capi.SQLITE_LOCK_SHARED };

      const result = wrappers.xLock(pFile, lockType);

      expect(result).toBe(0);
      expect(deps.opRun).not.toHaveBeenCalled();
      expect(openFiles[pFile].lockType).toBe(lockType);
    });
  });

  describe("xRead", () => {
    it("should read data successfully", () => {
      const pFile = 1;
      const pDest = 0;
      const n = 10;
      const offset64 = 0n;

      // Setup source data in SAB view
      for (let i = 0; i < n; i++) mockSabView[i] = i;
      openFiles[pFile] = { sabView: mockSabView };

      const result = wrappers.xRead(pFile, pDest, n, offset64);

      expect(result).toBe(0);
      expect(deps.opRun).toHaveBeenCalledWith("xRead", pFile, n, 0);
      // Verify data copied to WASM heap
      for (let i = 0; i < n; i++) expect(mockWasmHeap[pDest + i]).toBe(i);
    });

    it("should handle exceptions", () => {
      const pFile = 1;
      openFiles[pFile] = { sabView: mockSabView };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (deps.opRun as any).mockImplementation(() => {
        throw new Error("Read error");
      });

      const result = wrappers.xRead(pFile, 0, 10, 0n);

      expect(result).toBe(deps.capi.SQLITE_IOERR_READ);
      expect(deps.error).toHaveBeenCalled();
    });
  });

  describe("xSync", () => {
    it("should sync file", () => {
      const pFile = 1;
      const flags = 0;
      const result = wrappers.xSync(pFile, flags);
      expect(result).toBe(0);
      expect(deps.opRun).toHaveBeenCalledWith("xSync", pFile, flags);
    });
  });

  describe("xTruncate", () => {
    it("should truncate file", () => {
      const pFile = 1;
      const sz64 = 100n;
      const result = wrappers.xTruncate(pFile, sz64);
      expect(result).toBe(0);
      expect(deps.opRun).toHaveBeenCalledWith("xTruncate", pFile, 100);
    });
  });

  describe("xUnlock", () => {
    it("should unlock file", () => {
      const pFile = 1;
      const lockType = deps.capi.SQLITE_LOCK_NONE;
      openFiles[pFile] = { lockType: deps.capi.SQLITE_LOCK_SHARED };

      const result = wrappers.xUnlock(pFile, lockType);

      expect(result).toBe(0);
      expect(deps.opRun).toHaveBeenCalledWith("xUnlock", pFile, lockType);
      expect(openFiles[pFile].lockType).toBe(lockType);
    });
  });

  describe("xWrite", () => {
    it("should write data successfully", () => {
      const pFile = 1;
      const pSrc = 0;
      const n = 10;
      const offset64 = 0n;

      // Setup source data in WASM heap
      for (let i = 0; i < n; i++) mockWasmHeap[pSrc + i] = i + 10;
      openFiles[pFile] = { sabView: mockSabView };

      const result = wrappers.xWrite(pFile, pSrc, n, offset64);

      expect(result).toBe(0);
      expect(deps.opRun).toHaveBeenCalledWith("xWrite", pFile, n, 0);
      // Verify data copied to SAB view
      for (let i = 0; i < n; i++) expect(mockSabView[i]).toBe(i + 10);
    });

    it("should handle exceptions", () => {
      const pFile = 1;
      openFiles[pFile] = { sabView: mockSabView };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (deps.opRun as any).mockImplementation(() => {
        throw new Error("Write error");
      });

      const result = wrappers.xWrite(pFile, 0, 10, 0n);

      expect(result).toBe(deps.capi.SQLITE_IOERR_WRITE);
      expect(deps.error).toHaveBeenCalled();
    });
  });
});
