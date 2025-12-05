/**
 * Type definitions for OPFS VFS Installer
 *
 * This file contains comprehensive type definitions for the OPFS (Origin Private File System)
 * VFS (Virtual File System) installer for SQLite WASM. These types are referenced by JSDoc
 * comments throughout the installer modules.
 *
 * @module types/opfs-vfs-installer
 */

/**
 * SQLite3 module instance with all APIs
 */
export interface SQLite3Module {
  /** C API bindings */
  capi: SQLite3CAPI;
  /** WebAssembly interface */
  wasm: SQLite3WASM;
  /** Utility functions */
  util: SQLite3Util;
  /** Configuration object */
  config: SQLite3Config;
  /** VFS management */
  vfs: SQLite3VFS;
  /** Object-Oriented API version 1 */
  oo1?: SQLite3OO1;
  /** OPFS utilities (set after installation) */
  opfs?: OpfsUtilInterface;
  /** Script information */
  scriptInfo?: {
    sqlite3Dir?: string;
    [key: string]: unknown;
  };
}

/**
 * SQLite3 C API interface
 */
export interface SQLite3CAPI {
  // Constants
  SQLITE_OK: number;
  SQLITE_ERROR: number;
  SQLITE_BUSY: number;
  SQLITE_LOCKED: number;
  SQLITE_NOMEM: number;
  SQLITE_READONLY: number;
  SQLITE_IOERR: number;
  SQLITE_CORRUPT: number;
  SQLITE_CANTOPEN: number;
  SQLITE_NOTFOUND: number;
  SQLITE_MISUSE: number;

  // IOERR subcodes
  SQLITE_IOERR_READ: number;
  SQLITE_IOERR_SHORT_READ: number;
  SQLITE_IOERR_WRITE: number;
  SQLITE_IOERR_FSYNC: number;
  SQLITE_IOERR_DIR_FSYNC: number;
  SQLITE_IOERR_TRUNCATE: number;
  SQLITE_IOERR_FSTAT: number;
  SQLITE_IOERR_UNLOCK: number;
  SQLITE_IOERR_RDLOCK: number;
  SQLITE_IOERR_DELETE: number;
  SQLITE_IOERR_BLOCKED: number;
  SQLITE_IOERR_NOMEM: number;
  SQLITE_IOERR_ACCESS: number;
  SQLITE_IOERR_CHECKRESERVEDLOCK: number;
  SQLITE_IOERR_LOCK: number;
  SQLITE_IOERR_CLOSE: number;
  SQLITE_IOERR_DIR_CLOSE: number;

  // Access modes
  SQLITE_ACCESS_EXISTS: number;
  SQLITE_ACCESS_READWRITE: number;
  SQLITE_ACCESS_READ: number;

  // Lock levels
  SQLITE_LOCK_NONE: number;
  SQLITE_LOCK_SHARED: number;
  SQLITE_LOCK_RESERVED: number;
  SQLITE_LOCK_PENDING: number;
  SQLITE_LOCK_EXCLUSIVE: number;

  // Open flags
  SQLITE_OPEN_READONLY: number;
  SQLITE_OPEN_READWRITE: number;
  SQLITE_OPEN_CREATE: number;
  SQLITE_OPEN_DELETEONCLOSE: number;
  SQLITE_OPEN_EXCLUSIVE: number;
  SQLITE_OPEN_AUTOPROXY: number;
  SQLITE_OPEN_URI: number;
  SQLITE_OPEN_MEMORY: number;
  SQLITE_OPEN_MAIN_DB: number;
  SQLITE_OPEN_TEMP_DB: number;
  SQLITE_OPEN_TRANSIENT_DB: number;
  SQLITE_OPEN_MAIN_JOURNAL: number;
  SQLITE_OPEN_TEMP_JOURNAL: number;
  SQLITE_OPEN_SUBJOURNAL: number;
  SQLITE_OPEN_SUPER_JOURNAL: number;
  SQLITE_OPEN_NOMUTEX: number;
  SQLITE_OPEN_FULLMUTEX: number;
  SQLITE_OPEN_SHAREDCACHE: number;
  SQLITE_OPEN_PRIVATECACHE: number;

  // Device characteristics
  SQLITE_IOCAP_ATOMIC: number;
  SQLITE_IOCAP_ATOMIC512: number;
  SQLITE_IOCAP_ATOMIC1K: number;
  SQLITE_IOCAP_ATOMIC2K: number;
  SQLITE_IOCAP_ATOMIC4K: number;
  SQLITE_IOCAP_ATOMIC8K: number;
  SQLITE_IOCAP_ATOMIC16K: number;
  SQLITE_IOCAP_ATOMIC32K: number;
  SQLITE_IOCAP_ATOMIC64K: number;
  SQLITE_IOCAP_SAFE_APPEND: number;
  SQLITE_IOCAP_SEQUENTIAL: number;
  SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN: number;
  SQLITE_IOCAP_POWERSAFE_OVERWRITE: number;
  SQLITE_IOCAP_IMMUTABLE: number;
  SQLITE_IOCAP_BATCH_ATOMIC: number;

  // Structures
  sqlite3_vfs: SQLite3VFSClass;
  sqlite3_file: SQLite3FileClass;
  sqlite3_io_methods: SQLite3IoMethodsClass;

  // Functions
  sqlite3_vfs_find(name: string | null): number;
  sqlite3_uri_boolean(
    filename: number,
    param: string,
    defaultValue: number,
  ): number;
  sqlite3_busy_timeout(db: number, ms: number): number;

  [key: string]: unknown;
}

/**
 * SQLite3 VFS structure class
 */
export interface SQLite3VFSClass {
  new (pointer?: number): SQLite3VFSInstance;
  structInfo: {
    sizeof: number;
    [key: string]: unknown;
  };
}

/**
 * SQLite3 VFS instance
 */
export interface SQLite3VFSInstance {
  pointer: number;
  $iVersion: number;
  $szOsFile: number;
  $mxPathname: number;
  $zName: number;
  $pAppData: number;
  $xOpen: number | null;
  $xDelete: number | null;
  $xAccess: number | null;
  $xFullPathname: number | null;
  $xDlOpen: number | null;
  $xDlError: number | null;
  $xDlSym: number | null;
  $xDlClose: number | null;
  $xRandomness: number | null;
  $xSleep: number | null;
  $xCurrentTime: number | null;
  $xGetLastError: number | null;
  $xCurrentTimeInt64: number | null;
  addOnDispose(...args: unknown[]): SQLite3VFSInstance;
  dispose(): void;
}

/**
 * SQLite3 file structure class
 */
export interface SQLite3FileClass {
  new (pointer?: number): SQLite3FileInstance;
  structInfo: {
    sizeof: number;
    [key: string]: unknown;
  };
}

/**
 * SQLite3 file instance
 */
export interface SQLite3FileInstance {
  pointer: number;
  $pMethods: number;
  dispose(): void;
}

/**
 * SQLite3 I/O methods structure class
 */
export interface SQLite3IoMethodsClass {
  new (): SQLite3IoMethodsInstance;
}

/**
 * SQLite3 I/O methods instance
 */
export interface SQLite3IoMethodsInstance {
  pointer: number;
  $iVersion: number;
  $xClose: number | null;
  $xRead: number | null;
  $xWrite: number | null;
  $xTruncate: number | null;
  $xSync: number | null;
  $xFileSize: number | null;
  $xLock: number | null;
  $xUnlock: number | null;
  $xCheckReservedLock: number | null;
  $xFileControl: number | null;
  $xSectorSize: number | null;
  $xDeviceCharacteristics: number | null;
  dispose(): void;
}

/**
 * SQLite3 WebAssembly interface
 */
export interface SQLite3WASM {
  heap8u(): Uint8Array;
  allocCString(str: string): number;
  cstrToJs(ptr: number): string;
  cstrncpy(dest: number, src: number, max: number): number;
  poke(ptr: number, value: number | bigint, type: string): void;
  peek(ptr: number, type: string): number | bigint;
  scopedAllocPush(): unknown;
  scopedAllocPop(marker: unknown): void;
  scopedAlloc(size: number): number;
  scopedAllocCString(str: string): number;
}

/**
 * SQLite3 utility functions
 */
export interface SQLite3Util {
  toss(...args: unknown[]): never;
  affirmDbHeader(bytes: Uint8Array): void;
  affirmIsDb(bytes: Uint8Array): void;
  [key: string]: unknown;
}

/**
 * SQLite3 configuration
 */
export interface SQLite3Config {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  log(...args: unknown[]): void;
  [key: string]: unknown;
}

/**
 * SQLite3 VFS management
 */
export interface SQLite3VFS {
  installVfs(config: VFSInstallConfig): void;
  [key: string]: unknown;
}

/**
 * VFS installation configuration
 */
export interface VFSInstallConfig {
  io: {
    struct: SQLite3IoMethodsInstance;
    methods: IoSyncWrappers;
  };
  vfs: {
    struct: SQLite3VFSInstance;
    methods: VfsSyncWrappers;
  };
}

/**
 * SQLite3 Object-Oriented API v1
 */
export interface SQLite3OO1 {
  DB: SQLite3DBClass;
  OpfsDb?: SQLite3DBClass;
}

/**
 * SQLite3 DB class
 */
export interface SQLite3DBClass {
  new (...args: unknown[]): SQLite3DBInstance;
  prototype: SQLite3DBInstance;
  dbCtorHelper: {
    normalizeArgs(...args: unknown[]): DBConstructorOptions;
    call(context: SQLite3DBInstance, options: DBConstructorOptions): void;
    setVfsPostOpenCallback(
      vfsPointer: number,
      callback: (db: number, sqlite3: SQLite3Module) => void,
    ): void;
  };
}

/**
 * SQLite3 DB instance
 */
export interface SQLite3DBInstance {
  filename: string;
  pointer: number;
  [key: string]: unknown;
}

/**
 * DB constructor options
 */
export interface DBConstructorOptions {
  filename?: string;
  flags?: string | number;
  vfs?: string;
  [key: string]: unknown;
}

/**
 * OPFS installer options
 */
export interface OpfsInstallerOptions {
  /** Verbosity level: 0=error, 1=warn, 2=log */
  verbose?: number;
  /** Whether to run sanity checks */
  sanityChecks?: boolean;
  /** URI to the async proxy worker script */
  proxyUri?: string | (() => string);
}

/**
 * Normalized OPFS configuration
 */
export interface OpfsConfig extends OpfsInstallerOptions {
  verbose: number;
  sanityChecks: boolean;
  proxyUri: string;
  disabled: boolean;
}

/**
 * OPFS state object
 */
export interface OpfsState {
  verbose: number;
  littleEndian: boolean;
  asyncIdleWaitTime: number;
  asyncS11nExceptions: number;
  fileBufferSize: number;
  sabS11nOffset: number;
  sabS11nSize: number;
  sabIO: SharedArrayBuffer;
  sabOP: SharedArrayBuffer;
  opIds: OpfsOperationIds;
  sq3Codes: SQLiteConstants;
  opfsFlags: OpfsFlags;
  sabOPView?: Int32Array;
  sabFileBufView?: Uint8Array;
  sabS11nView?: Uint8Array;
  s11n?: SerializerInterface;
}

/**
 * Operation IDs for atomic communication
 */
export interface OpfsOperationIds {
  whichOp: number;
  rc: number;
  xAccess: number;
  xClose: number;
  xDelete: number;
  xDeleteNoWait: number;
  xFileSize: number;
  xLock: number;
  xOpen: number;
  xRead: number;
  xSleep: number;
  xSync: number;
  xTruncate: number;
  xUnlock: number;
  xWrite: number;
  mkdir: number;
  "opfs-async-metrics": number;
  "opfs-async-shutdown": number;
  retry: number;
}

/**
 * SQLite constant codes
 */
export interface SQLiteConstants {
  SQLITE_ACCESS_EXISTS: number;
  SQLITE_ACCESS_READWRITE: number;
  SQLITE_BUSY: number;
  SQLITE_CANTOPEN: number;
  SQLITE_ERROR: number;
  SQLITE_IOERR: number;
  SQLITE_IOERR_ACCESS: number;
  SQLITE_IOERR_CLOSE: number;
  SQLITE_IOERR_DELETE: number;
  SQLITE_IOERR_FSYNC: number;
  SQLITE_IOERR_LOCK: number;
  SQLITE_IOERR_READ: number;
  SQLITE_IOERR_SHORT_READ: number;
  SQLITE_IOERR_TRUNCATE: number;
  SQLITE_IOERR_UNLOCK: number;
  SQLITE_IOERR_WRITE: number;
  SQLITE_LOCK_EXCLUSIVE: number;
  SQLITE_LOCK_NONE: number;
  SQLITE_LOCK_PENDING: number;
  SQLITE_LOCK_RESERVED: number;
  SQLITE_LOCK_SHARED: number;
  SQLITE_LOCKED: number;
  SQLITE_MISUSE: number;
  SQLITE_NOTFOUND: number;
  SQLITE_OPEN_CREATE: number;
  SQLITE_OPEN_DELETEONCLOSE: number;
  SQLITE_OPEN_MAIN_DB: number;
  SQLITE_OPEN_READONLY: number;
}

/**
 * OPFS-specific flags
 */
export interface OpfsFlags {
  OPFS_UNLOCK_ASAP: number;
  OPFS_UNLINK_BEFORE_OPEN: number;
  defaultUnlockAsap: boolean;
}

/**
 * Performance metrics for operations
 */
export interface OpfsMetrics {
  [operationName: string]:
    | OperationMetric
    | {
        serialize: OperationMetric;
        deserialize: OperationMetric;
      };
  s11n: {
    serialize: OperationMetric;
    deserialize: OperationMetric;
  };
}

/**
 * Individual operation metric
 */
export interface OperationMetric {
  count: number;
  time: number;
  wait: number;
  avgTime?: number;
  avgWait?: number;
}

/**
 * Serializer interface for SharedArrayBuffer communication
 */
export interface SerializerInterface {
  serialize(...args: SerializableValue[]): void;
  deserialize(clear?: boolean): SerializableValue[] | null;
}

/**
 * Values that can be serialized
 */
export type SerializableValue = number | bigint | boolean | string;

/**
 * Operation runner function
 */
export type OperationRunner = (
  op: string,
  ...args: SerializableValue[]
) => number;

/**
 * Operation timer interface
 */
export interface OperationTimer {
  mTimeStart(op: string): void;
  mTimeEnd(): void;
}

/**
 * File handle object
 */
export interface OpfsFileHandle {
  fid: number;
  filename: string;
  sab: SharedArrayBuffer;
  sabView: Uint8Array;
  flags: number;
  readOnly: boolean;
  sq3File: SQLite3FileInstance;
  lockType: number;
}

/**
 * I/O sync wrappers interface
 */
export interface IoSyncWrappers {
  xCheckReservedLock(pFile: number, pOut: number): number;
  xClose(pFile: number): number;
  xDeviceCharacteristics(pFile: number): number;
  xFileControl(pFile: number, opId: number, pArg: number): number;
  xFileSize(pFile: number, pSz64: number): number;
  xLock(pFile: number, lockType: number): number;
  xRead(
    pFile: number,
    pDest: number,
    n: number,
    offset64: number | bigint,
  ): number;
  xSync(pFile: number, flags: number): number;
  xTruncate(pFile: number, sz64: number | bigint): number;
  xUnlock(pFile: number, lockType: number): number;
  xWrite(
    pFile: number,
    pSrc: number,
    n: number,
    offset64: number | bigint,
  ): number;
}

/**
 * VFS sync wrappers interface
 */
export interface VfsSyncWrappers {
  xAccess(pVfs: number, zName: number, flags: number, pOut: number): number;
  xCurrentTime(pVfs: number, pOut: number): number;
  xCurrentTimeInt64(pVfs: number, pOut: number): number;
  xDelete(pVfs: number, zName: number, doSyncDir: number): number;
  xFullPathname(
    pVfs: number,
    zName: number,
    nOut: number,
    pOut: number,
  ): number;
  xGetLastError(pVfs: number, nOut: number, pOut: number): number;
  xOpen(
    pVfs: number,
    zName: number,
    pFile: number,
    flags: number,
    pOutFlags: number,
  ): number;
  xRandomness?(pVfs: number, nOut: number, pOut: number): number;
  xSleep?(pVfs: number, ms: number): number;
}

/**
 * OPFS utility interface
 */
export interface OpfsUtilInterface {
  rootDirectory: FileSystemDirectoryHandle;
  metrics: {
    dump(): void;
    reset(): void;
  };
  debug: {
    asyncShutdown(): void;
    asyncRestart(): void;
  };
  getResolvedPath(filename: string, splitIt?: boolean): string | string[];
  getDirForFilename(
    absFilename: string,
    createDirs?: boolean,
  ): Promise<[FileSystemDirectoryHandle, string]>;
  mkdir(absDirName: string): Promise<boolean>;
  entryExists(fsEntryName: string): Promise<boolean>;
  randomFilename(len?: number): string;
  treeList(): Promise<DirectoryTree>;
  rmfr(): Promise<void>;
  unlink(
    fsEntryName: string,
    recursive?: boolean,
    throwOnError?: boolean,
  ): Promise<boolean>;
  traverse(opt: TraverseOptions | TraverseCallback): Promise<void>;
  importDb(
    filename: string,
    bytes: Uint8Array | ArrayBuffer | ChunkedImportCallback,
  ): Promise<number>;
}

/**
 * Directory tree structure
 */
export interface DirectoryTree {
  name: string;
  dirs: DirectoryTree[];
  files: string[];
}

/**
 * Traverse options
 */
export interface TraverseOptions {
  recursive?: boolean;
  directory?: FileSystemDirectoryHandle;
  callback: TraverseCallback;
}

/**
 * Traverse callback function
 */
export type TraverseCallback = (
  handle: FileSystemHandle,
  dirHandle: FileSystemDirectoryHandle,
  depth: number,
) => boolean | void;

/**
 * Chunked import callback
 */
export type ChunkedImportCallback = () => Promise<
  Uint8Array | ArrayBuffer | undefined
>;

/**
 * Worker message data types
 */
export type WorkerMessageData =
  | { type: "opfs-unavailable"; payload: string[] }
  | { type: "opfs-async-loaded" }
  | { type: "opfs-async-inited" }
  | { type: "opfs-async-metrics" }
  | { type: "opfs-async-restart" };

/**
 * Promise rejection wrapper
 */
export interface PromiseWasRejected {
  value: boolean | undefined;
}

/**
 * Dependencies for I/O sync wrappers
 */
export interface IoSyncWrapperDeps {
  wasm: SQLite3WASM;
  capi: SQLite3CAPI;
  state: OpfsState;
  opRun: OperationRunner;
  mTimeStart: (op: string) => void;
  mTimeEnd: () => void;
  error(...args: unknown[]): void;
  __openFiles: Record<number, OpfsFileHandle>;
}

/**
 * Dependencies for VFS sync wrappers
 */
export interface VfsSyncWrapperDeps {
  wasm: SQLite3WASM;
  capi: SQLite3CAPI;
  state: OpfsState;
  opRun: OperationRunner;
  mTimeStart: (op: string) => void;
  mTimeEnd: () => void;
  randomFilename: (len?: number) => string;
  __openFiles: Record<number, OpfsFileHandle>;
  sqlite3_file: SQLite3FileClass;
  opfsIoMethods: SQLite3IoMethodsInstance;
}

/**
 * Dependencies for worker message handler
 */
export interface WorkerMessageHandlerDeps {
  promiseResolve: () => void;
  promiseReject: (err: Error) => void;
  promiseWasRejected: PromiseWasRejected;
  sqlite3: SQLite3Module;
  opfsVfs: SQLite3VFSInstance;
  opfsIoMethods: SQLite3IoMethodsInstance;
  ioSyncWrappers: IoSyncWrappers;
  vfsSyncWrappers: VfsSyncWrappers;
  state: OpfsState;
  opfsUtil: OpfsUtilInterface;
  options: OpfsConfig;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  runSanityCheck: () => void;
  thisThreadHasOPFS: () => boolean;
  W: Worker;
}

/**
 * Install OPFS VFS function
 */
export type InstallOpfsVfs = {
  (options?: OpfsInstallerOptions): Promise<SQLite3Module>;
  defaultProxyUri: string;
};

/**
 * Install OPFS VFS initializer function
 */
export type InstallOpfsVfsInitializer = (
  sqlite3Ref: SQLite3Module,
) => Promise<void | SQLite3Module>;

/**
 * Return type of createInstallOpfsVfsContext
 */
export interface OpfsVfsInstallerContext {
  installOpfsVfs: InstallOpfsVfs;
  installOpfsVfsInitializer: InstallOpfsVfsInitializer;
}
