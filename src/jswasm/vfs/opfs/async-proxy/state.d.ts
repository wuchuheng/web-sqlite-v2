import type { SerializationBuffer } from "./serialization-buffer";

export type OperationName =
    | "opfs-async-shutdown"
    | "mkdir"
    | "xAccess"
    | "xClose"
    | "xDelete"
    | "xDeleteNoWait"
    | "xFileSize"
    | "xLock"
    | "xOpen"
    | "xRead"
    | "xSync"
    | "xTruncate"
    | "xUnlock"
    | "xWrite";

export interface WorkerSqliteErrorCodes {
    SQLITE_BUSY: number;
    SQLITE_CANTOPEN: number;
    SQLITE_IOERR: number;
    SQLITE_IOERR_DELETE: number;
    SQLITE_IOERR_FSYNC: number;
    SQLITE_IOERR_LOCK: number;
    SQLITE_IOERR_READ: number;
    SQLITE_IOERR_SHORT_READ: number;
    SQLITE_IOERR_TRUNCATE: number;
    SQLITE_IOERR_UNLOCK: number;
    SQLITE_IOERR_WRITE: number;
    SQLITE_LOCK_NONE: number;
    SQLITE_NOTFOUND: number;
    SQLITE_OPEN_CREATE: number;
    SQLITE_OPEN_DELETEONCLOSE: number;
    SQLITE_OPEN_READONLY: number;
}

export interface WorkerOpfsFlags {
    OPFS_UNLINK_BEFORE_OPEN: number;
    OPFS_UNLOCK_ASAP: number;
    defaultUnlockAsap: boolean;
}

export type OperationIdMap = { [K in OperationName]: number } & {
    whichOp: number;
    rc: number;
    retry: number;
};

export interface WorkerState {
    verbose: number;
    sabOP: SharedArrayBuffer | null;
    sabIO: SharedArrayBuffer | null;
    sabOPView: Int32Array | null;
    sabFileBufView: Uint8Array | null;
    sabS11nView: Uint8Array | null;
    sq3Codes: WorkerSqliteErrorCodes;
    opfsFlags: WorkerOpfsFlags;
    opIds: OperationIdMap;
    asyncIdleWaitTime: number;
    asyncS11nExceptions: number;
    fileBufferSize: number;
    sabS11nOffset: number;
    sabS11nSize: number;
    rootDir: FileSystemDirectoryHandle | null;
    littleEndian: boolean;
    s11n: SerializationBuffer | null;
}

export declare const createDefaultState: () => WorkerState;
