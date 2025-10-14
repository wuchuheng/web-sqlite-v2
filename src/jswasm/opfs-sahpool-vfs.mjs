export function createOpfsSahpoolInitializer() {
    return function initializeOpfsSahpool(sqlite3) {
        "use strict";
        const toss = sqlite3.util.toss;
        const toss3 = sqlite3.util.toss3;
        const initPromises = Object.create(null);
        const capi = sqlite3.capi;
        const util = sqlite3.util;
        const wasm = sqlite3.wasm;

        const SECTOR_SIZE = 4096;
        const HEADER_MAX_PATH_SIZE = 512;
        const HEADER_FLAGS_SIZE = 4;
        const HEADER_DIGEST_SIZE = 8;
        const HEADER_CORPUS_SIZE = HEADER_MAX_PATH_SIZE + HEADER_FLAGS_SIZE;
        const HEADER_OFFSET_FLAGS = HEADER_MAX_PATH_SIZE;
        const HEADER_OFFSET_DIGEST = HEADER_CORPUS_SIZE;
        const HEADER_OFFSET_DATA = SECTOR_SIZE;

        const PERSISTENT_FILE_TYPES =
            capi.SQLITE_OPEN_MAIN_DB |
            capi.SQLITE_OPEN_MAIN_JOURNAL |
            capi.SQLITE_OPEN_SUPER_JOURNAL |
            capi.SQLITE_OPEN_WAL;
        const FLAG_COMPUTE_DIGEST_V2 = capi.SQLITE_OPEN_MEMORY;
        const OPAQUE_DIR_NAME = ".opaque";

        const getRandomName = () => Math.random().toString(36).slice(2);

        const textDecoder = new TextDecoder();
        const textEncoder = new TextEncoder();

        const optionDefaults = Object.assign(Object.create(null), {
            name: "opfs-sahpool",
            directory: undefined,
            initialCapacity: 6,
            clearOnInit: false,

            verbosity: 2,
            forceReinitIfPreviouslyFailed: false,
        });

        const loggers = [
            sqlite3.config.error,
            sqlite3.config.warn,
            sqlite3.config.log,
        ];
        const warn = sqlite3.config.warn;

        const __mapVfsToPool = new Map();
        const getPoolForVfs = (pVfs) => __mapVfsToPool.get(pVfs);
        const setPoolForVfs = (pVfs, pool) => {
            if (pool) __mapVfsToPool.set(pVfs, pool);
            else __mapVfsToPool.delete(pVfs);
        };

        const __mapSqlite3File = new Map();
        const getPoolForPFile = (pFile) => __mapSqlite3File.get(pFile);
        const setPoolForPFile = (pFile, pool) => {
            if (pool) __mapSqlite3File.set(pFile, pool);
            else __mapSqlite3File.delete(pFile);
        };

        const ioMethods = {
            xCheckReservedLock: function (pFile, pOut) {
                const pool = getPoolForPFile(pFile);
                pool.log("xCheckReservedLock");
                pool.storeErr();
                wasm.poke32(pOut, 1);
                return 0;
            },
            xClose: function (pFile) {
                const pool = getPoolForPFile(pFile);
                pool.storeErr();
                const file = pool.getOFileForS3File(pFile);
                if (file) {
                    try {
                        pool.log(`xClose ${file.path}`);
                        pool.mapS3FileToOFile(pFile, false);
                        file.sah.flush();
                        if (file.flags & capi.SQLITE_OPEN_DELETEONCLOSE) {
                            pool.deletePath(file.path);
                        }
                    } catch (e) {
                        return pool.storeErr(e, capi.SQLITE_IOERR);
                    }
                }
                return 0;
            },
            xDeviceCharacteristics: function (_pFile) {
                return capi.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN;
            },
            xFileControl: function (_pFile, _opId, _pArg) {
                return capi.SQLITE_NOTFOUND;
            },
            xFileSize: function (pFile, pSz64) {
                const pool = getPoolForPFile(pFile);
                pool.log(`xFileSize`);
                const file = pool.getOFileForS3File(pFile);
                const size = file.sah.getSize() - HEADER_OFFSET_DATA;

                wasm.poke64(pSz64, BigInt(size));
                return 0;
            },
            xLock: function (pFile, lockType) {
                const pool = getPoolForPFile(pFile);
                pool.log(`xLock ${lockType}`);
                pool.storeErr();
                const file = pool.getOFileForS3File(pFile);
                file.lockType = lockType;
                return 0;
            },
            xRead: function (pFile, pDest, n, offset64) {
                const pool = getPoolForPFile(pFile);
                pool.storeErr();
                const file = pool.getOFileForS3File(pFile);
                pool.log(`xRead ${file.path} ${n} @ ${offset64}`);
                try {
                    const nRead = file.sah.read(
                        wasm.heap8u().subarray(pDest, pDest + n),
                        { at: HEADER_OFFSET_DATA + Number(offset64) }
                    );
                    if (nRead < n) {
                        wasm.heap8u().fill(0, pDest + nRead, pDest + n);
                        return capi.SQLITE_IOERR_SHORT_READ;
                    }
                    return 0;
                } catch (e) {
                    return pool.storeErr(e, capi.SQLITE_IOERR);
                }
            },
            xSectorSize: function (_pFile) {
                return SECTOR_SIZE;
            },
            xSync: function (pFile, flags) {
                const pool = getPoolForPFile(pFile);
                pool.log(`xSync ${flags}`);
                pool.storeErr();
                const file = pool.getOFileForS3File(pFile);

                try {
                    file.sah.flush();
                    return 0;
                } catch (e) {
                    return pool.storeErr(e, capi.SQLITE_IOERR);
                }
            },
            xTruncate: function (pFile, sz64) {
                const pool = getPoolForPFile(pFile);
                pool.log(`xTruncate ${sz64}`);
                pool.storeErr();
                const file = pool.getOFileForS3File(pFile);

                try {
                    file.sah.truncate(HEADER_OFFSET_DATA + Number(sz64));
                    return 0;
                } catch (e) {
                    return pool.storeErr(e, capi.SQLITE_IOERR);
                }
            },
            xUnlock: function (pFile, lockType) {
                const pool = getPoolForPFile(pFile);
                pool.log("xUnlock");
                const file = pool.getOFileForS3File(pFile);
                file.lockType = lockType;
                return 0;
            },
            xWrite: function (pFile, pSrc, n, offset64) {
                const pool = getPoolForPFile(pFile);
                pool.storeErr();
                const file = pool.getOFileForS3File(pFile);
                pool.log(`xWrite ${file.path} ${n} ${offset64}`);
                try {
                    const nBytes = file.sah.write(
                        wasm.heap8u().subarray(pSrc, pSrc + n),
                        { at: HEADER_OFFSET_DATA + Number(offset64) }
                    );
                    return n === nBytes ? 0 : toss("Unknown write() failure.");
                } catch (e) {
                    return pool.storeErr(e, capi.SQLITE_IOERR);
                }
            },
        };

        const opfsIoMethods = new capi.sqlite3_io_methods();
        opfsIoMethods.$iVersion = 1;
        sqlite3.vfs.installVfs({
            io: { struct: opfsIoMethods, methods: ioMethods },
        });

        const vfsMethods = {
            xAccess: function (pVfs, zName, flags, pOut) {
                const pool = getPoolForVfs(pVfs);
                pool.storeErr();
                try {
                    const name = pool.getPath(zName);
                    wasm.poke32(pOut, pool.hasFilename(name) ? 1 : 0);
                } catch (_e) {
                    wasm.poke32(pOut, 0);
                }
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
            xDelete: function (pVfs, zName, _doSyncDir) {
                const pool = getPoolForVfs(pVfs);
                pool.log(`xDelete ${wasm.cstrToJs(zName)}`);
                pool.storeErr();
                try {
                    pool.deletePath(pool.getPath(zName));
                    return 0;
                } catch (e) {
                    pool.storeErr(e);
                    return capi.SQLITE_IOERR_DELETE;
                }
            },
            xFullPathname: function (pVfs, zName, nOut, pOut) {
                const i = wasm.cstrncpy(pOut, zName, nOut);
                return i < nOut ? 0 : capi.SQLITE_CANTOPEN;
            },
            xGetLastError: function (pVfs, nOut, pOut) {
                const pool = getPoolForVfs(pVfs);
                const e = pool.popErr();
                pool.log(`xGetLastError ${nOut} e =`, e);
                if (e) {
                    const scope = wasm.scopedAllocPush();
                    try {
                        const [cMsg, n] = wasm.scopedAllocCString(
                            e.message,
                            true
                        );
                        wasm.cstrncpy(pOut, cMsg, nOut);
                        if (n > nOut) wasm.poke8(pOut + nOut - 1, 0);
                    } catch (_e) {
                        return capi.SQLITE_NOMEM;
                    } finally {
                        wasm.scopedAllocPop(scope);
                    }
                }
                return e ? e.sqlite3Rc || capi.SQLITE_IOERR : 0;
            },

            xOpen: function f(pVfs, zName, pFile, flags, pOutFlags) {
                const pool = getPoolForVfs(pVfs);
                try {
                    flags &= ~FLAG_COMPUTE_DIGEST_V2;
                    pool.log(`xOpen ${wasm.cstrToJs(zName)} ${flags}`);

                    const path =
                        zName && wasm.peek8(zName)
                            ? pool.getPath(zName)
                            : getRandomName();
                    let sah = pool.getSAHForPath(path);
                    if (!sah && flags & capi.SQLITE_OPEN_CREATE) {
                        if (pool.getFileCount() < pool.getCapacity()) {
                            sah = pool.nextAvailableSAH();
                            pool.setAssociatedPath(sah, path, flags);
                        } else {
                            toss("SAH pool is full. Cannot create file", path);
                        }
                    }
                    if (!sah) {
                        toss("file not found:", path);
                    }

                    const file = { path, flags, sah };
                    pool.mapS3FileToOFile(pFile, file);
                    file.lockType = capi.SQLITE_LOCK_NONE;
                    const sq3File = new capi.sqlite3_file(pFile);
                    sq3File.$pMethods = opfsIoMethods.pointer;
                    sq3File.dispose();
                    wasm.poke32(pOutFlags, flags);
                    return 0;
                } catch (e) {
                    pool.storeErr(e);
                    return capi.SQLITE_CANTOPEN;
                }
            },
        };

        const createOpfsVfs = function (vfsName) {
            if (sqlite3.capi.sqlite3_vfs_find(vfsName)) {
                toss3("VFS name is already registered:", vfsName);
            }
            const opfsVfs = new capi.sqlite3_vfs();

            const pDVfs = capi.sqlite3_vfs_find(null);
            const dVfs = pDVfs ? new capi.sqlite3_vfs(pDVfs) : null;
            opfsVfs.$iVersion = 2;
            opfsVfs.$szOsFile = capi.sqlite3_file.structInfo.sizeof;
            opfsVfs.$mxPathname = HEADER_MAX_PATH_SIZE;
            opfsVfs.addOnDispose(
                (opfsVfs.$zName = wasm.allocCString(vfsName)),
                () => setPoolForVfs(opfsVfs.pointer, 0)
            );

            if (dVfs) {
                opfsVfs.$xRandomness = dVfs.$xRandomness;
                opfsVfs.$xSleep = dVfs.$xSleep;
                dVfs.dispose();
            }
            if (!opfsVfs.$xRandomness && !vfsMethods.xRandomness) {
                vfsMethods.xRandomness = function (pVfs, nOut, pOut) {
                    const heap = wasm.heap8u();
                    let i = 0;
                    for (; i < nOut; ++i)
                        heap[pOut + i] = (Math.random() * 255000) & 0xff;
                    return i;
                };
            }
            if (!opfsVfs.$xSleep && !vfsMethods.xSleep) {
                vfsMethods.xSleep = (_pVfs, _ms) => 0;
            }
            sqlite3.vfs.installVfs({
                vfs: { struct: opfsVfs, methods: vfsMethods },
            });
            return opfsVfs;
        };

        class OpfsSAHPool {
            vfsDir;

            #dhVfsRoot;

            #dhOpaque;

            #dhVfsParent;

            #mapSAHToName = new Map();

            #mapFilenameToSAH = new Map();

            #availableSAH = new Set();

            #mapS3FileToOFile_ = new Map();

            #apBody = new Uint8Array(HEADER_CORPUS_SIZE);

            #dvBody;

            #cVfs;

            #verbosity;

            constructor(options = Object.create(null)) {
                this.#verbosity = options.verbosity ?? optionDefaults.verbosity;
                this.vfsName = options.name || optionDefaults.name;
                this.#cVfs = createOpfsVfs(this.vfsName);
                setPoolForVfs(this.#cVfs.pointer, this);
                this.vfsDir = options.directory || "." + this.vfsName;
                this.#dvBody = new DataView(
                    this.#apBody.buffer,
                    this.#apBody.byteOffset
                );
                this.isReady = this.reset(
                    !!(options.clearOnInit ?? optionDefaults.clearOnInit)
                ).then(() => {
                    if (this.$error) throw this.$error;
                    return this.getCapacity()
                        ? Promise.resolve(undefined)
                        : this.addCapacity(
                              options.initialCapacity ||
                                  optionDefaults.initialCapacity
                          );
                });
            }

            #logImpl(level, ...args) {
                if (this.#verbosity > level)
                    loggers[level](this.vfsName + ":", ...args);
            }
            log(...args) {
                this.#logImpl(2, ...args);
            }
            warn(...args) {
                this.#logImpl(1, ...args);
            }
            error(...args) {
                this.#logImpl(0, ...args);
            }

            getVfs() {
                return this.#cVfs;
            }

            getCapacity() {
                return this.#mapSAHToName.size;
            }

            getFileCount() {
                return this.#mapFilenameToSAH.size;
            }

            getFileNames() {
                const rc = [];
                for (const n of this.#mapFilenameToSAH.keys()) rc.push(n);
                return rc;
            }

            async addCapacity(n) {
                for (let i = 0; i < n; ++i) {
                    const name = getRandomName();
                    const h = await this.#dhOpaque.getFileHandle(name, {
                        create: true,
                    });
                    const ah = await h.createSyncAccessHandle();
                    this.#mapSAHToName.set(ah, name);
                    this.setAssociatedPath(ah, "", 0);
                }
                return this.getCapacity();
            }

            async reduceCapacity(n) {
                let nRm = 0;
                for (const ah of Array.from(this.#availableSAH)) {
                    if (
                        nRm === n ||
                        this.getFileCount() === this.getCapacity()
                    ) {
                        break;
                    }
                    const name = this.#mapSAHToName.get(ah);

                    ah.close();
                    await this.#dhOpaque.removeEntry(name);
                    this.#mapSAHToName.delete(ah);
                    this.#availableSAH.delete(ah);
                    ++nRm;
                }
                return nRm;
            }

            releaseAccessHandles() {
                for (const ah of this.#mapSAHToName.keys()) ah.close();
                this.#mapSAHToName.clear();
                this.#mapFilenameToSAH.clear();
                this.#availableSAH.clear();
            }

            async acquireAccessHandles(clearFiles = false) {
                const files = [];
                for await (const [name, h] of this.#dhOpaque) {
                    if ("file" === h.kind) {
                        files.push([name, h]);
                    }
                }
                return Promise.all(
                    files.map(async ([name, h]) => {
                        try {
                            const ah = await h.createSyncAccessHandle();
                            this.#mapSAHToName.set(ah, name);
                            if (clearFiles) {
                                ah.truncate(HEADER_OFFSET_DATA);
                                this.setAssociatedPath(ah, "", 0);
                            } else {
                                const path = this.getAssociatedPath(ah);
                                if (path) {
                                    this.#mapFilenameToSAH.set(path, ah);
                                } else {
                                    this.#availableSAH.add(ah);
                                }
                            }
                        } catch (e) {
                            this.storeErr(e);
                            this.releaseAccessHandles();
                            throw e;
                        }
                    })
                );
            }

            getAssociatedPath(sah) {
                sah.read(this.#apBody, { at: 0 });

                const flags = this.#dvBody.getUint32(HEADER_OFFSET_FLAGS);
                if (
                    this.#apBody[0] &&
                    (flags & capi.SQLITE_OPEN_DELETEONCLOSE ||
                        (flags & PERSISTENT_FILE_TYPES) === 0)
                ) {
                    warn(
                        `Removing file with unexpected flags ${flags.toString(
                            16
                        )}`,
                        this.#apBody
                    );
                    this.setAssociatedPath(sah, "", 0);
                    return "";
                }

                const fileDigest = new Uint32Array(HEADER_DIGEST_SIZE / 4);
                sah.read(fileDigest, { at: HEADER_OFFSET_DIGEST });
                const compDigest = this.computeDigest(this.#apBody, flags);

                if (fileDigest.every((v, i) => v === compDigest[i])) {
                    const pathBytes = this.#apBody.findIndex((v) => 0 === v);
                    if (0 === pathBytes) {
                        sah.truncate(HEADER_OFFSET_DATA);
                    }

                    return pathBytes
                        ? textDecoder.decode(
                              this.#apBody.subarray(0, pathBytes)
                          )
                        : "";
                } else {
                    warn("Disassociating file with bad digest.");
                    this.setAssociatedPath(sah, "", 0);
                    return "";
                }
            }

            setAssociatedPath(sah, path, flags) {
                const enc = textEncoder.encodeInto(path, this.#apBody);
                if (HEADER_MAX_PATH_SIZE <= enc.written + 1) {
                    toss("Path too long:", path);
                }
                if (path && flags) {
                    flags |= FLAG_COMPUTE_DIGEST_V2;
                }
                this.#apBody.fill(0, enc.written, HEADER_MAX_PATH_SIZE);
                this.#dvBody.setUint32(HEADER_OFFSET_FLAGS, flags);
                const digest = this.computeDigest(this.#apBody, flags);

                sah.write(this.#apBody, { at: 0 });
                sah.write(digest, { at: HEADER_OFFSET_DIGEST });
                sah.flush();

                if (path) {
                    this.#mapFilenameToSAH.set(path, sah);
                    this.#availableSAH.delete(sah);
                } else {
                    sah.truncate(HEADER_OFFSET_DATA);
                    this.#availableSAH.add(sah);
                }
            }

            computeDigest(byteArray, fileFlags) {
                if (fileFlags & FLAG_COMPUTE_DIGEST_V2) {
                    let h1 = 0xdeadbeef;
                    let h2 = 0x41c6ce57;
                    for (const v of byteArray) {
                        h1 = Math.imul(h1 ^ v, 2654435761);
                        h2 = Math.imul(h2 ^ v, 104729);
                    }
                    return new Uint32Array([h1 >>> 0, h2 >>> 0]);
                } else {
                    return new Uint32Array([0, 0]);
                }
            }

            async reset(clearFiles) {
                await this.isReady;
                let h = await navigator.storage.getDirectory();
                let prev;
                for (const d of this.vfsDir.split("/")) {
                    if (d) {
                        prev = h;
                        h = await h.getDirectoryHandle(d, {
                            create: true,
                        });
                    }
                }
                this.#dhVfsRoot = h;
                this.#dhVfsParent = prev;
                this.#dhOpaque = await this.#dhVfsRoot.getDirectoryHandle(
                    OPAQUE_DIR_NAME,
                    { create: true }
                );
                this.releaseAccessHandles();
                return this.acquireAccessHandles(clearFiles);
            }

            getPath(arg) {
                if (wasm.isPtr(arg)) arg = wasm.cstrToJs(arg);
                return (
                    arg instanceof URL ? arg : new URL(arg, "file://localhost/")
                ).pathname;
            }

            deletePath(path) {
                const sah = this.#mapFilenameToSAH.get(path);
                if (sah) {
                    this.#mapFilenameToSAH.delete(path);
                    this.setAssociatedPath(sah, "", 0);
                }
                return !!sah;
            }

            storeErr(e, code) {
                if (e) {
                    e.sqlite3Rc = code || capi.SQLITE_IOERR;
                    this.error(e);
                }
                this.$error = e;
                return code;
            }

            popErr() {
                const rc = this.$error;
                this.$error = undefined;
                return rc;
            }

            nextAvailableSAH() {
                const [rc] = this.#availableSAH.keys();
                return rc;
            }

            getOFileForS3File(pFile) {
                return this.#mapS3FileToOFile_.get(pFile);
            }

            mapS3FileToOFile(pFile, file) {
                if (file) {
                    this.#mapS3FileToOFile_.set(pFile, file);
                    setPoolForPFile(pFile, this);
                } else {
                    this.#mapS3FileToOFile_.delete(pFile);
                    setPoolForPFile(pFile, false);
                }
            }

            hasFilename(name) {
                return this.#mapFilenameToSAH.has(name);
            }

            getSAHForPath(path) {
                return this.#mapFilenameToSAH.get(path);
            }

            async removeVfs() {
                if (!this.#cVfs.pointer || !this.#dhOpaque) return false;
                capi.sqlite3_vfs_unregister(this.#cVfs.pointer);
                this.#cVfs.dispose();
                delete initPromises[this.vfsName];
                try {
                    this.releaseAccessHandles();
                    await this.#dhVfsRoot.removeEntry(OPAQUE_DIR_NAME, {
                        recursive: true,
                    });
                    this.#dhOpaque = undefined;
                    await this.#dhVfsParent.removeEntry(this.#dhVfsRoot.name, {
                        recursive: true,
                    });
                    this.#dhVfsRoot = this.#dhVfsParent = undefined;
                } catch (e) {
                    sqlite3.config.error(
                        this.vfsName,
                        "removeVfs() failed with no recovery strategy:",
                        e
                    );
                }
                return true;
            }

            pauseVfs() {
                if (this.#mapS3FileToOFile_.size > 0) {
                    sqlite3.SQLite3Error.toss(
                        capi.SQLITE_MISUSE,
                        "Cannot pause VFS",
                        this.vfsName,
                        "because it has opened files."
                    );
                }
                if (this.#mapSAHToName.size > 0) {
                    capi.sqlite3_vfs_unregister(this.vfsName);
                    this.releaseAccessHandles();
                }
                return this;
            }

            isPaused() {
                return 0 === this.#mapSAHToName.size;
            }

            async unpauseVfs() {
                if (0 === this.#mapSAHToName.size) {
                    return this.acquireAccessHandles(false).then(
                        () => capi.sqlite3_vfs_register(this.#cVfs, 0),
                        this
                    );
                }
                return this;
            }

            exportFile(name) {
                const sah =
                    this.#mapFilenameToSAH.get(name) ||
                    toss("File not found:", name);
                const n = sah.getSize() - HEADER_OFFSET_DATA;
                const b = new Uint8Array(n > 0 ? n : 0);
                if (n > 0) {
                    const nRead = sah.read(b, {
                        at: HEADER_OFFSET_DATA,
                    });
                    if (nRead != n) {
                        toss(
                            "Expected to read " +
                                n +
                                " bytes but read " +
                                nRead +
                                "."
                        );
                    }
                }
                return b;
            }

            async importDbChunked(name, callback) {
                const sah =
                    this.#mapFilenameToSAH.get(name) ||
                    this.nextAvailableSAH() ||
                    toss("No available handles to import to.");
                sah.truncate(0);
                let nWrote = 0,
                    chunk,
                    checkedHeader = false;
                try {
                    while (undefined !== (chunk = await callback())) {
                        if (chunk instanceof ArrayBuffer)
                            chunk = new Uint8Array(chunk);
                        if (0 === nWrote && chunk.byteLength >= 15) {
                            util.affirmDbHeader(chunk);
                            checkedHeader = true;
                        }
                        sah.write(chunk, {
                            at: HEADER_OFFSET_DATA + nWrote,
                        });
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
                    sah.write(new Uint8Array([1, 1]), {
                        at: HEADER_OFFSET_DATA + 18,
                    });
                } catch (e) {
                    this.setAssociatedPath(sah, "", 0);
                    throw e;
                }
                this.setAssociatedPath(sah, name, capi.SQLITE_OPEN_MAIN_DB);
                return nWrote;
            }

            importDb(name, bytes) {
                if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
                else if (bytes instanceof Function)
                    return this.importDbChunked(name, bytes);
                const sah =
                    this.#mapFilenameToSAH.get(name) ||
                    this.nextAvailableSAH() ||
                    toss("No available handles to import to.");
                const n = bytes.byteLength;
                if (n < 512 || n % 512 != 0) {
                    toss("Byte array size is invalid for an SQLite db.");
                }
                const header = "SQLite format 3";
                for (let i = 0; i < header.length; ++i) {
                    if (header.charCodeAt(i) !== bytes[i]) {
                        toss(
                            "Input does not contain an SQLite database header."
                        );
                    }
                }
                const nWrote = sah.write(bytes, {
                    at: HEADER_OFFSET_DATA,
                });
                if (nWrote != n) {
                    this.setAssociatedPath(sah, "", 0);
                    toss(
                        "Expected to write " +
                            n +
                            " bytes but wrote " +
                            nWrote +
                            "."
                    );
                } else {
                    sah.write(new Uint8Array([1, 1]), {
                        at: HEADER_OFFSET_DATA + 18,
                    });
                    this.setAssociatedPath(sah, name, capi.SQLITE_OPEN_MAIN_DB);
                }
                return nWrote;
            }
        }

        class OpfsSAHPoolUtil {
            #p;

            constructor(sahPool) {
                this.#p = sahPool;
                this.vfsName = sahPool.vfsName;
            }

            async addCapacity(n) {
                return this.#p.addCapacity(n);
            }

            async reduceCapacity(n) {
                return this.#p.reduceCapacity(n);
            }

            getCapacity() {
                return this.#p.getCapacity(this.#p);
            }

            getFileCount() {
                return this.#p.getFileCount();
            }
            getFileNames() {
                return this.#p.getFileNames();
            }

            async reserveMinimumCapacity(min) {
                const c = this.#p.getCapacity();
                return c < min ? this.#p.addCapacity(min - c) : c;
            }

            exportFile(name) {
                return this.#p.exportFile(name);
            }

            importDb(name, bytes) {
                return this.#p.importDb(name, bytes);
            }

            async wipeFiles() {
                return this.#p.reset(true);
            }

            unlink(filename) {
                return this.#p.deletePath(filename);
            }

            async removeVfs() {
                return this.#p.removeVfs();
            }

            pauseVfs() {
                this.#p.pauseVfs();
                return this;
            }
            async unpauseVfs() {
                return this.#p.unpauseVfs().then(() => this);
            }
            isPaused() {
                return this.#p.isPaused();
            }
        }

        const apiVersionCheck = async () => {
            const dh = await navigator.storage.getDirectory();
            const fn = ".opfs-sahpool-sync-check-" + getRandomName();
            const fh = await dh.getFileHandle(fn, { create: true });
            const ah = await fh.createSyncAccessHandle();
            const close = ah.close();
            await close;
            await dh.removeEntry(fn);
            if (close?.then) {
                toss(
                    "The local OPFS API is too old for opfs-sahpool:",
                    "it has an async FileSystemSyncAccessHandle.close() method."
                );
            }
            return true;
        };

        sqlite3.installOpfsSAHPoolVfs = async function (
            options = Object.create(null)
        ) {
            options = Object.assign(
                Object.create(null),
                optionDefaults,
                options || {}
            );
            const vfsName = options.name;
            if (options.$testThrowPhase1) {
                throw options.$testThrowPhase1;
            }
            if (initPromises[vfsName]) {
                try {
                    const p = await initPromises[vfsName];

                    return p;
                } catch (e) {
                    if (options.forceReinitIfPreviouslyFailed) {
                        delete initPromises[vfsName];
                    } else {
                        throw e;
                    }
                }
            }
            if (
                !globalThis.FileSystemHandle ||
                !globalThis.FileSystemDirectoryHandle ||
                !globalThis.FileSystemFileHandle ||
                !globalThis.FileSystemFileHandle.prototype
                    .createSyncAccessHandle ||
                !navigator?.storage?.getDirectory
            ) {
                return (initPromises[vfsName] = Promise.reject(
                    new Error("Missing required OPFS APIs.")
                ));
            }

            return (initPromises[vfsName] = apiVersionCheck()
                .then(async function () {
                    if (options.$testThrowPhase2) {
                        throw options.$testThrowPhase2;
                    }
                    const thePool = new OpfsSAHPool(options);
                    return thePool.isReady
                        .then(async () => {
                            const poolUtil = new OpfsSAHPoolUtil(thePool);
                            if (sqlite3.oo1) {
                                const oo1 = sqlite3.oo1;
                                const theVfs = thePool.getVfs();
                                const OpfsSAHPoolDb = function (...args) {
                                    const opt =
                                        oo1.DB.dbCtorHelper.normalizeArgs(
                                            ...args
                                        );
                                    opt.vfs = theVfs.$zName;
                                    oo1.DB.dbCtorHelper.call(this, opt);
                                };
                                OpfsSAHPoolDb.prototype = Object.create(
                                    oo1.DB.prototype
                                );
                                poolUtil.OpfsSAHPoolDb = OpfsSAHPoolDb;
                            }
                            thePool.log("VFS initialized.");
                            return poolUtil;
                        })
                        .catch(async (e) => {
                            await thePool.removeVfs().catch(() => {});
                            throw e;
                        });
                })
                .catch((err) => {
                    return (initPromises[vfsName] = Promise.reject(err));
                }));
        };
    };
}

