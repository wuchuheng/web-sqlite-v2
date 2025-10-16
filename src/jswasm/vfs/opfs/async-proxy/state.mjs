"use strict";

/* global detectLittleEndian, SerializationBuffer */

/** @typedef {import("./state.d.ts").AsyncProxyState} AsyncProxyState */
/** @typedef {import("./state.d.ts").SQLiteErrorCodes} SQLiteErrorCodes */
/** @typedef {import("./state.d.ts").AsyncOpfsFlags} AsyncOpfsFlags */
/** @typedef {import("./state.d.ts").OperationIds} OperationIds */

const emptySharedBuffer = new SharedArrayBuffer(0);
const emptyInt32Array = new Int32Array(emptySharedBuffer);
const emptyUint8Array = new Uint8Array(emptySharedBuffer);

/**
 * Builds a zeroed-out `SQLiteErrorCodes` object that satisfies the required keys.
 *
 * @returns {SQLiteErrorCodes}
 */
const createZeroSqliteCodes = () =>
    /** @type {SQLiteErrorCodes} */ ({
        SQLITE_IOERR: 0,
        SQLITE_IOERR_DELETE: 0,
        SQLITE_IOERR_READ: 0,
        SQLITE_IOERR_LOCK: 0,
        SQLITE_IOERR_FSYNC: 0,
        SQLITE_IOERR_TRUNCATE: 0,
        SQLITE_IOERR_UNLOCK: 0,
        SQLITE_IOERR_WRITE: 0,
        SQLITE_IOERR_SHORT_READ: 0,
        SQLITE_NOTFOUND: 0,
        SQLITE_OPEN_CREATE: 0,
        SQLITE_OPEN_READONLY: 0,
        SQLITE_OPEN_DELETEONCLOSE: 0,
        SQLITE_LOCK_NONE: 0,
        SQLITE_BUSY: 0,
        SQLITE_CANTOPEN: 0,
    });

/**
 * Builds a zeroed-out `AsyncOpfsFlags` object.
 *
 * @returns {AsyncOpfsFlags}
 */
const createZeroOpfsFlags = () =>
    /** @type {AsyncOpfsFlags} */ ({
        OPFS_UNLINK_BEFORE_OPEN: 0,
        OPFS_UNLOCK_ASAP: 0,
        defaultUnlockAsap: false,
    });

/**
 * Builds a zeroed-out `OperationIds` object.
 *
 * @returns {OperationIds}
 */
const createZeroOperationIds = () =>
    /** @type {OperationIds} */ ({
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
    });

/**
 * Creates the baseline worker state used by the OPFS proxy.
 *
 * @returns {AsyncProxyState} Default state with placeholders.
 */
const createDefaultState = () => {
    const littleEndian = detectLittleEndian();
    return {
        verbose: 1,
        sabOP: emptySharedBuffer,
        sabIO: emptySharedBuffer,
        sabOPView: emptyInt32Array,
        sabFileBufView: emptyUint8Array,
        sabS11nView: emptyUint8Array,
        sq3Codes: createZeroSqliteCodes(),
        opfsFlags: createZeroOpfsFlags(),
        opIds: createZeroOperationIds(),
        asyncIdleWaitTime: 150,
        asyncS11nExceptions: 1,
        fileBufferSize: 0,
        sabS11nOffset: 0,
        sabS11nSize: 0,
        littleEndian,
        serialization: new SerializationBuffer({
            sharedBuffer: emptySharedBuffer,
            offset: 0,
            size: 0,
            littleEndian,
            exceptionVerbosity: 0,
        }),
    };
};
globalThis.createDefaultState = createDefaultState;
