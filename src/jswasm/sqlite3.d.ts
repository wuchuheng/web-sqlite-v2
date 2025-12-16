/**
 * Type declarations for `sqlite3.mjs` (SQLite.org WASM/JS bundle).
 *
 * This declaration aims to be practical and "comprehensive enough" for real-world TS usage:
 * - Includes the top-level `sqlite3` API object returned from the async initializer.
 * - Models the OO API (`sqlite3.oo1`) including `DB`, `Stmt`, `JsStorageDb`, **and** `OpfsDb`.
 * - Models OPFS helpers (`sqlite3.opfs`), VFS helpers (`sqlite3.vfs`), and vtab helpers (`sqlite3.vtab`).
 *
 * Because the bundle assembles many APIs dynamically at runtime, some namespaces contain
 * additional fields not exhaustively declared here. Those are represented via `unknown`
 * index signatures (never `any`).
 */

export {};

declare global {
  /**
   * Global bootstrap state used by the bundle to locate and instantiate the WASM binary.
   * You may set this before importing the module to override defaults (e.g. `wasmFilename`).
   */

  var sqlite3InitModuleState: Sqlite3InitModuleState | undefined;

  /**
   * Global bootstrap helper installed by the bundle.
   * It orchestrates synchronous and asynchronous API initializers.
   */

  var sqlite3ApiBootstrap: Sqlite3ApiBootstrap | undefined;
}

/**
 * Global bootstrap state object used by the bundle.
 */
export interface Sqlite3InitModuleState {
  /** Optional debug logger hook used by the bundle. */
  debugModule?: (...args: readonly unknown[]) => void;

  /** The `<script>` element that loaded the module when available (browsers). */
  moduleScript?: HTMLScriptElement | null;

  /** True if running in a Worker global scope. */
  isWorker?: boolean;

  /** The current global location, if available. */
  location?: Location | undefined;

  /** Search parameters parsed from `location.href` (if available). */
  urlParams?: URLSearchParams;

  /** Filename (or URL) of the WASM binary. Default: `'sqlite3.wasm'`. */
  wasmFilename?: string;

  /**
   * Script directory used for resolving the WASM file when a script tag is available.
   * Some builds set this automatically.
   */
  scriptDir?: string;

  /** Extra fields used by the bundle or by callers. */
  [key: string]: unknown;
}

/**
 * Global bootstrap coordinator installed on `globalThis` by the bundle.
 */
export interface Sqlite3ApiBootstrap {
  /** Synchronous initializer functions which receive the `sqlite3` API object. */
  initializers: Array<(sqlite3: Sqlite3) => void>;

  /** Asynchronous initializer functions which receive the `sqlite3` API object. */
  initializersAsync: Array<(sqlite3: Sqlite3) => Promise<void>>;

  /**
   * Starts initialization (the bundle may delete this after completion).
   * @returns The initialized `sqlite3` API object.
   */
  initialize?: (sqlite3: Sqlite3) => Promise<Sqlite3>;

  /** Extra fields used internally by the bundle. */
  [key: string]: unknown;
}

/**
 * Minimal Emscripten `Module` configuration object accepted by `sqlite3InitModule(moduleArg)`.
 */
export interface EmscriptenModule {
  /**
   * Called by the loader to resolve runtime file URLs (notably the WASM binary).
   */
  locateFile?: (path: string, prefix?: string) => string;

  /**
   * Custom WASM instantiation hook used by some Emscripten builds.
   */
  instantiateWasm?: (
    imports: WebAssembly.Imports,
    onSuccess: (
      instance: WebAssembly.Instance,
      module: WebAssembly.Module,
    ) => void,
  ) => void | Promise<void>;

  /** Standard output hook. */
  print?: (...args: readonly unknown[]) => void;

  /** Standard error output hook. */
  printErr?: (...args: readonly unknown[]) => void;

  /** Called when Emscripten aborts. */
  onAbort?: (reason: unknown) => void;

  /** Optional hook for monitoring run dependencies. */
  monitorRunDependencies?: (left: number) => void;

  /** The WASM memory, if supplied/overridden. */
  wasmMemory?: WebAssembly.Memory;

  /** Arbitrary extra fields used by the bundle or callers. */
  [key: string]: unknown;
}

/**
 * Default export type: the async initializer which resolves to the `sqlite3` API object.
 */
export interface Sqlite3InitModule {
  /**
   * Initializes the SQLite WASM module.
   *
   * @param moduleArg Optional Emscripten `Module` configuration object.
   * @returns A Promise resolving to the `sqlite3` API object.
   */
  (moduleArg?: Partial<EmscriptenModule>): Promise<Sqlite3>;

  /**
   * Emscripten builds often attach a `ready` Promise to the init function.
   * If present, it resolves to the same value as calling the init function.
   */
  readonly ready?: Promise<Sqlite3>;
}

/**
 * SQLite runtime error thrown by the bundle’s higher-level APIs.
 */
export class SQLite3Error extends Error {
  /**
   * Constructs a new SQLite3Error.
   *
   * @param resultCode SQLite result code (e.g. `SQLITE_ERROR`).
   * @param message Optional message or message parts.
   */
  constructor(resultCode?: number, ...message: readonly unknown[]);

  /** The associated SQLite result code. */
  readonly resultCode: number;

  /** Helper to throw a `SQLite3Error`. */
  static toss(resultCode: number, ...message: readonly unknown[]): never;
}

/**
 * Error type used when WASM-side allocations fail.
 */
export class WasmAllocError extends Error {
  /**
   * Constructs a new WasmAllocError.
   *
   * @param message Optional message.
   */
  constructor(message?: string);
}

/**
 * A value which can be bound to a SQLite parameter.
 */
export type BindValue =
  | null
  | number
  | string
  | boolean
  | bigint
  | Uint8Array
  | ArrayBuffer;

/**
 * A bindable collection used by `Stmt.bind()` and `DB.exec({ bind })`.
 */
export type BindCollection =
  | readonly BindValue[]
  | Record<string, BindValue>
  | ArrayBuffer
  | Uint8Array
  | BindValue
  | undefined;

/**
 * SQL input accepted by most APIs.
 *
 * The bundle accepts strings and "SQLable typed arrays" (byte-oriented arrays).
 */
export type SqlInput = string | Uint8Array;

/**
 * Row mode used by `DB.exec()` when collecting or yielding results.
 */
export type RowMode = "array" | "object" | "stmt" | number | `$${string}`;

/**
 * A SQLite value returned by `Stmt.get()` in typical cases.
 */
export type SqlValue = null | number | string | bigint | Uint8Array;

/**
 * Options object accepted by `DB.exec(...)`.
 */
export interface ExecOptions<TRow = unknown> {
  /** SQL to execute. */
  sql?: SqlInput | readonly SqlInput[];

  /** Bind parameters for the statement(s). */
  bind?: BindCollection;

  /**
   * Callback invoked for each result row.
   * The callback argument type depends on `rowMode`.
   */
  callback?: (row: TRow, stmt: Sqlite3Stmt) => void;

  /** Controls row representation delivered to `callback` and/or collected into `resultRows`. */
  rowMode?: RowMode;

  /** Optional output array for collecting rows when `rowMode` is compatible. */
  resultRows?: TRow[];

  /** Optional output array used to capture the text SQL for each prepared statement. */
  saveSql?: string[];

  /**
   * Controls the return value of `exec()`:
   * - `'this'` (default): returns the DB instance
   * - `'resultRows'`: returns `resultRows` (creates one if missing)
   * - `'saveSql'`: returns `saveSql` (creates one if missing)
   */
  returnValue?: "this" | "resultRows" | "saveSql";

  /** When set, `exec()` may fill this with column names (first row only). */
  columnNames?: string[];
}

/**
 * The top-level `sqlite3` API object resolved from `sqlite3InitModule()`.
 */
export interface Sqlite3 {
  /** Error thrown on WASM allocation failures. */
  readonly WasmAllocError: typeof WasmAllocError;

  /** Error thrown for SQLite misuse / runtime errors. */
  readonly SQLite3Error: typeof SQLite3Error;

  /** Low-level C API bindings and constants. */
  readonly capi: Sqlite3Capi;

  /** Helper utilities (may be deleted after init in some builds). */
  util?: Sqlite3Util;

  /** WebAssembly utilities and memory helpers. */
  readonly wasm: Sqlite3Wasm;

  /** Configuration and logging hooks. */
  readonly config: Sqlite3Config;

  /** Version/build info populated by the bundle. */
  readonly version: Sqlite3VersionInfo;

  /** Optional field reserved for host applications. */
  client?: unknown;

  /**
   * Completes async initializers (VFS, OPFS, etc.) and returns the finalized API object.
   */
  asyncPostInit: () => Promise<Sqlite3>;

  /** Script/build metadata, populated when available. */
  scriptInfo?: Sqlite3ScriptInfo;

  /** OO API layer (present after its initializer runs). */
  oo1?: Sqlite3Oo1;

  /** VFS helper namespace (present after its initializer runs). */
  vfs?: Sqlite3VfsNamespace;

  /** Virtual table helper namespace (present after its initializer runs). */
  vtab?: Sqlite3VtabNamespace;

  /** OPFS helper namespace (present when OPFS support is installed). */
  opfs?: Sqlite3OpfsUtil;

  /**
   * Installs the OPFS SAH pool VFS (when available) and returns a pool utility object.
   */
  installOpfsSAHPoolVfs?: (
    options?: Partial<OpfsSAHPoolVfsOptions>,
  ) => Promise<OpfsSAHPoolVfsPoolUtil>;

  /**
   * Installs Worker1 API helpers (must be called in a Worker global scope).
   * The returned API surface is bundle-specific.
   */
  initWorker1API?: () => Record<string, unknown>;

  /**
   * Struct binder helper (created via `globalThis.Jaccwabyt(...)` in this bundle).
   * The exact shape depends on the Jaccwabyt build.
   */
  StructBinder?: unknown;

  /** Internal test hook flag used by the bundle. */
  __isUnderTest?: boolean;

  /** Additional namespaces may be installed at runtime. */
  [key: string]: unknown;
}

/**
 * Script/build metadata exposed by the bundle.
 */
export interface Sqlite3ScriptInfo {
  /** A snapshot of the instantiation arguments, when available. */
  instantiateWasm?: {
    /** WASM instance created by the loader. */
    instance: WebAssembly.Instance;
    /** WASM module created by the loader. */
    module: WebAssembly.Module;
    /** Imports passed to instantiation. */
    imports: WebAssembly.Imports;
  };

  /** Additional metadata. */
  [key: string]: unknown;
}

/**
 * Logging and configuration hooks.
 */
export interface Sqlite3Config {
  /** Error logger used by the bundle. */
  error: (...args: readonly unknown[]) => void;

  /** Warning logger used by the bundle. */
  warn: (...args: readonly unknown[]) => void;

  /** Informational logger used by the bundle. */
  log: (...args: readonly unknown[]) => void;

  /** Arbitrary configuration values. */
  [key: string]: unknown;
}

/**
 * Version/build information populated by the SQLite WASM bundle.
 */
export interface Sqlite3VersionInfo {
  /** SQLite version string (e.g. `"3.51.1"`). */
  libVersion?: string;

  /** SQLite version number (e.g. `3051001`). */
  libVersionNumber?: number;

  /** Source ID string embedded by SQLite. */
  sourceId?: string;

  /** Arbitrary additional version fields. */
  [key: string]: unknown;
}

/**
 * Low-level WebAssembly helpers exposed by the bundle.
 */
export interface Sqlite3Wasm {
  /** True if BigInt support is enabled in this build. */
  readonly bigIntEnabled: boolean;

  /** WASM exports (functions) made available by the compiled module. */
  readonly exports: Record<string, unknown>;

  /** The WASM memory view as signed bytes. */
  heap8: () => Int8Array;

  /** The WASM memory view as unsigned bytes. */
  heap8u: () => Uint8Array;

  /** Returns true if `v` looks like a WASM pointer for this build. */
  isPtr: (v: unknown) => v is number | bigint;

  /** Reads a NUL-terminated C string from WASM memory. */
  cstrToJs: (ptr: number | bigint) => string;

  /** Allocates a NUL-terminated UTF-8 C string in WASM memory. */
  allocCString: (s: string) => number;

  /** Pointer arithmetic helpers (exact shape is build-dependent). */
  readonly ptr: Record<string, unknown>;

  /** Pseudo-stack allocator (exact shape is build-dependent). */
  readonly pstack: Record<string, unknown>;

  /** Scoped allocator stack control (exact shape is build-dependent). */
  scopedAllocPush: () => unknown;

  /** Pops a previously pushed scoped allocation frame. */
  scopedAllocPop: (frame: unknown) => void;

  /** Arbitrary additional fields provided by the bundle. */
  [key: string]: unknown;
}

/**
 * Low-level C API bindings and constants (`sqlite3.capi`).
 *
 * The full surface is large; this interface declares common functions and a safe
 * `unknown` index signature for the rest.
 */
export interface Sqlite3Capi {
  /** SQLITE_OK etc. (exact numeric values are per SQLite). */
  readonly SQLITE_OK?: number;

  /** SQLITE_ROW etc. */
  readonly SQLITE_ROW?: number;

  /** SQLITE_DONE etc. */
  readonly SQLITE_DONE?: number;

  /** Column type constants. */
  readonly SQLITE_NULL?: number;
  readonly SQLITE_INTEGER?: number;
  readonly SQLITE_FLOAT?: number;
  readonly SQLITE_TEXT?: number;
  readonly SQLITE_BLOB?: number;

  /** `sqlite3_vfs` struct wrapper constructor. */
  sqlite3_vfs?: {
    new (ptr: number | bigint): Sqlite3VfsStruct;
    prototype: Sqlite3VfsStruct;
  };

  /** `sqlite3_index_info` struct wrapper constructor (used by vtab helpers). */
  sqlite3_index_info?: {
    new (ptr: number | bigint): Sqlite3IndexInfoStruct;
    prototype: Sqlite3IndexInfoStruct;
  };

  /** Registers a VFS. */
  sqlite3_vfs_register?: (vfs: number | bigint, asDefault: number) => number;

  /** Busy timeout helper (used by OPFS DB variants in this bundle). */
  sqlite3_busy_timeout?: (pDb: number | bigint, ms: number) => number;

  /** Additional API surface. */
  [key: string]: unknown;
}

/**
 * Subset of the `sqlite3_vfs` struct wrapper used by the VFS namespace initializer.
 */
export interface Sqlite3VfsStruct {
  /** Pointer to the wrapped struct. */
  readonly pointer?: number | bigint;

  /** Name field (C string pointer). */
  $zName?: number | bigint;

  /**
   * Registers this VFS with SQLite.
   *
   * @param asDefault If true, sets this VFS as default.
   * @returns SQLite result code.
   */
  registerVfs?: (asDefault?: boolean) => number;

  /** Disposes resources associated with this wrapper. */
  dispose: () => void;

  /** Additional fields. */
  [key: string]: unknown;
}

/**
 * Subset of `sqlite3_index_info` struct wrapper.
 *
 * The bundle adds helper methods like `nthConstraint()`.
 */
export interface Sqlite3IndexInfoStruct {
  /** Pointer to the wrapped struct. */
  readonly pointer?: number | bigint;

  /** Constraint count (field name used by the bundle). */
  $nConstraint?: number;

  /**
   * Returns the Nth constraint or `false` if out of range.
   *
   * @param n Constraint index.
   * @param asPtr When true, returns a pointer-like value.
   */
  nthConstraint?: (n: number, asPtr?: boolean) => unknown;

  /** Additional fields. */
  [key: string]: unknown;
}

/**
 * Utility namespace (`sqlite3.util`).
 */
export interface Sqlite3Util {
  /** Throws a SQLite3Error (bundle helper). */
  toss3: (rcOrMsg: number | string, ...msg: readonly unknown[]) => never;

  /** True if running on the UI/main thread (bundle helper). */
  isUIThread: () => boolean;

  /** Additional helpers. */
  [key: string]: unknown;
}

/**
 * OO layer namespace (`sqlite3.oo1`).
 */
export interface Sqlite3Oo1 {
  /** Database wrapper class. */
  readonly DB: Sqlite3DBConstructor;

  /** Statement wrapper class. */
  readonly Stmt: Sqlite3StmtConstructor;

  /**
   * A DB backed by browser storage (only on UI thread and when kvvfs is available).
   */
  readonly JsStorageDb?: Sqlite3DBConstructor;

  /**
   * A DB variant that forces the OPFS VFS (available when OPFS VFS is installed).
   */
  readonly OpfsDb?: Sqlite3DBConstructor & {
    /**
     * Imports a database file into OPFS.
     *
     * @param filename Target filename within OPFS.
     * @param bytes SQLite database file bytes.
     */
    importDb?: (
      filename: string,
      bytes: Uint8Array | ArrayBuffer,
    ) => Promise<void>;
  };

  /** Additional classes and helpers. */
  [key: string]: unknown;
}

/**
 * Constructor type for `sqlite3.oo1.DB`.
 */
export interface Sqlite3DBConstructor {
  /**
   * Opens a database.
   *
   * @param filename Database filename (default `":memory:"`) or options object.
   * @param flags Open flags (bundle default is `'c'`).
   * @param vfs Optional VFS name.
   */

  new (
    filename?: string | Sqlite3DbOpenOptions,
    flags?: string,
    vfs?: string | null,
  ): Sqlite3DB;

  /**
   * Wraps an existing `sqlite3*` pointer into a DB object.
   *
   * @param pDb Pointer to `sqlite3*`.
   * @param takeOwnership If true, the wrapper will close the handle on `close()`.
   */
  wrapHandle?: (pDb: number | bigint, takeOwnership?: boolean) => Sqlite3DB;

  /**
   * Helper used internally by the bundle to normalize and open DB constructor arguments.
   * Exposed by this build and used by `JsStorageDb`/`OpfsDb`/pool DB variants.
   */
  readonly dbCtorHelper?: Sqlite3DbCtorHelper;

  /** Internal helper exposed by the bundle. */
  dbCtorHelper?: Sqlite3DbCtorHelper;

  /** Additional static fields. */
  [key: string]: unknown;
}

/**
 * Helper surface exposed as `DB.dbCtorHelper` in this bundle.
 */
export interface Sqlite3DbCtorHelper {
  /**
   * Normalizes DB constructor arguments into an options object.
   */
  normalizeArgs: (...args: readonly unknown[]) => Sqlite3DbOpenOptions;

  /**
   * Calls the DB constructor logic with a normalized options object.
   */
  call: (dbThis: unknown, opt: Sqlite3DbOpenOptions) => void;

  /**
   * Installs a callback invoked after opening a DB with a specific VFS pointer.
   */
  setVfsPostOpenCallback: (
    vfsPtr: number | bigint,
    cb: (oo1DbPtr: number | bigint, sqlite3: Sqlite3) => void,
  ) => void;

  /** Additional helper fields. */
  [key: string]: unknown;
}

/**
 * Options object accepted by the `DB` constructor in this bundle.
 */
export interface Sqlite3DbOpenOptions {
  /** Database filename (default `":memory:"`). */
  filename?: string;

  /** Open flags (bundle default `'c'`). */
  flags?: string;

  /** Optional VFS name (e.g. `'opfs'`, `'kvvfs'`). */
  vfs?: string | null;

  /** Additional options may be accepted by specific builds. */
  [key: string]: unknown;
}

/**
 * OO wrapper for a SQLite database connection.
 */
export interface Sqlite3DB {
  /** True if this DB is still open. */
  isOpen(): boolean;

  /** Throws if the DB is closed, returning `this` for chaining. */
  affirmOpen(): this;

  /** Closes the DB if open (idempotent). */
  close(): void;

  /**
   * Returns the number of changes.
   *
   * @param total If true, returns total changes rather than changes since the last call.
   * @param sixtyFour If true, requests 64-bit results (may yield `bigint` when available).
   */
  changes(total?: boolean, sixtyFour?: boolean): number | bigint;

  /** Returns the filename for an attached database. */
  dbFilename(dbName?: string): string | null;

  /** Returns the name for the Nth attached database. */
  dbName(dbNumber?: number): string | null;

  /** Returns the VFS name for the given attached database. */
  dbVfsName(dbName?: number): string | undefined;

  /** Prepares a SQL statement. */
  prepare(sql: SqlInput): Sqlite3Stmt;

  /** Executes SQL (string form). */
  exec(sql: SqlInput): this;

  /** Executes SQL (options form). */
  exec(opt: ExecOptions & { returnValue?: undefined | "this" }): this;
  exec<TRow>(
    opt: ExecOptions<TRow> & { returnValue: "resultRows"; resultRows?: TRow[] },
  ): TRow[];
  exec(
    opt: ExecOptions & { returnValue: "saveSql"; saveSql?: string[] },
  ): string[];

  /** Convenience API: returns the first column of the first row, or `undefined` if no row. */
  selectValue(
    sql: SqlInput,
    bind?: BindCollection,
    asType?: number,
  ): SqlValue | undefined;

  /** Convenience API: returns the first column of all rows. */
  selectValues(
    sql: SqlInput,
    bind?: BindCollection,
    asType?: number,
  ): SqlValue[];

  /** Convenience API: returns the first row as an array. */
  selectArray(sql: SqlInput, bind?: BindCollection): SqlValue[] | undefined;

  /** Convenience API: returns the first row as an object keyed by column name. */
  selectObject(
    sql: SqlInput,
    bind?: BindCollection,
  ): Record<string, SqlValue> | undefined;

  /** Convenience API: returns all rows as arrays. */
  selectArrays(sql: SqlInput, bind?: BindCollection): SqlValue[][];

  /** Convenience API: returns all rows as objects keyed by column name. */
  selectObjects(
    sql: SqlInput,
    bind?: BindCollection,
  ): Array<Record<string, SqlValue>>;

  /** Returns the number of open statements tracked by this DB wrapper. */
  openStatementCount(): number;

  /**
   * Runs a callback within a transaction.
   *
   * @param callback Callback invoked with this DB.
   * @returns The callback return value.
   */
  transaction<T>(callback: (db: this) => T): T;

  /**
   * Runs a callback within a transaction with a BEGIN qualifier (e.g. `"IMMEDIATE"`).
   *
   * @param beginQualifier A single word qualifier appended to `BEGIN`.
   * @param callback Callback invoked with this DB.
   * @returns The callback return value.
   */
  transaction<T>(beginQualifier: string, callback: (db: this) => T): T;

  /**
   * Runs a callback within a SAVEPOINT.
   *
   * @param callback Callback invoked with this DB.
   * @returns The callback return value.
   */
  savepoint<T>(callback: (db: this) => T): T;

  /**
   * Creates a user-defined function.
   *
   * This is a flexible API supporting scalar, aggregate, and window functions.
   * Callback signatures are modeled conservatively without using `any`.
   */
  createFunction(
    name: string,
    xFunc: (...args: readonly SqlValue[]) => SqlValue | void,
    opt?: Sqlite3CreateFunctionOptions,
  ): this;

  /** Alternative overload accepting a single options object. */
  createFunction(opt: Sqlite3CreateFunctionOptions & { name: string }): this;

  /** Checks an SQLite result code and throws on error. */
  checkRc(resultCode: number): number;

  /**
   * Internal pointer to the `sqlite3*` handle (present when open).
   * This build exposes it as a read-only accessor.
   */
  readonly pointer?: number | bigint;

  /** Additional runtime fields. */
  [key: string]: unknown;
}

/**
 * Options for `DB.createFunction(...)`.
 */
export interface Sqlite3CreateFunctionOptions {
  /** Function name. */
  name?: string;

  /** Scalar function callback. */
  xFunc?: (...args: readonly SqlValue[]) => SqlValue | void;

  /** Aggregate/window step callback. */
  xStep?: (...args: readonly SqlValue[]) => void;

  /** Aggregate/window final callback. */
  xFinal?: (...args: readonly SqlValue[]) => SqlValue | void;

  /** Window value callback. */
  xValue?: (...args: readonly SqlValue[]) => SqlValue | void;

  /** Window inverse callback. */
  xInverse?: (...args: readonly SqlValue[]) => void;

  /** True to mark as deterministic (when supported). */
  deterministic?: boolean;

  /** Additional options. */
  [key: string]: unknown;
}

/**
 * Constructor type for `sqlite3.oo1.Stmt`.
 */
export interface Sqlite3StmtConstructor {
  new (
    db: Sqlite3DB,
    stmtPtr: number | bigint,
    bindTypes: unknown,
    takeOwnership?: boolean,
  ): Sqlite3Stmt;

  /**
   * Wraps a `sqlite3_stmt*` pointer into a Stmt object.
   *
   * @param oo1db A `DB` instance.
   * @param pStmt Pointer to `sqlite3_stmt*`.
   * @param takeOwnership If true, the wrapper will finalize the handle on `finalize()`.
   */
  wrapHandle?: (
    oo1db: Sqlite3DB,
    pStmt: number | bigint,
    takeOwnership?: boolean,
  ) => Sqlite3Stmt;

  /** Additional static fields. */
  [key: string]: unknown;
}

/**
 * OO wrapper for a prepared statement.
 */
export interface Sqlite3Stmt {
  /** Database wrapper which owns this statement. */
  readonly db: Sqlite3DB;

  /** Internal pointer to the `sqlite3_stmt*` handle (present when open). */
  readonly pointer?: number | bigint;

  /** Read-only count of result columns. */
  readonly columnCount: number;

  /** Read-only count of bindable parameters. */
  readonly parameterCount: number;

  /** Returns true if this statement is currently considered "busy". */
  isBusy(): boolean;

  /** Returns true if this statement is read-only. */
  isReadOnly(): boolean;

  /** Clears all bindings. */
  clearBindings(): this;

  /** Resets the statement to its initial state. */
  reset(): this;

  /** Binds parameters to the statement (flexible forms). */
  bind(arg?: BindCollection): this;
  bind(ndx: number, arg: BindValue | Uint8Array | ArrayBuffer): this;

  /** Binds a value as a blob. */
  bindAsBlob(arg: Uint8Array | ArrayBuffer): this;
  bindAsBlob(ndx: number, arg: Uint8Array | ArrayBuffer): this;

  /**
   * Steps the statement.
   *
   * @returns `true` if a row is available, `false` when done.
   */
  step(): boolean;

  /** Steps the statement and then resets it. */
  stepReset(): boolean;

  /** Steps the statement and then finalizes it. */
  stepFinalize(): void;

  /** Finalizes the statement (idempotent). */
  finalize(): void;

  /** Retrieves a value from the current row. */
  get(ndx: number, asType?: number): SqlValue;
  get(target: SqlValue[]): SqlValue[];
  get(target: Record<string, SqlValue>): Record<string, SqlValue>;

  /** Typed convenience getters. */
  getInt(ndx: number): number | bigint;
  getFloat(ndx: number): number;
  getString(ndx: number): string;
  getBlob(ndx: number): Uint8Array;

  /** Parses the selected column as JSON. */
  getJSON<T = unknown>(ndx: number): T | null;

  /** Returns a column name by index. */
  getColumnName(ndx: number): string;

  /** Appends all column names into `tgt` and returns it. */
  getColumnNames(tgt?: string[]): string[];

  /** Returns a statement parameter index by name. */
  getParamIndex(name: string): number;

  /** Returns a statement parameter name by index. */
  getParamName(index: number): string | null;

  /** Additional runtime fields. */
  [key: string]: unknown;
}

/**
 * VFS helper namespace (`sqlite3.vfs`).
 */
export interface Sqlite3VfsNamespace {
  /**
   * Installs I/O and/or VFS methods into struct wrappers.
   *
   * @param opt Options object describing the target structs and methods.
   * @returns The VFS namespace.
   */
  installVfs(opt: {
    io?: {
      struct: Sqlite3VfsStruct;
      methods: Record<string, unknown>;
      applyArgcCheck?: boolean;
    };
    vfs?: {
      struct: Sqlite3VfsStruct;
      methods: Record<string, unknown>;
      name?: string;
      asDefault?: boolean;
      applyArgcCheck?: boolean;
    };
  }): this;

  /** Additional helpers. */
  [key: string]: unknown;
}

/**
 * Virtual table helper namespace (`sqlite3.vtab`).
 */
export interface Sqlite3VtabNamespace {
  /**
   * Sets up the vtab helper module (bundle-specific behavior).
   */
  setupModule: (...args: readonly unknown[]) => unknown;

  /** Helper to wrap/construct xVtab implementations (bundle-specific). */
  xVtab: (...args: readonly unknown[]) => unknown;

  /** Helper to wrap/construct xCursor implementations (bundle-specific). */
  xCursor: (...args: readonly unknown[]) => unknown;

  /** Helper to wrap/construct xIndexInfo implementations (bundle-specific). */
  xIndexInfo: (...args: readonly unknown[]) => unknown;

  /** Helper to wrap/construct xRowid implementations (bundle-specific). */
  xRowid: (...args: readonly unknown[]) => unknown;

  /** Helper to wrap/construct error handling (bundle-specific). */
  xError: (...args: readonly unknown[]) => unknown;

  /** Additional helpers. */
  [key: string]: unknown;
}

/**
 * OPFS utilities object assigned to `sqlite3.opfs` in this bundle.
 */
export interface Sqlite3OpfsUtil {
  /** Root OPFS directory handle, when resolved/initialized. */
  rootDirectory?: FileSystemDirectoryHandle;

  /** Statistics and timing metrics for OPFS operations. */
  metrics: {
    /** Dumps current metrics (shape is bundle-specific). */
    dump: () => unknown;
    /** Resets collected metrics. */
    reset: () => void;
    /** Additional fields. */
    [key: string]: unknown;
  };

  /** Debug helpers for OPFS operations. */
  debug: {
    /** Shuts down OPFS VFS / state (bundle-specific). */
    asyncShutdown: () => Promise<void>;
    /** Restarts OPFS VFS / state (bundle-specific). */
    asyncRestart: () => Promise<void>;
    /** Additional fields. */
    [key: string]: unknown;
  };

  /**
   * Generates a random filename (bundle helper).
   */
  randomFilename: () => string;

  /**
   * Resolves a filename to a normalized OPFS path.
   *
   * @param filename Filename/path.
   * @param splitIt When true, returns path segments instead of a string.
   */
  getResolvedPath: (filename: string, splitIt?: boolean) => string | string[];

  /**
   * Returns true if a directory entry exists.
   *
   * @param fsEntryName Absolute filename/path within OPFS.
   */
  entryExists: (fsEntryName: string) => Promise<boolean>;

  /**
   * Creates a directory (mkdir) within OPFS.
   *
   * @param absDirName Absolute directory name within OPFS.
   * @returns True if created, false if already exists.
   */
  mkdir: (absDirName: string) => Promise<boolean>;

  /**
   * Recursively removes directory entries (rm -rf) from OPFS root.
   */
  rmfr: () => Promise<void>;

  /**
   * Unlinks a file or directory entry.
   *
   * @param fsEntryName Absolute filename/path within OPFS.
   * @param recursive When true, deletes directories recursively.
   * @param throwOnError When true, rejects on error.
   */
  unlink: (
    fsEntryName: string,
    recursive?: boolean,
    throwOnError?: boolean,
  ) => Promise<boolean>;

  /**
   * Traverses OPFS entries.
   *
   * The callback option is bundle-specific; this signature keeps it safe and usable.
   */
  traverse: (
    opt:
      | {
          /** Traversal root path (defaults to OPFS root). */
          root?: string;
          /** Callback invoked for each entry. */
          callback?: (info: Record<string, unknown>) => void | Promise<void>;
          /** Additional options. */
          [key: string]: unknown;
        }
      | ((info: Record<string, unknown>) => void | Promise<void>),
  ) => Promise<void>;

  /**
   * Returns a hierarchical listing of OPFS.
   */
  treeList: () => Promise<Record<string, unknown>>;

  /**
   * Imports a database file into OPFS (used by `oo1.OpfsDb.importDb`).
   *
   * @param filename Target filename within OPFS.
   * @param bytes SQLite database file bytes.
   */
  importDb: (
    filename: string,
    bytes: Uint8Array | ArrayBuffer,
  ) => Promise<void>;

  /**
   * Returns the directory handle for a filename and (optionally) creates the directory.
   */
  getDirForFilename: (
    absFilename: string,
    createDirs?: boolean,
  ) => Promise<{
    dirHandle: FileSystemDirectoryHandle;
    filenamePart: string;
  }>;

  /**
   * Gets an associated path for a given filename (bundle-specific).
   */
  getAssociatedPath?: (filename: string) => Promise<string | undefined>;

  /**
   * Sets an associated path for a given filename (bundle-specific).
   */
  setAssociatedPath?: (filename: string, path: string) => Promise<void>;

  /**
   * Returns a path handle (bundle-specific).
   */
  getPath?: (path: string) => Promise<FileSystemHandle | undefined>;

  /**
   * Deletes a path (bundle-specific).
   */
  deletePath?: (path: string) => Promise<boolean>;

  /** Additional fields. */
  [key: string]: unknown;
}

/**
 * Options accepted by `sqlite3.installOpfsSAHPoolVfs()` in this bundle.
 */
export interface OpfsSAHPoolVfsOptions {
  /** VFS name to install (default is bundle-defined). */
  name: string;

  /** When true, forces reinit if a previous init failed. */
  forceReinitIfPreviouslyFailed: boolean;

  /** Additional options (build-specific). */
  [key: string]: unknown;
}

/**
 * Pool utility object returned from `sqlite3.installOpfsSAHPoolVfs()`.
 */
export interface OpfsSAHPoolVfsPoolUtil {
  /**
   * The pool class, exposed for consumers.
   */
  OpfsSAHPool?: typeof OpfsSAHPool;

  /**
   * A `DB` variant that uses the installed pool VFS (available when `sqlite3.oo1` is present).
   */
  OpfsSAHPoolDb?: Sqlite3DBConstructor;

  /** Additional fields. */
  [key: string]: unknown;
}

/**
 * OPFS SAH pool implementation class (installed by this bundle).
 *
 * The full public surface is large and build-specific; this declaration focuses on the
 * methods observed in this bundle while keeping extra fields safely typed.
 */
export declare class OpfsSAHPool {
  /**
   * Constructs a new pool instance.
   *
   * @param options Pool options (bundle-specific).
   */
  constructor(options: Record<string, unknown>);

  /** Returns the installed VFS struct wrapper. */
  getVfs(): Sqlite3VfsStruct;

  /** Returns the number of files managed by the pool. */
  getFileCount(): number;

  /** Returns the list of managed filenames. */
  getFileNames(): string[];

  /** Returns current pool capacity (bundle-specific units). */
  getCapacity(): number;

  /** Adds capacity to the pool. */
  addCapacity(n: number): Promise<number>;

  /** Reduces capacity from the pool. */
  reduceCapacity(n: number): Promise<number>;

  /** Acquire underlying access handles (bundle-specific). */
  acquireAccessHandles(): Promise<void>;

  /** Release underlying access handles (bundle-specific). */
  releaseAccessHandles(): Promise<void>;

  /** Removes/uninstalls the VFS. */
  removeVfs(): Promise<void>;

  /** Pauses VFS operations (bundle-specific). */
  pauseVfs(): void;

  /** Resumes VFS operations (bundle-specific). */
  unpauseVfs(): void;

  /** Resets internal state (bundle-specific). */
  reset(): void;

  /** Emits a warning (bundle-specific). */
  warn(...args: readonly unknown[]): void;

  /** Emits an error (bundle-specific). */
  error(...args: readonly unknown[]): void;

  /** Throws an error (bundle-specific). */
  toss(...args: readonly unknown[]): never;

  /** Additional fields and methods. */
  [key: string]: unknown;
}

/** The default export: `sqlite3InitModule`. */
declare const sqlite3InitModule: Sqlite3InitModule;
export default sqlite3InitModule;
