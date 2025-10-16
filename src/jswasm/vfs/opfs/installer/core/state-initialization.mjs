/**
 * Initializes OPFS state object with shared buffers and operation IDs.
 * @param {import('./state-initialization.d.ts').StateInitDeps['opfsVfs']} opfsVfs - OPFS VFS structure
 * @param {import('./state-initialization.d.ts').StateInitDeps['capi']} capi - SQLite C API bindings
 * @param {import('./state-initialization.d.ts').StateInitDeps['toss']} toss - Error throwing utility
 * @returns {import('../../../../../../types/opfs-vfs-installer').OpfsState} Initialized state object
 */
export function initializeOpfsState(opfsVfs, capi, toss) {
    // 1. Input handling
    const state = Object.create(null);

    // 2. Core processing
    // 2.1 Detect endianness
    state.littleEndian = (() => {
        const buffer = new ArrayBuffer(2);
        new DataView(buffer).setInt16(0, 256, true);
        return new Int16Array(buffer)[0] === 256;
    })();

    // 2.2 Set buffer configuration
    state.asyncIdleWaitTime = 150;
    state.asyncS11nExceptions = 1;
    state.fileBufferSize = 1024 * 64;
    state.sabS11nOffset = state.fileBufferSize;
    state.sabS11nSize = opfsVfs.$mxPathname * 2;
    state.sabIO = new SharedArrayBuffer(
        state.fileBufferSize + state.sabS11nSize
    );

    // 2.3 Define operation IDs
    state.opIds = Object.create(null);
    let i = 0;
    state.opIds.whichOp = i++;
    state.opIds.rc = i++;
    state.opIds.xAccess = i++;
    state.opIds.xClose = i++;
    state.opIds.xDelete = i++;
    state.opIds.xDeleteNoWait = i++;
    state.opIds.xFileSize = i++;
    state.opIds.xLock = i++;
    state.opIds.xOpen = i++;
    state.opIds.xRead = i++;
    state.opIds.xSleep = i++;
    state.opIds.xSync = i++;
    state.opIds.xTruncate = i++;
    state.opIds.xUnlock = i++;
    state.opIds.xWrite = i++;
    state.opIds.mkdir = i++;
    state.opIds["opfs-async-metrics"] = i++;
    state.opIds["opfs-async-shutdown"] = i++;
    state.opIds.retry = i++;

    state.sabOP = new SharedArrayBuffer(i * 4);

    // 2.4 Map SQLite constants
    state.sq3Codes = Object.create(null);
    [
        "SQLITE_ACCESS_EXISTS",
        "SQLITE_ACCESS_READWRITE",
        "SQLITE_BUSY",
        "SQLITE_CANTOPEN",
        "SQLITE_ERROR",
        "SQLITE_IOERR",
        "SQLITE_IOERR_ACCESS",
        "SQLITE_IOERR_CLOSE",
        "SQLITE_IOERR_DELETE",
        "SQLITE_IOERR_FSYNC",
        "SQLITE_IOERR_LOCK",
        "SQLITE_IOERR_READ",
        "SQLITE_IOERR_SHORT_READ",
        "SQLITE_IOERR_TRUNCATE",
        "SQLITE_IOERR_UNLOCK",
        "SQLITE_IOERR_WRITE",
        "SQLITE_LOCK_EXCLUSIVE",
        "SQLITE_LOCK_NONE",
        "SQLITE_LOCK_PENDING",
        "SQLITE_LOCK_RESERVED",
        "SQLITE_LOCK_SHARED",
        "SQLITE_LOCKED",
        "SQLITE_MISUSE",
        "SQLITE_NOTFOUND",
        "SQLITE_OPEN_CREATE",
        "SQLITE_OPEN_DELETEONCLOSE",
        "SQLITE_OPEN_MAIN_DB",
        "SQLITE_OPEN_READONLY",
    ].forEach((k) => {
        if (undefined === (state.sq3Codes[k] = capi[k])) {
            toss("Maintenance required: not found:", k);
        }
    });

    // 2.5 Define OPFS-specific flags
    state.opfsFlags = Object.assign(Object.create(null), {
        OPFS_UNLOCK_ASAP: 0x01,
        OPFS_UNLINK_BEFORE_OPEN: 0x02,
        defaultUnlockAsap: false,
    });

    // 3. Output handling
    return state;
}

/**
 * Initializes metrics tracking for OPFS operations.
 * @param {import('../../../../../../types/opfs-vfs-installer').OpfsState} state - OPFS state object
 * @returns {import('../../../../../../types/opfs-vfs-installer').OpfsMetrics} Metrics object with counters for each operation
 */
export function initializeMetrics(state) {
    // 1. Input handling
    const metrics = Object.create(null);

    // 2. Core processing
    for (const k in state.opIds) {
        metrics[k] = Object.create(null);
        metrics[k].count = 0;
        metrics[k].time = 0;
        metrics[k].wait = 0;
    }

    const s11n = (metrics.s11n = Object.create(null));
    s11n.serialize = { count: 0, time: 0 };
    s11n.deserialize = { count: 0, time: 0 };

    // 3. Output handling
    return metrics;
}
