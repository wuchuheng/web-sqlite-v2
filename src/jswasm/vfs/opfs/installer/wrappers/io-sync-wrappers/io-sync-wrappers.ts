/**
 * Creates I/O method wrappers for OPFS file operations.
 * @module wrappers/io-sync-wrappers
 */

import type {
  IoSyncWrappers,
  IoSyncWrapperDeps,
} from "../../../../../shared/opfs-vfs-installer";

/**
 * Creates I/O synchronization wrappers for SQLite file operations
 * @param deps - Dependencies including WASM interface, state, and operation runner
 * @returns Object containing all I/O method implementations
 */
export function createIoSyncWrappers(deps: IoSyncWrapperDeps): IoSyncWrappers {
  const { wasm, capi, state, opRun, mTimeStart, mTimeEnd, error, __openFiles } =
    deps;

  return {
    /**
     * Checks if file lock is reserved.
     * @param pFile - File pointer
     * @param pOut - Output pointer for result
     * @returns Result code
     */
    xCheckReservedLock(_pFile: number, pOut: number): number {
      wasm.poke(pOut, 0, "i32");
      return 0;
    },

    /**
     * Closes an open file.
     * @param pFile - File pointer
     * @returns Result code
     */
    xClose(pFile: number): number {
      // 1. Input handling
      mTimeStart("xClose");
      let rc = 0;
      const f = __openFiles[pFile];

      if (!f) {
        mTimeEnd();
        return rc;
      }

      // 2. Core processing
      delete __openFiles[pFile];
      rc = opRun("xClose", pFile);
      if (f.sq3File) f.sq3File.dispose();

      // 3. Output handling
      mTimeEnd();
      return rc;
    },

    /**
     * Returns device characteristics.
     * @param _pFile - File pointer (unused)
     * @returns Characteristic flags
     */
    xDeviceCharacteristics(_pFile: number): number {
      return capi.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN;
    },

    /**
     * Handles file control operations.
     * @param _pFile - File pointer (unused)
     * @param _opId - Operation ID (unused)
     * @param _pArg - Argument pointer (unused)
     * @returns Not found code
     */
    xFileControl(_pFile: number, _opId: number, _pArg: number): number {
      return capi.SQLITE_NOTFOUND;
    },

    /**
     * Gets file size.
     * @param pFile - File pointer
     * @param pSz64 - Output pointer for size
     * @returns Result code
     */
    xFileSize(pFile: number, pSz64: number): number {
      // 1. Input handling
      mTimeStart("xFileSize");
      let rc = opRun("xFileSize", pFile);

      // 2. Core processing
      if (0 === rc) {
        try {
          if (!state.s11n) throw new Error("state.s11n is not defined");

          const sz = state.s11n!.deserialize(true);

          if (sz === undefined || sz?.length === 0) {
            throw new Error("Failed to deserialize file size");
          }
          const firstItem = sz![0]!;
          wasm.poke(pSz64, BigInt(firstItem), "i64");
        } catch (e) {
          error("Unexpected error reading xFileSize() result:", e);
          rc = state.sq3Codes.SQLITE_IOERR;
        }
      }

      // 3. Output handling
      mTimeEnd();
      return rc;
    },

    /**
     * Acquires file lock.
     * @param pFile - File pointer
     * @param lockType - Lock type
     * @returns Result code
     */
    xLock(pFile: number, lockType: number): number {
      // 1. Input handling
      mTimeStart("xLock");
      const f = __openFiles[pFile];
      let rc = 0;

      // 2. Core processing
      if (!f.lockType) {
        rc = opRun("xLock", pFile, lockType);
        if (0 === rc) f.lockType = lockType;
      } else {
        f.lockType = lockType;
      }

      // 3. Output handling
      mTimeEnd();
      return rc;
    },

    /**
     * Reads data from file.
     * @param pFile - File pointer
     * @param pDest - Destination buffer pointer
     * @param n - Bytes to read
     * @param offset64 - File offset
     * @returns Result code
     */
    xRead(
      pFile: number,
      pDest: number,
      n: number,
      offset64: number | bigint,
    ): number {
      // 1. Input handling
      mTimeStart("xRead");
      const f = __openFiles[pFile];
      let rc: number;

      // 2. Core processing
      try {
        rc = opRun("xRead", pFile, n, Number(offset64));
        if (0 === rc || capi.SQLITE_IOERR_SHORT_READ === rc) {
          wasm.heap8u().set(f.sabView.subarray(0, n), pDest);
        }
      } catch (e) {
        // eslint-disable-next-line prefer-rest-params
        error("xRead(", arguments, ") failed:", e, f);
        rc = capi.SQLITE_IOERR_READ;
      }

      // 3. Output handling
      mTimeEnd();
      return rc;
    },

    /**
     * Syncs file to storage.
     * @param pFile - File pointer
     * @param flags - Sync flags
     * @returns Result code
     */
    xSync(pFile: number, flags: number): number {
      mTimeStart("xSync");
      const rc = opRun("xSync", pFile, flags);
      mTimeEnd();
      return rc;
    },

    /**
     * Truncates file to specified size.
     * @param pFile - File pointer
     * @param sz64 - New size
     * @returns Result code
     */
    xTruncate(pFile: number, sz64: number | bigint): number {
      mTimeStart("xTruncate");
      const rc = opRun("xTruncate", pFile, Number(sz64));
      mTimeEnd();
      return rc;
    },

    /**
     * Releases file lock.
     * @param pFile - File pointer
     * @param lockType - Lock type
     * @returns Result code
     */
    xUnlock(pFile: number, lockType: number): number {
      // 1. Input handling
      mTimeStart("xUnlock");
      const f = __openFiles[pFile];
      let rc = 0;

      // 2. Core processing
      if (capi.SQLITE_LOCK_NONE === lockType && f.lockType) {
        rc = opRun("xUnlock", pFile, lockType);
      }
      if (0 === rc) f.lockType = lockType;

      // 3. Output handling
      mTimeEnd();
      return rc;
    },

    /**
     * Writes data to file.
     * @param pFile - File pointer
     * @param pSrc - Source buffer pointer
     * @param n - Bytes to write
     * @param offset64 - File offset
     * @returns Result code
     */
    xWrite(
      pFile: number,
      pSrc: number,
      n: number,
      offset64: number | bigint,
    ): number {
      // 1. Input handling
      mTimeStart("xWrite");
      const f = __openFiles[pFile];
      let rc: number;

      // 2. Core processing
      try {
        f.sabView.set(wasm.heap8u().subarray(pSrc, pSrc + n));
        rc = opRun("xWrite", pFile, n, Number(offset64));
      } catch (e) {
        // eslint-disable-next-line prefer-rest-params
        error("xWrite(", arguments, ") failed:", e, f);
        rc = capi.SQLITE_IOERR_WRITE;
      }

      // 3. Output handling
      mTimeEnd();
      return rc;
    },
  };
}
