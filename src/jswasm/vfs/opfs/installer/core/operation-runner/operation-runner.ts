/**
 * Operation runner for executing atomic operations via worker.
 * @module core/operation-runner
 */

import type {
  OpfsState,
  OpfsMetrics,
  OperationRunner,
  OperationTimer,
  SerializableValue,
} from "../../../../../shared/opfs-vfs-installer";

/**
 * Creates an operation runner for async OPFS calls.
 *
 * @param state - OPFS state object containing shared buffers and serializer
 * @param metrics - Metrics object for tracking operation performance
 * @param error - Function to log errors (e.g., console.error)
 * @param toss - Utility function to throw errors
 * @returns Operation runner function that executes operations atomically
 */
export function createOperationRunner(
  state: OpfsState,
  metrics: OpfsMetrics,
  error: (...args: unknown[]) => void,
  toss: (...args: unknown[]) => never,
): OperationRunner {
  /**
   * Executes an OPFS operation through the async worker.
   *
   * @param op - Operation name (key in `state.opIds`)
   * @param args - Arguments to be serialized and sent to the worker
   * @returns Result code from the operation (0 for success, non-zero for error)
   */
  return function opRun(op: string, ...args: SerializableValue[]): number {
    // 1. Input handling
    const opNdx = state.opIds[op as keyof typeof state.opIds];
    if (opNdx === undefined) {
      toss("Invalid op ID:", op);
    }

    // 2. Core processing
    // 2.1 Serialize arguments
    if (!state.s11n) toss("s11n is missing");
    state.s11n.serialize(...args);

    // 2.2 Set up atomic operation
    if (!state.sabOPView) toss("sabOPView is missing");
    Atomics.store(state.sabOPView, state.opIds.rc, -1);
    Atomics.store(state.sabOPView, state.opIds.whichOp, opNdx);
    Atomics.notify(state.sabOPView, state.opIds.whichOp);

    // 2.3 Wait for completion
    const t = performance.now();
    while ("not-equal" !== Atomics.wait(state.sabOPView, state.opIds.rc, -1)) {
      // Wait for worker to complete operation
    }
    const waitTime = performance.now() - t;

    // 2.4 Read result code
    const rc = Atomics.load(state.sabOPView, state.opIds.rc);
    // 2.5 Update metrics
    const metric = metrics[op];
    if (metric && "wait" in metric) {
      metric.wait += waitTime;
    } else {
      // Handle the case where the metric structure might be different or missing
      // This aligns with the original JS behavior which assumes existence or loose typing
      // In strict TS, we'd need to ensure metrics[op] is initialized and has 'wait'
      // For now, we cast or check to satisfy TS
      if (metric) {
        // If it's the split serialize/deserialize type, we might need to decide where to add wait
        // Or if it's a simple OperationMetric
        (metric as unknown as { wait: number }).wait += waitTime;
      }
    }

    // 2.5 Handle async exceptions
    if (rc && state.asyncS11nExceptions && state.s11n) {
      const err = state.s11n.deserialize();
      if (err) error(op + "() async error:", ...err);
    }

    // 3. Output handling
    return rc;
  };
}

/**
 * Creates timing utilities for operation metrics.
 *
 * @param metrics - Metrics object to update with timing information
 * @returns Timer interface with mTimeStart and mTimeEnd methods
 */
export function createOperationTimer(metrics: OpfsMetrics): OperationTimer {
  // 1. Input handling
  // Using a plain object to store temporary timing state
  const opTimer = Object.create(null) as {
    op: string | undefined;
    start: number | undefined;
  };
  opTimer.op = undefined;
  opTimer.start = undefined;

  // 3. Output handling
  return {
    /**
     * Starts timing an operation.
     * @param op - Operation name
     */
    mTimeStart(op: string) {
      opTimer.start = performance.now();
      opTimer.op = op;
      const metric = metrics[op];
      if (metric) {
        if ("count" in metric) {
          ++metric.count;
        } else {
          (metric as unknown as { count: number }).count++;
        }
      }
    },

    /**
     * Ends timing and records elapsed time.
     */
    mTimeEnd(): void {
      if (opTimer.op && opTimer.start !== undefined) {
        const metric = metrics[opTimer.op];
        if (metric) {
          if ("time" in metric) {
            metric.time += performance.now() - opTimer.start;
          } else {
            (metric as unknown as { time: number }).time +=
              performance.now() - opTimer.start;
          }
        }
      }
      opTimer.op = undefined;
    },
  };
}
