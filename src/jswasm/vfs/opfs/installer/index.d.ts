import type {
  SQLite3Module,
  OpfsConfig,
} from "../../../../../types/opfs-vfs-installer";

/**
 * OPFS VFS installer function that sets up the Origin Private File System
 * Virtual File System for SQLite WASM.
 */
export interface InstallOpfsVfs {
  /**
   * Installs OPFS VFS for SQLite with async worker support.
   * Validates environment, initializes worker, creates VFS structures,
   * and coordinates all installer components for persistent storage.
   * @param options - Configuration options for OPFS VFS installation
   * @returns Promise that resolves with sqlite3 instance when installation completes
   * @throws Error if OPFS is not available or worker fails to load
   */
  (options?: Partial<OpfsConfig>): Promise<SQLite3Module>;

  /**
   * Default URI for the OPFS async proxy worker script.
   * Relative to the installer directory.
   * @default "sqlite3-opfs-async-proxy.js"
   */
  defaultProxyUri: string;
}

/**
 * Initializer function for OPFS VFS that configures default proxy URI
 * and installs the VFS with error handling.
 */
export type InstallOpfsVfsInitializer = (
  sqlite3: SQLite3Module
) => Promise<void>;

/**
 * Context object returned by createInstallOpfsVfsContext containing
 * both the installer function and initializer function.
 */
export interface InstallOpfsVfsContext {
  /** Main installer function for OPFS VFS */
  installOpfsVfs: InstallOpfsVfs;
  /** Initializer function that sets up defaults and calls installer */
  installOpfsVfsInitializer: InstallOpfsVfsInitializer;
}

/**
 * Creates OPFS VFS installer context for SQLite.
 *
 * This is the main factory function that returns the installer and initializer functions.
 * It coordinates all modules (environment validation, configuration, state initialization,
 * serialization, operation runners, I/O wrappers, VFS wrappers, utilities, and worker
 * communication) to provide a complete OPFS VFS implementation.
 *
 * ## Architecture
 *
 * The installer consists of 12 focused modules organized in 3 categories:
 *
 * ### Core Modules (5)
 * - environment-validation: Validates browser OPFS API support
 * - config-setup: Normalizes options and parses URL parameters
 * - serialization: SharedArrayBuffer serialization for cross-thread communication
 * - state-initialization: Initializes shared state and performance metrics
 * - operation-runner: Executes atomic operations with timing
 *
 * ### Wrappers (3)
 * - io-sync-wrappers: File I/O operations (read, write, sync, truncate, lock)
 * - vfs-sync-wrappers: VFS operations (open, access, delete, fullPathname)
 * - vfs-integration: Optional VFS methods and OO1 API integration
 *
 * ### Utils (3)
 * - opfs-util: Filesystem utilities (mkdir, unlink, traverse, importDb, metrics)
 * - sanity-check: Comprehensive VFS validation tests
 * - worker-message-handler: Async worker communication protocol
 *
 * @param sqlite3 - SQLite3 module instance with capi, wasm, util, and config
 * @returns Context object containing installOpfsVfs and installOpfsVfsInitializer functions
 *
 * @example
 * ```typescript
 * import { createInstallOpfsVfsContext } from './installer/index.mjs';
 *
 * const { installOpfsVfs, installOpfsVfsInitializer } =
 *     createInstallOpfsVfsContext(sqlite3);
 *
 * // Install with options
 * await installOpfsVfs({
 *     verbose: 2,
 *     sanityChecks: true,
 *     proxyUri: "sqlite3-opfs-async-proxy.js",
 * });
 * ```
 *
 * @see README.md - Comprehensive documentation with migration guide
 */
export function createInstallOpfsVfsContext(
  sqlite3: SQLite3Module
): InstallOpfsVfsContext;

// Re-export all types from modules for convenience
export type {
  SQLite3Module,
  SQLite3CAPI,
  SQLite3WASM,
  SQLite3Util,
  SQLite3Config,
  SQLite3VFSInstance,
  SQLite3IOMethodsInstance,
  SQLite3FileInstance,
  OpfsConfig,
  OpfsState,
  OpfsMetrics,
  IoSyncWrappers,
  VfsSyncWrappers,
  OpfsUtilInterface,
} from "../../../../../types/opfs-vfs-installer";
