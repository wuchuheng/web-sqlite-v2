declare module '@wuchuheng/web-sqlite' {
  /** Low-level sqlite3 database handle pointer. */
  export type sqlite3 = number
  /**
   * SQLite3 Module Configuration
   */
  export interface SQLite3ModuleConfig {
    /** Custom print function for stdout */
    print?: (message: string) => void
    /** Custom print function for stderr */
    printErr?: (message: string) => void
    /** Custom locateFile function for WASM files */
    locateFile?: (path: string, scriptDirectory: string) => string
    /** Initial memory size in bytes */
    INITIAL_MEMORY?: number
    /** Pre-run callbacks */
    preRun?: Array<() => void> | (() => void)
    /** Post-run callbacks */
    postRun?: Array<() => void> | (() => void)
    /** Pre-init callbacks */
    preInit?: Array<() => void> | (() => void)
    /** On runtime initialized callback */
    onRuntimeInitialized?: () => void
    /** On abort callback */
    onAbort?: (what: unknown) => void
    /** Set status callback */
    setStatus?: (text: string) => void
    /** Monitor run dependencies */
    monitorRunDependencies?: (left: number) => void
    /** WASM memory */
    wasmMemory?: WebAssembly.Memory
    /** WASM binary */
    wasmBinary?: ArrayBuffer
  }

  /**
   * SQLite3 Version Information
   */
  export interface SQLite3Version {
    /** Library version string (e.g., "3.50.4") */
    libVersion: string
    /** Library version number */
    libVersionNumber: number
    /** Source ID */
    sourceId: string
    /** Download/build version identifier */
    downloadVersion: number
  }

  /**
   * SQLite3 C API Constants and Functions
   */
  export interface SQLite3CAPI {
    // Result codes
    SQLITE_OK: number
    SQLITE_ERROR: number
    SQLITE_INTERNAL: number
    SQLITE_PERM: number
    SQLITE_ABORT: number
    SQLITE_BUSY: number
    SQLITE_LOCKED: number
    SQLITE_NOMEM: number
    SQLITE_READONLY: number
    SQLITE_INTERRUPT: number
    SQLITE_IOERR: number
    SQLITE_CORRUPT: number
    SQLITE_NOTFOUND: number
    SQLITE_FULL: number
    SQLITE_CANTOPEN: number
    SQLITE_PROTOCOL: number
    SQLITE_EMPTY: number
    SQLITE_SCHEMA: number
    SQLITE_TOOBIG: number
    SQLITE_CONSTRAINT: number
    SQLITE_MISMATCH: number
    SQLITE_MISUSE: number
    SQLITE_NOLFS: number
    SQLITE_AUTH: number
    SQLITE_FORMAT: number
    SQLITE_RANGE: number
    SQLITE_NOTADB: number
    SQLITE_ROW: number
    SQLITE_DONE: number

    // Data types
    SQLITE_INTEGER: number
    SQLITE_FLOAT: number
    SQLITE_TEXT: number
    SQLITE_BLOB: number
    SQLITE_NULL: number

    // Open flags
    SQLITE_OPEN_READONLY: number
    SQLITE_OPEN_READWRITE: number
    SQLITE_OPEN_CREATE: number
    SQLITE_OPEN_URI: number
    SQLITE_OPEN_MEMORY: number
    SQLITE_OPEN_NOMUTEX: number
    SQLITE_OPEN_FULLMUTEX: number
    SQLITE_OPEN_SHAREDCACHE: number
    SQLITE_OPEN_PRIVATECACHE: number
    SQLITE_OPEN_EXRESCODE: number

    // Text encodings
    SQLITE_UTF8: number
    SQLITE_UTF16LE: number
    SQLITE_UTF16BE: number
    SQLITE_UTF16: number

    // Deterministic flag
    SQLITE_DETERMINISTIC: number
    SQLITE_DIRECTONLY: number
    SQLITE_INNOCUOUS: number

    // WASM-specific constants
    SQLITE_WASM_DEALLOC: number

    // Config options
    SQLITE_DBCONFIG_ENABLE_FKEY: number
    SQLITE_DBCONFIG_ENABLE_TRIGGER: number
    SQLITE_DBCONFIG_ENABLE_FTS3_TOKENIZER: number
    SQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION: number
    SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE: number
    SQLITE_DBCONFIG_ENABLE_QPSG: number
    SQLITE_DBCONFIG_TRIGGER_EQP: number
    SQLITE_DBCONFIG_RESET_DATABASE: number
    SQLITE_DBCONFIG_DEFENSIVE: number
    SQLITE_DBCONFIG_WRITABLE_SCHEMA: number
    SQLITE_DBCONFIG_LEGACY_ALTER_TABLE: number
    SQLITE_DBCONFIG_DQS_DML: number
    SQLITE_DBCONFIG_DQS_DDL: number
    SQLITE_DBCONFIG_ENABLE_VIEW: number
    SQLITE_DBCONFIG_LEGACY_FILE_FORMAT: number

    // Trace flags
    SQLITE_TRACE_STMT: number

    // Core API functions
    sqlite3_vfs_find(name: string | number): number
    sqlite3_open_v2(filename: string | number, ppDb: number, flags: number, vfs: string | number): number
    sqlite3_close_v2(pDb: number): number
    sqlite3_prepare_v2(pDb: number, sql: string | number, nByte: number, ppStmt: number, pzTail: number | null): number
    sqlite3_prepare_v3(pDb: number, sql: number, nByte: number, prepFlags: number, ppStmt: number, pzTail: number): number
    sqlite3_step(pStmt: number): number
    sqlite3_finalize(pStmt: number): number
    sqlite3_reset(pStmt: number): number
    sqlite3_clear_bindings(pStmt: number): number
    sqlite3_bind_parameter_count(pStmt: number): number
    sqlite3_bind_parameter_index(pStmt: number, name: string): number
    sqlite3_bind_parameter_name(pStmt: number, index: number): string
    sqlite3_column_count(pStmt: number): number
    sqlite3_column_name(pStmt: number, index: number): string
    sqlite3_column_type(pStmt: number, index: number): number
    sqlite3_column_int(pStmt: number, index: number): number
    sqlite3_column_int64(pStmt: number, index: number): bigint
    sqlite3_column_double(pStmt: number, index: number): number
    sqlite3_column_text(pStmt: number, index: number): string
    sqlite3_column_blob(pStmt: number, index: number): number
    sqlite3_column_bytes(pStmt: number, index: number): number
    sqlite3_bind_null(pStmt: number, index: number): number
    sqlite3_bind_int(pStmt: number, index: number, value: number): number
    sqlite3_bind_int64(pStmt: number, index: number, value: bigint): number
    sqlite3_bind_double(pStmt: number, index: number, value: number): number
    sqlite3_bind_text(pStmt: number, index: number, text: number, nBytes: number, destructor: number): number
    sqlite3_bind_blob(pStmt: number, index: number, blob: number, nBytes: number, destructor: number): number
    sqlite3_errmsg(pDb: number): string
    sqlite3_errstr(code: number): string
    sqlite3_extended_result_codes(pDb: number, onoff: number): number
    sqlite3_changes(pDb: number): number
    sqlite3_changes64(pDb: number): bigint
    sqlite3_total_changes(pDb: number): number
    sqlite3_total_changes64(pDb: number): bigint
    sqlite3_exec(pDb: number, sql: string, callback: number, pArg: number, pzErrMsg: number): number
    sqlite3_sql(pStmt: number): string
    sqlite3_db_filename(pDb: number, dbName: string): string
    sqlite3_db_name(pDb: number, dbNumber: number): string
    sqlite3_libversion(): string
    sqlite3_libversion_number(): number
    sqlite3_sourceid(): string
    sqlite3_stmt_busy(pStmt: number): number
    sqlite3_stmt_readonly(pStmt: number): number
    sqlite3_trace_v2(pDb: number, mask: number, callback: number, pCtx: number): number
    sqlite3_create_function_v2(
      pDb: number,
      name: string,
      nArg: number,
      eTextRep: number,
      pApp: number,
      xFunc: ((...args: unknown[]) => unknown) | number,
      xStep: ((...args: unknown[]) => unknown) | number,
      xFinal: ((...args: unknown[]) => unknown) | number,
      xDestroy: ((...args: unknown[]) => unknown) | number
    ): number
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
    ): number
    sqlite3_db_config(pDb: number, op: number, ...args: unknown[]): number
    sqlite3_randomness(n: number, p: number): void
    sqlite3_compileoption_get(n: number): string | null
    sqlite3_compileoption_used(option: string): boolean

    // Extended API functions
    sqlite3_js_rc_str(code: number): string
    sqlite3_js_db_vfs(pDb: number, dbName?: number | string): number
    sqlite3_js_vfs_list(): unknown[]
    sqlite3_js_db_uses_vfs(pDb: number, vfsName: string, dbName?: number): boolean
    sqlite3_js_db_export(pDb: number, schema?: number): Uint8Array
    sqlite3_js_aggregate_context(pCtx: number, n: number): number
    sqlite3_js_sql_to_string(sql: number | string): string
    sqlite3_js_kvvfs_clear?(which?: string): unknown
    sqlite3_js_kvvfs_size?(which?: string): number
    sqlite3_wasmfs_opfs_dir?(): string
    sqlite3_wasmfs_filename_is_persistent?(name: string): boolean

    // VFS structure
    sqlite3_vfs: new (ptr: number) => {
      $zName: number
      dispose(): void
    }
  }

  /**
   * Prepared Statement Class
   */
  export class Stmt {
    /** Database reference */
    readonly db: DB
    /** Statement pointer */
    readonly pointer: number
    /** Number of bindable parameters */
    readonly parameterCount: number
    /** Number of result columns */
    readonly columnCount: number

    /** Finalize (close) the statement */
    finalize(): number | undefined
    /** Reset the statement for reuse */
    reset(alsoClearBinds?: boolean): this
    /** Clear all parameter bindings */
    clearBindings(): this
    /** Bind parameters to the statement */
    bind(params: BindValue[] | Record<string, BindValue>): this
    bind(index: number | string, value: BindValue): this
    /** Bind a value as a BLOB */
    bindAsBlob(value: Uint8Array | Int8Array | ArrayBuffer | string): this
    bindAsBlob(index: number | string, value: Uint8Array | Int8Array | ArrayBuffer | string): this
    /** Execute one step of the statement */
    step(): boolean
    /** Step and reset */
    stepReset(): this
    /** Step, reset, and finalize */
    stepFinalize(): boolean
    /** Get column value(s) */
    get<T = unknown>(index: number, asType?: number): T
    get<T = Record<string, unknown>>(target: Record<string, unknown>): T
    get<T = unknown[]>(target: unknown[]): T
    /** Get column as integer */
    getInt(index: number): number
    /** Get column as float */
    getFloat(index: number): number
    /** Get column as string */
    getString(index: number): string
    /** Get column as blob */
    getBlob(index: number): Uint8Array
    /** Get column as JSON */
    getJSON<T = unknown>(index: number): T | null
    /** Get column name */
    getColumnName(index: number): string
    /** Get all column names */
    getColumnNames(target?: string[]): string[]
    /** Get parameter index by name */
    getParamIndex(name: string): number | undefined
    /** Get parameter name by index */
    getParamName(index: number): string | undefined
    /** Check if statement is busy */
    isBusy(): boolean
    /** Check if statement is read-only */
    isReadOnly(): boolean
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
    | ArrayBuffer

  /**
   * Exec options for DB.exec()
   */
  export interface ExecOptions {
    /** Bind values (array or named parameters) */
    bind?: BindValue[] | Record<string, BindValue>
    /** Callback for each result row. Return truthy to stop iteration. */
    callback?: (row: unknown, stmt: Stmt) => unknown
    /** Row materialisation strategy */
    rowMode?: "array" | "object" | "stmt" | number | string
    /** Column name cache for object row mode */
    columnNames?: string[]
    /** Return all rows instead of the database reference */
    returnValue?: "resultRows"
    /** Multi-statement mode (set false to stop after first statement) */
    multi?: boolean
    /** @internal SQL payload (legacy object form) */
    sql?: string
    /** @internal Result rows accumulator */
    resultRows?: unknown[]
    /** @internal Captured SQL text for debugging */
    saveSql?: string[]
  }

  /**
   * Result returned by DB.exec() when configured to provide result rows.
   */
  export interface ExecResult {
    /** Array of collected result rows. */
    resultRows?: unknown[]
    /** Internal helper for debugging to preserve executed SQL text. */
    saveSql?: string[]
  }

  /**
   * Create function options
   */
  export interface CreateFunctionOptions {
    /** Function name */
    name?: string
    /** Scalar function implementation */
    xFunc?: (ctx: number, ...args: unknown[]) => void
    /** Aggregate step function */
    xStep?: (ctx: number, ...args: unknown[]) => void
    /** Aggregate final function */
    xFinal?: (ctx: number) => void
    /** Window value function */
    xValue?: (ctx: number) => void
    /** Window inverse function */
    xInverse?: (ctx: number, ...args: unknown[]) => void
    /** Destructor function */
    xDestroy?: (pApp: number) => void
    /** Application data pointer */
    pApp?: number
    /** Number of arguments (-1 for variable) */
    arity?: number
    /** Function is deterministic */
    deterministic?: boolean
    /** Function can only be invoked from top-level SQL */
    directOnly?: boolean
    /** Function is innocuous (safe for use in triggers/views) */
    innocuous?: boolean
  }

  /**
   * Database Class
   */
  export class DB {
    /** Database filename */
    readonly filename: string
    /** Database pointer */
    readonly pointer: sqlite3
    /** On-close callbacks */
    onclose?: {
      before?: (db: DB) => void
      after?: (db: DB) => void
    }

    /**
     * Create a new database connection
     * @param filename Database filename or special name (:memory:, :localStorage:, :sessionStorage:)
     * @param flags Open flags: "c" (create), "w" (write), "r" (read), "t" (trace)
     * @param vfs VFS name
     */
    constructor(filename?: string, flags?: string, vfs?: string | null)
    constructor(options: { filename?: string; flags?: string; vfs?: string | null })

    /** Check if database is open */
    isOpen(): boolean
    /** Affirm database is open (throws if not) */
    affirmOpen(): this
    /** Close the database */
    close(): void
    /** Get number of changes */
    changes(total?: boolean, sixtyFour?: boolean): number | bigint
    /** Get database filename */
    dbFilename(dbName?: string): string
    /** Get database name */
    dbName(dbNumber?: number): string
    /** Get VFS name */
    dbVfsName(dbName?: number | string): string | undefined
    /** Prepare a statement */
    prepare(sql: string): Stmt
    /** Execute SQL */
    exec(sql: string, options?: ExecOptions): this | ExecResult
    exec(options: ExecOptions): this | ExecResult
    /** Create a scalar or aggregate function */
    createFunction(name: string, xFunc: (...args: unknown[]) => unknown, options?: CreateFunctionOptions): this
    createFunction(options: CreateFunctionOptions): this
    /** Select a single value */
    selectValue<T = unknown>(sql: string, bind?: BindValue[] | Record<string, BindValue>, asType?: number): T
    /** Select multiple values (first column) */
    selectValues<T = unknown>(sql: string, bind?: BindValue[] | Record<string, BindValue>, asType?: number): T[]
    /** Select a single row as array */
    selectArray<T = unknown[]>(sql: string, bind?: BindValue[] | Record<string, BindValue>): T
    /** Select a single row as object */
    selectObject<T = Record<string, unknown>>(sql: string, bind?: BindValue[] | Record<string, BindValue>): T
    /** Select all rows as arrays */
    selectArrays<T = unknown[][]>(sql: string, bind?: BindValue[] | Record<string, BindValue>): T
    /** Select all rows as objects */
    selectObjects<T = Record<string, unknown>[]>(sql: string, bind?: BindValue[] | Record<string, BindValue>): T
    /** Get count of open statements */
    openStatementCount(): number
    /** Execute in a transaction */
    transaction<T = unknown>(callback: (db: this) => T): T
    transaction<T = unknown>(qualifier: string, callback: (db: this) => T): T
    /** Execute in a savepoint */
    savepoint<T = unknown>(callback: (db: this) => T): T
    /** Check result code */
    checkRc(resultCode: number): this

    /** Static method to check result codes */
    static checkRc(db: DB | number, resultCode: number): void
  }

  /**
   * Object-Oriented API (OO1)
   */
  export interface SQLite3OO1 {
    /** Database class */
    DB: typeof DB
    /** Statement class */
    Stmt: typeof Stmt
    /** JsStorageDb class (browser only) */
    JsStorageDb?: typeof JsStorageDb
  }

  /**
   * JsStorageDb for localStorage/sessionStorage persistence
   */
  export class JsStorageDb extends DB {
    constructor(storageName?: "session" | "local")
    /** Clear storage for this database */
    clearStorage(): unknown
    /** Get storage size */
    storageSize(): number
    /** Static method to clear storage */
    static clearStorage(filename: string): unknown
    /** Static method to get storage size */
    static storageSize(filename: string): number
  }

  /**
   * SQLite3 Error Class
   */
  export class SQLite3Error extends Error {
    /** SQLite result code */
    resultCode: number
    constructor(code: number, ...message: unknown[])
    constructor(...message: unknown[])
  }

  /**
   * Main SQLite3 API Object
   */
  export interface SQLite3API {
    /** Version information */
    version: SQLite3Version
    /** C API */
    capi: SQLite3CAPI
    /** Object-oriented API */
    oo1: SQLite3OO1
    /** SQLite3 Error class */
    SQLite3Error: typeof SQLite3Error
    /** WASM utilities */
    wasm: {
      bigIntEnabled: boolean
      ptrSizeof: number
      heap8(): Int8Array
      heap8u(): Uint8Array
      allocCString(str: string, addNul?: boolean): [number, number]
      cstrToJs(ptr: number): string
      jstrlen(str: string): number
      jstrcpy(str: string, tgt: Int8Array | Uint8Array, offset: number, maxBytes: number, addNul: boolean): number
      alloc(size: number): number
      realloc(ptr: number, size: number): number
      dealloc(ptr: number): void
      allocFromTypedArray(data: ArrayBufferView | ArrayBuffer): number
      pstack: {
        pointer: number
        alloc(size: number): number
        allocPtr(): number
        restore(ptr: number): void
      }
      peekPtr(ptr: number): number
      pokePtr(ptr: number | number[], value: number): void
      peek(ptr: number, type: string): number
      poke(ptr: number, value: number, type?: string): void
      scopedAlloc(size: number): number
      scopedAllocPush(): number
      scopedAllocPop(ptr: number): void
      installFunction(signature: string, func: (...args: unknown[]) => unknown): number
    }
    /** Utilities */
    util: {
      isInt32(value: unknown): boolean
      isSQLableTypedArray(value: unknown): boolean
      isBindableTypedArray(value: unknown): boolean
      isTypedArray(value: unknown): boolean
      isSharedTypedArray(value: unknown): boolean
      bigIntFits64(value: bigint): boolean
      bigIntFits32(value: bigint): boolean
      bigIntFitsDouble(value: bigint): boolean
      flexibleString(value: unknown): string
      typedArrayToString(array: ArrayBufferView): string
      typedArrayPart(array: ArrayBufferView, offset: number, length: number): Uint8Array
      affirmDbHeader(bytes: ArrayBufferView | ArrayBuffer): void
      affirmIsDb(bytes: ArrayBufferView | ArrayBuffer): void
      isUIThread(): boolean
      toss(...args: unknown[]): never
      toss3(...args: unknown[]): never
    }
    /** Configuration */
    config: {
      error(...args: unknown[]): void
      warn(...args: unknown[]): void
      log(...args: unknown[]): void
      debug(...args: unknown[]): void
      wasmfsOpfsDir?: string
      useStdAlloc?: boolean
      bigIntEnabled?: boolean
    }
  }

  /**
   * SQLite3 Init Module Function
   */
  export interface SQLite3InitModule {
    (config?: SQLite3ModuleConfig): Promise<SQLite3API>
  }

  const sqlite3InitModule: SQLite3InitModule
  export default sqlite3InitModule
}
