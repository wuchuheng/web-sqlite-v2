/**
 * @fileoverview Helper responsible for opening OO1 database connections.
 */

/**
 * Builds the helper that opens database connections on demand.
 *
 * @param {object} context - Shared runtime context.
 * @returns {(this: any, ...args: any[]) => void} Function used internally by the DB constructor.
 */
export function createDbCtorHelper(context) {
    const { sqlite3, capi, wasm, ptrMap, stmtMap, vfsCallbacks, toss } =
        context;

    const nameOverrides = Object.create(null);
    const workerError = (name) =>
        toss(
            "The VFS for",
            name,
            "is only available in the main window thread."
        );
    const isWorkerThread = typeof importScripts === "function";

    nameOverrides[":localStorage:"] = {
        vfs: "kvvfs",
        filename: isWorkerThread ? workerError : () => "local",
    };
    nameOverrides[":sessionStorage:"] = {
        vfs: "kvvfs",
        filename: isWorkerThread ? workerError : () => "session",
    };

    const dbTraceLogger = wasm.installFunction(
        "i(ippp)",
        function (traceFlag, dbPointer, _ignored, sqlPointer) {
            if (capi.SQLITE_TRACE_STMT === traceFlag) {
                console.log(
                    `SQL TRACE #${++this.counter} via sqlite3@${dbPointer}:`,
                    wasm.cstrToJs(sqlPointer)
                );
            }
        }.bind({ counter: 0 })
    );

    const normalizeArgs = (filename = ":memory:", flags = "c", vfs = null) => {
        if (
            arguments.length === 1 &&
            filename &&
            typeof filename === "object"
        ) {
            const arg = { ...filename };
            if (arg.flags === undefined) arg.flags = "c";
            if (arg.vfs === undefined) arg.vfs = null;
            if (arg.filename === undefined) arg.filename = ":memory:";
            return arg;
        }
        return { filename, flags, vfs };
    };

    const setVfsPostOpenCallback = (pVfs, callback) => {
        if (!(callback instanceof Function)) {
            toss(
                "dbCtorHelper.setVfsPostOpenCallback() should not be used with",
                "a non-function argument.",
                callback
            );
        }
        vfsCallbacks[pVfs] = callback;
    };

    const dbCtorHelper = function dbCtor(...ctorArgs) {
        const opt = normalizeArgs(...ctorArgs);
        let { filename, flags: flagsStr, vfs: vfsName } = opt;

        if (
            (typeof filename !== "string" && typeof filename !== "number") ||
            typeof flagsStr !== "string" ||
            (vfsName &&
                typeof vfsName !== "string" &&
                typeof vfsName !== "number")
        ) {
            sqlite3.config.error(
                "Invalid DB ctor args",
                opt,
                ctorArgs
            );
            toss("Invalid arguments for DB constructor.");
        }

        let filenameText =
            typeof filename === "number" ? wasm.cstrToJs(filename) : filename;
        const override = nameOverrides[filenameText];
        if (override) {
            vfsName = override.vfs;
            filename = filenameText = override.filename(filenameText);
        }

        let openFlags = 0;
        if (flagsStr.includes("c")) {
            openFlags |= capi.SQLITE_OPEN_CREATE | capi.SQLITE_OPEN_READWRITE;
        }
        if (flagsStr.includes("w")) openFlags |= capi.SQLITE_OPEN_READWRITE;
        if (!openFlags) openFlags = capi.SQLITE_OPEN_READONLY;
        openFlags |= capi.SQLITE_OPEN_EXRESCODE;

        const stack = wasm.pstack.pointer;
        let dbPointer;

        try {
            const pointerSlot = wasm.pstack.allocPtr();
            const rc = capi.sqlite3_open_v2(
                filename,
                pointerSlot,
                openFlags,
                vfsName || 0
            );
            dbPointer = wasm.peekPtr(pointerSlot);
            context.checkRc(dbPointer, rc);
            capi.sqlite3_extended_result_codes(dbPointer, 1);

            if (flagsStr.includes("t")) {
                capi.sqlite3_trace_v2(
                    dbPointer,
                    capi.SQLITE_TRACE_STMT,
                    dbTraceLogger,
                    dbPointer
                );
            }
        } catch (error) {
            if (dbPointer) {
                capi.sqlite3_close_v2(dbPointer);
            }
            throw error;
        } finally {
            wasm.pstack.restore(stack);
        }

        this.filename = filenameText;
        ptrMap.set(this, dbPointer);
        stmtMap.set(this, Object.create(null));

        try {
            const pVfs =
                capi.sqlite3_js_db_vfs(dbPointer) ||
                toss("Internal error: cannot get VFS for new db handle.");
            const postInit = vfsCallbacks[pVfs];
            if (!postInit) return;
            if (postInit instanceof Function) {
                postInit(this, sqlite3);
            } else {
                context.checkRc(
                    dbPointer,
                    capi.sqlite3_exec(dbPointer, postInit, 0, 0, 0)
                );
            }
        } catch (error) {
            this.close();
            throw error;
        }
    };

    dbCtorHelper.normalizeArgs = normalizeArgs;
    dbCtorHelper.setVfsPostOpenCallback = setVfsPostOpenCallback;

    return dbCtorHelper;
}
