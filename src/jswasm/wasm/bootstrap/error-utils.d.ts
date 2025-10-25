/**
 * Error constructor subtype returned by {@link createSQLite3Error}.
 */
export interface Sqlite3ErrorConstructor extends ErrorConstructor {
  new (...args: unknown[]): Error & { resultCode: number };
  toss(...args: unknown[]): never;
}

/**
 * Error constructor subtype returned by {@link createWasmAllocError}.
 */
export interface WasmAllocErrorConstructor extends ErrorConstructor {
  new (...args: unknown[]): Error & { resultCode: number };
  toss(...args: unknown[]): never;
}

/**
 * Subset of the C API that exposes a result-code to string mapper.
 */
export interface ResultCodeApi {
  sqlite3_js_rc_str?(rc: number): string | undefined;
}

/**
 * Minimal shape exposing the SQLITE_ERROR constant.
 */
export interface SqliteErrorCodeApi {
  SQLITE_ERROR: number;
}

/**
 * Minimal shape exposing the SQLITE_NOMEM constant.
 */
export interface SqliteNomemCodeApi {
  SQLITE_NOMEM: number;
}

/**
 * Builds a helper that resolves result codes to readable strings.
 */
export function createResultCodeStringifier(
  capi: ResultCodeApi,
): (rc: number) => string;

/**
 * Produces the canonical SQLite error constructor used throughout the bundle.
 */
export function createSQLite3Error(
  capi: SqliteErrorCodeApi,
  rcToString: (rc: number) => string,
): Sqlite3ErrorConstructor;

/**
 * Produces the error constructor thrown when WASM memory allocation fails.
 */
export function createWasmAllocError(
  capi: SqliteNomemCodeApi,
): WasmAllocErrorConstructor;
