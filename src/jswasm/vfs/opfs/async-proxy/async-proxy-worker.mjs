"use strict";

/* global GetSyncHandleError, SerializationBuffer, WorkerLogger, createDefaultState, getResolvedPath, toss */

/** @typedef {import("./environment.d.ts").WorkerPostFn} WorkerPostFn */
/** @typedef {import("./state.d.ts").AsyncProxyState} AsyncProxyState */
/** @typedef {import("./async-proxy-worker.d.ts").WorkerInitOptions} WorkerInitOptions */
/** @typedef {import("./async-proxy-worker.d.ts").AsyncFileRecord} AsyncFileRecord */
/** @typedef {import("./async-proxy-worker.d.ts").AsyncOperationImplementation} AsyncOperationImplementation */
/** @typedef {import("./async-proxy-worker.d.ts").AsyncProxyOperationName} AsyncProxyOperationName */
/** @typedef {import("./async-proxy-worker.d.ts").OperationHandlerEntry} OperationHandlerEntry */

/**
 * Encapsulates the asynchronous worker behaviour that bridges OPFS with the SQLite VFS.
 */
class AsyncProxyWorker {
    /**
     * @param {WorkerPostFn} postFn - Message bridge.
     */
    constructor(postFn) {
        /** @type {WorkerPostFn} */
        this.postMessage = postFn;
        /** @type {AsyncProxyState} */
        this.state = createDefaultState();
        this.logger = new WorkerLogger(() => this.state.verbose ?? 1);
        /** @type {Map<number, AsyncFileRecord>} */
        this.openFiles = new Map();
        this.implicitLocks = new Set();
        this.serialization = this.state.serialization;
        /** @type {Record<AsyncProxyOperationName, AsyncOperationImplementation>} */
        this.operationImplementations = this.createOperationImplementations();
        /** @type {Map<number, OperationHandlerEntry>} */
        this.operationHandlersById = new Map();
        this.isShutdownRequested = false;
        this.waitLoopActive = false;
        /** @type {FileSystemDirectoryHandle | null} */
        this.rootDirectory = null;
    }

    /**
     * Initialises the worker by binding OPFS and message listeners.
     *
     * @returns {Promise<void>} Resolves once the worker posts `opfs-async-loaded`.
     */
    async start() {
        try {
            this.rootDirectory = await navigator.storage.getDirectory();
        } catch (error) {
            this.logger.error("error initializing OPFS asyncer:", error);
            throw error;
        }

        globalThis.onmessage = (event) => this.onMessage(event);
        this.postMessage("opfs-async-loaded");
    }

    /**
     * Maps operation names to implementation functions.
     *
     * @returns {Record<AsyncProxyOperationName, AsyncOperationImplementation>} Operation dictionary.
     */
    createOperationImplementations() {
        return {
            "opfs-async-shutdown": this.handleShutdown.bind(this),
            mkdir: this.handleMkdir.bind(this),
            xAccess: this.handleXAccess.bind(this),
            xClose: this.handleXClose.bind(this),
            xDelete: this.handleXDelete.bind(this),
            xDeleteNoWait: this.handleXDeleteNoWait.bind(this),
            xFileSize: this.handleXFileSize.bind(this),
            xLock: this.handleXLock.bind(this),
            xOpen: this.handleXOpen.bind(this),
            xRead: this.handleXRead.bind(this),
            xSync: this.handleXSync.bind(this),
            xTruncate: this.handleXTruncate.bind(this),
            xUnlock: this.handleXUnlock.bind(this),
            xWrite: this.handleXWrite.bind(this),
        };
    }

    /**
     * Receives control messages from the main thread.
     *
     * @param {import("./async-proxy-worker.d.ts").WorkerMessageEvent} event - Structured worker message.
     */
    onMessage({ data }) {
        switch (data?.type) {
            case "opfs-async-init":
                this.handleInit(data.args);
                break;
            case "opfs-async-restart":
                this.handleRestart();
                break;
            default:
                this.logger.warn("Unexpected message from controller:", data);
        }
    }

    /**
     * Applies the initial configuration sent by the main thread.
     *
     * @param {import("./async-proxy-worker.d.ts").WorkerInitOptions | undefined} options - Shared buffers and metadata required by the worker.
     */
    handleInit(options) {
        if (!options) {
            toss("opfs-async-init requires options payload.");
        }

        Object.assign(this.state, options);
        this.state.verbose = options.verbose ?? 1;

        this.state.sabOPView = new Int32Array(this.state.sabOP);
        this.state.sabFileBufView = new Uint8Array(
            this.state.sabIO,
            0,
            this.state.fileBufferSize,
        );
        this.state.sabS11nView = new Uint8Array(
            this.state.sabIO,
            this.state.sabS11nOffset,
            this.state.sabS11nSize,
        );

        this.serialization = new SerializationBuffer({
            sharedBuffer: this.state.sabIO,
            offset: this.state.sabS11nOffset,
            size: this.state.sabS11nSize,
            littleEndian: this.state.littleEndian,
            exceptionVerbosity: this.state.asyncS11nExceptions,
        });
        this.state.serialization = this.serialization;

        this.buildOperationRouting();

        this.logger.log("init state", {
            verbose: this.state.verbose,
            asyncIdleWaitTime: this.state.asyncIdleWaitTime,
            fileBufferSize: this.state.fileBufferSize,
        });

        this.startWaitLoop();
        this.postMessage("opfs-async-inited");
    }

    /**
     * Rebuilds the opId-to-handler mapping and validates the configuration.
     */
    buildOperationRouting() {
        for (const key of Object.keys(this.operationImplementations)) {
            if (!Number.isFinite(this.state.opIds[key])) {
                toss("Maintenance required: missing state.opIds[", key, "]");
            }
        }
        this.operationHandlersById.clear();
        for (const [name, id] of Object.entries(this.state.opIds)) {
            const handler = this.operationImplementations[name];
            if (handler) {
                this.operationHandlersById.set(id, { name, handler });
            }
        }
    }

    /**
     * Starts the Atomics wait loop if not already running.
     */
    startWaitLoop() {
        if (this.waitLoopActive) {
            return;
        }
        this.isShutdownRequested = false;
        this.waitLoopActive = true;
        (async () => {
            try {
                await this.waitLoop();
            } finally {
                this.waitLoopActive = false;
            }
        })();
    }

    /**
     * Waits for operations signalled by the main thread and dispatches handlers.
     * The serialization buffer is primed by the main thread before each wake-up.
     */
    async waitLoop() {
        const { sabOPView, opIds, asyncIdleWaitTime } = this.state;
        while (!this.isShutdownRequested) {
            try {
                const waitResult = Atomics.wait(
                    sabOPView,
                    opIds.whichOp,
                    0,
                    asyncIdleWaitTime,
                );
                if (waitResult !== "not-equal") {
                    await this.releaseImplicitLocks();
                    continue;
                }

                const opId = Atomics.load(sabOPView, opIds.whichOp);
                Atomics.store(sabOPView, opIds.whichOp, 0);

                const handlerEntry =
                    this.operationHandlersById.get(opId) ??
                    toss("No waitLoop handler for whichOp #", opId);
                const args = this.serialization.deserialize(true);
                await handlerEntry.handler(...args);
            } catch (error) {
                this.logger.error("waitLoop() caught:", error);
            }
        }
    }

    /**
     * Attempts to gracefully restart the worker after a shutdown request.
     */
    handleRestart() {
        if (this.isShutdownRequested) {
            this.logger.warn(
                "Restarting after opfs-async-shutdown. Might or might not work.",
            );
            this.startWaitLoop();
        }
    }

    /**
     * Sets the shutdown flag and notifies the controller.
     */
    handleShutdown() {
        this.isShutdownRequested = true;
        this.storeAndNotify("opfs-async-shutdown", 0);
    }

    /**
     * Creates a directory (recursively) for the provided path.
     *
     * @param {string} dirname - Directory to create.
     */
    async handleMkdir(dirname) {
        let rc = 0;
        try {
            await this.getDirectoryForFilename(`${dirname}/filepart`, true);
        } catch (error) {
            this.serialization.storeException(2, error);
            rc = this.state.sq3Codes.SQLITE_IOERR;
        }
        this.storeAndNotify("mkdir", rc);
    }

    /**
     * Asserts that a file exists.
     *
     * @param {string} filename - Absolute path of the file to probe.
     */
    async handleXAccess(filename) {
        let rc = 0;
        try {
            const [directory, part] =
                await this.getDirectoryForFilename(filename);
            await directory.getFileHandle(part);
        } catch (error) {
            this.serialization.storeException(2, error);
            rc = this.state.sq3Codes.SQLITE_IOERR;
        }
        this.storeAndNotify("xAccess", rc);
    }

    /**
     * Closes an open file handle.
     *
     * @param {number} fid - File descriptor.
     */
    async handleXClose(fid) {
        this.implicitLocks.delete(fid);
        let rc = 0;
        const file = this.openFiles.get(fid);
        if (file) {
            this.openFiles.delete(fid);
            await this.closeSyncHandle(file);
            if (file.deleteOnClose) {
                try {
                    await file.dirHandle.removeEntry(file.filenamePart);
                } catch (error) {
                    this.logger.warn(
                        "Ignoring dirHandle.removeEntry() failure of",
                        file,
                        error,
                    );
                }
            }
        } else {
            this.serialization.serialize();
            rc = this.state.sq3Codes.SQLITE_NOTFOUND;
        }
        this.storeAndNotify("xClose", rc);
    }

    /**
     * Deletes a file or directory and notifies the caller.
     *
     * @param {string} filename - Path to delete.
     * @param {number} [syncDir=0] - Controls parent directory syncing cascade.
     * @param {boolean} [recursive=false] - When true removes directories recursively.
     */
    async handleXDelete(filename, syncDir = 0, recursive = false) {
        const rc = await this.handleXDeleteNoWait(filename, syncDir, recursive);
        this.storeAndNotify("xDelete", rc);
    }

    /**
     * Deletes a file without notifying the caller. Used by other operations.
     *
     * @param {string} filename - Path to delete.
     * @param {number} [syncDir=0] - Controls parent directory syncing cascade.
     * @param {boolean} [recursive=false] - When true removes directories recursively.
     * @returns {Promise<number>} SQLite result code.
     */
    async handleXDeleteNoWait(filename, syncDir = 0, recursive = false) {
        let rc = 0;
        try {
            let target = filename;
            let shouldRecurse = recursive;
            // Walk up the path when asked to sync parent directories, mirroring the native VFS behaviour.
            while (target) {
                const [dirHandle, part] = await this.getDirectoryForFilename(
                    target,
                    false,
                );
                if (!part) break;
                await dirHandle.removeEntry(part, { recursive: shouldRecurse });
                if (syncDir !== 0x1234) break;
                shouldRecurse = false;
                const components = getResolvedPath(target);
                components.pop();
                target = components.join("/");
            }
        } catch (error) {
            this.serialization.storeException(2, error);
            rc = this.state.sq3Codes.SQLITE_IOERR_DELETE;
        }
        return rc;
    }

    /**
     * Retrieves a file's size.
     *
     * @param {number} fid - File descriptor.
     */
    async handleXFileSize(fid) {
        let rc = 0;
        const file = this.openFiles.get(fid);
        try {
            const handle = await this.getSyncHandle(file, "xFileSize");
            const size = await handle.getSize();
            this.serialization.serialize(Number(size));
        } catch (error) {
            this.serialization.storeException(1, error);
            rc = GetSyncHandleError.toSQLiteCode(
                error,
                this.state.sq3Codes.SQLITE_IOERR,
                this.state.sq3Codes,
            );
        }
        await this.releaseImplicitLock(file);
        this.storeAndNotify("xFileSize", rc);
    }

    /**
     * Applies an SQLite-style lock.
     *
     * @param {number} fid - File descriptor.
     * @param {number} lockType - SQLite lock constant.
     */
    async handleXLock(fid, lockType) {
        let rc = 0;
        const file = this.openFiles.get(fid);
        const previous = file?.xLock;
        if (!file) {
            this.storeAndNotify("xLock", this.state.sq3Codes.SQLITE_NOTFOUND);
            return;
        }
        file.xLock = lockType;
        if (!file.syncHandle) {
            try {
                await this.getSyncHandle(file, "xLock");
                this.implicitLocks.delete(fid);
            } catch (error) {
                this.serialization.storeException(1, error);
                rc = GetSyncHandleError.toSQLiteCode(
                    error,
                    this.state.sq3Codes.SQLITE_IOERR_LOCK,
                    this.state.sq3Codes,
                );
                file.xLock = previous;
            }
        }
        this.storeAndNotify("xLock", rc);
    }

    /**
     * Opens a file and registers it in the local table.
     *
     * @param {number} fid - File descriptor slot.
     * @param {string} filename - Absolute filename.
     * @param {number} flags - SQLite open flags.
     * @param {number} opfsFlags - Internal OPFS behaviour flags.
     */
    async handleXOpen(fid, filename, flags, opfsFlags) {
        const create = this.state.sq3Codes.SQLITE_OPEN_CREATE & flags;
        try {
            let dirHandle;
            let filenamePart;
            try {
                [dirHandle, filenamePart] = await this.getDirectoryForFilename(
                    filename,
                    !!create,
                );
            } catch (error) {
                this.serialization.storeException(1, error);
                this.storeAndNotify(
                    "xOpen",
                    this.state.sq3Codes.SQLITE_NOTFOUND,
                );
                return;
            }

            if (this.state.opfsFlags.OPFS_UNLINK_BEFORE_OPEN & opfsFlags) {
                try {
                    await dirHandle.removeEntry(filenamePart);
                } catch (_ignored) {
                    /* best effort */
                }
            }

            const fileHandle = await dirHandle.getFileHandle(filenamePart, {
                create,
            });

            const fileRecord = {
                fid,
                filenameAbs: filename,
                filenamePart,
                dirHandle,
                fileHandle,
                sabView: this.state.sabFileBufView,
                readOnly:
                    !create &&
                    !!(this.state.sq3Codes.SQLITE_OPEN_READONLY & flags),
                deleteOnClose: !!(
                    this.state.sq3Codes.SQLITE_OPEN_DELETEONCLOSE & flags
                ),
                releaseImplicitLocks:
                    opfsFlags & this.state.opfsFlags.OPFS_UNLOCK_ASAP ||
                    this.state.opfsFlags.defaultUnlockAsap,
            };
            this.openFiles.set(fid, fileRecord);

            this.storeAndNotify("xOpen", 0);
        } catch (error) {
            this.logger.error("xOpen", error);
            this.serialization.storeException(1, error);
            this.storeAndNotify("xOpen", this.state.sq3Codes.SQLITE_IOERR);
        }
    }

    /**
     * Reads bytes from an open file into the shared buffer.
     *
     * @param {number} fid - File descriptor.
     * @param {number} length - Number of bytes requested.
     * @param {bigint|number} offset64 - File offset.
     */
    async handleXRead(fid, length, offset64) {
        const file = this.openFiles.get(fid);
        let rc = 0;
        try {
            const handle = await this.getSyncHandle(file, "xRead");
            const bytesRead = handle.read(file.sabView.subarray(0, length), {
                at: Number(offset64),
            });
            if (bytesRead < length) {
                file.sabView.fill(0, bytesRead, length);
                rc = this.state.sq3Codes.SQLITE_IOERR_SHORT_READ;
            }
        } catch (error) {
            this.logger.error("xRead() failed", error, file);
            this.serialization.storeException(1, error);
            rc = GetSyncHandleError.toSQLiteCode(
                error,
                this.state.sq3Codes.SQLITE_IOERR_READ,
                this.state.sq3Codes,
            );
        }
        await this.releaseImplicitLock(file);
        this.storeAndNotify("xRead", rc);
    }

    /**
     * Flushes pending writes.
     *
     * @param {number} fid - File descriptor.
     * @param {number} _flags - Reserved (unused).
     */
    async handleXSync(fid, _flags) {
        let rc = 0;
        const file = this.openFiles.get(fid);
        if (file && !file.readOnly && file.syncHandle) {
            try {
                await file.syncHandle.flush();
            } catch (error) {
                this.serialization.storeException(2, error);
                rc = this.state.sq3Codes.SQLITE_IOERR_FSYNC;
            }
        }
        this.storeAndNotify("xSync", rc);
    }

    /**
     * Truncates a file to the provided size.
     *
     * @param {number} fid - File descriptor.
     * @param {bigint|number} size - Desired length.
     */
    async handleXTruncate(fid, size) {
        const file = this.openFiles.get(fid);
        let rc = 0;
        try {
            this.affirmWritable("xTruncate", file);
            const handle = await this.getSyncHandle(file, "xTruncate");
            await handle.truncate(size);
        } catch (error) {
            this.logger.error("xTruncate():", error, file);
            this.serialization.storeException(2, error);
            rc = GetSyncHandleError.toSQLiteCode(
                error,
                this.state.sq3Codes.SQLITE_IOERR_TRUNCATE,
                this.state.sq3Codes,
            );
        }
        await this.releaseImplicitLock(file);
        this.storeAndNotify("xTruncate", rc);
    }

    /**
     * Releases a lock and potentially disposes the sync handle.
     *
     * @param {number} fid - File descriptor.
     * @param {number} lockType - SQLite lock constant.
     */
    async handleXUnlock(fid, lockType) {
        const file = this.openFiles.get(fid);
        let rc = 0;
        if (
            file?.syncHandle &&
            this.state.sq3Codes.SQLITE_LOCK_NONE === lockType
        ) {
            try {
                await this.closeSyncHandle(file);
            } catch (error) {
                this.serialization.storeException(1, error);
                rc = this.state.sq3Codes.SQLITE_IOERR_UNLOCK;
            }
        }
        this.storeAndNotify("xUnlock", rc);
    }

    /**
     * Writes bytes from the shared buffer into the file.
     *
     * @param {number} fid - File descriptor.
     * @param {number} length - Number of bytes to write.
     * @param {bigint|number} offset64 - File offset.
     */
    async handleXWrite(fid, length, offset64) {
        const file = this.openFiles.get(fid);
        let rc = 0;
        try {
            this.affirmWritable("xWrite", file);
            const handle = await this.getSyncHandle(file, "xWrite");
            const bytesWritten = handle.write(
                file.sabView.subarray(0, length),
                {
                    at: Number(offset64),
                },
            );
            rc =
                bytesWritten === length
                    ? 0
                    : this.state.sq3Codes.SQLITE_IOERR_WRITE;
        } catch (error) {
            this.logger.error("xWrite():", error, file);
            this.serialization.storeException(1, error);
            rc = GetSyncHandleError.toSQLiteCode(
                error,
                this.state.sq3Codes.SQLITE_IOERR_WRITE,
                this.state.sq3Codes,
            );
        }
        await this.releaseImplicitLock(file);
        this.storeAndNotify("xWrite", rc);
    }

    /**
     * Retrieves (and optionally creates) the directory corresponding to a path.
     *
     * @param {string} absFilename - Absolute filename.
     * @param {boolean} [createDirs=false] - Whether to create intermediate directories.
     * @returns {Promise<[FileSystemDirectoryHandle, string]>} Directory handle and filename part.
     */
    async getDirectoryForFilename(absFilename, createDirs = false) {
        if (!this.rootDirectory) {
            toss(
                "getDirectoryForFilename() called before rootDirectory assigned.",
            );
        }
        const pathParts = getResolvedPath(absFilename);
        const filename = pathParts.pop() ?? "";
        let directory = this.rootDirectory;
        for (const segment of pathParts) {
            if (!segment) continue;
            directory = await directory.getDirectoryHandle(segment, {
                create: !!createDirs,
            });
        }
        return [directory, filename];
    }

    /**
     * Ensures the file is writable, otherwise throws an error.
     *
     * @param {string} opName - Operation name for context.
     * @param {AsyncFileRecord | undefined} file - File metadata.
     */
    affirmWritable(opName, file) {
        if (!file) toss(opName, "(): File handle not found.");
        if (file.readOnly) {
            toss(opName + "(): File is read-only: " + file.filenameAbs);
        }
    }

    /**
     * Persists and notifies the caller with a result code.
     *
     * @param {AsyncProxyOperationName} opName - Operation name for logging.
     * @param {number} value - SQLite result code.
     */
    storeAndNotify(opName, value) {
        this.logger.log(`${opName}() => notify(`, value, ")");
        Atomics.store(this.state.sabOPView, this.state.opIds.rc, value);
        Atomics.notify(this.state.sabOPView, this.state.opIds.rc);
    }

    /**
     * Obtains a sync access handle, retrying when the platform reports busy.
     *
     * @param {AsyncFileRecord | undefined} file - File metadata record.
     * @param {string} opName - Operation requesting the handle.
     * @returns {Promise<FileSystemSyncAccessHandle>} Sync handle.
     */
    async getSyncHandle(file, opName) {
        if (!file) {
            toss(opName, "(): File handle not found.");
        }
        if (file.syncHandle) {
            return file.syncHandle;
        }
        const startTime = performance.now();
        this.logger.log("Acquiring sync handle for", file.filenameAbs);
        const maxAttempts = 6;
        // The wait policy mirrors the C-side busy handler and keeps the worker responsive.
        const baseDelay = this.state.asyncIdleWaitTime * 2;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                file.syncHandle =
                    await file.fileHandle.createSyncAccessHandle();
                break;
            } catch (error) {
                if (attempt === maxAttempts) {
                    throw new GetSyncHandleError(
                        error,
                        "Error getting sync handle for",
                        `${opName}().`,
                        maxAttempts + " attempts failed.",
                        file.filenameAbs,
                    );
                }
                const delay = baseDelay * attempt;
                this.logger.warn(
                    "Error getting sync handle for",
                    `${opName}(). Waiting`,
                    delay,
                    "ms and trying again.",
                    file.filenameAbs,
                    error,
                );
                Atomics.wait(
                    this.state.sabOPView,
                    this.state.opIds.retry,
                    0,
                    delay,
                );
            }
        }
        this.logger.log(
            "Got",
            `${opName}() sync handle for`,
            file.filenameAbs,
            "in",
            performance.now() - startTime,
            "ms",
        );
        if (!file.xLock) {
            this.implicitLocks.add(file.fid);
            this.logger.log(
                "Acquired implicit lock for",
                `${opName}()`,
                file.fid,
                file.filenameAbs,
            );
        }
        return file.syncHandle;
    }

    /**
     * Releases all implicit locks from timed-out operations.
     */
    async releaseImplicitLocks() {
        if (!this.implicitLocks.size) return;
        for (const fid of [...this.implicitLocks]) {
            const file = this.openFiles.get(fid);
            if (!file) {
                this.implicitLocks.delete(fid);
                continue;
            }
            await this.closeSyncHandleQuietly(file);
            this.logger.log("Auto-unlocked", fid, file.filenameAbs);
        }
    }

    /**
     * Releases a specific implicit lock if requested by the caller.
     *
     * @param {AsyncFileRecord | undefined} file - File metadata record.
     */
    async releaseImplicitLock(file) {
        if (file?.releaseImplicitLocks && this.implicitLocks.has(file.fid)) {
            await this.closeSyncHandleQuietly(file);
        }
    }

    /**
     * Closes a sync handle and forgets the associated lock.
     *
     * @param {AsyncFileRecord | undefined} file - File metadata record.
     */
    async closeSyncHandle(file) {
        if (!file?.syncHandle) return;
        this.logger.log("Closing sync handle for", file.filenameAbs);
        const handle = file.syncHandle;
        delete file.syncHandle;
        delete file.xLock;
        this.implicitLocks.delete(file.fid);
        await handle.close();
    }

    /**
     * Closes a sync handle while ignoring any raised errors.
     *
     * @param {AsyncFileRecord | undefined} file - File metadata record.
     */
    async closeSyncHandleQuietly(file) {
        try {
            await this.closeSyncHandle(file);
        } catch (error) {
            this.logger.warn("closeSyncHandleQuietly() ignoring:", error, file);
        }
    }
}
globalThis.AsyncProxyWorker = AsyncProxyWorker;
