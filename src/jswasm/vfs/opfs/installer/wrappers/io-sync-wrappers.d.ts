/**
 * Type definitions for io-sync-wrappers module
 * @module wrappers/io-sync-wrappers
 */

import type {
  IoSyncWrappers,
  IoSyncWrapperDeps,
} from "../../../shared/opfs-vfs-installer";

/**
 * Creates I/O synchronization wrappers for SQLite file operations
 * @param deps - Dependencies including WASM interface, state, and operation runner
 * @returns Object containing all I/O method implementations
 */
export function createIoSyncWrappers(deps: IoSyncWrapperDeps): IoSyncWrappers;
