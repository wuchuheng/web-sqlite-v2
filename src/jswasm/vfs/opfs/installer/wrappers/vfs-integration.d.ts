/**
 * Type definitions for vfs-integration module
 * @module wrappers/vfs-integration
 */

import type {
  SQLite3Module,
  SQLite3VFSInstance,
  OpfsUtilInterface,
} from "../../../shared/opfs-vfs-installer";

/**
 * Sets up optional VFS methods (xRandomness, xSleep) with fallbacks
 * @param opfsVfs - OPFS VFS instance to configure
 * @param dVfs - Default VFS instance for fallback methods (or null)
 * @param vfsSyncWrappers - VFS synchronization wrappers object to extend
 * @param state - OPFS state object with operation IDs
 */
export function setupOptionalVfsMethods(
  opfsVfs: SQLite3VFSInstance,
  dVfs: SQLite3VFSInstance | null,
  vfsSyncWrappers: Record<string, (...args: number[]) => number>,
  state: { sabOPView: Int32Array; opIds: Record<string, number> }
): void;

/**
 * Integrates OPFS VFS with SQLite OO1 API
 * @param sqlite3 - SQLite3 module instance
 * @param opfsVfs - OPFS VFS instance
 * @param opfsUtil - OPFS utility functions interface
 */
export function integrateWithOo1(
  sqlite3: SQLite3Module,
  opfsVfs: SQLite3VFSInstance,
  opfsUtil: OpfsUtilInterface
): void;
