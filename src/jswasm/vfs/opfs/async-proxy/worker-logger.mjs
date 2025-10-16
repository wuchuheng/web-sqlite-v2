"use strict";

/**
 * Thin logging wrapper that mirrors the historical integer-based
 * verbosity levels used by the OPFS worker.
 *
 * @module async-proxy/worker-logger
 */

/**
 * @typedef {import('./worker-logger.d.ts').VerbosityProvider} VerbosityProvider
 */

/**
 * Lightweight log helper mirroring the historic integer-based verbosity levels.
 */
export class WorkerLogger {
    /**
     * @param {VerbosityProvider} levelProvider - Callable returning the current
     *   verbosity.
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
     * @param {0|1|2} level - 0: error, 1: warn, 2: info.
     * @param {...import('./worker-logger.d.ts').ConsoleArgument} args - Forwarded console arguments.
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
     * @param {...import('./worker-logger.d.ts').ConsoleArgument} args - Console arguments.
     */
    log(...args) {
        this.logAt(2, ...args);
    }

    /**
     * Convenience warn-level logger.
     *
     * @param {...import('./worker-logger.d.ts').ConsoleArgument} args - Console arguments.
     */
    warn(...args) {
        this.logAt(1, ...args);
    }

    /**
     * Convenience error-level logger.
     *
     * @param {...import('./worker-logger.d.ts').ConsoleArgument} args - Console arguments.
     */
    error(...args) {
        this.logAt(0, ...args);
    }
}
