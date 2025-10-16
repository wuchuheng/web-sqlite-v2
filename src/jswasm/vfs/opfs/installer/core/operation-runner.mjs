/**
 * Creates an operation runner for async OPFS calls.
 * @param {import('../../../../../../types/opfs-vfs-installer').OpfsState} state - OPFS state object
 * @param {import('../../../../../../types/opfs-vfs-installer').OpfsMetrics} metrics - Metrics tracking object
 * @param {import('./operation-runner.d.ts').OperationRunnerDeps['error']} error - Error logging function
 * @param {import('./operation-runner.d.ts').OperationRunnerDeps['toss']} toss - Error throwing utility
 * @returns {import('./operation-runner.d.ts').OperationRunner} Operation runner function
 */
export function createOperationRunner(state, metrics, error, toss) {
    /**
     * Executes an OPFS operation through the async worker.
     * @param {string} op - Operation name
     * @param {...any} args - Operation arguments
     * @returns {number} Result code from operation
     */
    return function opRun(op, ...args) {
        // 1. Input handling
        const opNdx = state.opIds[op] || toss("Invalid op ID:", op);

        // 2. Core processing
        // 2.1 Serialize arguments
        state.s11n.serialize(...args);

        // 2.2 Set up atomic operation
        Atomics.store(state.sabOPView, state.opIds.rc, -1);
        Atomics.store(state.sabOPView, state.opIds.whichOp, opNdx);
        Atomics.notify(state.sabOPView, state.opIds.whichOp);

        // 2.3 Wait for completion
        const t = performance.now();
        while (
            "not-equal" !== Atomics.wait(state.sabOPView, state.opIds.rc, -1)
        ) {
            // Intentionally empty - busy wait for atomic operation
        }
        const waitTime = performance.now() - t;

        // 2.4 Read result code
        const rc = Atomics.load(state.sabOPView, state.opIds.rc);
        metrics[op].wait += waitTime;

        // 2.5 Handle async exceptions
        if (rc && state.asyncS11nExceptions) {
            const err = state.s11n.deserialize();
            if (err) error(op + "() async error:", ...err);
        }

        // 3. Output handling
        return rc;
    };
}

/**
 * Creates timing utilities for operation metrics.
 * @param {import('../../../../../../types/opfs-vfs-installer').OpfsMetrics} metrics - Metrics tracking object
 * @returns {import('./operation-runner.d.ts').OperationTimer} Timer interface with mTimeStart and mTimeEnd
 */
export function createOperationTimer(metrics) {
    // 1. Input handling
    const opTimer = Object.create(null);
    opTimer.op = undefined;
    opTimer.start = undefined;

    // 3. Output handling
    return {
        /**
         * Starts timing an operation.
         * @param {string} op - Operation name
         */
        mTimeStart(op) {
            opTimer.start = performance.now();
            opTimer.op = op;
            ++metrics[op].count;
        },

        /**
         * Ends timing and records elapsed time.
         */
        mTimeEnd() {
            metrics[opTimer.op].time += performance.now() - opTimer.start;
        },
    };
}
