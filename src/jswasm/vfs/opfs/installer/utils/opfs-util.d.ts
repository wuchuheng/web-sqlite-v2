import type { OpfsUtilInterface } from "../../../../../../types/opfs-vfs-installer";

/**
 * Dependencies required for creating OPFS utility functions.
 */
export interface OpfsUtilDeps {
  /** OPFS state object */
  state: {
    littleEndian: boolean;
    asyncIdleWaitTime: number;
    asyncS11nExceptions: string[];
    fileBufferSize: number;
    sabS11nOffset: number;
    sabS11nSize: number;
    sabIO: SharedArrayBuffer;
    sabOP: SharedArrayBuffer;
    opIds: Record<string, number>;
    sq3Codes: Record<string, number>;
    opfsFlags: Record<string, number>;
    verbose: number;
    sabOPView: Int32Array;
    sabFileBufView: Uint8Array;
    sabS11nView: Uint8Array;
    s11n: {
      serialize: (value: string) => void;
      deserialize: () => [string];
    };
  };
  /** Utility functions */
  util: {
    affirmDbHeader: (chunk: Uint8Array) => void;
    toss: (...args: string[]) => never;
  };
  /** SQLite3 module instance */
  sqlite3: {
    capi: {
      sqlite3_open_v2: (
        filename: number,
        ppDb: number,
        flags: number,
        vfsName: number
      ) => number;
      sqlite3_close_v2: (pDb: number) => number;
      sqlite3_exec: (
        pDb: number,
        sql: number,
        callback: number,
        userData: number,
        pzErr: number
      ) => number;
      SQLITE_OPEN_READONLY: number;
    };
    wasm: {
      scopedAllocPush: () => number;
      scopedAllocPop: (scope: number) => void;
      scopedAllocCString: (str: string) => number;
      scopedAlloc: (size: number) => number;
      peek: (ptr: number, type: string) => number;
      poke: (ptr: number, value: number, type?: string) => void;
    };
  };
}

/**
 * Creates utility functions for OPFS filesystem operations.
 * Provides methods for file/directory manipulation, path resolution,
 * and database import/export operations.
 * @param deps - Dependencies object with state, util, and sqlite3
 * @returns OPFS utility interface with file system operation methods
 */
export function createOpfsUtil(deps: OpfsUtilDeps): OpfsUtilInterface;
