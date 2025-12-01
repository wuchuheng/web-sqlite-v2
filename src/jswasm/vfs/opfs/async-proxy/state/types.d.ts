export interface SerializationBuffer {
  serialize(...values: readonly (string | number | bigint | boolean)[]): void;
  deserialize(clear?: boolean): (string | number | bigint | boolean)[];
  storeException(priority: number, error: unknown): void;
}

export interface SQLiteErrorCodes {
  readonly SQLITE_IOERR: number;
  readonly SQLITE_IOERR_DELETE: number;
  readonly SQLITE_IOERR_READ: number;
  readonly SQLITE_IOERR_LOCK: number;
  readonly SQLITE_IOERR_FSYNC: number;
  readonly SQLITE_IOERR_TRUNCATE: number;
  readonly SQLITE_IOERR_UNLOCK: number;
  readonly SQLITE_IOERR_WRITE: number;
  readonly SQLITE_IOERR_SHORT_READ: number;
  readonly SQLITE_NOTFOUND: number;
  readonly SQLITE_OPEN_CREATE: number;
  readonly SQLITE_OPEN_READONLY: number;
  readonly SQLITE_OPEN_DELETEONCLOSE: number;
  readonly SQLITE_LOCK_NONE: number;
  readonly SQLITE_BUSY: number;
  readonly SQLITE_CANTOPEN: number;
}

export interface AsyncOpfsFlags {
  readonly OPFS_UNLINK_BEFORE_OPEN: number;
  readonly OPFS_UNLOCK_ASAP: number;
  readonly defaultUnlockAsap: boolean;
}

export interface OperationIds {
  readonly whichOp: number;
  readonly rc: number;
  readonly retry: number;
  readonly ["opfs-async-shutdown"]: number;
  readonly mkdir: number;
  readonly xAccess: number;
  readonly xClose: number;
  readonly xDelete: number;
  readonly xDeleteNoWait: number;
  readonly xFileSize: number;
  readonly xLock: number;
  readonly xOpen: number;
  readonly xRead: number;
  readonly xSync: number;
  readonly xTruncate: number;
  readonly xUnlock: number;
  readonly xWrite: number;
  readonly [key: string]: number;
}

export interface AsyncProxyState {
  verbose: number;
  sabOP: SharedArrayBuffer;
  sabIO: SharedArrayBuffer;
  sabOPView: Int32Array;
  sabFileBufView: Uint8Array;
  sabS11nView: Uint8Array;
  sq3Codes: SQLiteErrorCodes;
  opfsFlags: AsyncOpfsFlags;
  opIds: OperationIds;
  asyncIdleWaitTime: number;
  asyncS11nExceptions: number;
  fileBufferSize: number;
  sabS11nOffset: number;
  sabS11nSize: number;
  littleEndian: boolean;
  serialization: SerializationBuffer;
}

export declare function createDefaultState(): AsyncProxyState;
