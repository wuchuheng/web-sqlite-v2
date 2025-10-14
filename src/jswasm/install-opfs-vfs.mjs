export function createInstallOpfsVfsContext(sqlite3) {
    const installOpfsVfs = function callee(options) {
        if (!globalThis.SharedArrayBuffer || !globalThis.Atomics) {
            return Promise.reject(
                new Error(
                    "Cannot install OPFS: Missing SharedArrayBuffer and/or Atomics. " +
                        "The server must emit the COOP/COEP response headers to enable those. " +
                        "See https://sqlite.org/wasm/doc/trunk/persistence.md#coop-coep"
                )
            );
        } else if ("undefined" === typeof WorkerGlobalScope) {
            return Promise.reject(
                new Error(
                    "The OPFS sqlite3_vfs cannot run in the main thread " +
                        "because it requires Atomics.wait()."
                )
            );
        } else if (
            !globalThis.FileSystemHandle ||
            !globalThis.FileSystemDirectoryHandle ||
            !globalThis.FileSystemFileHandle ||
            !globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle ||
            !navigator?.storage?.getDirectory
        ) {
            return Promise.reject(new Error("Missing required OPFS APIs."));
        }
        if (!options || "object" !== typeof options) {
            options = Object.create(null);
        }
        const urlParams = new URL(globalThis.location.href).searchParams;
        if (urlParams.has("opfs-disable")) {
            return Promise.resolve(sqlite3);
        }
        if (undefined === options.verbose) {
            options.verbose = urlParams.has("opfs-verbose")
                ? +urlParams.get("opfs-verbose") || 2
                : 1;
        }
        if (undefined === options.sanityChecks) {
            options.sanityChecks = urlParams.has("opfs-sanity-check");
        }
        if (undefined === options.proxyUri) {
            options.proxyUri = callee.defaultProxyUri;
        }

        if ("function" === typeof options.proxyUri) {
            options.proxyUri = options.proxyUri();
        }
        const thePromise = new Promise(function (
            promiseResolve_,
            promiseReject_
        ) {
            const loggers = [
                sqlite3.config.error,
                sqlite3.config.warn,
                sqlite3.config.log,
            ];
            const logImpl = (level, ...args) => {
                if (options.verbose > level)
                    loggers[level]("OPFS syncer:", ...args);
            };
            const log = (...args) => logImpl(2, ...args);
            const warn = (...args) => logImpl(1, ...args);
            const error = (...args) => logImpl(0, ...args);
            const toss = sqlite3.util.toss;
            const capi = sqlite3.capi;
            const util = sqlite3.util;
            const wasm = sqlite3.wasm;
            const sqlite3_vfs = capi.sqlite3_vfs;
            const sqlite3_file = capi.sqlite3_file;
            const sqlite3_io_methods = capi.sqlite3_io_methods;

            const opfsUtil = Object.create(null);

            const thisThreadHasOPFS = () => {
                return (
                    globalThis.FileSystemHandle &&
                    globalThis.FileSystemDirectoryHandle &&
                    globalThis.FileSystemFileHandle &&
                    globalThis.FileSystemFileHandle.prototype
                        .createSyncAccessHandle &&
                    navigator?.storage?.getDirectory
                );
            };

            opfsUtil.metrics = {
                dump: function () {
                    let k,
                        n = 0,
                        t = 0,
                        w = 0;
                    for (k in state.opIds) {
                        const m = metrics[k];
                        n += m.count;
                        t += m.time;
                        w += m.wait;
                        m.avgTime = m.count && m.time ? m.time / m.count : 0;
                        m.avgWait = m.count && m.wait ? m.wait / m.count : 0;
                    }
                    sqlite3.config.log(
                        globalThis.location.href,
                        "metrics for",
                        globalThis.location.href,
                        ":",
                        metrics,
                        "\nTotal of",
                        n,
                        "op(s) for",
                        t,
                        "ms (incl. " + w + " ms of waiting on the async side)"
                    );
                    sqlite3.config.log(
                        "Serialization metrics:",
                        metrics.s11n
                    );
                    W.postMessage({ type: "opfs-async-metrics" });
                },
                reset: function () {
                    let k;
                    const r = (m) => (m.count = m.time = m.wait = 0);
                    for (k in state.opIds) {
                        r((metrics[k] = Object.create(null)));
                    }
                    let s = (metrics.s11n = Object.create(null));
                    s = s.serialize = Object.create(null);
                    s.count = s.time = 0;
                    s = metrics.s11n.deserialize = Object.create(null);
                    s.count = s.time = 0;
                },
            };
            const opfsIoMethods = new sqlite3_io_methods();
            const opfsVfs = new sqlite3_vfs().addOnDispose(() =>
                opfsIoMethods.dispose()
            );
            let promiseWasRejected = undefined;
            const promiseReject = (err) => {
                promiseWasRejected = true;
                opfsVfs.dispose();
                return promiseReject_(err);
            };
            const promiseResolve = () => {
                promiseWasRejected = false;
                return promiseResolve_(sqlite3);
            };
            const W = new Worker(new URL(options.proxyUri, import.meta.url));
            setTimeout(() => {
                if (undefined === promiseWasRejected) {
                    promiseReject(
                        new Error(
                            "Timeout while waiting for OPFS async proxy worker."
                        )
                    );
                }
            }, 4000);
            W._originalOnError = W.onerror;
            W.onerror = function (err) {
                error("Error initializing OPFS asyncer:", err);
                promiseReject(
                    new Error(
                        "Loading OPFS async Worker failed for unknown reasons."
                    )
                );
            };
            const pDVfs = capi.sqlite3_vfs_find(null);
            const dVfs = pDVfs ? new sqlite3_vfs(pDVfs) : null;
            opfsIoMethods.$iVersion = 1;
            opfsVfs.$iVersion = 2;
            opfsVfs.$szOsFile = capi.sqlite3_file.structInfo.sizeof;
            opfsVfs.$mxPathname = 1024;
            opfsVfs.$zName = wasm.allocCString("opfs");

            opfsVfs.$xDlOpen =
                opfsVfs.$xDlError =
                opfsVfs.$xDlSym =
                opfsVfs.$xDlClose =
                    null;
            opfsVfs.addOnDispose(
                "$zName",
                opfsVfs.$zName,
                "cleanup default VFS wrapper",
                () => (dVfs ? dVfs.dispose() : null)
            );

            const state = Object.create(null);
            state.verbose = options.verbose;
            state.littleEndian = (() => {
                const buffer = new ArrayBuffer(2);
                new DataView(buffer).setInt16(0, 256, true);

                return new Int16Array(buffer)[0] === 256;
            })();

            state.asyncIdleWaitTime = 150;

            state.asyncS11nExceptions = 1;

            state.fileBufferSize = 1024 * 64;
            state.sabS11nOffset = state.fileBufferSize;

            state.sabS11nSize = opfsVfs.$mxPathname * 2;

            state.sabIO = new SharedArrayBuffer(
                state.fileBufferSize + state.sabS11nSize
            );
            state.opIds = Object.create(null);
            const metrics = Object.create(null);
            {
                let i = 0;

                state.opIds.whichOp = i++;

                state.opIds.rc = i++;

                state.opIds.xAccess = i++;
                state.opIds.xClose = i++;
                state.opIds.xDelete = i++;
                state.opIds.xDeleteNoWait = i++;
                state.opIds.xFileSize = i++;
                state.opIds.xLock = i++;
                state.opIds.xOpen = i++;
                state.opIds.xRead = i++;
                state.opIds.xSleep = i++;
                state.opIds.xSync = i++;
                state.opIds.xTruncate = i++;
                state.opIds.xUnlock = i++;
                state.opIds.xWrite = i++;
                state.opIds.mkdir = i++;
                state.opIds["opfs-async-metrics"] = i++;
                state.opIds["opfs-async-shutdown"] = i++;

                state.opIds.retry = i++;
                state.sabOP = new SharedArrayBuffer(i * 4);
                opfsUtil.metrics.reset();
            }

            state.sq3Codes = Object.create(null);
            [
                "SQLITE_ACCESS_EXISTS",
                "SQLITE_ACCESS_READWRITE",
                "SQLITE_BUSY",
                "SQLITE_CANTOPEN",
                "SQLITE_ERROR",
                "SQLITE_IOERR",
                "SQLITE_IOERR_ACCESS",
                "SQLITE_IOERR_CLOSE",
                "SQLITE_IOERR_DELETE",
                "SQLITE_IOERR_FSYNC",
                "SQLITE_IOERR_LOCK",
                "SQLITE_IOERR_READ",
                "SQLITE_IOERR_SHORT_READ",
                "SQLITE_IOERR_TRUNCATE",
                "SQLITE_IOERR_UNLOCK",
                "SQLITE_IOERR_WRITE",
                "SQLITE_LOCK_EXCLUSIVE",
                "SQLITE_LOCK_NONE",
                "SQLITE_LOCK_PENDING",
                "SQLITE_LOCK_RESERVED",
                "SQLITE_LOCK_SHARED",
                "SQLITE_LOCKED",
                "SQLITE_MISUSE",
                "SQLITE_NOTFOUND",
                "SQLITE_OPEN_CREATE",
                "SQLITE_OPEN_DELETEONCLOSE",
                "SQLITE_OPEN_MAIN_DB",
                "SQLITE_OPEN_READONLY",
            ].forEach((k) => {
                if (undefined === (state.sq3Codes[k] = capi[k])) {
                    toss("Maintenance required: not found:", k);
                }
            });
            state.opfsFlags = Object.assign(Object.create(null), {
                OPFS_UNLOCK_ASAP: 0x01,

                OPFS_UNLINK_BEFORE_OPEN: 0x02,

                defaultUnlockAsap: false,
            });

            const opRun = (op, ...args) => {
                const opNdx = state.opIds[op] || toss("Invalid op ID:", op);
                state.s11n.serialize(...args);
                Atomics.store(state.sabOPView, state.opIds.rc, -1);
                Atomics.store(state.sabOPView, state.opIds.whichOp, opNdx);
                Atomics.notify(state.sabOPView, state.opIds.whichOp);
                const t = performance.now();
                while (
                    "not-equal" !==
                    Atomics.wait(state.sabOPView, state.opIds.rc, -1)
                ) {
                    // Intentionally empty - busy wait for atomic operation
                }

                const rc = Atomics.load(state.sabOPView, state.opIds.rc);
                metrics[op].wait += performance.now() - t;
                if (rc && state.asyncS11nExceptions) {
                    const err = state.s11n.deserialize();
                    if (err) error(op + "() async error:", ...err);
                }
                return rc;
            };

            opfsUtil.debug = {
                asyncShutdown: () => {
                    warn(
                        "Shutting down OPFS async listener. The OPFS VFS will no longer work."
                    );
                    opRun("opfs-async-shutdown");
                },
                asyncRestart: () => {
                    warn(
                        "Attempting to restart OPFS VFS async listener. Might work, might not."
                    );
                    W.postMessage({ type: "opfs-async-restart" });
                },
            };

            const initS11n = () => {
                if (state.s11n) return state.s11n;
                const textDecoder = new TextDecoder(),
                    textEncoder = new TextEncoder("utf-8"),
                    viewU8 = new Uint8Array(
                        state.sabIO,
                        state.sabS11nOffset,
                        state.sabS11nSize
                    ),
                    viewDV = new DataView(
                        state.sabIO,
                        state.sabS11nOffset,
                        state.sabS11nSize
                    );
                state.s11n = Object.create(null);

                const TypeIds = Object.create(null);
                TypeIds.number = {
                    id: 1,
                    size: 8,
                    getter: "getFloat64",
                    setter: "setFloat64",
                };
                TypeIds.bigint = {
                    id: 2,
                    size: 8,
                    getter: "getBigInt64",
                    setter: "setBigInt64",
                };
                TypeIds.boolean = {
                    id: 3,
                    size: 4,
                    getter: "getInt32",
                    setter: "setInt32",
                };
                TypeIds.string = { id: 4 };

                const getTypeId = (v) =>
                    TypeIds[typeof v] ||
                    toss(
                        "Maintenance required: this value type cannot be serialized.",
                        v
                    );
                const getTypeIdById = (tid) => {
                    switch (tid) {
                        case TypeIds.number.id:
                            return TypeIds.number;
                        case TypeIds.bigint.id:
                            return TypeIds.bigint;
                        case TypeIds.boolean.id:
                            return TypeIds.boolean;
                        case TypeIds.string.id:
                            return TypeIds.string;
                        default:
                            toss("Invalid type ID:", tid);
                    }
                };

                state.s11n.deserialize = function (clear = false) {
                    ++metrics.s11n.deserialize.count;
                    const t = performance.now();
                    const argc = viewU8[0];
                    const rc = argc ? [] : null;
                    if (argc) {
                        const typeIds = [];
                        let offset = 1,
                            i,
                            n,
                            v;
                        for (i = 0; i < argc; ++i, ++offset) {
                            typeIds.push(getTypeIdById(viewU8[offset]));
                        }
                        for (i = 0; i < argc; ++i) {
                            const t = typeIds[i];
                            if (t.getter) {
                                v = viewDV[t.getter](offset, state.littleEndian);
                                offset += t.size;
                            } else {
                                n = viewDV.getInt32(offset, state.littleEndian);
                                offset += 4;
                                v = textDecoder.decode(
                                    viewU8.slice(offset, offset + n)
                                );
                                offset += n;
                            }
                            rc.push(v);
                        }
                    }
                    if (clear) viewU8[0] = 0;

                    metrics.s11n.deserialize.time += performance.now() - t;
                    return rc;
                };

                state.s11n.serialize = function (...args) {
                    const t = performance.now();
                    ++metrics.s11n.serialize.count;
                    if (args.length) {
                        const typeIds = [];
                        let i = 0,
                            offset = 1;
                        viewU8[0] = args.length & 0xff;
                        for (; i < args.length; ++i, ++offset) {
                            typeIds.push(getTypeId(args[i]));
                            viewU8[offset] = typeIds[i].id;
                        }
                        for (i = 0; i < args.length; ++i) {
                            const t = typeIds[i];
                            if (t.setter) {
                                viewDV[t.setter](
                                    offset,
                                    args[i],
                                    state.littleEndian
                                );
                                offset += t.size;
                            } else {
                                const s = textEncoder.encode(args[i]);
                                viewDV.setInt32(
                                    offset,
                                    s.byteLength,
                                    state.littleEndian
                                );
                                offset += 4;
                                viewU8.set(s, offset);
                                offset += s.byteLength;
                            }
                        }
                    } else {
                        viewU8[0] = 0;
                    }
                    metrics.s11n.serialize.time += performance.now() - t;
                };
                return state.s11n;
            };

            const randomFilename = function f(len = 16) {
                if (!f._chars) {
                    f._chars =
                        "abcdefghijklmnopqrstuvwxyz" +
                        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                        "012346789";
                    f._n = f._chars.length;
                }
                const a = [];
                let i = 0;
                for (; i < len; ++i) {
                    const ndx = (Math.random() * (f._n * 64)) % f._n | 0;
                    a[i] = f._chars[ndx];
                }
                return a.join("");
            };

            const __openFiles = Object.create(null);

            const opTimer = Object.create(null);
            opTimer.op = undefined;
            opTimer.start = undefined;
            const mTimeStart = (op) => {
                opTimer.start = performance.now();
                opTimer.op = op;
                ++metrics[op].count;
            };
            const mTimeEnd = () =>
                (metrics[opTimer.op].time += performance.now() - opTimer.start);

            const ioSyncWrappers = {
                xCheckReservedLock: function (pFile, pOut) {
                    wasm.poke(pOut, 0, "i32");
                    return 0;
                },
                xClose: function (pFile) {
                    mTimeStart("xClose");
                    let rc = 0;
                    const f = __openFiles[pFile];
                    if (f) {
                        delete __openFiles[pFile];
                        rc = opRun("xClose", pFile);
                        if (f.sq3File) f.sq3File.dispose();
                    }
                    mTimeEnd();
                    return rc;
                },
                xDeviceCharacteristics: function (_pFile) {
                    return capi.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN;
                },
                xFileControl: function (_pFile, _opId, _pArg) {
                    return capi.SQLITE_NOTFOUND;
                },
                xFileSize: function (pFile, pSz64) {
                    mTimeStart("xFileSize");
                    let rc = opRun("xFileSize", pFile);
                    if (0 == rc) {
                        try {
                            const sz = state.s11n.deserialize()[0];
                            wasm.poke(pSz64, sz, "i64");
                        } catch (e) {
                            error(
                                "Unexpected error reading xFileSize() result:",
                                e
                            );
                            rc = state.sq3Codes.SQLITE_IOERR;
                        }
                    }
                    mTimeEnd();
                    return rc;
                },
                xLock: function (pFile, lockType) {
                    mTimeStart("xLock");
                    const f = __openFiles[pFile];
                    let rc = 0;

                    if (!f.lockType) {
                        rc = opRun("xLock", pFile, lockType);
                        if (0 === rc) f.lockType = lockType;
                    } else {
                        f.lockType = lockType;
                    }
                    mTimeEnd();
                    return rc;
                },
                xRead: function (pFile, pDest, n, offset64) {
                    mTimeStart("xRead");
                    const f = __openFiles[pFile];
                    let rc;
                    try {
                        rc = opRun("xRead", pFile, n, Number(offset64));
                        if (0 === rc || capi.SQLITE_IOERR_SHORT_READ === rc) {
                            wasm.heap8u().set(
                                f.sabView.subarray(0, n),
                                pDest
                            );
                        }
                    } catch (e) {
                        error("xRead(", arguments, ") failed:", e, f);
                        rc = capi.SQLITE_IOERR_READ;
                    }
                    mTimeEnd();
                    return rc;
                },
                xSync: function (pFile, flags) {
                    mTimeStart("xSync");
                    ++metrics.xSync.count;
                    const rc = opRun("xSync", pFile, flags);
                    mTimeEnd();
                    return rc;
                },
                xTruncate: function (pFile, sz64) {
                    mTimeStart("xTruncate");
                    const rc = opRun("xTruncate", pFile, Number(sz64));
                    mTimeEnd();
                    return rc;
                },
                xUnlock: function (pFile, lockType) {
                    mTimeStart("xUnlock");
                    const f = __openFiles[pFile];
                    let rc = 0;
                    if (capi.SQLITE_LOCK_NONE === lockType && f.lockType) {
                        rc = opRun("xUnlock", pFile, lockType);
                    }
                    if (0 === rc) f.lockType = lockType;
                    mTimeEnd();
                    return rc;
                },
                xWrite: function (pFile, pSrc, n, offset64) {
                    mTimeStart("xWrite");
                    const f = __openFiles[pFile];
                    let rc;
                    try {
                        f.sabView.set(
                            wasm.heap8u().subarray(pSrc, pSrc + n)
                        );
                        rc = opRun("xWrite", pFile, n, Number(offset64));
                    } catch (e) {
                        error("xWrite(", arguments, ") failed:", e, f);
                        rc = capi.SQLITE_IOERR_WRITE;
                    }
                    mTimeEnd();
                    return rc;
                },
            };

            const vfsSyncWrappers = {
                xAccess: function (pVfs, zName, flags, pOut) {
                    mTimeStart("xAccess");
                    const rc = opRun("xAccess", wasm.cstrToJs(zName));
                    wasm.poke(pOut, rc ? 0 : 1, "i32");
                    mTimeEnd();
                    return 0;
                },
                xCurrentTime: function (pVfs, pOut) {
                    wasm.poke(
                        pOut,
                        2440587.5 + new Date().getTime() / 86400000,
                        "double"
                    );
                    return 0;
                },
                xCurrentTimeInt64: function (pVfs, pOut) {
                    wasm.poke(
                        pOut,
                        2440587.5 * 86400000 + new Date().getTime(),
                        "i64"
                    );
                    return 0;
                },
                xDelete: function (pVfs, zName, doSyncDir) {
                    mTimeStart("xDelete");
                    const rc = opRun(
                        "xDelete",
                        wasm.cstrToJs(zName),
                        doSyncDir,
                        false
                    );
                    mTimeEnd();
                    return rc;
                },
                xFullPathname: function (pVfs, zName, nOut, pOut) {
                    const i = wasm.cstrncpy(pOut, zName, nOut);
                    return i < nOut ? 0 : capi.SQLITE_CANTOPEN;
                },
                xGetLastError: function (_pVfs, _nOut, _pOut) {
                    warn("OPFS xGetLastError() has nothing sensible to return.");
                    return 0;
                },

                xOpen: function f(pVfs, zName, pFile, flags, pOutFlags) {
                    mTimeStart("xOpen");
                    let opfsFlags = 0;
                    if (0 === zName) {
                        zName = randomFilename();
                    } else if (wasm.isPtr(zName)) {
                        if (
                            capi.sqlite3_uri_boolean(
                                zName,
                                "opfs-unlock-asap",
                                0
                            )
                        ) {
                            opfsFlags |= state.opfsFlags.OPFS_UNLOCK_ASAP;
                        }
                        if (
                            capi.sqlite3_uri_boolean(
                                zName,
                                "delete-before-open",
                                0
                            )
                        ) {
                            opfsFlags |=
                                state.opfsFlags.OPFS_UNLINK_BEFORE_OPEN;
                        }
                        zName = wasm.cstrToJs(zName);
                    }
                    const fh = Object.create(null);
                    fh.fid = pFile;
                    fh.filename = zName;
                    fh.sab = new SharedArrayBuffer(state.fileBufferSize);
                    fh.flags = flags;
                    fh.readOnly =
                        !(sqlite3.SQLITE_OPEN_CREATE & flags) &&
                        !!(flags & capi.SQLITE_OPEN_READONLY);
                    const rc = opRun(
                        "xOpen",
                        pFile,
                        zName,
                        flags,
                        opfsFlags
                    );
                    if (!rc) {
                        if (fh.readOnly) {
                            wasm.poke(
                                pOutFlags,
                                capi.SQLITE_OPEN_READONLY,
                                "i32"
                            );
                        }
                        __openFiles[pFile] = fh;
                        fh.sabView = state.sabFileBufView;
                        fh.sq3File = new sqlite3_file(pFile);
                        fh.sq3File.$pMethods = opfsIoMethods.pointer;
                        fh.lockType = capi.SQLITE_LOCK_NONE;
                    }
                    mTimeEnd();
                    return rc;
                },
            };

            if (dVfs) {
                opfsVfs.$xRandomness = dVfs.$xRandomness;
                opfsVfs.$xSleep = dVfs.$xSleep;
            }
            if (!opfsVfs.$xRandomness) {
                vfsSyncWrappers.xRandomness = function (pVfs, nOut, pOut) {
                    const heap = wasm.heap8u();
                    let i = 0;
                    for (; i < nOut; ++i)
                        heap[pOut + i] = (Math.random() * 255000) & 0xff;
                    return i;
                };
            }
            if (!opfsVfs.$xSleep) {
                vfsSyncWrappers.xSleep = function (pVfs, ms) {
                    Atomics.wait(state.sabOPView, state.opIds.xSleep, 0, ms);
                    return 0;
                };
            }

            opfsUtil.getResolvedPath = function (filename, splitIt) {
                const p = new URL(filename, "file://irrelevant").pathname;
                return splitIt ? p.split("/").filter((v) => !!v) : p;
            };

            opfsUtil.getDirForFilename = async function f(
                absFilename,
                createDirs = false
            ) {
                const path = opfsUtil.getResolvedPath(absFilename, true);
                const filename = path.pop();
                let dh = opfsUtil.rootDirectory;
                for (const dirName of path) {
                    if (dirName) {
                        dh = await dh.getDirectoryHandle(dirName, {
                            create: !!createDirs,
                        });
                    }
                }
                return [dh, filename];
            };

            opfsUtil.mkdir = async function (absDirName) {
                try {
                    await opfsUtil.getDirForFilename(
                        absDirName + "/filepart",
                        true
                    );
                    return true;
                } catch (_e) {
                    return false;
                }
            };

            opfsUtil.entryExists = async function (fsEntryName) {
                try {
                    const [dh, fn] = await opfsUtil.getDirForFilename(
                        fsEntryName
                    );
                    await dh.getFileHandle(fn);
                    return true;
                } catch (_e) {
                    return false;
                }
            };

            opfsUtil.randomFilename = randomFilename;

            opfsUtil.treeList = async function () {
                const doDir = async function callee(dirHandle, tgt) {
                    tgt.name = dirHandle.name;
                    tgt.dirs = [];
                    tgt.files = [];
                    for await (const handle of dirHandle.values()) {
                        if ("directory" === handle.kind) {
                            const subDir = Object.create(null);
                            tgt.dirs.push(subDir);
                            await callee(handle, subDir);
                        } else {
                            tgt.files.push(handle.name);
                        }
                    }
                };
                const root = Object.create(null);
                await doDir(opfsUtil.rootDirectory, root);
                return root;
            };

            opfsUtil.rmfr = async function () {
                const dir = opfsUtil.rootDirectory,
                    opt = { recurse: true };
                for await (const handle of dir.values()) {
                    dir.removeEntry(handle.name, opt);
                }
            };

            opfsUtil.unlink = async function (
                fsEntryName,
                recursive = false,
                throwOnError = false
            ) {
                try {
                    const [hDir, filenamePart] =
                        await opfsUtil.getDirForFilename(
                            fsEntryName,
                            false
                        );
                    await hDir.removeEntry(filenamePart, {
                        recursive,
                    });
                    return true;
                } catch (e) {
                    if (throwOnError) {
                        throw new Error(
                            "unlink(",
                            arguments[0],
                            ") failed: " + e.message,
                            {
                                cause: e,
                            }
                        );
                    }
                    return false;
                }
            };

            opfsUtil.traverse = async function (opt) {
                const defaultOpt = {
                    recursive: true,
                    directory: opfsUtil.rootDirectory,
                };
                if ("function" === typeof opt) {
                    opt = { callback: opt };
                }
                opt = Object.assign(defaultOpt, opt || {});
                const doDir = async function callee(dirHandle, depth) {
                    for await (const handle of dirHandle.values()) {
                        if (
                            false === opt.callback(handle, dirHandle, depth)
                        )
                            return false;
                        else if (
                            opt.recursive &&
                            "directory" === handle.kind
                        ) {
                            if (false === (await callee(handle, depth + 1)))
                                break;
                        }
                    }
                };
                doDir(opt.directory, 0);
            };

            const importDbChunked = async function (filename, callback) {
                const [hDir, fnamePart] = await opfsUtil.getDirForFilename(
                    filename,
                    true
                );
                const hFile = await hDir.getFileHandle(fnamePart, {
                    create: true,
                });
                let sah = await hFile.createSyncAccessHandle();
                let nWrote = 0,
                    chunk,
                    checkedHeader = false;
                try {
                    sah.truncate(0);
                    while (undefined !== (chunk = await callback())) {
                        if (chunk instanceof ArrayBuffer)
                            chunk = new Uint8Array(chunk);
                        if (0 === nWrote && chunk.byteLength >= 15) {
                            util.affirmDbHeader(chunk);
                            checkedHeader = true;
                        }
                        sah.write(chunk, { at: nWrote });
                        nWrote += chunk.byteLength;
                    }
                    if (nWrote < 512 || 0 !== nWrote % 512) {
                        toss(
                            "Input size",
                            nWrote,
                            "is not correct for an SQLite database."
                        );
                    }
                    if (!checkedHeader) {
                        const header = new Uint8Array(20);
                        sah.read(header, { at: 0 });
                        util.affirmDbHeader(header);
                    }
                    sah.write(new Uint8Array([1, 1]), { at: 18 });
                    return nWrote;
                } catch (e) {
                    await sah.close();
                    sah = undefined;
                    await hDir.removeEntry(fnamePart).catch(() => {});
                    throw e;
                } finally {
                    if (sah) await sah.close();
                }
            };

            opfsUtil.importDb = async function (filename, bytes) {
                if (bytes instanceof Function) {
                    return importDbChunked(filename, bytes);
                }
                if (bytes instanceof ArrayBuffer)
                    bytes = new Uint8Array(bytes);
                util.affirmIsDb(bytes);
                const n = bytes.byteLength;
                const [hDir, fnamePart] = await opfsUtil.getDirForFilename(
                    filename,
                    true
                );
                let sah,
                    nWrote = 0;
                try {
                    const hFile = await hDir.getFileHandle(fnamePart, {
                        create: true,
                    });
                    sah = await hFile.createSyncAccessHandle();
                    sah.truncate(0);
                    nWrote = sah.write(bytes, { at: 0 });
                    if (nWrote != n) {
                        toss(
                            "Expected to write " + n + " bytes but wrote " + nWrote + "."
                        );
                    }
                    sah.write(new Uint8Array([1, 1]), { at: 18 });
                    return nWrote;
                } catch (e) {
                    if (sah) {
                        await sah.close();
                        sah = undefined;
                    }
                    await hDir.removeEntry(fnamePart).catch(() => {});
                    throw e;
                } finally {
                    if (sah) await sah.close();
                }
            };

            if (sqlite3.oo1) {
                const OpfsDb = function (...args) {
                    const opt = sqlite3.oo1.DB.dbCtorHelper.normalizeArgs(
                        ...args
                    );
                    opt.vfs = opfsVfs.$zName;
                    sqlite3.oo1.DB.dbCtorHelper.call(this, opt);
                };
                OpfsDb.prototype = Object.create(sqlite3.oo1.DB.prototype);
                sqlite3.oo1.OpfsDb = OpfsDb;
                OpfsDb.importDb = opfsUtil.importDb;
                sqlite3.oo1.DB.dbCtorHelper.setVfsPostOpenCallback(
                    opfsVfs.pointer,
                    function (oo1Db, sqlite3) {
                        sqlite3.capi.sqlite3_busy_timeout(oo1Db, 10000);
                    }
                );
            }

            const sanityCheck = function () {
                const scope = wasm.scopedAllocPush();
                const sq3File = new sqlite3_file();
                try {
                    const fid = sq3File.pointer;
                    const openFlags =
                        capi.SQLITE_OPEN_CREATE |
                        capi.SQLITE_OPEN_READWRITE |
                        capi.SQLITE_OPEN_MAIN_DB;
                    const pOut = wasm.scopedAlloc(8);
                    const dbFile = "/sanity/check/file" + randomFilename(8);
                    const zDbFile = wasm.scopedAllocCString(dbFile);
                    let rc;
                    state.s11n.serialize("This is ä string.");
                    rc = state.s11n.deserialize();
                    log("deserialize() says:", rc);
                    if ("This is ä string." !== rc[0])
                        toss("String d13n error.");
                    vfsSyncWrappers.xAccess(
                        opfsVfs.pointer,
                        zDbFile,
                        0,
                        pOut
                    );
                    rc = wasm.peek(pOut, "i32");
                    log("xAccess(", dbFile, ") exists ?=", rc);
                    rc = vfsSyncWrappers.xOpen(
                        opfsVfs.pointer,
                        zDbFile,
                        fid,
                        openFlags,
                        pOut
                    );
                    log(
                        "open rc =",
                        rc,
                        "state.sabOPView[xOpen] =",
                        state.sabOPView[state.opIds.xOpen]
                    );
                    if (0 !== rc) {
                        error("open failed with code", rc);
                        return;
                    }
                    vfsSyncWrappers.xAccess(
                        opfsVfs.pointer,
                        zDbFile,
                        0,
                        pOut
                    );
                    rc = wasm.peek(pOut, "i32");
                    if (!rc) toss("xAccess() failed to detect file.");
                    rc = ioSyncWrappers.xSync(sq3File.pointer, 0);
                    if (rc) toss("sync failed w/ rc", rc);
                    rc = ioSyncWrappers.xTruncate(sq3File.pointer, 1024);
                    if (rc) toss("truncate failed w/ rc", rc);
                    wasm.poke(pOut, 0, "i64");
                    rc = ioSyncWrappers.xFileSize(sq3File.pointer, pOut);
                    if (rc) toss("xFileSize failed w/ rc", rc);
                    log("xFileSize says:", wasm.peek(pOut, "i64"));
                    rc = ioSyncWrappers.xWrite(sq3File.pointer, zDbFile, 10, 1);
                    if (rc) toss("xWrite() failed!");
                    const readBuf = wasm.scopedAlloc(16);
                    rc = ioSyncWrappers.xRead(sq3File.pointer, readBuf, 6, 2);
                    wasm.poke(readBuf + 6, 0);
                    let jRead = wasm.cstrToJs(readBuf);
                    log("xRead() got:", jRead);
                    if ("sanity" !== jRead) toss("Unexpected xRead() value.");
                    if (vfsSyncWrappers.xSleep) {
                        log("xSleep()ing before close()ing...");
                        vfsSyncWrappers.xSleep(opfsVfs.pointer, 2000);
                        log("waking up from xSleep()");
                    }
                    rc = ioSyncWrappers.xClose(fid);
                    log("xClose rc =", rc, "sabOPView =", state.sabOPView);
                    log("Deleting file:", dbFile);
                    vfsSyncWrappers.xDelete(opfsVfs.pointer, zDbFile, 0x1234);
                    vfsSyncWrappers.xAccess(
                        opfsVfs.pointer,
                        zDbFile,
                        0,
                        pOut
                    );
                    rc = wasm.peek(pOut, "i32");
                    if (rc)
                        toss(
                            "Expecting 0 from xAccess(",
                            dbFile,
                            ") after xDelete()."
                        );
                    warn("End of OPFS sanity checks.");
                } finally {
                    sq3File.dispose();
                    wasm.scopedAllocPop(scope);
                }
            };

            W.onmessage = function ({ data }) {
                switch (data.type) {
                    case "opfs-unavailable":
                        promiseReject(new Error(data.payload.join(" ")));
                        break;
                    case "opfs-async-loaded":
                        W.postMessage({
                            type: "opfs-async-init",
                            args: state,
                        });
                        break;
                    case "opfs-async-inited": {
                        if (true === promiseWasRejected) {
                            break;
                        }
                        try {
                            sqlite3.vfs.installVfs({
                                io: {
                                    struct: opfsIoMethods,
                                    methods: ioSyncWrappers,
                                },
                                vfs: {
                                    struct: opfsVfs,
                                    methods: vfsSyncWrappers,
                                },
                            });
                            state.sabOPView = new Int32Array(state.sabOP);
                            state.sabFileBufView = new Uint8Array(
                                state.sabIO,
                                0,
                                state.fileBufferSize
                            );
                            state.sabS11nView = new Uint8Array(
                                state.sabIO,
                                state.sabS11nOffset,
                                state.sabS11nSize
                            );
                            initS11n();
                            if (options.sanityChecks) {
                                warn(
                                    "Running sanity checks because of opfs-sanity-check URL arg..."
                                );
                                sanityCheck();
                            }
                            if (thisThreadHasOPFS()) {
                                navigator.storage
                                    .getDirectory()
                                    .then((d) => {
                                        W.onerror = W._originalOnError;
                                        delete W._originalOnError;
                                        sqlite3.opfs = opfsUtil;
                                        opfsUtil.rootDirectory = d;
                                        log(
                                            "End of OPFS sqlite3_vfs setup.",
                                            opfsVfs
                                        );
                                        promiseResolve();
                                    })
                                    .catch(promiseReject);
                            } else {
                                promiseResolve();
                            }
                        } catch (e) {
                            error(e);
                            promiseReject(e);
                        }
                        break;
                    }
                    default: {
                        const errMsg =
                            "Unexpected message from the OPFS async worker: " +
                            JSON.stringify(data);
                        error(errMsg);
                        promiseReject(new Error(errMsg));
                        break;
                    }
                }
            };
        });
        return thePromise;
    };

    installOpfsVfs.defaultProxyUri = "sqlite3-opfs-async-proxy.js";

    const installOpfsVfsInitializer = async (sqlite3Ref) => {
        try {
            let proxyJs = installOpfsVfs.defaultProxyUri;
            if (sqlite3Ref.scriptInfo.sqlite3Dir) {
                installOpfsVfs.defaultProxyUri =
                    sqlite3Ref.scriptInfo.sqlite3Dir + proxyJs;
            }
            return installOpfsVfs().catch((e) => {
                sqlite3Ref.config.warn(
                    "Ignoring inability to install OPFS sqlite3_vfs:",
                    e.message
                );
            });
        } catch (e) {
            sqlite3Ref.config.error("installOpfsVfs() exception:", e);
            return Promise.reject(e);
        }
    };

    return { installOpfsVfs, installOpfsVfsInitializer };
}
