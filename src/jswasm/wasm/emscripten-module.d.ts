/**
 * Emscripten Module Types
 *
 * This file defines types for the Emscripten WebAssembly module that powers
 * the SQLite3 WebAssembly implementation. These types represent the runtime
 * interface between JavaScript and the compiled SQLite C code.
 */

/**
 * Emscripten WebAssembly Module
 *
 * Represents the instantiated Emscripten module that wraps the SQLite3 WASM binary.
 * This module provides the bridge between JavaScript and the compiled C code, including
 * memory management, function exports, and runtime configuration.
 *
 * @remarks
 * The module is initialized through sqlite3InitModule() and becomes available after
 * the WebAssembly binary is loaded and instantiated. It manages the shared memory
 * space (WebAssembly.Memory) and provides access to exported C functions.
 */
export interface EmscriptenModule {
  /**
   * WebAssembly memory shared between JavaScript and the WASM module
   *
   * This memory object contains all the heap data including HEAP8, HEAP16, HEAP32,
   * and HEAP64 views. All pointer-based operations reference locations within this memory.
   */
  wasmMemory: WebAssembly.Memory;

  /**
   * Compiled WebAssembly module assembly exports
   *
   * Contains the low-level function exports from the compiled C code, including
   * all sqlite3_* functions and memory allocation functions (malloc, free, etc.).
   */
  asm?: WebAssembly.Exports;

  /**
   * Promise resolver for module ready state
   *
   * Called when the module has successfully completed initialization and is ready
   * for use. Resolves the promise returned by sqlite3InitModule().
   */
  readyPromiseResolve?: (module: EmscriptenModule) => void;

  /**
   * Promise rejector for module initialization failures
   *
   * Called if module initialization fails due to errors loading the WASM binary,
   * instantiation failures, or runtime errors during startup.
   */
  readyPromiseReject?: (reason: Error | string) => void;

  /**
   * SQLite3 API facade attached after post-load initialization
   *
   * The high-level JavaScript API for interacting with SQLite3, including the
   * capi (C API), wasm utilities, oo1 (object-oriented API), and configuration.
   *
   * @remarks
   * This property is populated by runSQLite3PostLoadInit() and provides the
   * complete public API surface for SQLite3 operations.
   */
  sqlite3?: Sqlite3Facade;

  /**
   * Post-load initialization function
   *
   * Called after the WebAssembly module is loaded to wire up the high-level
   * JavaScript bridge and create the sqlite3 API facade.
   */
  runSQLite3PostLoadInit?: (module: EmscriptenModule) => void;

  /**
   * Flag indicating whether the module has been started
   *
   * Set to true after the run() lifecycle method completes. Prevents multiple
   * calls to the runtime initialization sequence.
   */
  calledRun?: boolean;
  /**
   * Log read files functionality.
   */
  logReadFiles?: boolean;
}

/**
 * WebAssembly Exports from Compiled SQLite3 Module
 *
 * Contains all exported functions from the compiled SQLite C code. These are the
 * raw WASM function exports before any JavaScript wrapping or convenience layers.
 *
 * @remarks
 * Function signatures use number for pointers (memory addresses), as WASM operates
 * with linear memory addressing. String and blob parameters must be pre-allocated
 * in WASM memory and passed as pointer+length pairs.
 */
export interface WasmExports extends WebAssembly.Exports {
  /**
   * WebAssembly linear memory
   *
   * The memory buffer that stores all heap data. JavaScript typed arrays
   * (HEAP8, HEAP32, etc.) provide views into this memory.
   */
  memory?: WebAssembly.Memory;

  // Core SQLite3 API Functions

  /**
   * Open a database connection
   *
   * @param filenamePtr - Pointer to UTF-8 encoded filename string in WASM memory
   * @param ppDb - Pointer to pointer that will receive the database handle
   * @param flags - SQLITE_OPEN_* flags controlling open behavior
   * @param vfsPtr - Pointer to VFS name string, or 0 for default VFS
   * @returns SQLite result code (SQLITE_OK on success)
   */
  sqlite3_open_v2(
    filenamePtr: number,
    ppDb: number,
    flags: number,
    vfsPtr: number,
  ): number;

  /**
   * Close a database connection
   *
   * @param pDb - Database handle pointer
   * @returns SQLite result code (SQLITE_OK on success)
   */
  sqlite3_close_v2(pDb: number): number;

  /**
   * Prepare an SQL statement for execution
   *
   * @param pDb - Database handle pointer
   * @param sqlPtr - Pointer to UTF-8 encoded SQL string
   * @param nByte - Length of SQL string in bytes (-1 for null-terminated)
   * @param ppStmt - Pointer to pointer that will receive the statement handle
   * @param pzTail - Pointer to pointer that will receive pointer to unused SQL
   * @returns SQLite result code (SQLITE_OK on success)
   */
  sqlite3_prepare_v2(
    pDb: number,
    sqlPtr: number,
    nByte: number,
    ppStmt: number,
    pzTail: number,
  ): number;

  /**
   * Execute one step of a prepared statement
   *
   * @param pStmt - Statement handle pointer
   * @returns SQLITE_ROW (row available), SQLITE_DONE (no more rows), or error code
   */
  sqlite3_step(pStmt: number): number;

  /**
   * Finalize a prepared statement and release resources
   *
   * @param pStmt - Statement handle pointer
   * @returns SQLite result code (SQLITE_OK on success)
   */
  sqlite3_finalize(pStmt: number): number;

  // Memory Management Functions

  /**
   * Allocate memory using SQLite's allocator
   *
   * @param size - Number of bytes to allocate
   * @returns Pointer to allocated memory, or 0 on allocation failure
   */
  sqlite3_malloc(size: number): number;

  /**
   * Reallocate previously allocated memory
   *
   * @param ptr - Pointer to existing allocation
   * @param size - New size in bytes
   * @returns Pointer to reallocated memory (may differ from input pointer)
   */
  sqlite3_realloc(ptr: number, size: number): number;

  /**
   * Free memory allocated by sqlite3_malloc or sqlite3_realloc
   *
   * @param ptr - Pointer to memory to free
   */
  sqlite3_free(ptr: number): void;

  /**
   * Allocate memory using standard C malloc
   *
   * @param size - Number of bytes to allocate
   * @returns Pointer to allocated memory, or 0 on allocation failure
   */
  malloc(size: number): number;

  /**
   * Reallocate memory using standard C realloc
   *
   * @param ptr - Pointer to existing allocation
   * @param size - New size in bytes
   * @returns Pointer to reallocated memory (may differ from input pointer)
   */
  realloc(ptr: number, size: number): number;

  /**
   * Free memory using standard C free
   *
   * @param ptr - Pointer to memory to free
   */
  free(ptr: number): void;

  /**
   * Generate random bytes for cryptographic operations
   *
   * @param size - Number of random bytes to generate
   * @param pointer - Pointer to buffer that will receive random bytes
   */
  sqlite3_randomness(size: number, pointer: number): void;

  /**
   * Initialize WASMFS with OPFS backing store
   *
   * @param directoryPointer - Pointer to directory name string for OPFS mount point
   * @returns 0 on success, non-zero on error
   */
  sqlite3__wasm_init_wasmfs?(directoryPointer: number): number;

  /**
   * Serialize a database to an in-memory buffer
   *
   * @param dbPointer - Database handle pointer
   * @param schemaPointer - Pointer to schema name string (0 for "main")
   * @param ppOut - Pointer to pointer that will receive serialized data
   * @param pSize - Pointer to size_t that will receive data size
   * @param flags - Serialization flags
   * @returns SQLite result code (SQLITE_OK on success)
   */
  sqlite3__wasm_db_serialize(
    dbPointer: number,
    schemaPointer: number,
    ppOut: number,
    pSize: number,
    flags: number,
  ): number;
}

/**
 * SQLite3 Facade Interface
 *
 * The complete public API surface for SQLite3 WebAssembly, including the C API
 * bindings (capi), WebAssembly utilities (wasm), object-oriented API (oo1),
 * utility functions (util), and configuration.
 *
 * @remarks
 * This interface is intentionally minimal here to avoid circular dependencies.
 * The complete Sqlite3Facade type is defined in create-sqlite3-facade.d.ts.
 */
export interface Sqlite3Facade {
  /**
   * C API bindings with SQLite constants and wrapped function calls
   *
   * Provides direct access to SQLite C functions with JavaScript-friendly
   * signatures (automatic string conversion, error handling, etc.).
   */
  capi: Record<
    string,
    | number
    | ((...args: (string | number | Uint8Array)[]) => number | string | void)
  >;

  /**
   * WebAssembly utilities for memory management and type conversion
   *
   * Includes functions for allocating/deallocating WASM memory, converting
   * between JavaScript and C strings, and working with typed arrays.
   */
  wasm: Record<
    string,
    | number
    | boolean
    | ((
        ...args: (number | string | Uint8Array)[]
      ) => number | string | void | Uint8Array)
  >;

  /**
   * Utility functions for type checking and validation
   *
   * Helper functions for verifying value types, converting data formats,
   * and performing common operations.
   */
  util?: Record<
    string,
    (
      ...args: (string | number | bigint | Uint8Array | ArrayBuffer | null)[]
    ) => boolean | string | number | void | never
  >;

  /**
   * Bootstrap configuration settings
   *
   * Configuration options used during initialization, including memory settings,
   * debug flags, and OPFS directory configuration.
   */
  config: Record<
    string,
    string | number | boolean | ((...args: (string | number)[]) => void)
  >;

  /**
   * Version information for the SQLite3 library
   *
   * Contains libVersion (string), libVersionNumber (number), sourceId (string),
   * and downloadVersion (number).
   */
  version: Record<string, string | number>;

  /**
   * Error constructor classes
   *
   * Custom error classes for SQLite3 errors (SQLite3Error) and WASM allocation
   * failures (WasmAllocError).
   */
  SQLite3Error: ErrorConstructor & {
    toss: (...args: (string | number)[]) => never;
  };
  WasmAllocError: ErrorConstructor & {
    toss: (...args: (string | number)[]) => never;
  };

  /**
   * Asynchronous post-initialization hook
   *
   * Called after synchronous initialization completes to run async initializers
   * (e.g., OPFS setup, worker initialization). Returns a promise that resolves
   * to this same Sqlite3Facade instance.
   */
  asyncPostInit(): Promise<Sqlite3Facade>;
}
