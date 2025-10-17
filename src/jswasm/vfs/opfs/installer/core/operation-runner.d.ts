/**
 * Type definitions for operation-runner module
 * @module core/operation-runner
 */

import type {
  OpfsState,
  OpfsMetrics,
  OperationRunner,
  OperationTimer,
} from "../../../shared/opfs-vfs-installer";

/**
 * Creates operation runner for executing atomic operations via worker
 * @param state - OPFS state object with serializer and buffers
 * @param metrics - Metrics object for tracking performance
 * @param error - Error logging function
 * @param toss - Error throwing utility function
 * @returns Operation runner function that executes operations atomically
 */
export function createOperationRunner(
  state: OpfsState,
  metrics: OpfsMetrics,
  error: (...args: unknown[]) => void,
  toss: (...args: unknown[]) => never
): OperationRunner;

/**
 * Creates operation timer for tracking performance metrics
 * @param metrics - Metrics object to update with timing information
 * @returns Operation timer interface with start/end methods
 */
export function createOperationTimer(metrics: OpfsMetrics): OperationTimer;
