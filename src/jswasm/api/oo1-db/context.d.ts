import type { DB, SQLite3API, SQLite3CAPI, Stmt } from "@wuchuheng/web-sqlite";
import type { Sqlite3WasmNamespace } from "../../wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts";
import type { CapiHelpers } from "../../wasm/bootstrap/runtime/capi-helpers.d.ts";

/**
 * SQLite C API namespace augmented with helper utilities exposed by the wasm bridge.
 */
export type SQLite3CapiWithHelpers = SQLite3CAPI &
  Pick<
    CapiHelpers,
    | "sqlite3_js_db_vfs"
    | "sqlite3_js_db_export"
    | "sqlite3_js_vfs_create_file"
    | "sqlite3_js_kvvfs_clear"
    | "sqlite3_js_kvvfs_size"
    | "sqlite3_js_rc_str"
    | "sqlite3_js_aggregate_context"
    | "sqlite3_values_to_js"
    | "sqlite3_result_js"
    | "sqlite3_result_error_js"
  > & {
    /**
     * Reports an error against the supplied database handle and returns the SQLite result code.
     */
    sqlite3__wasm_db_error(
      dbPointer: number,
      result: number | Error,
      message?: string,
    ): number;
  };

/**
 * Utility namespace exposed by the sqlite3 facade with additional internal helpers.
 */
export type Oo1Util = SQLite3API["util"] & {
  /**
   * Populates sqlite3's error state with the supplied message and result code.
   */
  sqlite3__wasm_db_error(
    dbPointer: number,
    result: number | Error,
    message?: string,
  ): number;
};

/** Pointer-like values accepted by the cleanup helpers. */
export type PointerLike = number | { pointer?: number } | DB | Stmt;

/** Registry of statements associated with an OO1 database instance. */
export interface StatementRegistry {
  [pointer: number]: Stmt | undefined;
}

/** Callback invoked once a VFS-backed connection finishes opening. */
export type VfsPostOpenCallback = (db: DB, sqlite3: SQLite3API) => void;

/** Metadata captured for cleanup of registered database resources. */
export interface DbCleanupMetadata {
  collation?: Set<string>;
  udf?: Map<string, Set<number>>;
  wudf?: Map<string, Set<number>>;
}

/** Shared runtime context threaded through the OO1 helper modules. */
export interface Oo1Context {
  /** Primary sqlite3 facade. */
  sqlite3: SQLite3API;
  /** C API namespace augmented with wasm helper functions. */
  capi: SQLite3CapiWithHelpers;
  /** Wasm helper namespace powering xWrap bindings. */
  wasm: Sqlite3WasmNamespace;
  /** High-level utilities mirrored from the sqlite3 facade. */
  util: Oo1Util;
  /** Pointer mapping between wrapper instances and native handles. */
  ptrMap: WeakMap<object, number>;
  /** Statement registry keyed by database handle. */
  stmtMap: WeakMap<DB, StatementRegistry>;
  /** Callbacks invoked after opening VFS-backed databases. */
  vfsCallbacks: Record<number, VfsPostOpenCallback | string | undefined>;
  /** Throws a sqlite3-specific error. */
  toss: (...messageParts: unknown[]) => never;
  /** Validates a result code, throwing if it represents failure. */
  checkRc<T extends DB | Stmt | number>(subject: T, resultCode: number): T;
}

/**
 * Builds the shared OO1 runtime context from the sqlite3 facade.
 */
export function createOo1Context(sqlite3: SQLite3API): Oo1Context;
