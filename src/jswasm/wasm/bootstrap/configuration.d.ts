import type { EmscriptenModule } from "../emscripten-module.d.ts";

/**
 * Bootstrap Configuration
 *
 * Configuration options that control SQLite3 WebAssembly initialization, including
 * memory allocation strategy, debug output, OPFS directory setup, and pointer size
 * settings for the target architecture.
 */
export interface BootstrapConfig {
    /**
     * WebAssembly module exports containing SQLite3 C functions
     *
     * Typically obtained from Module.asm or wasmExports after WASM instantiation.
     * Contains all sqlite3_* functions, memory allocation functions, and WASM-specific
     * utility functions.
     */
    exports?: WebAssembly.Exports;

    /**
     * WebAssembly linear memory object
     *
     * The shared memory buffer between JavaScript and WASM. All HEAP8, HEAP16,
     * HEAP32, and HEAP64 typed arrays are views into this memory.
     */
    memory?: WebAssembly.Memory;

    /**
     * Enable BigInt support for 64-bit integers
     *
     * When true, uses BigInt for sqlite3_int64 values. When false, large integers
     * may lose precision when represented as JavaScript numbers.
     */
    bigIntEnabled: boolean;

    /**
     * Debug message logging function
     *
     * Called with debug-level messages during initialization and runtime. Set to
     * a no-op function to disable debug output.
     */
    debug: (...args: (string | number | boolean)[]) => void;

    /**
     * Warning message logging function
     *
     * Called with warning-level messages for non-fatal issues like deprecated
     * API usage or suboptimal configurations.
     */
    warn: (...args: (string | number | boolean)[]) => void;

    /**
     * Error message logging function
     *
     * Called with error-level messages for failures during initialization or
     * runtime errors that may cause instability.
     */
    error: (...args: (string | number | boolean)[]) => void;

    /**
     * General logging function
     *
     * Called with informational messages during normal operation. Typically
     * mapped to console.log or a custom logger.
     */
    log: (...args: (string | number | boolean)[]) => void;

    /**
     * WASMFS OPFS directory mount point
     *
     * If set, specifies the directory path where OPFS (Origin Private File System)
     * should be mounted in the WASMFS virtual file system. Must be in the form
     * "/dir-name" (leading slash, no trailing slash, single path component).
     *
     * @example "/opfs-storage"
     */
    wasmfsOpfsDir?: string;

    /**
     * Use standard C allocator instead of SQLite's allocator
     *
     * When true, uses malloc/free/realloc from the C standard library. When false,
     * uses sqlite3_malloc/sqlite3_free/sqlite3_realloc. Affects allocExportName,
     * deallocExportName, and reallocExportName.
     */
    useStdAlloc: boolean;

    /**
     * Name of the allocation function export
     *
     * Either "sqlite3_malloc" (useStdAlloc: false) or "malloc" (useStdAlloc: true).
     * Used by wasm.alloc() to allocate memory for strings, blobs, and temporary buffers.
     */
    allocExportName: string;

    /**
     * Name of the deallocation function export
     *
     * Either "sqlite3_free" (useStdAlloc: false) or "free" (useStdAlloc: true).
     * Used by wasm.dealloc() to free previously allocated memory.
     */
    deallocExportName: string;

    /**
     * Name of the reallocation function export
     *
     * Either "sqlite3_realloc" (useStdAlloc: false) or "realloc" (useStdAlloc: true).
     * Used by wasm.realloc() to resize previously allocated memory blocks.
     */
    reallocExportName: string;

    /**
     * Size of a pointer in bytes for the target WASM architecture
     *
     * Typically 4 for wasm32 (default) or 8 for wasm64. Determines heap offset
     * calculations and pointer arithmetic.
     */
    wasmPtrSizeof?: number;

    /**
     * Intermediate representation type for pointers
     *
     * Either "i32" for 32-bit pointers (wasm32) or "i64" for 64-bit pointers (wasm64).
     * Used by xWrap signature strings to specify pointer parameter types.
     */
    wasmPtrIR?: "i32" | "i64";
}

/**
 * Options for Resolving Bootstrap Configuration
 *
 * Optional parameters passed to resolveBootstrapConfig() that provide context
 * for normalizing the configuration, including references to the Emscripten
 * module and global object.
 */
export interface ResolveBootstrapConfigOptions {
    /**
     * Reference to the Emscripten module
     *
     * Used to extract default values for exports and memory if not explicitly
     * provided in apiConfig. Typically the global Module object created by
     * Emscripten glue code.
     */
    moduleRef?: EmscriptenModule;

    /**
     * Global object reference
     *
     * The global object (globalThis, window, self) used for looking up default
     * configuration values. Defaults to globalThis if not provided.
     */
    globalObject?: typeof globalThis;
}

/**
 * Resolve Bootstrap Configuration
 *
 * Normalizes a partial configuration object by filling in defaults, validating
 * values, and extracting settings from the Emscripten module reference. This
 * ensures the bootstrap process works with a complete, validated configuration.
 *
 * @param apiConfig - Partial configuration overrides from user or global scope
 * @param options - Module reference and global object for extracting defaults
 * @returns Complete, validated BootstrapConfig ready for initialization
 *
 * @remarks
 * Default resolution order:
 * 1. Explicit apiConfig values (highest priority)
 * 2. Values from options.moduleRef (Module.asm, Module.wasmMemory)
 * 3. Hard-coded defaults in resolveBootstrapConfig implementation
 *
 * @example
 * ```typescript
 * const config = resolveBootstrapConfig(
 *   { debug: console.debug, wasmfsOpfsDir: '/opfs' },
 *   { moduleRef: Module }
 * );
 * ```
 */
export function resolveBootstrapConfig(
    apiConfig?: Partial<BootstrapConfig>,
    options?: ResolveBootstrapConfigOptions
): BootstrapConfig;
