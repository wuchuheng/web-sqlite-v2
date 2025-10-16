"use strict";

import { detectLittleEndian } from "./environment.mjs";

/**
 * Factory for the mutable worker state shared across handlers.
 *
 * @module async-proxy/state
 */

/**
 * Creates the baseline worker state used by the OPFS proxy.
 *
 * @returns {import('./state.d.ts').WorkerState} Default state with placeholders.
 */
export const createDefaultState = () => ({
    verbose: 1,
    sabOP: null,
    sabIO: null,
    sabOPView: null,
    sabFileBufView: null,
    sabS11nView: null,
    sq3Codes: {
        SQLITE_BUSY: 0,
        SQLITE_CANTOPEN: 0,
        SQLITE_IOERR: 0,
        SQLITE_IOERR_DELETE: 0,
        SQLITE_IOERR_FSYNC: 0,
        SQLITE_IOERR_LOCK: 0,
        SQLITE_IOERR_READ: 0,
        SQLITE_IOERR_SHORT_READ: 0,
        SQLITE_IOERR_TRUNCATE: 0,
        SQLITE_IOERR_UNLOCK: 0,
        SQLITE_IOERR_WRITE: 0,
        SQLITE_LOCK_NONE: 0,
        SQLITE_NOTFOUND: 0,
        SQLITE_OPEN_CREATE: 0,
        SQLITE_OPEN_DELETEONCLOSE: 0,
        SQLITE_OPEN_READONLY: 0,
    },
    opfsFlags: {
        OPFS_UNLINK_BEFORE_OPEN: 0,
        OPFS_UNLOCK_ASAP: 0,
        defaultUnlockAsap: false,
    },
    opIds: {
        whichOp: 0,
        rc: 0,
        retry: 0,
        "opfs-async-shutdown": 0,
        mkdir: 0,
        xAccess: 0,
        xClose: 0,
        xDelete: 0,
        xDeleteNoWait: 0,
        xFileSize: 0,
        xLock: 0,
        xOpen: 0,
        xRead: 0,
        xSync: 0,
        xTruncate: 0,
        xUnlock: 0,
        xWrite: 0,
    },
    asyncIdleWaitTime: 150,
    asyncS11nExceptions: 1,
    fileBufferSize: 0,
    sabS11nOffset: 0,
    sabS11nSize: 0,
    rootDir: null,
    littleEndian: detectLittleEndian(),
    s11n: null,
});
