/**
 * Creates I/O method wrappers for OPFS file operations.
 * @param {import('./io-sync-wrappers.d.ts').IoSyncWrapperDeps} deps - Dependencies object
 * @returns {import('../../../../../../types/opfs-vfs-installer').IoSyncWrappers} I/O method wrappers
 */
export function createIoSyncWrappers(deps) {
    const {
        wasm,
        capi,
        state,
        opRun,
        mTimeStart,
        mTimeEnd,
        error,
        __openFiles,
    } = deps;

    return {
        /**
         * Checks if file lock is reserved.
         * @param {number} pFile - File pointer
         * @param {number} pOut - Output pointer for result
         * @returns {number} Result code
         */
        xCheckReservedLock(pFile, pOut) {
            wasm.poke(pOut, 0, "i32");
            return 0;
        },

        /**
         * Closes an open file.
         * @param {number} pFile - File pointer
         * @returns {number} Result code
         */
        xClose(pFile) {
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
         * @param {number} _pFile - File pointer (unused)
         * @returns {number} Characteristic flags
         */
        xDeviceCharacteristics(_pFile) {
            return capi.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN;
        },

        /**
         * Handles file control operations.
         * @param {number} _pFile - File pointer (unused)
         * @param {number} _opId - Operation ID (unused)
         * @param {number} _pArg - Argument pointer (unused)
         * @returns {number} Not found code
         */
        xFileControl(_pFile, _opId, _pArg) {
            return capi.SQLITE_NOTFOUND;
        },

        /**
         * Gets file size.
         * @param {number} pFile - File pointer
         * @param {number} pSz64 - Output pointer for size
         * @returns {number} Result code
         */
        xFileSize(pFile, pSz64) {
            // 1. Input handling
            mTimeStart("xFileSize");
            let rc = opRun("xFileSize", pFile);

            // 2. Core processing
            if (0 === rc) {
                try {
                    const sz = state.s11n.deserialize()[0];
                    wasm.poke(pSz64, sz, "i64");
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
         * @param {number} pFile - File pointer
         * @param {number} lockType - Lock type
         * @returns {number} Result code
         */
        xLock(pFile, lockType) {
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
         * @param {number} pFile - File pointer
         * @param {number} pDest - Destination buffer pointer
         * @param {number} n - Bytes to read
         * @param {BigInt} offset64 - File offset
         * @returns {number} Result code
         */
        xRead(pFile, pDest, n, offset64) {
            // 1. Input handling
            mTimeStart("xRead");
            const f = __openFiles[pFile];
            let rc;

            // 2. Core processing
            try {
                rc = opRun("xRead", pFile, n, Number(offset64));
                if (0 === rc || capi.SQLITE_IOERR_SHORT_READ === rc) {
                    wasm.heap8u().set(f.sabView.subarray(0, n), pDest);
                }
            } catch (e) {
                error("xRead(", arguments, ") failed:", e, f);
                rc = capi.SQLITE_IOERR_READ;
            }

            // 3. Output handling
            mTimeEnd();
            return rc;
        },

        /**
         * Syncs file to storage.
         * @param {number} pFile - File pointer
         * @param {number} flags - Sync flags
         * @returns {number} Result code
         */
        xSync(pFile, flags) {
            mTimeStart("xSync");
            const rc = opRun("xSync", pFile, flags);
            mTimeEnd();
            return rc;
        },

        /**
         * Truncates file to specified size.
         * @param {number} pFile - File pointer
         * @param {BigInt} sz64 - New size
         * @returns {number} Result code
         */
        xTruncate(pFile, sz64) {
            mTimeStart("xTruncate");
            const rc = opRun("xTruncate", pFile, Number(sz64));
            mTimeEnd();
            return rc;
        },

        /**
         * Releases file lock.
         * @param {number} pFile - File pointer
         * @param {number} lockType - Lock type
         * @returns {number} Result code
         */
        xUnlock(pFile, lockType) {
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
         * @param {number} pFile - File pointer
         * @param {number} pSrc - Source buffer pointer
         * @param {number} n - Bytes to write
         * @param {BigInt} offset64 - File offset
         * @returns {number} Result code
         */
        xWrite(pFile, pSrc, n, offset64) {
            // 1. Input handling
            mTimeStart("xWrite");
            const f = __openFiles[pFile];
            let rc;

            // 2. Core processing
            try {
                f.sabView.set(wasm.heap8u().subarray(pSrc, pSrc + n));
                rc = opRun("xWrite", pFile, n, Number(offset64));
            } catch (e) {
                error("xWrite(", arguments, ") failed:", e, f);
                rc = capi.SQLITE_IOERR_WRITE;
            }

            // 3. Output handling
            mTimeEnd();
            return rc;
        },
    };
}
