interface Sqlite3Util {
  toss: (...args: unknown[]) => never;
  toss3: (...args: unknown[]) => never;
  affirmDbHeader: (bytes: Uint8Array) => void;
}

interface Sqlite3Struct {
  $iVersion: number;
  $szOsFile?: number;
  $mxPathname?: number;
  $zName?: number;
  $xRandomness?: unknown;
  $xSleep?: unknown;
  addOnDispose: (ptr: number | undefined, callback: () => void) => void;
  pointer: number;
  dispose: () => void;
}

interface Sqlite3Capi {
  SQLITE_OPEN_MAIN_DB: number;
  SQLITE_OPEN_MAIN_JOURNAL: number;
  SQLITE_OPEN_SUPER_JOURNAL: number;
  SQLITE_OPEN_WAL: number;
  SQLITE_OPEN_MEMORY: number;
  SQLITE_OPEN_DELETEONCLOSE: number;
  SQLITE_OPEN_CREATE: number;
  SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN: number;
  SQLITE_NOTFOUND: number;
  SQLITE_IOERR: number;
  SQLITE_IOERR_SHORT_READ: number;
  SQLITE_IOERR_DELETE: number;
  SQLITE_CANTOPEN: number;
  SQLITE_NOMEM: number;
  SQLITE_LOCK_NONE: number;
  SQLITE_MISUSE: number;
  sqlite3_vfs: { new (pDVfs?: number | null): Sqlite3Struct };
  sqlite3_io_methods: { new (): Sqlite3Struct };
  sqlite3_file: {
    structInfo: { sizeof: number };
    new (ptr: number): { $pMethods: number; dispose: () => void };
  };
  sqlite3_vfs_find: (name: string | null) => number;
  sqlite3_vfs_register: (
    vfs: Sqlite3Struct | number,
    makeDefault: number,
  ) => number;
  sqlite3_vfs_unregister: (vfs: number | string) => number;
}

interface Sqlite3Wasm {
  poke32: (ptr: number, val: number) => void;
  poke64: (ptr: number, val: bigint) => void;
  poke: (ptr: number, val: number, type: string) => void;
  poke8: (ptr: number, val: number) => void;
  peek8: (ptr: number) => number;
  heap8u: () => Uint8Array;
  cstrncpy: (pOut: number, zName: number, nOut: number) => number;
  cstrToJs: (ptr: number) => string;
  allocCString: (str: string) => number;
  scopedAllocPush: () => unknown;
  scopedAllocPop: (state: unknown) => void;
  scopedAllocCString: (
    str: string,
    nullTerminated?: boolean,
  ) => [number, number];
  isPtr: (val: unknown) => boolean;
}

interface Sqlite3Config {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
}

interface Sqlite3Vfs {
  installVfs: (options: {
    io?: { struct: Sqlite3Struct; methods: unknown };
    vfs?: { struct: Sqlite3Struct; methods: Sqlite3VfsMethods };
  }) => void;
}

interface Sqlite3VfsMethods {
  xAccess: (
    pVfs: number,
    zName: number,
    flags: number,
    pOut: number,
  ) => number;
  xCurrentTime: (pVfs: number, pOut: number) => number;
  xCurrentTimeInt64: (pVfs: number, pOut: number) => number;
  xDelete: (pVfs: number, zName: number, doSyncDir: number) => number;
  xFullPathname: (
    pVfs: number,
    zName: number,
    nOut: number,
    pOut: number,
  ) => number;
  xGetLastError: (pVfs: number, nOut: number, pOut: number) => number;
  xOpen: (
    pVfs: number,
    zName: number,
    pFile: number,
    flags: number,
    pOutFlags: number,
  ) => number;
  xRandomness?: (pVfs: number, nOut: number, pOut: number) => number;
  xSleep?: (pVfs: number, ms: number) => number;
}

interface Sqlite3DbCtorOptions {
  filename?: string | number;
  flags?: string;
  vfs?: string | number | null;
}

interface Sqlite3Oo1 {
  DB: {
    prototype: object;
    dbCtorHelper: {
      normalizeArgs: (...args: unknown[]) => Sqlite3DbCtorOptions;
      call: (ctx: unknown, opt: unknown) => void;
    };
  };
}

interface OpfsFile {
  path: string;
  flags: number;
  sah: FileSystemSyncAccessHandle;
  lockType?: number;
}

interface OpfsSAHPoolOptions {
  name?: string;
  directory?: string;
  initialCapacity?: number;
  clearOnInit?: boolean;
  verbosity?: number;
  forceReinitIfPreviouslyFailed?: boolean;
  $testThrowPhase1?: unknown;
  $testThrowPhase2?: unknown;
}

interface SqliteError extends Error {
  sqlite3Rc?: number;
}

interface OpfsSAHPoolUtil {
  addCapacity(n: number): Promise<number>;
  reduceCapacity(n: number): Promise<number>;
  getCapacity(): number;
  getFileCount(): number;
  getFileNames(): string[];
  reserveMinimumCapacity(min: number): Promise<number>;
  exportFile(name: string): Uint8Array;
  importDb(
    name: string,
    bytes:
      | Uint8Array
      | ArrayBuffer
      | (() =>
          | Uint8Array
          | ArrayBuffer
          | undefined
          | Promise<Uint8Array | ArrayBuffer | undefined>),
  ): number | Promise<number>;
  wipeFiles(): Promise<void>;
  unlink(filename: string): boolean;
  removeVfs(): Promise<boolean>;
  pauseVfs(): OpfsSAHPoolUtil;
  unpauseVfs(): Promise<OpfsSAHPoolUtil>;
  isPaused(): boolean;
  OpfsSAHPoolDb?: unknown;
  vfsName: string;
}

interface Sqlite3 {
  util: Sqlite3Util;
  capi: Sqlite3Capi;
  wasm: Sqlite3Wasm;
  config: Sqlite3Config;
  vfs: Sqlite3Vfs;
  oo1?: Sqlite3Oo1;
  installOpfsSAHPoolVfs?: (
    options?: OpfsSAHPoolOptions,
  ) => Promise<OpfsSAHPoolUtil>;
  SQLite3Error: {
    toss: (code: number, ...args: unknown[]) => never;
  };
}

export function initializeOpfsSahpool(sqlite3: Sqlite3) {
  "use strict";
  const toss = sqlite3.util.toss;
  const toss3 = sqlite3.util.toss3;
  const initPromises: Record<string, Promise<OpfsSAHPoolUtil>> = Object.create(
    null,
  );
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

  const __mapVfsToPool = new Map<number, OpfsSAHPool>();
  const getPoolForVfs = (pVfs: number) => __mapVfsToPool.get(pVfs);
  const setPoolForVfs = (pVfs: number, pool: OpfsSAHPool | 0) => {
    if (pool) __mapVfsToPool.set(pVfs, pool);
    else __mapVfsToPool.delete(pVfs);
  };

  const __mapSqlite3File = new Map<number, OpfsSAHPool>();
  const getPoolForPFile = (pFile: number) => __mapSqlite3File.get(pFile);
  const setPoolForPFile = (pFile: number, pool: OpfsSAHPool | false) => {
    if (pool) __mapSqlite3File.set(pFile, pool);
    else __mapSqlite3File.delete(pFile);
  };

  const ioMethods = {
    xCheckReservedLock: function (pFile: number, pOut: number) {
      const pool = getPoolForPFile(pFile);
      if (!pool) return capi.SQLITE_IOERR;
      pool.log("xCheckReservedLock");
      pool.storeErr();
      wasm.poke32(pOut, 1);
      return 0;
    },
    xClose: function (pFile: number) {
      const pool = getPoolForPFile(pFile);
      if (!pool) return 0; // Already closed or invalid?
      pool.storeErr();
      const file = pool.getOFileForS3File(pFile);
      if (file) {
        try {
          pool.log(`xClose ${file.path}`);
          pool.mapS3FileToOFile(pFile, undefined);
          file.sah.flush();
          if (file.flags & capi.SQLITE_OPEN_DELETEONCLOSE) {
            pool.deletePath(file.path);
          }
        } catch (e: unknown) {
          return pool.storeErr(e as SqliteError, capi.SQLITE_IOERR);
        }
      }
      return 0;
    },
    xDeviceCharacteristics: function (_pFile: number) {
      return capi.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN;
    },
    xFileControl: function (_pFile: number, _opId: number, _pArg: number) {
      return capi.SQLITE_NOTFOUND;
    },
    xFileSize: function (pFile: number, pSz64: number) {
      const pool = getPoolForPFile(pFile);
      if (!pool) return capi.SQLITE_IOERR;
      pool.log(`xFileSize`);
      const file = pool.getOFileForS3File(pFile);
      if (!file) return capi.SQLITE_IOERR;
      const size =
        (file.sah.getSize() as number) - HEADER_OFFSET_DATA;

      wasm.poke64(pSz64, BigInt(size));
      return 0;
    },
    xLock: function (pFile: number, lockType: number) {
      const pool = getPoolForPFile(pFile);
      if (!pool) return capi.SQLITE_IOERR;
      pool.log(`xLock ${lockType}`);
      pool.storeErr();
      const file = pool.getOFileForS3File(pFile);
      if (file) file.lockType = lockType;
      return 0;
    },
    xRead: function (
      pFile: number,
      pDest: number,
      n: number,
      offset64: bigint,
    ) {
      const pool = getPoolForPFile(pFile);
      if (!pool) return capi.SQLITE_IOERR;
      pool.storeErr();
      const file = pool.getOFileForS3File(pFile);
      if (!file) return capi.SQLITE_IOERR;
      pool.log(`xRead ${file.path} ${n} @ ${offset64}`);
      try {
        const nRead = file.sah.read(
          wasm.heap8u().subarray(pDest, pDest + n) as unknown as Uint8Array,
          {
            at: HEADER_OFFSET_DATA + Number(offset64),
          },
        );
        if (nRead < n) {
          wasm.heap8u().fill(0, pDest + nRead, pDest + n);
          return capi.SQLITE_IOERR_SHORT_READ;
        }
        return 0;
      } catch (e: unknown) {
        return pool.storeErr(e as SqliteError, capi.SQLITE_IOERR);
      }
    },
    xSectorSize: function (_pFile: number) {
      return SECTOR_SIZE;
    },
    xSync: function (pFile: number, flags: number) {
      const pool = getPoolForPFile(pFile);
      if (!pool) return capi.SQLITE_IOERR;
      pool.log(`xSync ${flags}`);
      pool.storeErr();
      const file = pool.getOFileForS3File(pFile);
      if (!file) return capi.SQLITE_IOERR;

      try {
        file.sah.flush();
        return 0;
      } catch (e: unknown) {
        return pool.storeErr(e as SqliteError, capi.SQLITE_IOERR);
      }
    },
    xTruncate: function (pFile: number, sz64: bigint) {
      const pool = getPoolForPFile(pFile);
      if (!pool) return capi.SQLITE_IOERR;
      pool.log(`xTruncate ${sz64}`);
      pool.storeErr();
      const file = pool.getOFileForS3File(pFile);
      if (!file) return capi.SQLITE_IOERR;

      try {
        file.sah.truncate(HEADER_OFFSET_DATA + Number(sz64));
        return 0;
      } catch (e: unknown) {
        return pool.storeErr(e as SqliteError, capi.SQLITE_IOERR);
      }
    },
    xUnlock: function (pFile: number, lockType: number) {
      const pool = getPoolForPFile(pFile);
      if (!pool) return capi.SQLITE_IOERR;
      pool.log("xUnlock");
      const file = pool.getOFileForS3File(pFile);
      if (file) file.lockType = lockType;
      return 0;
    },
    xWrite: function (
      pFile: number,
      pSrc: number,
      n: number,
      offset64: bigint,
    ) {
      const pool = getPoolForPFile(pFile);
      if (!pool) return capi.SQLITE_IOERR;
      pool.storeErr();
      const file = pool.getOFileForS3File(pFile);
      if (!file) return capi.SQLITE_IOERR;
      pool.log(`xWrite ${file.path} ${n} ${offset64}`);
      try {
        const nBytes = file.sah.write(
          wasm.heap8u().subarray(pSrc, pSrc + n) as unknown as Uint8Array,
          {
            at: HEADER_OFFSET_DATA + Number(offset64),
          },
        );
        return n === nBytes ? 0 : toss("Unknown write() failure.");
      } catch (e: unknown) {
        return pool.storeErr(e as SqliteError, capi.SQLITE_IOERR);
      }
    },
  };

  const opfsIoMethods = new capi.sqlite3_io_methods();
  opfsIoMethods.$iVersion = 1;
  sqlite3.vfs.installVfs({
    io: { struct: opfsIoMethods, methods: ioMethods },
  });

  const vfsMethods: Sqlite3VfsMethods = {
    xAccess: function (
      pVfs: number,
      zName: number,
      _flags: number,
      pOut: number,
    ) {
      const pool = getPoolForVfs(pVfs);
      if (!pool) return capi.SQLITE_IOERR;
      pool.storeErr();
      try {
        const name = pool.getPath(zName);
        wasm.poke32(pOut, pool.hasFilename(name) ? 1 : 0);
      } catch (_e) {
        wasm.poke32(pOut, 0);
      }
      return 0;
    },
    xCurrentTime: function (_pVfs: number, pOut: number) {
      wasm.poke(pOut, 2440587.5 + new Date().getTime() / 86400000, "double");
      return 0;
    },
    xCurrentTimeInt64: function (_pVfs: number, pOut: number) {
      wasm.poke(pOut, 2440587.5 * 86400000 + new Date().getTime(), "i64");
      return 0;
    },
    xDelete: function (pVfs: number, zName: number, _doSyncDir: number) {
      const pool = getPoolForVfs(pVfs);
      if (!pool) return capi.SQLITE_IOERR_DELETE;
      pool.log(`xDelete ${wasm.cstrToJs(zName)}`);
      pool.storeErr();
      try {
        pool.deletePath(pool.getPath(zName));
        return 0;
      } catch (e: unknown) {
        pool.storeErr(e as SqliteError);
        return capi.SQLITE_IOERR_DELETE;
      }
    },
    xFullPathname: function (
      _pVfs: number,
      zName: number,
      nOut: number,
      pOut: number,
    ) {
      const i = wasm.cstrncpy(pOut, zName, nOut);
      return i < nOut ? 0 : capi.SQLITE_CANTOPEN;
    },
    xGetLastError: function (pVfs: number, nOut: number, pOut: number) {
      const pool = getPoolForVfs(pVfs);
      if (!pool) return 0;
      const e = pool.popErr();
      pool.log(`xGetLastError ${nOut} e =`, e);
      if (e) {
        const scope = wasm.scopedAllocPush();
        try {
          const [cMsg, n] = wasm.scopedAllocCString(e.message, true);
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

    xOpen: function f(
      pVfs: number,
      zName: number,
      pFile: number,
      flags: number,
      pOutFlags: number,
    ) {
      const pool = getPoolForVfs(pVfs);
      if (!pool) return capi.SQLITE_CANTOPEN;
      try {
        flags &= ~FLAG_COMPUTE_DIGEST_V2;
        pool.log(`xOpen ${wasm.cstrToJs(zName)} ${flags}`);

        const path =
          zName && wasm.peek8(zName) ? pool.getPath(zName) : getRandomName();
        let sah = pool.getSAHForPath(path);
        if (!sah && flags & capi.SQLITE_OPEN_CREATE) {
          if (pool.getFileCount() < pool.getCapacity()) {
            sah = pool.nextAvailableSAH();
            if (sah) {
              pool.setAssociatedPath(sah, path, flags);
            } else {
              // Should not happen given check < Capacity
              toss(
                "SAH pool corruption: count < capacity but no available SAH",
              );
            }
          } else {
            toss("SAH pool is full. Cannot create file", path);
          }
        }
        if (!sah) {
          toss("file not found:", path);
        }

        // sah is guaranteed defined here or tossed
        const file: OpfsFile = {
          path,
          flags,
          sah: sah!,
          lockType: capi.SQLITE_LOCK_NONE,
        };
        pool.mapS3FileToOFile(pFile, file);
        file.lockType = capi.SQLITE_LOCK_NONE;
        const sq3File = new capi.sqlite3_file(pFile);
        sq3File.$pMethods = opfsIoMethods.pointer;
        sq3File.dispose();
        wasm.poke32(pOutFlags, flags);
        return 0;
      } catch (e: unknown) {
        pool.storeErr(e as SqliteError);
        return capi.SQLITE_CANTOPEN;
      }
    },
  };

  const createOpfsVfs = function (vfsName: string) {
    if (sqlite3.capi.sqlite3_vfs_find(vfsName)) {
      toss3("VFS name is already registered:", vfsName);
    }
    const opfsVfs = new capi.sqlite3_vfs();

    const pDVfs = capi.sqlite3_vfs_find(null);
    const dVfs = pDVfs ? new capi.sqlite3_vfs(pDVfs) : null;
    opfsVfs.$iVersion = 2;
    opfsVfs.$szOsFile = capi.sqlite3_file.structInfo.sizeof;
    opfsVfs.$mxPathname = HEADER_MAX_PATH_SIZE;
    opfsVfs.addOnDispose((opfsVfs.$zName = wasm.allocCString(vfsName)), () =>
      setPoolForVfs(opfsVfs.pointer, 0),
    );

    if (dVfs) {
      opfsVfs.$xRandomness = dVfs.$xRandomness;
      opfsVfs.$xSleep = dVfs.$xSleep;
      dVfs.dispose();
    }
    if (!opfsVfs.$xRandomness && !vfsMethods.xRandomness) {
      vfsMethods.xRandomness = function (
        _pVfs: number,
        nOut: number,
        pOut: number,
      ) {
        const heap = wasm.heap8u();
        let i = 0;
        for (; i < nOut; ++i) heap[pOut + i] = (Math.random() * 255000) & 0xff;
        return i;
      };
    }
    if (!opfsVfs.$xSleep && !vfsMethods.xSleep) {
      vfsMethods.xSleep = (_pVfs: number, _ms: number) => 0;
    }
    sqlite3.vfs.installVfs({
      vfs: { struct: opfsVfs, methods: vfsMethods },
    });
    return opfsVfs;
  };

  class OpfsSAHPool {
    vfsDir: string;
    vfsName: string;
    $error?: SqliteError;
    isReady: Promise<void>;

    #dhVfsRoot?: FileSystemDirectoryHandle;
    #dhOpaque?: FileSystemDirectoryHandle;
    #dhVfsParent?: FileSystemDirectoryHandle;

    #mapSAHToName = new Map<FileSystemSyncAccessHandle, string>();
    #mapFilenameToSAH = new Map<string, FileSystemSyncAccessHandle>();
    #availableSAH = new Set<FileSystemSyncAccessHandle>();
    #mapS3FileToOFile_ = new Map<number, OpfsFile>();

    #apBody = new Uint8Array(HEADER_CORPUS_SIZE);
    #dvBody: DataView;
    #cVfs: Sqlite3Struct;
    #verbosity: number;

    constructor(options: OpfsSAHPoolOptions = Object.create(null)) {
      this.#verbosity = options.verbosity ?? optionDefaults.verbosity;
      this.vfsName = options.name || optionDefaults.name;
      this.#cVfs = createOpfsVfs(this.vfsName);
      setPoolForVfs(this.#cVfs.pointer, this);
      this.vfsDir = options.directory || "." + this.vfsName;
      this.#dvBody = new DataView(this.#apBody.buffer, this.#apBody.byteOffset);
      this.isReady = this.reset(
        !!(options.clearOnInit ?? optionDefaults.clearOnInit),
      )
        .then(() => {
          if (this.$error) throw this.$error;
          return this.getCapacity()
            ? Promise.resolve(undefined)
            : this.addCapacity(
                options.initialCapacity || optionDefaults.initialCapacity,
              );
        })
        .then(() => {});
    }

    #logImpl(level: number, ...args: unknown[]) {
      if (this.#verbosity > level) loggers[level](this.vfsName + ":", ...args);
    }
    log(...args: unknown[]) {
      this.#logImpl(2, ...args);
    }
    warn(...args: unknown[]) {
      this.#logImpl(1, ...args);
    }
    error(...args: unknown[]) {
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
      const rc: string[] = [];
      for (const n of this.#mapFilenameToSAH.keys()) rc.push(n);
      return rc;
    }

    async addCapacity(n: number) {
      for (let i = 0; i < n; ++i) {
        const name = getRandomName();
        if (!this.#dhOpaque) throw new Error("VFS not initialized");
        const h = await this.#dhOpaque.getFileHandle(name, {
          create: true,
        });
        const ah = await h.createSyncAccessHandle();
        this.#mapSAHToName.set(ah, name);
        this.setAssociatedPath(ah, "", 0);
      }
      return this.getCapacity();
    }

    async reduceCapacity(n: number) {
      let nRm = 0;
      for (const ah of Array.from(this.#availableSAH)) {
        if (nRm === n || this.getFileCount() === this.getCapacity()) {
          break;
        }
        const name = this.#mapSAHToName.get(ah);
        if (!name) continue; // Should not happen

        ah.close();
        if (this.#dhOpaque) await this.#dhOpaque.removeEntry(name);
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
      const files: [string, FileSystemHandle][] = [];
      if (!this.#dhOpaque) return;
      // @ts-expect-error - async iterator on FileSystemDirectoryHandle
      for await (const [name, h] of this.#dhOpaque) {
        if ("file" === h.kind) {
          files.push([name, h]);
        }
      }
      return Promise.all(
        files.map(async ([name, h]) => {
          try {
            const ah = await (
              h as FileSystemFileHandle
            ).createSyncAccessHandle();
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
          } catch (e: unknown) {
            this.storeErr(e as SqliteError);
            this.releaseAccessHandles();
            throw e;
          }
        }),
      );
    }

    getAssociatedPath(sah: FileSystemSyncAccessHandle) {
      sah.read(this.#apBody, { at: 0 });

      const flags = this.#dvBody.getUint32(HEADER_OFFSET_FLAGS);
      if (
        this.#apBody[0] &&
        (flags & capi.SQLITE_OPEN_DELETEONCLOSE ||
          (flags & PERSISTENT_FILE_TYPES) === 0)
      ) {
        warn(
          `Removing file with unexpected flags ${flags.toString(16)}`,
          this.#apBody,
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
          ? textDecoder.decode(this.#apBody.subarray(0, pathBytes))
          : "";
      } else {
        warn("Disassociating file with bad digest.");
        this.setAssociatedPath(sah, "", 0);
        return "";
      }
    }

    setAssociatedPath(
      sah: FileSystemSyncAccessHandle,
      path: string,
      flags: number,
    ) {
      const enc = textEncoder.encodeInto(path, this.#apBody);
      if (HEADER_MAX_PATH_SIZE <= enc.written! + 1) {
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

    computeDigest(byteArray: Uint8Array, fileFlags: number) {
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

    async reset(clearFiles: boolean) {
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
        { create: true },
      );
      this.releaseAccessHandles();
      return this.acquireAccessHandles(clearFiles);
    }

    getPath(arg: string | number | URL) {
      if (wasm.isPtr(arg)) arg = wasm.cstrToJs(arg as number);
      return (
        arg instanceof URL ? arg : new URL(arg as string, "file://localhost/")
      ).pathname;
    }

    deletePath(path: string) {
      const sah = this.#mapFilenameToSAH.get(path);
      if (sah) {
        this.#mapFilenameToSAH.delete(path);
        this.setAssociatedPath(sah, "", 0);
      }
      return !!sah;
    }

    storeErr(e?: SqliteError, code?: number) {
      if (e) {
        e.sqlite3Rc = code || capi.SQLITE_IOERR;
        this.error(e);
      }
      this.$error = e;
      return code || capi.SQLITE_IOERR;
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

    getOFileForS3File(pFile: number) {
      return this.#mapS3FileToOFile_.get(pFile);
    }

    mapS3FileToOFile(pFile: number, file: OpfsFile | undefined | false) {
      if (file) {
        this.#mapS3FileToOFile_.set(pFile, file);
        setPoolForPFile(pFile, this);
      } else {
        this.#mapS3FileToOFile_.delete(pFile);
        setPoolForPFile(pFile, false);
      }
    }

    hasFilename(name: string) {
      return this.#mapFilenameToSAH.has(name);
    }

    getSAHForPath(path: string) {
      return this.#mapFilenameToSAH.get(path);
    }

    async removeVfs() {
      if (!this.#cVfs.pointer || !this.#dhOpaque) return false;
      capi.sqlite3_vfs_unregister(this.#cVfs.pointer);
      this.#cVfs.dispose();
      delete initPromises[this.vfsName];
      try {
        this.releaseAccessHandles();
        if (this.#dhVfsRoot) {
          await this.#dhVfsRoot.removeEntry(OPAQUE_DIR_NAME, {
            recursive: true,
          });
        }
        this.#dhOpaque = undefined;
        if (this.#dhVfsParent && this.#dhVfsRoot) {
          await this.#dhVfsParent.removeEntry(this.#dhVfsRoot.name, {
            recursive: true,
          });
        }
        this.#dhVfsRoot = this.#dhVfsParent = undefined;
      } catch (e) {
        sqlite3.config.error(
          this.vfsName,
          "removeVfs() failed with no recovery strategy:",
          e,
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
          "because it has opened files.",
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
        return this.acquireAccessHandles(false).then(() =>
          capi.sqlite3_vfs_register(this.#cVfs, 0),
        );
      }
      return this;
    }

    exportFile(name: string) {
      const sah =
        this.#mapFilenameToSAH.get(name) || toss("File not found:", name);
      const n = (sah.getSize() as unknown as number) - HEADER_OFFSET_DATA;
      const b = new Uint8Array(n > 0 ? n : 0);
      if (n > 0) {
        const nRead = sah.read(b, {
          at: HEADER_OFFSET_DATA,
        });
        if (nRead != n) {
          toss("Expected to read " + n + " bytes but read " + nRead + ".");
        }
      }
      return b;
    }

    async importDbChunked(
      name: string,
      callback: () =>
        | Promise<Uint8Array | ArrayBuffer | undefined>
        | Uint8Array
        | ArrayBuffer
        | undefined,
    ) {
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
          if (chunk instanceof ArrayBuffer) chunk = new Uint8Array(chunk);
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
          toss("Input size", nWrote, "is not correct for an SQLite database.");
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

    importDb(
      name: string,
      bytes:
        | Uint8Array
        | ArrayBuffer
        | (() =>
            | Promise<Uint8Array | ArrayBuffer | undefined>
            | Uint8Array
            | ArrayBuffer
            | undefined),
    ) {
      if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
      else if (bytes instanceof Function)
        return this.importDbChunked(name, bytes);
      const sah =
        this.#mapFilenameToSAH.get(name) ||
        this.nextAvailableSAH() ||
        toss("No available handles to import to.");

      const b = bytes as Uint8Array;
      const n = b.byteLength;
      if (n < 512 || n % 512 != 0) {
        toss("Byte array size is invalid for an SQLite db.");
      }
      const header = "SQLite format 3";
      for (let i = 0; i < header.length; ++i) {
        if (header.charCodeAt(i) !== b[i]) {
          toss("Input does not contain an SQLite database header.");
        }
      }
      const nWrote = sah.write(b as unknown as Uint8Array, {
        at: HEADER_OFFSET_DATA,
      });
      if (nWrote != n) {
        this.setAssociatedPath(sah, "", 0);
        toss("Expected to write " + n + " bytes but wrote " + nWrote + ".");
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
    #p: OpfsSAHPool;
    vfsName: string;
    OpfsSAHPoolDb?: unknown;

    constructor(sahPool: OpfsSAHPool) {
      this.#p = sahPool;
      this.vfsName = sahPool.vfsName;
    }

    async addCapacity(n: number) {
      return this.#p.addCapacity(n);
    }

    async reduceCapacity(n: number) {
      return this.#p.reduceCapacity(n);
    }

    getCapacity() {
      return this.#p.getCapacity();
    }

    getFileCount() {
      return this.#p.getFileCount();
    }
    getFileNames() {
      return this.#p.getFileNames();
    }

    async reserveMinimumCapacity(min: number) {
      const c = this.#p.getCapacity();
      return c < min ? this.#p.addCapacity(min - c) : c;
    }

    exportFile(name: string) {
      return this.#p.exportFile(name);
    }

    importDb(
      name: string,
      bytes:
        | Uint8Array
        | ArrayBuffer
        | (() =>
            | Promise<Uint8Array | ArrayBuffer | undefined>
            | Uint8Array
            | ArrayBuffer
            | undefined),
    ) {
      return this.#p.importDb(name, bytes);
    }

    async wipeFiles() {
      await this.#p.reset(true);
    }

    unlink(filename: string) {
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
        "it has an async FileSystemSyncAccessHandle.close() method.",
      );
    }
    return true;
  };

  sqlite3.installOpfsSAHPoolVfs = async function (
    options: OpfsSAHPoolOptions = Object.create(null),
  ) {
    options = Object.assign(Object.create(null), optionDefaults, options || {});
    const vfsName = options.name!;
    if (options.$testThrowPhase1) {
      throw options.$testThrowPhase1;
    }
    if (initPromises[vfsName] !== undefined) {
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
      !globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle ||
      !navigator?.storage?.getDirectory
    ) {
      return (initPromises[vfsName] = Promise.reject(
        new Error("Missing required OPFS APIs."),
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
              const OpfsSAHPoolDb = function (this: unknown, ...args: unknown[]) {
                const opt = oo1.DB.dbCtorHelper.normalizeArgs(...args);
                opt.vfs = theVfs.$zName;
                oo1.DB.dbCtorHelper.call(this, opt);
              };
              OpfsSAHPoolDb.prototype = Object.create(oo1.DB.prototype);
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
}
