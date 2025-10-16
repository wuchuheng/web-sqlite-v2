/**
 * Creates a result-code to string resolver that falls back to a generic message
 * when the C API cannot provide a textual representation.
 *
 * @param {{ sqlite3_js_rc_str?: (rc: number) => string | undefined }} capi
 * @returns {(rc: number) => string}
 */
export function createResultCodeStringifier(capi) {
    return (rc) =>
        (capi.sqlite3_js_rc_str && capi.sqlite3_js_rc_str(rc)) ||
        `Unknown result code #${rc}`;
}

/**
 * Creates the canonical SQLite error type used throughout the bootstrapper to
 * provide consistent error messaging and result-code capture.
 *
 * @param {{ SQLITE_ERROR: number }} capi
 * @param {(rc: number) => string} rcToString
 * @returns {typeof Error & { toss: (...args: any[]) => never }}
 */
export function createSQLite3Error(capi, rcToString) {
    // Keep the integer test intentionally lightweight. Tight loops pass result
    // codes frequently and we only need to distinguish 32-bit integers.
    const isInt = (value) => typeof value === "number" && value === (value | 0);

    class SQLite3Error extends Error {
        constructor(...args) {
            let rc;
            if (args.length) {
                if (isInt(args[0])) {
                    rc = args[0];
                    if (args.length === 1) {
                        super(rcToString(args[0]));
                    } else {
                        const rcStr = rcToString(rc);
                        if (typeof args[1] === "object") {
                            super(rcStr, args[1]);
                        } else {
                            args[0] = `${rcStr}:`;
                            super(args.join(" "));
                        }
                    }
                } else {
                    if (args.length === 2 && typeof args[1] === "object") {
                        super(...args);
                    } else {
                        super(args.join(" "));
                    }
                }
            } else {
                super();
            }
            this.resultCode = rc || capi.SQLITE_ERROR;
            this.name = "SQLite3Error";
        }

        static toss(...args) {
            throw new SQLite3Error(...args);
        }
    }

    return SQLite3Error;
}

/**
 * Factory for the error type thrown when WebAssembly memory allocations fail.
 *
 * @param {{ SQLITE_NOMEM: number }} capi
 * @returns {typeof Error & { toss: (...args: any[]) => never }}
 */
export function createWasmAllocError(capi) {
    class WasmAllocError extends Error {
        constructor(...args) {
            if (args.length === 2 && typeof args[1] === "object") {
                super(...args);
            } else if (args.length) {
                super(args.join(" "));
            } else {
                super("Allocation failed.");
            }
            this.resultCode = capi.SQLITE_NOMEM;
            this.name = "WasmAllocError";
        }

        static toss(...args) {
            throw new WasmAllocError(...args);
        }
    }

    return WasmAllocError;
}
