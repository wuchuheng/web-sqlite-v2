import type {
  IoSyncWrappers,
  VfsSyncWrappers,
} from "../../../../../../types/opfs-vfs-installer";

/**
 * Dependencies required for running OPFS sanity checks.
 */
export interface SanityCheckDeps {
  /** WASM utilities */
  wasm: {
    scopedAllocPush: () => number;
    scopedAllocPop: (scope: number) => void;
    scopedAllocCString: (str: string) => number;
    scopedAlloc: (size: number) => number;
    peek: (ptr: number, type: string) => number | bigint;
    poke: (ptr: number, value: number | bigint, type?: string) => void;
    cstrToJs: (ptr: number) => string;
  };
  /** C API functions and constants */
  capi: {
    sqlite3_file: new () => {
      pointer: number;
      dispose: () => void;
    };
    SQLITE_OPEN_CREATE: number;
    SQLITE_OPEN_READWRITE: number;
    SQLITE_OPEN_MAIN_DB: number;
  };
  /** OPFS state object */
  state: {
    sabOPView: Int32Array;
    opIds: Record<string, number>;
    s11n: {
      serialize: (value: string) => void;
      deserialize: () => [string];
    };
  };
  /** VFS synchronization wrappers */
  vfsSyncWrappers: VfsSyncWrappers & {
    xSleep?: (pVfs: number, microseconds: number) => number;
  };
  /** I/O synchronization wrappers */
  ioSyncWrappers: IoSyncWrappers;
  /** OPFS VFS instance */
  opfsVfs: {
    pointer: number;
    $iVersion: number;
    $zName: number;
    $mxPathname: number;
  };
  /** Random filename generator */
  randomFilename: (len?: number) => string;
  /** Logging function */
  log: (...args: (string | number | bigint)[]) => void;
  /** Warning function */
  warn: (...args: (string | number | bigint)[]) => void;
  /** Error function */
  error: (...args: (string | number | bigint)[]) => void;
  /** Throw error function */
  toss: (...args: (string | number | bigint)[]) => never;
}

/**
 * Runs comprehensive sanity checks on OPFS VFS implementation.
 * Tests file operations (open, read, write, close, delete),
 * directory operations, serialization, and VFS methods.
 * Throws errors if any check fails.
 * @param deps - Dependencies object with wasm, capi, state, wrappers, and utilities
 */
export function runSanityCheck(deps: SanityCheckDeps): void;
