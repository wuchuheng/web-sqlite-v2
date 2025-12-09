import type {
  VfsSyncWrappers,
  VfsSyncWrapperDeps,
  OpfsFileHandle,
} from "../../../../../shared/opfs-vfs-installer";

/**
 * Creates VFS method wrappers for OPFS filesystem operations.
 *
 * This function generates the VFS implementation that bridges the SQLite C API (via WASM)
 * to the synchronous OPFS operations. It handles file access, deletion, opening, and
 * time retrieval.
 *
 * @param deps - Dependencies including WASM interface, C API bindings, OPFS state, and operation runners.
 * @returns Object containing the VFS method implementations (xAccess, xOpen, xDelete, etc.).
 */
export function createVfsSyncWrappers(
  deps: VfsSyncWrapperDeps,
): VfsSyncWrappers {
  const {
    wasm,
    capi,
    state,
    opRun,
    mTimeStart,
    mTimeEnd,
    opfsIoMethods,
    randomFilename,
    __openFiles,
  } = deps;
  const { sqlite3_file } = capi;

  return {
    /**
     * Checks file accessibility.
     *
     * @param pVfs - VFS pointer (unused by this implementation).
     * @param zName - Filename as a C string pointer.
     * @param flags - Access flags (unused by this implementation).
     * @param pOut - Pointer to write the result (1 for success, 0 for failure).
     * @returns Result code (always 0 as per SQLite VFS spec for this method).
     */
    xAccess(
      _pVfs: number,
      zName: number,
      _flags: number,
      pOut: number,
    ): number {
      mTimeStart("xAccess");
      const rc = opRun("xAccess", wasm.cstrToJs(zName));
      wasm.poke(pOut, rc ? 0 : 1, "i32");
      mTimeEnd();
      return 0;
    },

    /**
     * Gets current time as a Julian day number.
     *
     * @param pVfs - VFS pointer (unused).
     * @param pOut - Pointer to write the Julian day number (double).
     * @returns Result code (always 0).
     */
    xCurrentTime(_pVfs: number, pOut: number): number {
      wasm.poke(pOut, 2440587.5 + new Date().getTime() / 86400000, "double");
      return 0;
    },

    /**
     * Gets current time in milliseconds since the Unix epoch.
     *
     * @param pVfs - VFS pointer (unused).
     * @param pOut - Pointer to write the time (int64).
     * @returns Result code (always 0).
     */
    xCurrentTimeInt64(_pVfs: number, pOut: number): number {
      wasm.poke(pOut, 2440587.5 * 86400000 + new Date().getTime(), "i64");
      return 0;
    },

    /**
     * Deletes a file.
     *
     * @param pVfs - VFS pointer (unused).
     * @param zName - Filename as a C string pointer.
     * @param doSyncDir - Whether to sync the directory after deletion.
     * @returns Result code from the delete operation.
     */
    xDelete(_pVfs: number, zName: number, doSyncDir: number): number {
      mTimeStart("xDelete");
      const rc = opRun("xDelete", wasm.cstrToJs(zName), doSyncDir, false);
      mTimeEnd();
      return rc;
    },

    /**
     * Converts a filename to its full pathname.
     *
     * In this VFS, we treat the input name as the full path.
     *
     * @param pVfs - VFS pointer (unused).
     * @param zName - Filename as a C string pointer.
     * @param nOut - Size of the output buffer.
     * @param pOut - Pointer to the output buffer.
     * @returns 0 on success, or SQLITE_CANTOPEN if the buffer is too small.
     */
    xFullPathname(
      _pVfs: number,
      zName: number,
      nOut: number,
      pOut: number,
    ): number {
      const i = wasm.cstrncpy(pOut, zName, nOut);
      return i < nOut ? 0 : capi.SQLITE_CANTOPEN;
    },

    /**
     * Gets the last error code.
     *
     * @param _pVfs - VFS pointer (unused).
     * @param _nOut - Buffer size (unused).
     * @param _pOut - Output buffer (unused).
     * @returns Always 0.
     */
    xGetLastError(_pVfs: number, _nOut: number, _pOut: number): number {
      return 0;
    },

    /**
     * Opens a file.
     *
     * Handles file creation, opening existing files, and parsing URI parameters
     * for OPFS-specific behaviors.
     *
     * @param pVfs - VFS pointer.
     * @param zName - Filename (pointer or 0 for a random temporary name).
     * @param pFile - Pointer to the sqlite3_file structure to populate.
     * @param flags - Open flags (e.g., READONLY, CREATE).
     * @param pOutFlags - Pointer to write the actual open flags used.
     * @returns Result code from the open operation.
     */
    xOpen(
      _pVfs: number,
      zName: number,
      pFile: number,
      flags: number,
      pOutFlags: number,
    ): number {
      // 1. Input handling
      mTimeStart("xOpen");
      let opfsFlags = 0;
      let filenameStr: string;

      // 1.1 Generate or parse filename
      if (0 === zName) {
        filenameStr = randomFilename();
      } else if (typeof zName === "number" /* wasm.isPtr(zName) check */) {
        if (capi.sqlite3_uri_boolean(zName, "opfs-unlock-asap", 0)) {
          opfsFlags |= state.opfsFlags.OPFS_UNLOCK_ASAP;
        }
        if (capi.sqlite3_uri_boolean(zName, "delete-before-open", 0)) {
          opfsFlags |= state.opfsFlags.OPFS_UNLINK_BEFORE_OPEN;
        }
        filenameStr = wasm.cstrToJs(zName);
      } else {
        // Should not happen if zName is typed as number, but defensive coding
        // matching original logic if zName could be non-number in JS land (though unlikely in TS)
        filenameStr = String(zName);
      }

      // 2. Core processing
      // 2.1 Create file handle
      // Using Object.create(null) to match original behavior, but casting to OpfsFileHandle
      const fh = Object.create(null) as OpfsFileHandle;
      fh.fid = pFile;
      fh.filename = filenameStr;
      fh.sab = new SharedArrayBuffer(state.fileBufferSize);
      fh.flags = flags;
      fh.readOnly =
        !(capi.SQLITE_OPEN_CREATE & flags) &&
        !!(flags & capi.SQLITE_OPEN_READONLY);

      // 2.2 Open file via async worker
      const rc = opRun("xOpen", pFile, filenameStr, flags, opfsFlags);

      // 2.3 Initialize file handle on success
      if (!rc) {
        if (fh.readOnly) {
          wasm.poke(pOutFlags, capi.SQLITE_OPEN_READONLY, "i32");
        }
        __openFiles[pFile] = fh;
        fh.sabView = state.sabFileBufView!; // Assuming sabFileBufView is set
        fh.sq3File = new sqlite3_file(pFile);
        fh.sq3File.$pMethods = opfsIoMethods.pointer;
        fh.lockType = capi.SQLITE_LOCK_NONE;
      }

      // 3. Output handling
      mTimeEnd();
      return rc;
    },
  };
}
