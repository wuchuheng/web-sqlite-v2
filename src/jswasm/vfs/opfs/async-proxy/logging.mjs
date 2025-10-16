"use strict";

/** @typedef {import("./logging.d.ts").WorkerLogArgument} WorkerLogArgument */
/** @typedef {import("./logging.d.ts").WorkerLogLevel} WorkerLogLevel */

/**
 * Lightweight log helper mirroring the historic integer-based verbosity levels.
 */
class WorkerLogger {
    /**
     * @param {() => number} levelProvider - Callable returning the current verbosity.
     */
    constructor(levelProvider) {
        this.levelProvider = levelProvider;
        this.backends = new Map([
            [0, console.error.bind(console, "OPFS asyncer:")],
            [1, console.warn.bind(console, "OPFS asyncer:")],
            [2, console.log.bind(console, "OPFS asyncer:")],
        ]);
    }

    /**
     * Logs a message if the verbosity threshold allows it.
     *
     * @param {WorkerLogLevel} level - 0: error, 1: warn, 2: info.
     * @param {...WorkerLogArgument} args - Forwarded console arguments.
     */
    logAt(level, ...args) {
        if (this.levelProvider() > level) {
            const backend = this.backends.get(level);
            if (backend) backend(...args);
        }
    }

    /**
     * Convenience info-level logger.
     *
     * @param {...WorkerLogArgument} args - Console arguments.
     */
    log(...args) {
        this.logAt(2, ...args);
    }

    /**
     * Convenience warn-level logger.
     *
     * @param {...WorkerLogArgument} args - Console arguments.
     */
    warn(...args) {
        this.logAt(1, ...args);
    }

    /**
     * Convenience error-level logger.
     *
     * @param {...WorkerLogArgument} args - Console arguments.
     */
    error(...args) {
        this.logAt(0, ...args);
    }
}
globalThis.WorkerLogger = WorkerLogger;
