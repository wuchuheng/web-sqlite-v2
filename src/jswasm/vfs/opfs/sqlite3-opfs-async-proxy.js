/*
  2022-09-16

  The author disclaims copyright to this source code.  In place of a
  legal notice, here is a blessing:

  *   May you do good and not evil.
  *   May you find forgiveness for yourself and forgive others.
  *   May you share freely, never taking more than you give.

  ***********************************************************************

  A Worker which manages asynchronous OPFS handles on behalf of a
  synchronous API which controls it via a combination of Worker
  messages, SharedArrayBuffer, and Atomics. It is the asynchronous
  counterpart of the API defined in sqlite3-vfs-opfs.js.

  Highly indebted to:

  https://github.com/rhashimoto/wa-sqlite/blob/master/src/examples/OriginPrivateFileSystemVFS.js

  for demonstrating how to use the OPFS APIs.

  This file is to be loaded as a Worker. It does not have any direct
  access to the sqlite3 JS/WASM bits, so any bits which it needs (most
  notably SQLITE_xxx integer codes) have to be imported into it via an
  initialization process.

  This file represents an implementation detail of a larger piece of
  code, and not a public interface. Its details may change at any time
  and are not intended to be used by any client-level code.

  2022-11-27: Chrome v108 changes some async methods to synchronous, as
  documented at:

  https://developer.chrome.com/blog/sync-methods-for-accesshandles/

  Firefox v111 and Safari 16.4, both released in March 2023, also
  include this.

  We cannot change to the sync forms at this point without breaking
  clients who use Chrome v104-ish or higher. truncate(), getSize(),
  flush(), and close() are now (as of v108) synchronous. Calling them
  with an "await", as we have to for the async forms, is still legal
  with the sync forms but is superfluous. Calling the async forms with
  theFunc().then(...) is not compatible with the change to
  synchronous, but we do do not use those APIs that way. i.e. we don't
  _need_ to change anything for this, but at some point (after Chrome
  versions (approximately) 104-107 are extinct) should change our
  usage of those methods to remove the "await".
*/

"use strict";

/**
 * Posts a typed message back to the controller thread.
 * Uses the historical `type/payload` envelope required by the consumer.
 *
 * @param {string} type - Message type identifier understood by the main thread.
 * @param {...unknown} payload - Arbitrary payload forwarded as-is.
 */
const wPost = (type, ...payload) => postMessage({ type, payload });

/**
 * Throws an Error assembled from the provided string fragments.
 *
 * @param {...unknown} parts - Values concatenated into the error message.
 * @throws {Error}
 */
const toss = (...parts) => {
    throw new Error(parts.join(" "));
};

/**
 * Detects whether the current platform is missing any OPFS prerequisites.
 *
 * @returns {string[]|null} Tuple of error strings if unsupported, otherwise `null`.
 */
const detectEnvironmentIssue = () => {
    if (!globalThis.SharedArrayBuffer) {
        return [
            "Missing SharedArrayBuffer API.",
            "The server must emit the COOP/COEP response headers to enable that.",
        ];
    }
    if (!globalThis.Atomics) {
        return [
            "Missing Atomics API.",
            "The server must emit the COOP/COEP response headers to enable that.",
        ];
    }
    const haveOpfsApis =
        globalThis.FileSystemHandle &&
        globalThis.FileSystemDirectoryHandle &&
        globalThis.FileSystemFileHandle &&
        globalThis.FileSystemFileHandle.prototype
            ?.createSyncAccessHandle &&
        navigator?.storage?.getDirectory;
    if (!haveOpfsApis) {
        return ["Missing required OPFS APIs."];
    }
    return null;
};

/**
 * Normalises an absolute filename into path components.
 *
 * @param {string} filename - Absolute filename.
 * @returns {string[]} Components without leading/trailing empties.
 */
const getResolvedPath = (filename) => {
    const urlPath = new URL(filename, "file://irrelevant").pathname;
    return urlPath.split("/").filter((segment) => segment.length > 0);
};

/**
 * Determines native endianness of the running platform.
 *
 * @returns {boolean} `true` if little-endian.
 */
const detectLittleEndian = () => {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true);
    return new Int16Array(buffer)[0] === 256;
};

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
     * @param {number} level - 0: error, 1: warn, 2: info.
     * @param {...unknown} args - Forwarded console arguments.
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
     * @param {...unknown} args - Console arguments.
     */
    log(...args) {
        this.logAt(2, ...args);
    }

    /**
     * Convenience warn-level logger.
     *
     * @param {...unknown} args - Console arguments.
     */
    warn(...args) {
        this.logAt(1, ...args);
    }

    /**
     * Convenience error-level logger.
     *
     * @param {...unknown} args - Console arguments.
     */
    error(...args) {
        this.logAt(0, ...args);
    }
}

/**
 * Error wrapper signalling repeated failures while requesting a sync access handle.
 */
class GetSyncHandleError extends Error {
    /**
     * @param {DOMException|Error} cause - Underlying failure from the OPFS API.
     * @param {...string} messageParts - Fragments describing the failed operation.
     */
    constructor(cause, ...messageParts) {
        super([messageParts.join(" "), ": ", cause.name, ": ", cause.message].join(""), {
            cause,
        });
        this.name = "GetSyncHandleError";
    }

    /**
     * Converts an error into the appropriate SQLite error code.
     *
     * @param {unknown} error - Error to inspect.
     * @param {number} fallbackCode - Error code used when no specific mapping exists.
     * @param {Record<string, number>} sqliteCodes - Mapping of sqlite error codes.
     * @returns {number} SQLite-compatible error code.
     */
    static toSQLiteCode(error, fallbackCode, sqliteCodes) {
        if (error instanceof GetSyncHandleError) {
            const cause = error.cause;
            if (
                cause?.name === "NoModificationAllowedError" ||
                (cause?.name === "DOMException" &&
                    cause?.message?.startsWith("Access Handles cannot"))
            ) {
                return sqliteCodes.SQLITE_BUSY;
            }
            if (cause?.name === "NotFoundError") {
                return sqliteCodes.SQLITE_CANTOPEN;
            }
        } else if (error && typeof error === "object" && error.name === "NotFoundError") {
            return sqliteCodes.SQLITE_CANTOPEN;
        }
        return fallbackCode;
    }
}

/**
 * Handles serialization/deserialization of arguments across a SharedArrayBuffer.
 */
class SerializationBuffer {
    /**
     * @param {Object} options - Construction options.
     * @param {SharedArrayBuffer} options.sharedBuffer - Backing buffer shared with the main thread.
     * @param {number} options.offset - Byte offset into the shared buffer.
     * @param {number} options.size - Number of bytes available for serialization.
     * @param {boolean} options.littleEndian - Platform endianness.
     * @param {number} options.exceptionVerbosity - Max priority of exceptions to record (0 disables).
     */
    constructor({ sharedBuffer, offset, size, littleEndian, exceptionVerbosity }) {
        this.bytes = new Uint8Array(sharedBuffer, offset, size);
        this.view = new DataView(sharedBuffer, offset, size);
        this.littleEndian = littleEndian;
        this.exceptionVerbosity = exceptionVerbosity;
        this.textEncoder = new TextEncoder();
        this.textDecoder = new TextDecoder();

        /**
         * Metadata for the supported value kinds.
         * @type {Record<string, {id:number,size?:number,getter?:string,setter?:string}>}
         */
        this.typeInfo = {
            number: { id: 1, size: 8, getter: "getFloat64", setter: "setFloat64" },
            bigint: { id: 2, size: 8, getter: "getBigInt64", setter: "setBigInt64" },
            boolean: { id: 3, size: 4, getter: "getInt32", setter: "setInt32" },
            string: { id: 4 },
        };
        this.typeInfoById = Object.fromEntries(
            Object.values(this.typeInfo).map((info) => [info.id, info])
        );
    }

    /**
     * Encodes arbitrary values into the shared buffer.
     *
     * @param {...(string|number|bigint|boolean)} values - Values stored for the consumer.
     */
    serialize(...values) {
        if (!values.length) {
            this.bytes[0] = 0;
            return;
        }
        const typeDescriptors = values.map((value) => {
            const descriptor = this.typeInfo[typeof value];
            if (!descriptor) {
                toss(
                    "Maintenance required: this value type cannot be serialized.",
                    value
                );
            }
            return descriptor;
        });

        let offset = 1;
        this.bytes[0] = values.length & 0xff;
        for (const descriptor of typeDescriptors) {
            this.bytes[offset++] = descriptor.id;
        }
        for (let i = 0; i < values.length; i++) {
            const descriptor = typeDescriptors[i];
            const value = values[i];
            if (descriptor.setter) {
                this.view[descriptor.setter](offset, value, this.littleEndian);
                offset += descriptor.size;
            } else {
                const encoded = this.textEncoder.encode(value);
                this.view.setInt32(offset, encoded.byteLength, this.littleEndian);
                offset += 4;
                this.bytes.set(encoded, offset);
                offset += encoded.byteLength;
            }
        }
    }

    /**
     * Reads data previously written by {@link serialize}.
     *
     * @param {boolean} clear - When true the buffer is marked empty after reading.
     * @returns {Array<string|number|bigint|boolean>|null} Payload values or `null` if empty.
     */
    deserialize(clear = false) {
        const argc = this.bytes[0];
        if (!argc) {
            if (clear) this.bytes[0] = 0;
            return null;
        }

        const values = [];
        const types = [];
        let offset = 1;
        for (let i = 0; i < argc; i++, offset++) {
            types.push(this.typeInfoById[this.bytes[offset]]);
        }
        for (const descriptor of types) {
            if (descriptor.getter) {
                values.push(this.view[descriptor.getter](offset, this.littleEndian));
                offset += descriptor.size;
            } else {
                const length = this.view.getInt32(offset, this.littleEndian);
                offset += 4;
                const slice = this.bytes.slice(offset, offset + length);
                values.push(this.textDecoder.decode(slice));
                offset += length;
            }
        }

        if (clear) this.bytes[0] = 0;
        return values;
    }

    /**
     * Conditionally serializes an exception string based on the configured threshold.
     *
     * @param {number} priority - Smaller numbers represent higher priority.
     * @param {unknown} error - Error object to stringify.
     */
    storeException(priority, error) {
        if (this.exceptionVerbosity <= 0 || priority > this.exceptionVerbosity) {
            return;
        }
        if (!error || typeof error !== "object") {
            this.serialize(String(error ?? "Unknown error"));
            return;
        }
        const { name = "Error", message = "" } = /** @type {Error} */ (error);
        this.serialize(`${name}: ${message}`);
    }
}

/**
 * @typedef {Object} WorkerInitOptions
 * @property {number} verbose
 * @property {SharedArrayBuffer} sabOP
 * @property {SharedArrayBuffer} sabIO
 * @property {Record<string, number>} sq3Codes
 * @property {Record<string, number>} opfsFlags
 * @property {Record<string, number>} opIds
 * @property {number} asyncIdleWaitTime
 * @property {number} asyncS11nExceptions
 * @property {number} fileBufferSize
 * @property {number} sabS11nOffset
 * @property {number} sabS11nSize
 */

/**
 * Creates the baseline worker state used by the OPFS proxy.
 *
 * @returns {WorkerInitOptions & {rootDir:FileSystemDirectoryHandle|null,littleEndian:boolean,sabOPView:Int32Array|null,sabFileBufView:Uint8Array|null,sabS11nView:Uint8Array|null,s11n:SerializationBuffer|null}} -
 * Default state with placeholders.
 */
const createDefaultState = () => ({
    verbose: 1,
    sabOP: null,
    sabIO: null,
    sabOPView: null,
    sabFileBufView: null,
    sabS11nView: null,
    sq3Codes: Object.create(null),
    opfsFlags: Object.create(null),
    opIds: Object.create(null),
    asyncIdleWaitTime: 150,
    asyncS11nExceptions: 1,
    fileBufferSize: 0,
    sabS11nOffset: 0,
    sabS11nSize: 0,
    rootDir: null,
    littleEndian: detectLittleEndian(),
    s11n: null,
});

/**
 * Encapsulates the asynchronous worker behaviour that bridges OPFS with the SQLite VFS.
 */
class AsyncProxyWorker {
    /**
     * @param {(type:string,...payload:unknown[]) => void} postFn - Message bridge.
     */
    constructor(postFn) {
        this.postMessage = postFn;
        this.state = createDefaultState();
        this.logger = new WorkerLogger(() => this.state.verbose ?? 1);
        this.openFiles = new Map();
        this.implicitLocks = new Set();
        this.serialization = null;
        this.operationImplementations = this.createOperationImplementations();
        this.operationHandlersById = new Map();
        this.isShutdownRequested = false;
        this.waitLoopActive = false;
    }

    /**
     * Initialises the worker by binding OPFS and message listeners.
     *
     * @returns {Promise<void>} Resolves once the worker posts `opfs-async-loaded`.
     */
    async start() {
        try {
            this.state.rootDir = await navigator.storage.getDirectory();
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
     * @returns {Record<string, Function>} Operation dictionary.
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
     * @param {{data?: {type?: string, args?: WorkerInitOptions}}} event - Structured worker message.
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
     * @param {WorkerInitOptions} options - Shared buffers and metadata required by the worker.
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
            this.state.fileBufferSize
        );
        this.state.sabS11nView = new Uint8Array(
            this.state.sabIO,
            this.state.sabS11nOffset,
            this.state.sabS11nSize
        );

        this.serialization = new SerializationBuffer({
            sharedBuffer: this.state.sabIO,
            offset: this.state.sabS11nOffset,
            size: this.state.sabS11nSize,
            littleEndian: this.state.littleEndian,
            exceptionVerbosity: this.state.asyncS11nExceptions,
        });
        this.state.s11n = this.serialization;

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
     */
    async waitLoop() {
        const { sabOPView, opIds, asyncIdleWaitTime } = this.state;
        while (!this.isShutdownRequested) {
            try {
                const waitResult = Atomics.wait(
                    sabOPView,
                    opIds.whichOp,
                    0,
                    asyncIdleWaitTime
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
                const args = this.serialization.deserialize(true) ?? [];
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
                "Restarting after opfs-async-shutdown. Might or might not work."
            );
            this.startWaitLoop();
        }
    }

    /**
     * Sets the shutdown flag and notifies the controller.
     */
    async handleShutdown() {
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
            const [directory, part] = await this.getDirectoryForFilename(filename);
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
                        error
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
            while (target) {
                const [dirHandle, part] = await this.getDirectoryForFilename(
                    target,
                    false
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
                this.state.sq3Codes
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
                    this.state.sq3Codes
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
                    !!create
                );
            } catch (error) {
                this.serialization.storeException(1, error);
                this.storeAndNotify("xOpen", this.state.sq3Codes.SQLITE_NOTFOUND);
                return;
            }

            if (this.state.opfsFlags.OPFS_UNLINK_BEFORE_OPEN & opfsFlags) {
                try {
                    await dirHandle.removeEntry(filenamePart);
                } catch (_ignored) {
                    /* best effort */
                }
            }

            const fileHandle = await dirHandle.getFileHandle(filenamePart, { create });

            const fileRecord = {
                fid,
                filenameAbs: filename,
                filenamePart,
                dirHandle,
                fileHandle,
                sabView: this.state.sabFileBufView,
                readOnly:
                    !create && !!(this.state.sq3Codes.SQLITE_OPEN_READONLY & flags),
                deleteOnClose: !!(
                    this.state.sq3Codes.SQLITE_OPEN_DELETEONCLOSE & flags
                ),
            };
            fileRecord.releaseImplicitLocks =
                (opfsFlags & this.state.opfsFlags.OPFS_UNLOCK_ASAP) ||
                this.state.opfsFlags.defaultUnlockAsap;
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
                this.state.sq3Codes
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
                this.state.sq3Codes
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
        if (file?.syncHandle && this.state.sq3Codes.SQLITE_LOCK_NONE === lockType) {
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
            const bytesWritten = handle.write(file.sabView.subarray(0, length), {
                at: Number(offset64),
            });
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
                this.state.sq3Codes
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
        const pathParts = getResolvedPath(absFilename);
        const filename = pathParts.pop() ?? "";
        let directory = this.state.rootDir;
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
     * @param {{readOnly:boolean, filenameAbs:string}|undefined} file - File metadata.
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
     * @param {string} opName - Operation name for logging.
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
     * @param {any} file - File metadata record.
     * @param {string} opName - Operation requesting the handle.
     * @returns {Promise<FileSystemSyncAccessHandle>} Sync handle.
     */
    async getSyncHandle(file, opName) {
        if (file.syncHandle) {
            return file.syncHandle;
        }
        const startTime = performance.now();
        this.logger.log("Acquiring sync handle for", file.filenameAbs);
        const maxAttempts = 6;
        const baseDelay = this.state.asyncIdleWaitTime * 2;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                file.syncHandle = await file.fileHandle.createSyncAccessHandle();
                break;
            } catch (error) {
                if (attempt === maxAttempts) {
                    throw new GetSyncHandleError(
                        error,
                        "Error getting sync handle for",
                        `${opName}().`,
                        maxAttempts + " attempts failed.",
                        file.filenameAbs
                    );
                }
                const delay = baseDelay * attempt;
                this.logger.warn(
                    "Error getting sync handle for",
                    `${opName}(). Waiting`,
                    delay,
                    "ms and trying again.",
                    file.filenameAbs,
                    error
                );
                Atomics.wait(this.state.sabOPView, this.state.opIds.retry, 0, delay);
            }
        }
        this.logger.log(
            "Got",
            `${opName}() sync handle for`,
            file.filenameAbs,
            "in",
            performance.now() - startTime,
            "ms"
        );
        if (!file.xLock) {
            this.implicitLocks.add(file.fid);
            this.logger.log(
                "Acquired implicit lock for",
                `${opName}()`,
                file.fid,
                file.filenameAbs
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
     * @param {any} file - File metadata record.
     */
    async releaseImplicitLock(file) {
        if (file?.releaseImplicitLocks && this.implicitLocks.has(file.fid)) {
            await this.closeSyncHandleQuietly(file);
        }
    }

    /**
     * Closes a sync handle and forgets the associated lock.
     *
     * @param {any} file - File metadata record.
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
     * @param {any} file - File metadata record.
     */
    async closeSyncHandleQuietly(file) {
        try {
            await this.closeSyncHandle(file);
        } catch (error) {
            this.logger.warn("closeSyncHandleQuietly() ignoring:", error, file);
        }
    }
}

(() => {
    const environmentIssue = detectEnvironmentIssue();
    if (environmentIssue) {
        wPost("opfs-unavailable", ...environmentIssue);
        return;
    }

    const worker = new AsyncProxyWorker(wPost);
    worker.start().catch((error) => worker.logger.error(error));
})();
