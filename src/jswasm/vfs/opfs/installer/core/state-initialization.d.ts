/**
 * Type definitions for state-initialization module
 * @module core/state-initialization
 */

import type {
  OpfsState,
  OpfsMetrics,
  SQLite3VFSInstance,
  SQLite3CAPI,
} from "../../../types/opfs-vfs-installer";

/**
 * Initializes OPFS state object with shared buffers and operation IDs
 * @param opfsVfs - OPFS VFS structure instance
 * @param capi - SQLite C API bindings
 * @param toss - Error throwing utility function
 * @returns Initialized state object with all buffers and IDs configured
 */
export function initializeOpfsState(
  opfsVfs: SQLite3VFSInstance,
  capi: SQLite3CAPI,
  toss: (...args: unknown[]) => never
): OpfsState;

/**
 * Initializes metrics tracking for OPFS operations
 * @param state - OPFS state object containing operation IDs
 * @returns Metrics object with counters for each operation
 */
export function initializeMetrics(state: OpfsState): OpfsMetrics;
