/**
 * SQLite3 Facade Creation Module
 *
 * This module exports the types and factory function for creating the complete
 * SQLite3 facade that is returned to users after bootstrap completes. The facade
 * combines all components (capi, wasm, util, config) into a unified API surface.
 *
 * @module create-sqlite3-facade
 */

import type {
  Sqlite3Facade,
  Sqlite3Initializer,
  Sqlite3AsyncInitializer,
  Sqlite3BootstrapFunction,
  CreateSqlite3FacadeOptions,
} from "./sqlite3-facade-namespace.d.ts";

// Re-export the comprehensive types from sqlite3-facade-namespace.d.ts
export type {
  Sqlite3Facade,
  Sqlite3Initializer,
  Sqlite3AsyncInitializer,
  Sqlite3BootstrapFunction,
  CreateSqlite3FacadeOptions,
};

/**
 * Create SQLite3 Facade
 *
 * Assembles the complete public API facade from the components created during
 * bootstrap. This function is called at the end of sqlite3ApiBootstrap() after
 * all internal setup completes.
 *
 * @param options - All components needed to build the facade including capi,
 *                  wasm, util, config, error constructors, and bootstrap function
 * @returns The complete Sqlite3Facade ready for use
 *
 * @remarks
 * This function performs the following steps:
 * 1. Constructs the facade object with all namespaces (capi, wasm, util, config)
 * 2. Adds version information from SQLite library
 * 3. Creates asyncPostInit() method for running async initializers
 * 4. Runs synchronous initializers from sqlite3ApiBootstrap.initializers
 * 5. Caches the result in sqlite3ApiBootstrap.sqlite3
 *
 * The facade provides access to:
 * - **capi**: C API bindings with SQLite constants and wrapped functions
 * - **wasm**: WebAssembly utilities for memory management and type conversion
 * - **util**: Utility functions for type checking and validation
 * - **config**: Bootstrap configuration settings
 * - **version**: SQLite3 library version information
 * - **client**: Optional client-side API for worker communication
 * - **StructBinder**: Optional struct binding utility for C struct access
 *
 * @example
 * ```typescript
 * const sqlite3 = createSqlite3Facade({
 *   sqlite3ApiBootstrap,
 *   WasmAllocError,
 *   SQLite3Error,
 *   capi,
 *   util,
 *   wasm,
 *   config
 * });
 *
 * // Access the C API
 * const db = sqlite3.capi.sqlite3_open_v2(...);
 *
 * // Use WASM utilities
 * const ptr = sqlite3.wasm.alloc(1024);
 *
 * // Run async initialization (OPFS, workers, etc.)
 * await sqlite3.asyncPostInit();
 * ```
 */
export function createSqlite3Facade(
  options: CreateSqlite3FacadeOptions,
): Sqlite3Facade;
