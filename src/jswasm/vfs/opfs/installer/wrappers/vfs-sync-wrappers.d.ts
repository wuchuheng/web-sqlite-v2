/**
 * Type definitions for vfs-sync-wrappers module
 * @module wrappers/vfs-sync-wrappers
 */

import type {
  VfsSyncWrappers,
  VfsSyncWrapperDeps,
} from "../../../types/opfs-vfs-installer";

/**
 * Creates VFS synchronization wrappers for SQLite virtual file system operations
 * @param deps - Dependencies including WASM interface, state, and file tracking
 * @returns Object containing all VFS method implementations
 */
export function createVfsSyncWrappers(
  deps: VfsSyncWrapperDeps
): VfsSyncWrappers;
