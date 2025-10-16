/**
 * Creates VFS method wrappers for OPFS filesystem operations.
 * @param {object} deps - Dependencies object
 * @returns {object} VFS method wrappers
 */
export function createVfsSyncWrappers(deps) {
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
     * @param {number} pVfs - VFS pointer
     * @param {number} zName - Filename C string
     * @param {number} flags - Access flags
     * @param {number} pOut - Output pointer
     * @returns {number} Result code
     */
    xAccess(pVfs, zName, flags, pOut) {
      mTimeStart('xAccess');
      const rc = opRun('xAccess', wasm.cstrToJs(zName));
      wasm.poke(pOut, rc ? 0 : 1, 'i32');
      mTimeEnd();
      return 0;
    },

    /**
     * Gets current time as Julian day number.
     * @param {number} pVfs - VFS pointer
     * @param {number} pOut - Output pointer
     * @returns {number} Result code (always 0)
     */
    xCurrentTime(pVfs, pOut) {
      wasm.poke(pOut, 2440587.5 + new Date().getTime() / 86400000, 'double');
      return 0;
    },

    /**
     * Gets current time in milliseconds since Unix epoch.
     * @param {number} pVfs - VFS pointer
     * @param {number} pOut - Output pointer
     * @returns {number} Result code (always 0)
     */
    xCurrentTimeInt64(pVfs, pOut) {
      wasm.poke(pOut, 2440587.5 * 86400000 + new Date().getTime(), 'i64');
      return 0;
    },

    /**
     * Deletes a file.
     * @param {number} pVfs - VFS pointer
     * @param {number} zName - Filename C string
     * @param {number} doSyncDir - Whether to sync directory
     * @returns {number} Result code
     */
    xDelete(pVfs, zName, doSyncDir) {
      mTimeStart('xDelete');
      const rc = opRun('xDelete', wasm.cstrToJs(zName), doSyncDir, false);
      mTimeEnd();
      return rc;
    },

    /**
     * Converts filename to full pathname.
     * @param {number} pVfs - VFS pointer
     * @param {number} zName - Filename C string
     * @param {number} nOut - Output buffer size
     * @param {number} pOut - Output buffer pointer
     * @returns {number} Result code
     */
    xFullPathname(pVfs, zName, nOut, pOut) {
      const i = wasm.cstrncpy(pOut, zName, nOut);
      return i < nOut ? 0 : capi.SQLITE_CANTOPEN;
    },

    /**
     * Gets last error information.
     * @param {number} _pVfs - VFS pointer (unused)
     * @param {number} _nOut - Buffer size (unused)
     * @param {number} _pOut - Output buffer (unused)
     * @returns {number} Result code (always 0)
     */
    xGetLastError(_pVfs, _nOut, _pOut) {
      return 0;
    },

    /**
     * Opens a database file.
     * @param {number} pVfs - VFS pointer
     * @param {number} zName - Filename (pointer or 0 for temp)
     * @param {number} pFile - File structure pointer
     * @param {number} flags - Open flags
     * @param {number} pOutFlags - Output flags pointer
     * @returns {number} Result code
     */
    xOpen(pVfs, zName, pFile, flags, pOutFlags) {
      // 1. Input handling
      mTimeStart('xOpen');
      let opfsFlags = 0;

      // 1.1 Generate or parse filename
      if (0 === zName) {
        zName = randomFilename();
      } else if (wasm.isPtr(zName)) {
        if (capi.sqlite3_uri_boolean(zName, 'opfs-unlock-asap', 0)) {
          opfsFlags |= state.opfsFlags.OPFS_UNLOCK_ASAP;
        }
        if (capi.sqlite3_uri_boolean(zName, 'delete-before-open', 0)) {
          opfsFlags |= state.opfsFlags.OPFS_UNLINK_BEFORE_OPEN;
        }
        zName = wasm.cstrToJs(zName);
      }

      // 2. Core processing
      // 2.1 Create file handle
      const fh = Object.create(null);
      fh.fid = pFile;
      fh.filename = zName;
      fh.sab = new SharedArrayBuffer(state.fileBufferSize);
      fh.flags = flags;
      fh.readOnly =
        !(capi.SQLITE_OPEN_CREATE & flags) && !!(flags & capi.SQLITE_OPEN_READONLY);

      // 2.2 Open file via async worker
      const rc = opRun('xOpen', pFile, zName, flags, opfsFlags);

      // 2.3 Initialize file handle on success
      if (!rc) {
        if (fh.readOnly) {
          wasm.poke(pOutFlags, capi.SQLITE_OPEN_READONLY, 'i32');
        }
        __openFiles[pFile] = fh;
        fh.sabView = state.sabFileBufView;
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
