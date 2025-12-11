import type {
  OpfsState,
  OpfsMetrics,
  OpfsOpIds,
  SQLiteConstants,
  OpfsFlags,
  SQLite3VFSInstance,
  SQLite3CAPI,
  OpfsMetricSet,
  OpfsS11nMetrics,
} from "../../../../../shared/opfs-vfs-installer";

/**
 * Initializes OPFS state object with shared buffers and operation IDs.
 * @param opfsVfs - OPFS VFS structure
 * @param capi - SQLite C API bindings
 * @param toss - Error throwing utility
 * @returns Initialized state object
 */
export function initializeOpfsState(
  opfsVfs: SQLite3VFSInstance,
  capi: SQLite3CAPI,
  toss: (msg: string, ...args: unknown[]) => never,
): OpfsState {
  // 1. Input handling
  const state = Object.create(null) as OpfsState;

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
  state.sabIO = new SharedArrayBuffer(state.fileBufferSize + state.sabS11nSize);

  // 2.3 Define operation IDs
  state.opIds = Object.create(null) as OpfsOpIds;
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
  state.sabOPView = new Int32Array(state.sabOP);

  // 2.4 Map SQLite constants
  state.sq3Codes = Object.create(null) as SQLiteConstants;
  const constants: (keyof SQLiteConstants)[] = [
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
  ];

  constants.forEach((k) => {
    const val = capi[k];
    if (undefined === val) {
      toss("Maintenance required: not found:", k);
    }
    state.sq3Codes[k] = val as number;
  });

  // 2.5 Define OPFS-specific flags
  state.opfsFlags = Object.assign(Object.create(null), {
    OPFS_UNLOCK_ASAP: 0x01,
    OPFS_UNLINK_BEFORE_OPEN: 0x02,
    defaultUnlockAsap: false,
  }) as OpfsFlags;

  // 3. Output handling
  return state;
}

/**
 * Initializes metrics tracking for OPFS operations.
 * @param state - OPFS state object
 * @returns Metrics object with counters for each operation
 */
export function initializeMetrics(state: OpfsState): OpfsMetrics {
  // 1. Input handling
  const metrics = Object.create(null) as OpfsMetrics;

  // 2. Core processing
  for (const k in state.opIds) {
    const metricSet = Object.create(null) as OpfsMetricSet;
    metricSet.count = 0;
    metricSet.time = 0;
    metricSet.wait = 0;
    metrics[k] = metricSet;
  }

  const s11n = Object.create(null) as OpfsS11nMetrics;
  s11n.serialize = { count: 0, time: 0, wait: 0 };
  s11n.deserialize = { count: 0, time: 0, wait: 0 };
  metrics.s11n = s11n;

  // 3. Output handling
  return metrics;
}
