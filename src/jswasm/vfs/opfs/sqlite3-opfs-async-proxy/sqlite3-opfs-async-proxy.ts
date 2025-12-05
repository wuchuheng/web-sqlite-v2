/**
 * Web Worker entry point that proxies OPFS operations from a synchronous VFS to
 * asynchronous browser APIs using SharedArrayBuffer, Atomics, and postMessage.
 * It is intentionally side-effectful and does not export any symbols.
 */
const wPost = (type: string, ...args: unknown[]): void =>
  postMessage({ type, payload: args });

interface FileSystemSyncAccessHandle {
  close(): void | Promise<void>;
  flush(): void | Promise<void>;
  getSize(): number | Promise<number>;
  read(buffer: BufferSource, options?: { at?: number }): number;
  truncate(size: number): void | Promise<void>;
  write(buffer: BufferSource, options?: { at?: number }): number;
}

interface FileSystemFileHandle {
  createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>;
}

type SerializationValue = number | bigint | boolean | string;

interface SerializationHelpers {
  serialize: (...args: SerializationValue[]) => void;
  deserialize: (clear?: boolean) => SerializationValue[];
  storeException: (priority: number, error: unknown) => void;
}

interface OpfsFlags {
  OPFS_UNLINK_BEFORE_OPEN: number;
  OPFS_UNLOCK_ASAP: number;
  defaultUnlockAsap?: boolean;
  [key: string]: number | boolean | undefined;
}

interface OpfsProxyOptions {
  verbose?: number;
  opIds: Record<string, number>;
  sq3Codes: Record<string, number>;
  opfsFlags: OpfsFlags;
  asyncIdleWaitTime: number;
  sabOP: SharedArrayBuffer;
  sabIO: SharedArrayBuffer;
  fileBufferSize: number;
  sabS11nOffset: number;
  sabS11nSize: number;
  littleEndian: boolean;
  asyncS11nExceptions: number;
}

interface ProxyState extends OpfsProxyOptions {
  verbose: number;
  rootDir?: FileSystemDirectoryHandle;
  sabOPView: Int32Array;
  sabFileBufView: Uint8Array;
  sabS11nView?: Uint8Array;
  s11n?: SerializationHelpers;
}

interface FileHandleState {
  fid: number;
  filenameAbs: string;
  filenamePart: string;
  dirHandle: FileSystemDirectoryHandle;
  fileHandle: FileSystemFileHandle;
  sabView: Uint8Array;
  readOnly: boolean;
  deleteOnClose: boolean;
  syncHandle?: FileSystemSyncAccessHandle;
  xLock?: number;
  releaseImplicitLocks?: boolean;
}

type VfsAsyncHandler = (...args: unknown[]) => Promise<void | number>;

const isDomErrorWithName = (error: unknown, name: string): boolean => {
  const domError = error as { name?: string };
  return typeof domError?.name === "string" && domError.name === name;
};

class GetSyncHandleError extends Error {
  constructor(errorObject: DOMException, ...msg: string[]) {
    super(
      [...msg, ": " + errorObject.name + ":", errorObject.message].join(" "),
      {
        cause: errorObject,
      },
    );
    this.name = "GetSyncHandleError";
  }

  static convertRc(
    error: unknown,
    rc: number,
    sq3Codes: Record<string, number>,
  ): number {
    if (error instanceof GetSyncHandleError) {
      const cause = error.cause as
        | { name?: string; message?: string }
        | undefined;
      if (
        cause?.name === "NoModificationAllowedError" ||
        (cause?.name === "DOMException" &&
          typeof cause.message === "string" &&
          cause.message.startsWith("Access Handles cannot"))
      ) {
        return sq3Codes.SQLITE_BUSY;
      }
      if (cause?.name === "NotFoundError") {
        return sq3Codes.SQLITE_CANTOPEN;
      }
    } else if (isDomErrorWithName(error, "NotFoundError")) {
      return sq3Codes.SQLITE_CANTOPEN;
    }
    return rc;
  }
}

const installAsyncProxy = (): void => {
  const toss = (...args: unknown[]): never => {
    const message = args.map(String).join(" ");
    throw new Error(message);
  };

  if (globalThis.window === globalThis) {
    toss(
      "This code cannot run from the main thread.",
      "Load it as a Worker from a separate Worker.",
    );
  } else if (!navigator?.storage?.getDirectory) {
    toss("This API requires navigator.storage.getDirectory.");
  }

  const state = Object.create(null) as ProxyState;
  state.verbose = 1;

  const loggers: Record<number, (...args: unknown[]) => void> = {
    0: console.error.bind(console),
    1: console.warn.bind(console),
    2: console.log.bind(console),
  };
  const logImpl = (level: number, ...args: unknown[]): void => {
    if (state.verbose > level) loggers[level]("OPFS asyncer:", ...args);
  };
  const log = (...args: unknown[]): void => logImpl(2, ...args);
  const warn = (...args: unknown[]): void => logImpl(1, ...args);
  const error = (...args: unknown[]): void => logImpl(0, ...args);

  const __openFiles: Record<number, FileHandleState> = Object.create(null);
  const __implicitLocks = new Set<number>();

  const getResolvedPath = (
    filename: string,
    splitIt: boolean,
  ): string | string[] => {
    const pathname = new URL(filename, "file://irrelevant").pathname;
    return splitIt ? pathname.split("/").filter((v) => !!v) : pathname;
  };

  const getDirForFilename = async (
    absFilename: string,
    createDirs = false,
  ): Promise<[FileSystemDirectoryHandle, string | undefined]> => {
    const path = getResolvedPath(absFilename, true) as string[];
    const filename = path.pop();
    let dh = state.rootDir as FileSystemDirectoryHandle;
    for (const dirName of path) {
      if (dirName) {
        dh = await dh.getDirectoryHandle(dirName, { create: !!createDirs });
      }
    }
    return [dh, filename];
  };

  const closeSyncHandle = async (fh: FileHandleState): Promise<void> => {
    if (fh.syncHandle) {
      log("Closing sync handle for", fh.filenameAbs);
      const h = fh.syncHandle;
      delete fh.syncHandle;
      delete fh.xLock;
      __implicitLocks.delete(fh.fid);
      h.close();
    }
  };

  const closeSyncHandleNoThrow = async (fh: FileHandleState): Promise<void> => {
    try {
      await closeSyncHandle(fh);
    } catch (e) {
      warn("closeSyncHandleNoThrow() ignoring:", e, fh);
    }
  };

  const releaseImplicitLocks = async (): Promise<void> => {
    if (__implicitLocks.size) {
      for (const fid of __implicitLocks) {
        const fh = __openFiles[fid];
        await closeSyncHandleNoThrow(fh);
        log("Auto-unlocked", fid, fh.filenameAbs);
      }
    }
  };

  const releaseImplicitLock = async (
    fh: FileHandleState,
  ): Promise<void | undefined> => {
    if (fh.releaseImplicitLocks && __implicitLocks.has(fh.fid)) {
      return closeSyncHandleNoThrow(fh);
    }
    return undefined;
  };

  const getSyncHandle = async (
    fh: FileHandleState,
    opName: string,
  ): Promise<FileSystemSyncAccessHandle> => {
    if (!fh.syncHandle) {
      const start = performance.now();
      log("Acquiring sync handle for", fh.filenameAbs);
      const maxTries = 6;
      const msBase = state.asyncIdleWaitTime * 2;
      for (let i = 1, ms = msBase; i <= maxTries; ms = msBase * ++i) {
        try {
          fh.syncHandle = await fh.fileHandle.createSyncAccessHandle();
          break;
        } catch (e) {
          if (i === maxTries) {
            throw new GetSyncHandleError(
              e as DOMException,
              "Error getting sync handle for",
              opName + "().",
              maxTries.toString(),
              "attempts failed.",
              fh.filenameAbs,
            );
          }
          warn(
            "Error getting sync handle for",
            opName + "(). Waiting",
            ms,
            "ms and trying again.",
            fh.filenameAbs,
            e,
          );
          Atomics.wait(state.sabOPView, state.opIds.retry, 0, ms);
        }
      }
      log(
        "Got",
        opName + "() sync handle for",
        fh.filenameAbs,
        "in",
        performance.now() - start,
        "ms",
      );
      if (!fh.xLock) {
        __implicitLocks.add(fh.fid);
        log(
          "Acquired implicit lock for",
          opName + "()",
          fh.fid,
          fh.filenameAbs,
        );
      }
    }
    return fh.syncHandle as FileSystemSyncAccessHandle;
  };

  const storeAndNotify = (opName: string, value: number): void => {
    log(opName + "() => notify(", value, ")");
    Atomics.store(state.sabOPView, state.opIds.rc, value);
    Atomics.notify(state.sabOPView, state.opIds.rc);
  };

  const affirmNotRO = (opName: string, fh: FileHandleState): void => {
    if (fh.readOnly) toss(opName + "(): File is read-only: " + fh.filenameAbs);
  };

  let flagAsyncShutdown = false;

  const vfsAsyncImpls = {
    "opfs-async-shutdown": async () => {
      flagAsyncShutdown = true;
      storeAndNotify("opfs-async-shutdown", 0);
    },
    mkdir: async (dirname: string) => {
      let rc = 0;
      try {
        await getDirForFilename(dirname + "/filepart", true);
      } catch (e) {
        state.s11n?.storeException(2, e);
        rc = state.sq3Codes.SQLITE_IOERR;
      }
      storeAndNotify("mkdir", rc);
    },
    xAccess: async (filename: string) => {
      let rc = 0;
      try {
        const [dh, fn] = await getDirForFilename(filename);
        await dh.getFileHandle(fn as string);
      } catch (e) {
        state.s11n?.storeException(2, e);
        rc = state.sq3Codes.SQLITE_IOERR;
      }
      storeAndNotify("xAccess", rc);
    },
    xClose: async (fid: number) => {
      const opName = "xClose";
      __implicitLocks.delete(fid);
      const fh = __openFiles[fid];
      let rc = 0;
      if (fh) {
        delete __openFiles[fid];
        await closeSyncHandle(fh);
        if (fh.deleteOnClose) {
          try {
            await fh.dirHandle.removeEntry(fh.filenamePart);
          } catch (e) {
            warn("Ignoring dirHandle.removeEntry() failure of", fh, e);
          }
        }
      } else {
        state.s11n?.serialize();
        rc = state.sq3Codes.SQLITE_NOTFOUND;
      }
      storeAndNotify(opName, rc);
    },
    xDelete: async (filename: string, syncDir = 0, recursive = false) => {
      const rc = (await vfsAsyncImpls.xDeleteNoWait(
        filename,
        syncDir,
        recursive,
      )) as number;
      storeAndNotify("xDelete", rc);
    },
    xDeleteNoWait: async (
      filename: string,
      syncDir = 0,
      recursive = false,
    ): Promise<number> => {
      let rc = 0;
      try {
        let currentFilename: string | string[] | undefined = filename;
        while (currentFilename) {
          const [hDir, filenamePart] = await getDirForFilename(
            currentFilename as string,
            false,
          );
          if (!filenamePart) break;
          await hDir.removeEntry(filenamePart, { recursive: !!recursive });
          if (0x1234 !== syncDir) break;
          recursive = false;
          currentFilename = getResolvedPath(
            currentFilename as string,
            true,
          ) as string[];
          currentFilename.pop();
          currentFilename = currentFilename.join("/");
        }
      } catch (e) {
        state.s11n?.storeException(2, e);
        rc = state.sq3Codes.SQLITE_IOERR_DELETE;
      }
      return rc;
    },
    xFileSize: async (fid: number) => {
      const fh = __openFiles[fid];
      let rc = 0;
      try {
        const sz = await (await getSyncHandle(fh, "xFileSize")).getSize();
        state.s11n?.serialize(Number(sz));
      } catch (e) {
        state.s11n?.storeException(1, e);
        rc = GetSyncHandleError.convertRc(
          e,
          state.sq3Codes.SQLITE_IOERR,
          state.sq3Codes,
        );
      }
      await releaseImplicitLock(fh);
      storeAndNotify("xFileSize", rc);
    },
    xLock: async (fid: number, lockType: number) => {
      const fh = __openFiles[fid];
      let rc = 0;
      const oldLockType = fh.xLock;
      fh.xLock = lockType;
      if (!fh.syncHandle) {
        try {
          await getSyncHandle(fh, "xLock");
          __implicitLocks.delete(fid);
        } catch (e) {
          state.s11n?.storeException(1, e);
          rc = GetSyncHandleError.convertRc(
            e,
            state.sq3Codes.SQLITE_IOERR_LOCK,
            state.sq3Codes,
          );
          fh.xLock = oldLockType;
        }
      }
      storeAndNotify("xLock", rc);
    },
    xOpen: async (
      fid: number,
      filename: string,
      flags: number,
      opfsFlags: number,
    ) => {
      const opName = "xOpen";
      const create = state.sq3Codes.SQLITE_OPEN_CREATE & flags;
      try {
        let hDir: FileSystemDirectoryHandle;
        let filenamePart: string | undefined;
        try {
          [hDir, filenamePart] = await getDirForFilename(filename, !!create);
        } catch (e) {
          state.s11n?.storeException(1, e);
          storeAndNotify(opName, state.sq3Codes.SQLITE_NOTFOUND);
          return;
        }
        if (state.opfsFlags.OPFS_UNLINK_BEFORE_OPEN & opfsFlags) {
          try {
            await hDir.removeEntry(filenamePart as string);
          } catch {
            /* ignore */
          }
        }
        const hFile = await hDir.getFileHandle(filenamePart as string, {
          create: !!create,
        });
        const fh: FileHandleState = Object.assign(Object.create(null), {
          fid,
          filenameAbs: filename,
          filenamePart,
          dirHandle: hDir,
          fileHandle: hFile,
          sabView: state.sabFileBufView,
          readOnly: !create && !!(state.sq3Codes.SQLITE_OPEN_READONLY & flags),
          deleteOnClose: !!(state.sq3Codes.SQLITE_OPEN_DELETEONCLOSE & flags),
        });
        fh.releaseImplicitLocks =
          (opfsFlags & state.opfsFlags.OPFS_UNLOCK_ASAP) !== 0 ||
          Boolean(state.opfsFlags.defaultUnlockAsap);
        __openFiles[fid] = fh;
        storeAndNotify(opName, 0);
      } catch (e) {
        error(opName, e);
        state.s11n?.storeException(1, e);
        storeAndNotify(opName, state.sq3Codes.SQLITE_IOERR);
      }
    },
    xRead: async (fid: number, n: number, offset64: number) => {
      let rc = 0;
      const fh = __openFiles[fid];
      try {
        const nRead = (await getSyncHandle(fh, "xRead")).read(
          fh.sabView.subarray(0, n) as unknown as BufferSource,
          { at: Number(offset64) },
        );
        if (nRead < n) {
          fh.sabView.fill(0, nRead, n);
          rc = state.sq3Codes.SQLITE_IOERR_SHORT_READ;
        }
      } catch (e) {
        error("xRead() failed", e, fh);
        state.s11n?.storeException(1, e);
        rc = GetSyncHandleError.convertRc(
          e,
          state.sq3Codes.SQLITE_IOERR_READ,
          state.sq3Codes,
        );
      }
      await releaseImplicitLock(fh);
      storeAndNotify("xRead", rc);
    },
    xSync: async (fid: number, _flags: number) => {
      const fh = __openFiles[fid];
      let rc = 0;
      if (!fh.readOnly && fh.syncHandle) {
        try {
          await fh.syncHandle.flush();
        } catch (e) {
          state.s11n?.storeException(2, e);
          rc = state.sq3Codes.SQLITE_IOERR_FSYNC;
        }
      }
      storeAndNotify("xSync", rc);
    },
    xTruncate: async (fid: number, size: number) => {
      let rc = 0;
      const fh = __openFiles[fid];
      try {
        affirmNotRO("xTruncate", fh);
        await (await getSyncHandle(fh, "xTruncate")).truncate(size);
      } catch (e) {
        error("xTruncate():", e, fh);
        state.s11n?.storeException(2, e);
        rc = GetSyncHandleError.convertRc(
          e,
          state.sq3Codes.SQLITE_IOERR_TRUNCATE,
          state.sq3Codes,
        );
      }
      await releaseImplicitLock(fh);
      storeAndNotify("xTruncate", rc);
    },
    xUnlock: async (fid: number, lockType: number) => {
      let rc = 0;
      const fh = __openFiles[fid];
      if (fh.syncHandle && state.sq3Codes.SQLITE_LOCK_NONE === lockType) {
        try {
          await closeSyncHandle(fh);
        } catch (e) {
          state.s11n?.storeException(1, e);
          rc = state.sq3Codes.SQLITE_IOERR_UNLOCK;
        }
      }
      storeAndNotify("xUnlock", rc);
    },
    xWrite: async (fid: number, n: number, offset64: number) => {
      let rc: number;
      const fh = __openFiles[fid];
      try {
        affirmNotRO("xWrite", fh);
        rc =
          n ===
          (await getSyncHandle(fh, "xWrite")).write(
            fh.sabView.subarray(0, n) as unknown as BufferSource,
            {
              at: Number(offset64),
            },
          )
            ? 0
            : state.sq3Codes.SQLITE_IOERR_WRITE;
      } catch (e) {
        error("xWrite():", e, fh);
        state.s11n?.storeException(1, e);
        rc = GetSyncHandleError.convertRc(
          e,
          state.sq3Codes.SQLITE_IOERR_WRITE,
          state.sq3Codes,
        );
      }
      await releaseImplicitLock(fh);
      storeAndNotify("xWrite", rc);
    },
  };

  const initS11n = (): SerializationHelpers => {
    if (state.s11n) return state.s11n;
    const textDecoder = new TextDecoder();
    const textEncoder = new TextEncoder();
    const viewU8 = new Uint8Array(
      state.sabIO,
      state.sabS11nOffset,
      state.sabS11nSize,
    );
    const viewDV = new DataView(
      state.sabIO,
      state.sabS11nOffset,
      state.sabS11nSize,
    );
    const s11n: SerializationHelpers = Object.create(null);
    state.s11n = s11n;
    const typeIdsByName: Record<
      string,
      {
        id: number;
        size?: number;
        getter?: keyof DataView;
        setter?: keyof DataView;
      }
    > = Object.create(null);
    typeIdsByName.number = {
      id: 1,
      size: 8,
      getter: "getFloat64",
      setter: "setFloat64",
    };
    typeIdsByName.bigint = {
      id: 2,
      size: 8,
      getter: "getBigInt64",
      setter: "setBigInt64",
    };
    typeIdsByName.boolean = {
      id: 3,
      size: 4,
      getter: "getInt32",
      setter: "setInt32",
    };
    typeIdsByName.string = { id: 4 };
    const getTypeId = (v: SerializationValue) =>
      typeIdsByName[typeof v] ||
      toss("Maintenance required: this value type cannot be serialized.", v);
    const getTypeIdById = (
      tid: number,
    ): {
      id: number;
      size?: number;
      getter?: keyof DataView;
      setter?: keyof DataView;
    } => {
      switch (tid) {
        case typeIdsByName.number.id:
          return typeIdsByName.number;
        case typeIdsByName.bigint.id:
          return typeIdsByName.bigint;
        case typeIdsByName.boolean.id:
          return typeIdsByName.boolean;
        case typeIdsByName.string.id:
          return typeIdsByName.string;
        default:
          return toss("Invalid type ID:", tid);
      }
    };
    const readValue = (
      typeId: { getter?: keyof DataView; size?: number },
      offset: number,
    ): { value: SerializationValue; nextOffset: number } => {
      if (typeId.getter === "getFloat64") {
        return {
          value: viewDV.getFloat64(offset, state.littleEndian),
          nextOffset: offset + (typeId.size ?? 0),
        };
      }
      if (typeId.getter === "getBigInt64") {
        return {
          value: viewDV.getBigInt64(offset, state.littleEndian),
          nextOffset: offset + (typeId.size ?? 0),
        };
      }
      if (typeId.getter === "getInt32") {
        return {
          value: viewDV.getInt32(offset, state.littleEndian),
          nextOffset: offset + (typeId.size ?? 0),
        };
      }
      return toss("Unsupported getter:", typeId.getter);
    };
    const writeValue = (
      typeId: { setter?: keyof DataView; size?: number },
      offset: number,
      value: SerializationValue,
    ): number => {
      if (typeId.setter === "setFloat64") {
        viewDV.setFloat64(offset, value as number, state.littleEndian);
        return offset + (typeId.size ?? 0);
      }
      if (typeId.setter === "setBigInt64") {
        viewDV.setBigInt64(offset, value as bigint, state.littleEndian);
        return offset + (typeId.size ?? 0);
      }
      if (typeId.setter === "setInt32") {
        viewDV.setInt32(offset, value as number, state.littleEndian);
        return offset + (typeId.size ?? 0);
      }
      return toss("Unsupported setter:", typeId.setter);
    };
    s11n.deserialize = function (clear = false): SerializationValue[] {
      const argc = viewU8[0];
      const rc: SerializationValue[] = [];
      if (argc) {
        const typeIds: Array<{
          id: number;
          size?: number;
          getter?: keyof DataView;
          setter?: keyof DataView;
        }> = [];
        let offset = 1;
        for (let i = 0; i < argc; ++i, ++offset) {
          typeIds.push(getTypeIdById(viewU8[offset]));
        }
        for (let i = 0; i < argc; ++i) {
          const typeId = typeIds[i];
          if (typeId && typeId.getter && typeId.size) {
            const { value, nextOffset } = readValue(typeId, offset);
            offset = nextOffset;
            rc.push(value);
          } else {
            const n = viewDV.getInt32(offset, state.littleEndian);
            offset += 4;
            const v = textDecoder.decode(viewU8.slice(offset, offset + n));
            offset += n;
            rc.push(v);
          }
        }
      }
      if (clear) viewU8[0] = 0;

      return rc;
    };
    s11n.serialize = function (...args: SerializationValue[]): void {
      if (args.length) {
        const typeIds: Array<{
          id: number;
          size?: number;
          getter?: keyof DataView;
          setter?: keyof DataView;
        }> = [];
        let offset = 1;
        viewU8[0] = args.length & 0xff;
        for (let i = 0; i < args.length; ++i, ++offset) {
          typeIds.push(getTypeId(args[i]));
          viewU8[offset] = typeIds[i].id;
        }
        for (let i = 0; i < args.length; ++i) {
          const typeId = typeIds[i];
          if (typeId && typeId.setter && typeId.size) {
            offset = writeValue(typeId, offset, args[i]);
          } else {
            const s = textEncoder.encode(args[i] as string);
            viewDV.setInt32(offset, s.byteLength, state.littleEndian);
            offset += 4;
            viewU8.set(s, offset);
            offset += s.byteLength;
          }
        }
      } else {
        viewU8[0] = 0;
      }
    };

    s11n.storeException = state.asyncS11nExceptions
      ? (priority: number, e: unknown) => {
          if (priority <= state.asyncS11nExceptions) {
            const err = e as { name?: string; message?: string };
            s11n.serialize([err.name, ": ", err.message].join(""));
          }
        }
      : () => {};

    return s11n;
  };

  const waitLoop = async (): Promise<void> => {
    const opHandlers: Record<number, { key: string; f: VfsAsyncHandler }> =
      Object.create(null);
    for (const key of Object.keys(state.opIds)) {
      const handler = (vfsAsyncImpls as Record<string, VfsAsyncHandler>)[key];
      if (!handler) continue;
      opHandlers[state.opIds[key]] = { key, f: handler };
    }
    while (!flagAsyncShutdown) {
      try {
        if (
          "not-equal" !==
          Atomics.wait(
            state.sabOPView,
            state.opIds.whichOp,
            0,
            state.asyncIdleWaitTime,
          )
        ) {
          await releaseImplicitLocks();
          continue;
        }
        const opId = Atomics.load(state.sabOPView, state.opIds.whichOp);
        Atomics.store(state.sabOPView, state.opIds.whichOp, 0);
        const handler =
          opHandlers[opId] ?? toss("No waitLoop handler for whichOp #", opId);
        const args = state.s11n?.deserialize(true) || [];

        if (handler.f) await handler.f(...args);
        else error("Missing callback for opId", opId);
      } catch (e) {
        error("in waitLoop():", e);
      }
    }
  };

  navigator.storage
    .getDirectory()
    .then((rootDir) => {
      state.rootDir = rootDir;
      globalThis.onmessage = ({ data }) => {
        switch (data.type) {
          case "opfs-async-init": {
            const opt = data.args as OpfsProxyOptions;
            state.opIds = opt.opIds;
            state.sq3Codes = opt.sq3Codes;
            state.opfsFlags = opt.opfsFlags;
            state.asyncIdleWaitTime = opt.asyncIdleWaitTime;
            state.sabOP = opt.sabOP;
            state.sabIO = opt.sabIO;
            state.fileBufferSize = opt.fileBufferSize;
            state.sabS11nOffset = opt.sabS11nOffset;
            state.sabS11nSize = opt.sabS11nSize;
            state.littleEndian = opt.littleEndian;
            state.asyncS11nExceptions = opt.asyncS11nExceptions;
            state.verbose = opt.verbose ?? 1;
            state.sabOPView = new Int32Array(state.sabOP);
            state.sabFileBufView = new Uint8Array(
              state.sabIO,
              0,
              state.fileBufferSize,
            );
            state.sabS11nView = new Uint8Array(
              state.sabIO,
              state.sabS11nOffset,
              state.sabS11nSize,
            );
            Object.keys(vfsAsyncImpls).forEach((k) => {
              if (!Number.isFinite(state.opIds[k])) {
                toss("Maintenance required: missing state.opIds[", k, "]");
              }
            });
            initS11n();
            log("init state", state);
            wPost("opfs-async-inited");
            void waitLoop();
            break;
          }
          case "opfs-async-restart":
            if (flagAsyncShutdown) {
              warn(
                "Restarting after opfs-async-shutdown. Might or might not work.",
              );
              flagAsyncShutdown = false;
              void waitLoop();
            }
            break;
        }
      };
      wPost("opfs-async-loaded");
    })
    .catch((e) => error("error initializing OPFS asyncer:", e));
};

if (!globalThis.SharedArrayBuffer) {
  wPost(
    "opfs-unavailable",
    "Missing SharedArrayBuffer API.",
    "The server must emit the COOP/COEP response headers to enable that.",
  );
} else if (!globalThis.Atomics) {
  wPost(
    "opfs-unavailable",
    "Missing Atomics API.",
    "The server must emit the COOP/COEP response headers to enable that.",
  );
} else if (
  !globalThis.FileSystemHandle ||
  !globalThis.FileSystemDirectoryHandle ||
  !globalThis.FileSystemFileHandle ||
  !globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle ||
  !navigator?.storage?.getDirectory
) {
  wPost("opfs-unavailable", "Missing required OPFS APIs.");
} else {
  installAsyncProxy();
}
