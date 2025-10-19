export type WasmPointer = number | bigint;

export type PeekType =
  | "i1"
  | "i8"
  | "i16"
  | "i32"
  | "i64"
  | "f32"
  | "f64"
  | "float"
  | "double"
  | "ptr"
  | "*";

export type PokeType = PeekType;

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;
export type sqlite3 = WasmPointer;
export type sqlite3_stmt = WasmPointer;
export type sqlite3_value = WasmPointer;
export type sqlite3_context = WasmPointer;
export type sqlite3_blob = WasmPointer;

export enum SqliteResultCode {
  SQLITE_OK = 0,
  SQLITE_ERROR = 1,
  SQLITE_INTERNAL = 2,
  SQLITE_PERM = 3,
  SQLITE_ABORT = 4,
  SQLITE_BUSY = 5,
  SQLITE_LOCKED = 6,
  SQLITE_NOMEM = 7,
  SQLITE_READONLY = 8,
  SQLITE_INTERRUPT = 9,
  SQLITE_IOERR = 10,
  SQLITE_CORRUPT = 11,
  SQLITE_NOTFOUND = 12,
  SQLITE_FULL = 13,
  SQLITE_CANTOPEN = 14,
  SQLITE_PROTOCOL = 15,
  SQLITE_EMPTY = 16,
  SQLITE_SCHEMA = 17,
  SQLITE_TOOBIG = 18,
  SQLITE_CONSTRAINT = 19,
  SQLITE_MISMATCH = 20,
  SQLITE_MISUSE = 21,
  SQLITE_NOLFS = 22,
  SQLITE_AUTH = 23,
  SQLITE_FORMAT = 24,
  SQLITE_RANGE = 25,
  SQLITE_NOTADB = 26,
  SQLITE_NOTICE = 27,
  SQLITE_WARNING = 28,
  SQLITE_ROW = 100,
  SQLITE_DONE = 101,
}

export enum SqliteDataType {
  SQLITE_INTEGER = 1,
  SQLITE_FLOAT = 2,
  SQLITE_TEXT = 3,
  SQLITE_BLOB = 4,
  SQLITE_NULL = 5,
}

export enum SqliteOpenFlags {
  SQLITE_OPEN_READONLY = 0x00000001,
  SQLITE_OPEN_READWRITE = 0x00000002,
  SQLITE_OPEN_CREATE = 0x00000004,
  SQLITE_OPEN_URI = 0x00000040,
  SQLITE_OPEN_MEMORY = 0x00000080,
  SQLITE_OPEN_NOMUTEX = 0x00008000,
  SQLITE_OPEN_FULLMUTEX = 0x00010000,
  SQLITE_OPEN_SHAREDCACHE = 0x00020000,
  SQLITE_OPEN_PRIVATECACHE = 0x00040000,
}

export type ExecCallback = (
  columnValues: (string | null)[],
  columnNames: string[]
) => number | boolean | void;

export type SqliteDestructor = number | ((ptr: WasmPointer) => void);

export type SqliteBindableBlob =
  | string
  | number[]
  | Uint8Array
  | Int8Array
  | ArrayBuffer;

export type SqliteBindableText =
  | string
  | number[]
  | Uint8Array
  | Int8Array
  | ArrayBuffer
  | null;

export type SqliteRandomTypedArray = Uint8Array | Int8Array;

export type ScalarFunction = (
  context: sqlite3_context,
  argc: number,
  argv: sqlite3_value[]
) => void;

export type AggregateStepFunction = (
  context: sqlite3_context,
  argc: number,
  argv: sqlite3_value[]
) => void;

export type AggregateFinalFunction = (context: sqlite3_context) => void;

export type FunctionDestructor = (userData: unknown) => void;

/**
 * SQLite3 Module Configuration
 */
export interface SQLite3ModuleConfig {
  /** Custom print function for stdout */
  print?: (message: string) => void;
  /** Custom print function for stderr */
  printErr?: (message: string) => void;
  /** Custom locateFile function for WASM files */
  locateFile?: (path: string, scriptDirectory: string) => string;
  /** Initial memory size in bytes */
  INITIAL_MEMORY?: number;
  /** Pre-run callbacks */
  preRun?: Array<() => void> | (() => void);
  /** Post-run callbacks */
  postRun?: Array<() => void> | (() => void);
  /** Pre-init callbacks */
  preInit?: Array<() => void> | (() => void);
  /** On runtime initialized callback */
  onRuntimeInitialized?: () => void;
  /** On abort callback */
  onAbort?: (what: unknown) => void;
  /** Set status callback */
  setStatus?: (text: string) => void;
  /** Monitor run dependencies */
  monitorRunDependencies?: (left: number) => void;
  /** WASM memory */
  wasmMemory?: WebAssembly.Memory;
  /** WASM binary */
  wasmBinary?: ArrayBuffer;
}

/**
 * SQLite3 Version Information
 */
export interface SQLite3Version {
  /** Library version string (e.g., "3.50.4") */
  libVersion: string;
  /** Library version number */
  libVersionNumber: number;
  /** Source ID */
  sourceId: string;
  /** Download/build version identifier */
  downloadVersion: number;
}

/**
 * SQLite3 C API Constants and Functions
 */
export interface SQLite3CAPI {
  // Result codes
  SQLITE_OK: number;
  SQLITE_ERROR: number;
  SQLITE_INTERNAL: number;
  SQLITE_PERM: number;
  SQLITE_ABORT: number;
  SQLITE_BUSY: number;
  SQLITE_LOCKED: number;
  SQLITE_NOMEM: number;
  SQLITE_READONLY: number;
  SQLITE_INTERRUPT: number;
  SQLITE_IOERR: number;
  SQLITE_CORRUPT: number;
  SQLITE_NOTFOUND: number;
  SQLITE_FULL: number;
  SQLITE_CANTOPEN: number;
  SQLITE_PROTOCOL: number;
  SQLITE_EMPTY: number;
  SQLITE_SCHEMA: number;
  SQLITE_TOOBIG: number;
  SQLITE_CONSTRAINT: number;
  SQLITE_MISMATCH: number;
  SQLITE_MISUSE: number;
  SQLITE_NOLFS: number;
  SQLITE_AUTH: number;
  SQLITE_FORMAT: number;
  SQLITE_RANGE: number;
  SQLITE_NOTADB: number;
  SQLITE_ROW: number;
  SQLITE_DONE: number;

  // Data types
  SQLITE_INTEGER: number;
  SQLITE_FLOAT: number;
  SQLITE_TEXT: number;
  SQLITE_BLOB: number;
  SQLITE_NULL: number;

  // Open flags
  SQLITE_OPEN_READONLY: number;
  SQLITE_OPEN_READWRITE: number;
  SQLITE_OPEN_CREATE: number;
  SQLITE_OPEN_URI: number;
  SQLITE_OPEN_MEMORY: number;
  SQLITE_OPEN_NOMUTEX: number;
  SQLITE_OPEN_FULLMUTEX: number;
  SQLITE_OPEN_SHAREDCACHE: number;
  SQLITE_OPEN_PRIVATECACHE: number;
  SQLITE_OPEN_EXRESCODE: number;

  // Text encodings
  SQLITE_UTF8: number;
  SQLITE_UTF16LE: number;
  SQLITE_UTF16BE: number;
  SQLITE_UTF16: number;

  // Deterministic flag
  SQLITE_DETERMINISTIC: number;
  SQLITE_DIRECTONLY: number;
  SQLITE_INNOCUOUS: number;

  // WASM-specific constants
  SQLITE_WASM_DEALLOC: number;

  // Config options
  SQLITE_DBCONFIG_ENABLE_FKEY: number;
  SQLITE_DBCONFIG_ENABLE_TRIGGER: number;
  SQLITE_DBCONFIG_ENABLE_FTS3_TOKENIZER: number;
  SQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION: number;
  SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE: number;
  SQLITE_DBCONFIG_ENABLE_QPSG: number;
  SQLITE_DBCONFIG_TRIGGER_EQP: number;
  SQLITE_DBCONFIG_RESET_DATABASE: number;
  SQLITE_DBCONFIG_DEFENSIVE: number;
  SQLITE_DBCONFIG_WRITABLE_SCHEMA: number;
  SQLITE_DBCONFIG_LEGACY_ALTER_TABLE: number;
  SQLITE_DBCONFIG_DQS_DML: number;
  SQLITE_DBCONFIG_DQS_DDL: number;
  SQLITE_DBCONFIG_ENABLE_VIEW: number;
  SQLITE_DBCONFIG_LEGACY_FILE_FORMAT: number;

  // Trace flags
  SQLITE_TRACE_STMT: number;

  // Core API functions
  sqlite3_vfs_find(name: string | number): number;
  sqlite3_open_v2(
    filename: string,
    ppDb: WasmPointer,
    flags: number,
    vfs: string | number | null
  ): SqliteResultCode;
  sqlite3_close_v2(pDb: sqlite3): SqliteResultCode;
  sqlite3_prepare_v2(
    pDb: sqlite3,
    sql: string | number | Uint8Array | Int8Array | ArrayBuffer,
    nByte: number,
    ppStmt: WasmPointer,
    pzTail: WasmPointer | null
  ): SqliteResultCode;
  sqlite3_prepare_v3(
    pDb: sqlite3,
    sql: string | number | Uint8Array | Int8Array | ArrayBuffer,
    nByte: number,
    prepFlags: number,
    ppStmt: WasmPointer,
    pzTail: WasmPointer | null
  ): SqliteResultCode;
  sqlite3_step(pStmt: sqlite3_stmt): SqliteResultCode;
  sqlite3_finalize(pStmt: sqlite3_stmt): SqliteResultCode;
  sqlite3_reset(pStmt: sqlite3_stmt): SqliteResultCode;
  sqlite3_clear_bindings(pStmt: number): number;
  sqlite3_bind_parameter_count(pStmt: sqlite3_stmt): number;
  sqlite3_bind_parameter_index(pStmt: sqlite3_stmt, name: string): number;
  sqlite3_bind_parameter_name(pStmt: sqlite3_stmt, index: number): string;
  sqlite3_column_count(pStmt: sqlite3_stmt): number;
  sqlite3_column_name(pStmt: sqlite3_stmt, index: number): string;
  sqlite3_column_type(pStmt: sqlite3_stmt, index: number): SqliteDataType;
  sqlite3_column_int(pStmt: sqlite3_stmt, index: number): number;
  sqlite3_column_int64(pStmt: sqlite3_stmt, index: number): bigint | number;
  sqlite3_column_double(pStmt: sqlite3_stmt, index: number): number;
  sqlite3_column_text(pStmt: sqlite3_stmt, index: number): string;
  sqlite3_column_blob(pStmt: sqlite3_stmt, index: number): WasmPointer;
  sqlite3_column_bytes(pStmt: sqlite3_stmt, index: number): number;
  sqlite3_bind_null(pStmt: sqlite3_stmt, index: number): SqliteResultCode;
  sqlite3_bind_int(
    pStmt: sqlite3_stmt,
    index: number,
    value: number
  ): SqliteResultCode;
  sqlite3_bind_int64(
    pStmt: sqlite3_stmt,
    index: number,
    value: bigint | number
  ): SqliteResultCode;
  sqlite3_bind_double(
    pStmt: sqlite3_stmt,
    index: number,
    value: number
  ): SqliteResultCode;
  sqlite3_bind_text(
    pStmt: sqlite3_stmt,
    index: number,
    text: string | number,
    nBytes: number,
    destructor?: number
  ): SqliteResultCode;
  sqlite3_bind_blob(
    pStmt: sqlite3_stmt,
    index: number,
    blob: number | SqliteBindableBlob,
    nBytes: number,
    destructor?: number
  ): SqliteResultCode;
  sqlite3_errmsg(pDb: sqlite3): string;
  sqlite3_errstr(code: SqliteResultCode): string;
  sqlite3_extended_result_codes(pDb: number, onoff: number): number;
  sqlite3_changes(pDb: number): number;
  sqlite3_changes64(pDb: number): bigint;
  sqlite3_total_changes(pDb: number): number;
  sqlite3_total_changes64(pDb: number): bigint;
  sqlite3_exec(
    pDb: sqlite3,
    sql: string,
    callback?: ExecCallback | WasmPointer | null,
    pArg?: WasmPointer | null,
    pzErrMsg?: WasmPointer | null
  ): SqliteResultCode;
  sqlite3_sql(pStmt: number): string;
  sqlite3_db_filename(pDb: sqlite3, dbName: string): string | null;
  sqlite3_db_name(pDb: number, dbNumber: number): string;
  sqlite3_libversion(): string;
  sqlite3_libversion_number(): number;
  sqlite3_sourceid(): string;
  sqlite3_stmt_busy(pStmt: number): number;
  sqlite3_stmt_readonly(pStmt: number): number;
  sqlite3_trace_v2(
    pDb: number,
    mask: number,
    callback: number,
    pCtx: number
  ): number;
  sqlite3_create_function_v2(
    pDb: sqlite3,
    name: string,
    nArg: number,
    eTextRep: number,
    pApp: unknown,
    xFunc: ScalarFunction | number | null,
    xStep: AggregateStepFunction | number | null,
    xFinal: AggregateFinalFunction | number | null,
    xDestroy: FunctionDestructor | number | null
  ): SqliteResultCode;
  sqlite3_create_window_function(
    pDb: number,
    name: string,
    nArg: number,
    eTextRep: number,
    pApp: number,
    xStep: (...args: unknown[]) => unknown,
    xFinal: (...args: unknown[]) => unknown,
    xValue: (...args: unknown[]) => unknown,
    xInverse: (...args: unknown[]) => unknown,
    xDestroy: (...args: unknown[]) => unknown
  ): number;
  sqlite3_db_config(pDb: number, op: number, ...args: unknown[]): number;
  sqlite3_randomness(n: number, p: WasmPointer): void;
  sqlite3_randomness<T extends SqliteRandomTypedArray>(typedArray: T): T;
  sqlite3_compileoption_get(n: number): string | null;
  sqlite3_compileoption_used(option: string): boolean;

  // Extended API functions
  sqlite3_js_rc_str(code: SqliteResultCode): string;
  sqlite3_js_db_vfs(pDb: number, dbName?: number | string): number;
  sqlite3_js_vfs_list(): unknown[];
  sqlite3_js_db_uses_vfs(
    pDb: number,
    vfsName: string,
    dbName?: number
  ): boolean;
  sqlite3_js_db_export(pDb: sqlite3, schema?: number | string): Uint8Array;
  sqlite3_js_aggregate_context(pCtx: number, n: number): number;
  sqlite3_js_sql_to_string(sql: number | string): string;
  sqlite3_js_kvvfs_clear?(which?: string): unknown;
  sqlite3_js_kvvfs_size?(which?: string): number;
  sqlite3_wasmfs_opfs_dir?(): string;
  sqlite3_wasmfs_filename_is_persistent?(name: string): boolean;

  // VFS structure
  sqlite3_vfs: new (ptr: WasmPointer) => {
    $zName: number;
    dispose(): void;
  };
  sqlite3_get_autocommit(db: sqlite3): number;
}

export type Sqlite3CAPI = SQLite3CAPI;

/**
 * Prepared Statement Class
 */
export class Stmt {
  /** Original SQL text */
  readonly sql: string;
  /** Database reference */
  readonly db: DB;
  /** Statement pointer */
  readonly pointer: number;
  /** Number of bindable parameters */
  readonly parameterCount: number;
  /** Number of result columns */
  readonly columnCount: number;

  /** Finalize (close) the statement */
  finalize(): void;
  /** Reset the statement for reuse */
  reset(alsoClearBinds?: boolean): this;
  /** Clear all parameter bindings */
  clearBindings(): this;
  /** Bind parameters to the statement */
  bind(...values: BindValue[]): this;
  bind(values: BindValue[]): this;
  bind(values: Record<string, BindValue>): this;
  bind(index: number | string, value: BindValue): this;
  /** Bind a value as a BLOB */
  bindAsBlob(value: Uint8Array | Int8Array | ArrayBuffer | string): this;
  bindAsBlob(
    index: number | string,
    value: Uint8Array | Int8Array | ArrayBuffer | string
  ): this;
  /** Execute one step of the statement */
  step(): boolean;
  /** Step and reset */
  stepReset(): this;
  /** Step, reset, and finalize */
  stepFinalize(): this;
  /** Get column value(s) */
  get<T = unknown>(index: number, asType?: number): T;
  get<T = Record<string, unknown>>(target: Record<string, unknown>): T;
  get<T = unknown[]>(target: unknown[]): T;
  /** Get column as integer */
  getInt(index: number): number;
  /** Get column as float */
  getFloat(index: number): number;
  /** Get column as string */
  getString(index: number): string;
  /** Get column as blob */
  getBlob(index: number): Uint8Array;
  /** Get column as JSON */
  getJSON<T = unknown>(index: number): T | null;
  /** Get column name */
  getColumnName(index: number): string;
  /** Get all column names */
  getColumnNames(target?: string[]): string[];
  /** Get parameter index by name */
  getParamIndex(name: string): number | undefined;
  /** Get parameter name by index */
  getParamName(index: number): string | undefined;
  /** Check if statement is busy */
  isBusy(): boolean;
  /** Check if statement is read-only */
  isReadOnly(): boolean;
}

/**
 * Bind value types
 */
export type BindValue =
  | null
  | undefined
  | number
  | bigint
  | string
  | boolean
  | Uint8Array
  | Int8Array
  | ArrayBuffer;

/**
 * Exec options for DB.exec()
 */
export interface ExecOptions {
  /** Bind values (array or named parameters) */
  bind?: BindValue[] | Record<string, BindValue>;
  /**
   * Callback for each result row.
   * Return literal false to stop iteration; any other value continues.
   */
  callback?: (row: unknown, stmt: Stmt) => unknown;
  /** Row materialisation strategy */
  rowMode?: "array" | "object" | "stmt" | number | `$${string}`;
  /** Column name cache for object row mode */
  columnNames?: string[];
  /** Controls what exec() returns. Defaults to "this". */
  returnValue?: "this" | "resultRows" | "saveSql";
  /** Multi-statement mode (set false to stop after the first statement). */
  multi?: boolean;
  /** @internal SQL payload (legacy object form) */
  sql?: string;
  /** @internal Result rows accumulator */
  resultRows?: unknown[];
  /** @internal Captured SQL text for debugging */
  saveSql?: string[];
}

/**
 * Result returned by DB.exec() when configured to provide result rows.
 */
export interface ExecResult {
  /** Array of collected result rows. */
  resultRows?: unknown[];
  /** Internal helper for debugging to preserve executed SQL text. */
  saveSql?: string[];
}

/**
 * Create function options
 */
export interface CreateFunctionOptions {
  /** Function name */
  name?: string;
  /** Scalar function implementation */
  xFunc?: (ctx: number, ...args: unknown[]) => void;
  /** Aggregate step function */
  xStep?: (ctx: number, ...args: unknown[]) => void;
  /** Aggregate final function */
  xFinal?: (ctx: number) => void;
  /** Window value function */
  xValue?: (ctx: number) => void;
  /** Window inverse function */
  xInverse?: (ctx: number, ...args: unknown[]) => void;
  /** Destructor function */
  xDestroy?: (pApp: number) => void;
  /** Application data pointer */
  pApp?: number;
  /** Number of arguments (-1 for variable) */
  arity?: number;
  /** Function is deterministic */
  deterministic?: boolean;
  /** Function can only be invoked from top-level SQL */
  directOnly?: boolean;
  /** Function is innocuous (safe for use in triggers/views) */
  innocuous?: boolean;
}

/**
 * Database Class
 */
export class DB {
  /** Database filename */
  readonly filename: string;
  /** Database pointer */
  readonly pointer: sqlite3;
  /** On-close callbacks */
  onclose?: {
    before?: (db: DB) => void;
    after?: (db: DB) => void;
  };

  /**
   * Create a new database connection
   * @param filename Database filename or special name (:memory:, :localStorage:, :sessionStorage:)
   * @param flags Open flags: "c" (create), "w" (write), "r" (read), "t" (trace)
   * @param vfs VFS name
   */
  constructor(filename?: string, flags?: string, vfs?: string | null);
  constructor(options: {
    filename?: string;
    flags?: string;
    vfs?: string | null;
  });

  /** Check if database is open */
  readonly isOpen: boolean;
  /** Affirm database is open (throws if not) */
  affirmOpen(): this;
  /** Close the database */
  close(): void;
  /** Export the database as a Uint8Array */
  export(): Uint8Array;
  /** Get number of changes */
  changes(total?: boolean, sixtyFour?: boolean): number | bigint;
  /** Get database filename */
  dbFilename(dbName?: string): string;
  /** Get database name */
  dbName(dbNumber?: number): string;
  /** Get VFS name */
  dbVfsName(dbName?: number | string): string | undefined;
  /** Prepare a statement */
  prepare(sql: string): Stmt;
  /** Execute SQL */
  exec(sql: string, options?: ExecOptions): this | ExecResult;
  exec(options: ExecOptions): this | ExecResult;
  /** Create a scalar or aggregate function */
  createFunction(
    name: string,
    xFunc: (...args: unknown[]) => unknown,
    options?: CreateFunctionOptions
  ): this;
  createFunction(options: CreateFunctionOptions): this;
  /** Select a single value */
  selectValue<T = unknown>(
    sql: string,
    bind?: BindValue[] | Record<string, BindValue>,
    asType?: number
  ): T;
  /** Select multiple values (first column) */
  selectValues<T = unknown>(
    sql: string,
    bind?: BindValue[] | Record<string, BindValue>,
    asType?: number
  ): T[];
  /** Select a single row as array */
  selectArray<T = unknown[]>(
    sql: string,
    bind?: BindValue[] | Record<string, BindValue>
  ): T;
  /** Select a single row as object */
  selectObject<T = Record<string, unknown>>(
    sql: string,
    bind?: BindValue[] | Record<string, BindValue>
  ): T;
  /** Select all rows as arrays */
  selectArrays<T = unknown[][]>(
    sql: string,
    bind?: BindValue[] | Record<string, BindValue>
  ): T;
  /** Select all rows as objects */
  selectObjects<T = Record<string, unknown>[]>(
    sql: string,
    bind?: BindValue[] | Record<string, BindValue>
  ): T;
  /** Get count of open statements */
  openStatementCount(): number;
  /** Execute in a transaction */
  transaction<T = unknown>(callback: () => T): T;
  transaction<T = unknown>(qualifier: string, callback: () => T): T;
  /** Execute in a savepoint */
  savepoint<T = unknown>(callback: () => T): T;
  /** Check result code */
  checkRc(resultCode: number): this;

  /** Static method to check result codes */
  static checkRc(db: DB | number, resultCode: number): void;
}

/**
 * Object-Oriented API (OO1)
 */
export interface SQLite3OO1 {
  /** Database class */
  DB: typeof DB;
  /** Statement class */
  Stmt: typeof Stmt;
  /** JsStorageDb class (browser only) */
  JsStorageDb?: typeof JsStorageDb;
  /** OpfsDb class (browser only) */
  OpfsDb?: typeof OpfsDb;
}

/**
 * JsStorageDb for localStorage/sessionStorage persistence
 */
export class JsStorageDb extends DB {
  constructor(storageType?: "local" | "session");
  /** Flush current database state to storage */
  flush(): void;
  /** Clear storage for this database */
  clearStorage(): number;
  /** Get storage size */
  storageSize(): number;
  /** Static method to clear storage */
  static clearStorage(storageType?: "local" | "session"): number;
  /** Static method to get storage size */
  static storageSize(storageType?: "local" | "session"): number;
}

/**
 * OpfsDb for persistent OPFS-backed databases
 */
export class OpfsDb extends DB {
  constructor(filename: string);
  /** Import a database image into OPFS */
  static importDb(
    filename: string,
    bytes: Uint8Array | ArrayBuffer
  ): Promise<number>;
}

/**
 * SQLite3 Error Class
 */
export class SQLite3Error extends Error {
  /** SQLite result code */
  resultCode: number;
  constructor(code: number, ...message: unknown[]);
  constructor(...message: unknown[]);
}

/**
 * Main SQLite3 API Object
 */
export interface SQLite3Wasm
  extends import("./wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts")
    .Sqlite3WasmNamespace {
  /** Indicates whether BigInt-backed heap views are available. */
  bigIntEnabled: boolean;
  /** Pointer size in bytes for the active build. */
  ptrSizeof: number;
  /** Intermediate representation used for pointers ("i32" or "i64"). */
  ptrIR: "i32" | "i64";
  /** Returns a signed 8-bit heap view. */
  heap8(): Int8Array;
  /** Returns an unsigned 8-bit heap view. */
  heap8u(): Uint8Array;
  /** Returns a signed 16-bit heap view. */
  heap16(): Int16Array;
  /** Returns an unsigned 16-bit heap view. */
  heap16u(): Uint16Array;
  /** Returns a signed 32-bit heap view. */
  heap32(): Int32Array;
  /** Returns an unsigned 32-bit heap view. */
  heap32u(): Uint32Array;
  /**
   * Resolves a heap view for the requested element size or constructor.
   */
  heapForSize(
    indicator:
      | number
      | (new (
          buffer: ArrayBuffer,
          byteOffset?: number,
          length?: number
        ) => ArrayBufferView),
    unsigned?: boolean
  ):
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array
    | BigInt64Array
    | BigUint64Array;
  /** Computes the size in bytes for the provided IR signature. */
  sizeofIR(signature: string): number | undefined;
  /** Returns the indirect function table exported by the wasm module. */
  functionTable(): WebAssembly.Table;
  /** Resolves a function entry from the indirect function table. */
  functionEntry(
    pointer: WasmPointer
  ): ((...args: unknown[]) => unknown) | undefined;
  /** Creates a wasm-compatible wrapper for a JavaScript function. */
  jsFuncToWasm(
    func: ((...args: unknown[]) => unknown) | string,
    signature: string
  ): (...args: unknown[]) => unknown;
  /** Installs a function into the wasm indirect table and returns its index. */
  installFunction(
    func: ((...args: unknown[]) => unknown) | string,
    signature?: string
  ): WasmPointer;
  /** Installs a function whose lifetime is bound to the current scoped allocator. */
  scopedInstallFunction(
    func: ((...args: unknown[]) => unknown) | string,
    signature?: string
  ): WasmPointer;
  /** Removes a function from the wasm indirect table and returns the previous entry. */
  uninstallFunction(
    pointer: WasmPointer | null | undefined
  ): ((...args: unknown[]) => unknown) | null | undefined;
  /** Allocates a block of memory on the WASM heap. */
  alloc(byteCount: number): WasmPointer;
  /** Resizes or frees a WASM allocation. */
  realloc(pointer: WasmPointer | null, byteCount: number): WasmPointer;
  /** Releases memory previously allocated from the WASM heap. */
  dealloc(pointer: WasmPointer | null | undefined): void;
  /** Copies typed array data into WASM memory and returns its pointer. */
  allocFromTypedArray(source: ArrayBufferView | ArrayBuffer): WasmPointer;
  /** Converts a C string pointer to a JavaScript string. */
  cstrToJs(pointer: WasmPointer | null): string | null;
  /** Calculates the byte length of a C string in WASM memory. */
  cstrlen(pointer: WasmPointer | null): number | null;
  /** Calculates the UTF-8 encoded byte length of a JavaScript string. */
  jstrlen(value: string | null): number | null;
  /** Copies a JavaScript string into a target buffer or pointer. */
  jstrcpy(
    value: string,
    target: Uint8Array | WasmPointer,
    offset?: number,
    maxBytes?: number,
    addNul?: boolean
  ): number;
  /** Copies a C string into a target pointer, mirroring `strncpy`. */
  cstrncpy(
    targetPointer: WasmPointer,
    sourcePointer: WasmPointer,
    n: number
  ): number;
  /**
   * Encodes a JavaScript string into a new Uint8Array, optionally adding a NUL terminator.
   */
  jstrToUintArray(value: string, addNul?: boolean): Uint8Array;
  /** Allocates a UTF-8 encoded copy of a JavaScript string. */
  allocCString(
    value: string,
    returnWithLength?: boolean
  ): WasmPointer | [WasmPointer, number] | null;
  /**
   * Reads values from WASM memory using an IR signature.
   */
  peek(
    pointer: WasmPointer | WasmPointer[],
    signature?: PeekType
  ): number | bigint | (number | bigint)[];
  /** Writes values into WASM memory using an IR signature. */
  poke(
    pointer: WasmPointer | WasmPointer[],
    value: number | bigint,
    signature?: PokeType
  ): this;
  /** Reads a pointer-sized value from WASM memory. */
  peekPtr(pointer: WasmPointer): WasmPointer;
  /** Writes a pointer-sized value into WASM memory. */
  pokePtr(pointer: WasmPointer | WasmPointer[], value?: WasmPointer): this;
  /** Reads an 8-bit value from WASM memory. */
  peek8(pointer: WasmPointer | WasmPointer[]): number | number[];
  /** Writes an 8-bit value into WASM memory. */
  poke8(pointer: WasmPointer | WasmPointer[], value: number): this;
  /** Reads a 16-bit value from WASM memory. */
  peek16(pointer: WasmPointer | WasmPointer[]): number | number[];
  /** Writes a 16-bit value into WASM memory. */
  poke16(pointer: WasmPointer | WasmPointer[], value: number): this;
  /** Reads a 32-bit value from WASM memory. */
  peek32(pointer: WasmPointer | WasmPointer[]): number | number[];
  /** Writes a 32-bit value into WASM memory. */
  poke32(pointer: WasmPointer | WasmPointer[], value: number): this;
  /** Reads a 64-bit value from WASM memory. */
  peek64(pointer: WasmPointer | WasmPointer[]): bigint | (bigint | number)[];
  /** Writes a 64-bit value into WASM memory. */
  poke64(pointer: WasmPointer | WasmPointer[], value: number | bigint): this;
  /** Reads a 32-bit floating-point value from WASM memory. */
  peek32f(pointer: WasmPointer | WasmPointer[]): number | number[];
  /** Writes a 32-bit floating-point value into WASM memory. */
  poke32f(pointer: WasmPointer | WasmPointer[], value: number): this;
  /** Reads a 64-bit floating-point value from WASM memory. */
  peek64f(pointer: WasmPointer | WasmPointer[]): number | number[];
  /** Writes a 64-bit floating-point value into WASM memory. */
  poke64f(pointer: WasmPointer | WasmPointer[], value: number): this;
  /** Legacy alias for {@link peek}. */
  getMemValue(
    pointer: WasmPointer | WasmPointer[],
    signature?: PeekType
  ): number | bigint | (number | bigint)[];
  /** Legacy alias for {@link poke}. */
  setMemValue(
    pointer: WasmPointer | WasmPointer[],
    value: number | bigint,
    signature?: PokeType
  ): this;
  /** Reads a pointer value and returns it as a numeric pointer. */
  getPtrValue(pointer: WasmPointer): WasmPointer;
  /** Writes a pointer value to memory and returns the bridge for chaining. */
  setPtrValue(pointer: WasmPointer, value: WasmPointer): this;
  /**
   * Returns true when the provided candidate is a pointer value for the active build.
   */
  isPtr(candidate: unknown): candidate is WasmPointer;
  /** Checks whether the provided pointer is a 32-bit integer. */
  isPtr32(candidate: unknown): candidate is WasmPointer;
  /** Pushes a new allocation scope onto the scoped allocator stack. */
  scopedAllocPush(): unknown;
  /** Pops a scoped allocation stack and frees owned resources. */
  scopedAllocPop(state?: unknown | null): void;
  /** Allocates memory tracked by the active scoped allocation stack. */
  scopedAlloc(byteCount: number): WasmPointer;
  /** Allocates a pointer (or pointer array) tracked by the scoped allocator. */
  scopedAllocPtr(
    count?: number,
    safePtrSize?: boolean
  ): WasmPointer | WasmPointer[];
  /** Allocates a pointer (or pointer array) using the standard allocator. */
  allocPtr(count?: number, safePtrSize?: boolean): WasmPointer | WasmPointer[];
  /** Allocates a scoped CString, optionally returning its length. */
  scopedAllocCString(
    value: string,
    returnWithLength?: boolean
  ): WasmPointer | [WasmPointer, number] | null;
  /** Converts argc/argv data into a JavaScript string array. */
  cArgvToJs(argc: number, argvPointer: WasmPointer): (string | null)[];
  /** Allocates argv-style argument blocks using the scoped allocator. */
  scopedAllocMainArgv(values: unknown[]): WasmPointer;
  /** Allocates argv-style argument blocks using the general allocator. */
  allocMainArgv(values: unknown[]): WasmPointer;
  /** Executes a callback with automatic scoped-allocation cleanup. */
  scopedAllocCall<T>(callback: () => T): T;
  /**
   * Provides direct access to exported wasm functions, performing basic argument checks.
   */
  xCall(
    fn: string | ((...args: unknown[]) => unknown),
    ...args: unknown[]
  ): unknown;
  /** Looks up an exported function by name. */
  xGet(name: string): (...args: unknown[]) => unknown;
  /**
   * Wraps a wasm export with argument/result conversions.
   */
  xWrap(
    fnName: string,
    resultType?: string,
    argTypes?: (string | unknown)[]
  ): (...args: unknown[]) => unknown;
  /** Stack helper mirroring the legacy pstack API. */
  pstack: {
    readonly pointer: WasmPointer;
    readonly quota: number;
    readonly remaining: number;
    restore(pointer: WasmPointer): void;
    alloc(byteCount: number | string): WasmPointer;
    allocChunks(chunkCount: number, chunkSize: number | string): WasmPointer[];
    allocPtr(
      count?: number,
      safePtrSize?: boolean
    ): WasmPointer | WasmPointer[];
    call<T>(callback: (sqlite3: SQLite3API) => T): T;
  };
}

export interface SQLite3API {
  /** Version information */
  version: SQLite3Version;
  /** C API */
  capi: SQLite3CAPI;
  /** Object-oriented API */
  oo1: SQLite3OO1;
  /** SQLite3 Error class */
  SQLite3Error: typeof SQLite3Error;
  /** WASM utilities */
  wasm: SQLite3Wasm;
  /** Utilities */
  util: {
    isInt32(value: unknown): boolean;
    isSQLableTypedArray(value: unknown): boolean;
    isBindableTypedArray(value: unknown): boolean;
    isTypedArray(value: unknown): boolean;
    isSharedTypedArray(value: unknown): boolean;
    bigIntFits64(value: bigint): boolean;
    bigIntFits32(value: bigint): boolean;
    bigIntFitsDouble(value: bigint): boolean;
    flexibleString(value: unknown): string;
    typedArrayToString(array: ArrayBufferView): string;
    typedArrayPart(
      array: ArrayBufferView,
      offset: number,
      length: number
    ): Uint8Array;
    affirmDbHeader(bytes: ArrayBufferView | ArrayBuffer): void;
    affirmIsDb(bytes: ArrayBufferView | ArrayBuffer): void;
    isUIThread(): boolean;
    toss(...args: unknown[]): never;
    toss3(...args: unknown[]): never;
  };
  /** Configuration */
  config: {
    error(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    log(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    wasmfsOpfsDir?: string;
    useStdAlloc?: boolean;
    bigIntEnabled?: boolean;
  };
}

/**
 * SQLite3 Init Module Function
 */
export interface SQLite3InitModule {
  (config?: SQLite3ModuleConfig): Promise<SQLite3API>;
}

export const sqlite3InitModule: SQLite3InitModule;
export default sqlite3InitModule;

declare module "@wuchuheng/web-sqlite" {
  export {
    WasmPointer,
    sqlite3,
    sqlite3_stmt,
    sqlite3_value,
    sqlite3_context,
    sqlite3_blob,
    SqliteResultCode,
    SqliteDataType,
    SqliteOpenFlags,
    ExecCallback,
    SqliteDestructor,
    SqliteBindableBlob,
    SqliteBindableText,
    SqliteRandomTypedArray,
    ScalarFunction,
    AggregateStepFunction,
    AggregateFinalFunction,
    FunctionDestructor,
    SQLite3ModuleConfig,
    SQLite3Version,
    SQLite3CAPI,
    Sqlite3CAPI,
    Stmt,
    BindValue,
    ExecOptions,
    ExecResult,
    CreateFunctionOptions,
    DB,
    SQLite3OO1,
    JsStorageDb,
    OpfsDb,
    SQLite3Error,
    SQLite3API,
    SQLite3InitModule,
    sqlite3InitModule,
  };
  export default sqlite3InitModule;
}
