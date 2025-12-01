type AsyncOpfsFlags = import("./types.d.ts").AsyncOpfsFlags;
type AsyncProxyState = import("./types.d.ts").AsyncProxyState;
type OperationIds = import("./types.d.ts").OperationIds;
type SQLiteErrorCodes = import("./types.d.ts").SQLiteErrorCodes;

/**
 * Empty shared buffer used to initialize state fields prior to worker configuration.
 * Provides a zero-length `SharedArrayBuffer` to create placeholder typed views.
 */
const emptySharedBuffer: SharedArrayBuffer = new SharedArrayBuffer(0);

/**
 * Placeholder `Int32Array` view over the empty shared buffer.
 * Used for `sabOPView` before the worker receives real buffers from the controller.
 */
const emptyInt32Array: Int32Array = new Int32Array(emptySharedBuffer);

/**
 * Placeholder `Uint8Array` view over the empty shared buffer.
 * Used for `sabFileBufView` and `sabS11nView` prior to initialization.
 */
const emptyUint8Array: Uint8Array = new Uint8Array(emptySharedBuffer);

/**
 * Builds a zeroed-out SQLite error/flag constant map.
 * Returns an object with all required SQLite codes initialized to `0`.
 *
 * @returns Zeroed `SQLiteErrorCodes` object.
 */
const createZeroSqliteCodes = (): SQLiteErrorCodes => ({
  SQLITE_IOERR: 0, // Generic I/O error result code
  SQLITE_IOERR_DELETE: 0, // I/O error specifically during deletion
  SQLITE_IOERR_READ: 0, // I/O error during read operations
  SQLITE_IOERR_LOCK: 0, // I/O error acquiring/using a lock
  SQLITE_IOERR_FSYNC: 0, // I/O error during filesystem sync/flush
  SQLITE_IOERR_TRUNCATE: 0, // I/O error while truncating a file
  SQLITE_IOERR_UNLOCK: 0, // I/O error releasing a lock
  SQLITE_IOERR_WRITE: 0, // I/O error during write operations
  SQLITE_IOERR_SHORT_READ: 0, // Fewer bytes read than requested
  SQLITE_NOTFOUND: 0, // Target file or handle not found
  SQLITE_OPEN_CREATE: 0, // Flag: create file if it does not exist
  SQLITE_OPEN_READONLY: 0, // Flag: open file read-only
  SQLITE_OPEN_DELETEONCLOSE: 0, // Flag: delete the file on close
  SQLITE_LOCK_NONE: 0, // Lock state: no lock held
  SQLITE_BUSY: 0, // Busy/temporarily unavailable
  SQLITE_CANTOPEN: 0, // Could not open the file
});

/**
 * Builds a zeroed-out OPFS flags configuration.
 * Initializes numeric flags to `0` and boolean defaults accordingly.
 *
 * @returns Zeroed `AsyncOpfsFlags` object.
 */
const createZeroOpfsFlags = (): AsyncOpfsFlags => ({
  OPFS_UNLINK_BEFORE_OPEN: 0,
  OPFS_UNLOCK_ASAP: 0,
  defaultUnlockAsap: false,
});

/**
 * Builds a zeroed-out operation id table.
 * All operation identifiers are set to `0`, including special and VFS ops.
 *
 * @returns Zeroed `OperationIds` object.
 */
const createZeroOperationIds = (): OperationIds => ({
  whichOp: 0, // Atomics index: operation id slot signalled by controller
  rc: 0, // Atomics index: result code slot for worker → controller
  retry: 0, // Atomics index: backoff/Wait slot used for busy retries
  "opfs-async-shutdown": 0, // Operation: request worker shutdown
  mkdir: 0, // Operation: create directory path
  xAccess: 0, // Operation: check file existence
  xClose: 0, // Operation: close file and cleanup
  xDelete: 0, // Operation: delete file or directory (notify)
  xDeleteNoWait: 0, // Operation: delete file (internal, no notify)
  xFileSize: 0, // Operation: get file size
  xLock: 0, // Operation: acquire SQLite-style lock
  xOpen: 0, // Operation: open file (with flags)
  xRead: 0, // Operation: read bytes into shared buffer
  xSync: 0, // Operation: flush pending writes
  xTruncate: 0, // Operation: truncate file to size
  xUnlock: 0, // Operation: release lock, possibly dispose handle
  xWrite: 0, // Operation: write bytes from shared buffer
});

/**
 * Creates the default OPFS async proxy worker state.
 * Populates placeholders for shared buffers, typed views, flags, codes, ids,
 * timing values, and the `SerializationBuffer` with zero-size parameters.
 *
 * @returns New `AsyncProxyState` instance with default values.
 */
function createDefaultState(): AsyncProxyState {
  const detectLittleEndian = (
    globalThis as unknown as {
      detectLittleEndian: () => boolean;
    }
  ).detectLittleEndian;
  const littleEndian = detectLittleEndian();

  const SerializationBuffer = (
    globalThis as unknown as {
      SerializationBuffer: new (options: {
        sharedBuffer: SharedArrayBuffer;
        offset: number;
        size: number;
        littleEndian: boolean;
        exceptionVerbosity: number;
      }) => unknown;
    }
  ).SerializationBuffer as new (options: {
    sharedBuffer: SharedArrayBuffer;
    offset: number;
    size: number;
    littleEndian: boolean;
    exceptionVerbosity: number;
  }) => unknown;

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
    }) as unknown as AsyncProxyState["serialization"],
  };
}

/**
 * Attaches the state factory to the worker global scope for compatibility
 * with non-module script loaders (e.g., `importScripts`).
 */
(globalThis as unknown as { createDefaultState: unknown }).createDefaultState =
  createDefaultState;
