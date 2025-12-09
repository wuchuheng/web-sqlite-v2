/**
 * @module opfs-util
 * Filesystem utilities for the OPFS VFS installer.
 */

// We need to define types that were previously implicit or in missing .d.ts files
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
export interface OpfsUtilDeps {
  state: {
    opIds: Record<string, unknown>;
    [key: string]: unknown;
  };
  util: {
    affirmIsDb: (bytes: Uint8Array) => void;
    affirmDbHeader: (bytes: Uint8Array) => void;
    [key: string]: unknown;
  };
  sqlite3: {
    config: {
      log: (...args: unknown[]) => void;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

export interface TreeListEntry {
  name?: string;
  dirs: TreeListEntry[];
  files: string[];
}

export interface OpfsUtilInterface {
  rootDirectory: FileSystemDirectoryHandle;
  randomFilename: (len?: number) => string;
  getResolvedPath: (filename: string, splitIt?: boolean) => string | string[];
  getDirForFilename: (
    absFilename: string,
    createDirs?: boolean,
  ) => Promise<[FileSystemDirectoryHandle, string]>;
  mkdir: (absDirName: string) => Promise<boolean>;
  entryExists: (fsEntryName: string) => Promise<boolean>;
  treeList: () => Promise<TreeListEntry>;
  rmfr: () => Promise<void>;
  unlink: (
    fsEntryName: string,
    recursive?: boolean,
    throwOnError?: boolean,
  ) => Promise<boolean>;
  traverse: (opt: TraverseOptions | TraverseCallback) => Promise<void>;
  importDb: (
    filename: string,
    bytes: ArrayBuffer | Uint8Array | (() => Promise<Uint8Array | undefined>),
  ) => Promise<number>;
  metrics: {
    dump: (metrics: any, W: Worker) => void;
    reset: (metrics: any) => void;
  };
  debug: {
    asyncShutdown: (
      opRun: (op: string) => void,
      warn: (...args: any[]) => void,
    ) => void;
    asyncRestart: (W: Worker, warn: (...args: any[]) => void) => void;
  };
}

export type TraverseCallback = (
  handle: FileSystemHandle,
  dirHandle: FileSystemDirectoryHandle,
  depth: number,
) => boolean | void | Promise<boolean | void>;

export interface TraverseOptions {
  callback: TraverseCallback;
  recursive?: boolean;
  directory?: FileSystemDirectoryHandle;
}

/**
 * Creates utility functions for OPFS filesystem operations.
 * @param deps - Dependencies object
 * @returns OPFS utility interface
 */
export function createOpfsUtil(deps: OpfsUtilDeps): OpfsUtilInterface {
  const { state, util, sqlite3 } = deps;

  // Use a Partial to construct the object, but cast to full interface at return
  // Note: rootDirectory is NOT initialized here, but expected to be assigned later by the caller?
  // In the original .mjs, it was `const opfsUtil = Object.create(null);` and methods were added.
  // However, usages show `opfsUtil.rootDirectory` being accessed.
  // The consumer of createOpfsUtil must assign `rootDirectory`.
  const opfsUtil = Object.create(null) as Partial<OpfsUtilInterface>;

  /**
   * Generates a random filename.
   * @param len - Filename length (default 16)
   * @returns Random filename
   */
  const randomFilename = function f(len: number = 16): string {
    const func = f as unknown as { _chars: string; _n: number };
    if (!func._chars) {
      func._chars =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012346789";
      func._n = func._chars.length;
    }
    const a: string[] = [];
    for (let i = 0; i < len; ++i) {
      const ndx = (Math.random() * (func._n * 64)) % func._n | 0;
      a[i] = func._chars[ndx];
    }
    return a.join("");
  };
  opfsUtil.randomFilename = randomFilename;

  /**
   * Resolves and normalizes a file path.
   * @param filename - Input filename
   * @param splitIt - Whether to split into components
   * @returns Path or path components
   */
  opfsUtil.getResolvedPath = function (
    filename: string,
    splitIt?: boolean,
  ): string | string[] {
    const p = new URL(filename, "file://irrelevant").pathname;
    return splitIt ? p.split("/").filter((v) => !!v) : p;
  };

  /**
   * Gets directory handle for a filename.
   * @param absFilename - Absolute filename
   * @param createDirs - Whether to create missing directories
   * @returns Directory handle and filename
   */
  opfsUtil.getDirForFilename = async function (
    absFilename: string,
    createDirs = false,
  ): Promise<[FileSystemDirectoryHandle, string]> {
    // 1. Input handling
    const path = opfsUtil.getResolvedPath!(absFilename, true) as string[];
    const filename = path.pop();
    if (filename === undefined) throw new Error("Invalid filename");

    // 2. Core processing
    // We assume rootDirectory is set by the time this is called
    let dh = opfsUtil.rootDirectory!;
    for (const dirName of path) {
      if (dirName) {
        dh = await dh.getDirectoryHandle(dirName, {
          create: !!createDirs,
        });
      }
    }

    // 3. Output handling
    return [dh, filename];
  };

  /**
   * Creates a directory.
   * @param absDirName - Absolute directory path
   * @returns Success status
   */
  opfsUtil.mkdir = async function (absDirName: string): Promise<boolean> {
    try {
      await opfsUtil.getDirForFilename!(absDirName + "/filepart", true);
      return true;
    } catch (_e) {
      return false;
    }
  };

  /**
   * Checks if a filesystem entry exists.
   * @param fsEntryName - Entry name to check
   * @returns True if exists
   */
  opfsUtil.entryExists = async function (
    fsEntryName: string,
  ): Promise<boolean> {
    try {
      const [dh, fn] = await opfsUtil.getDirForFilename!(fsEntryName);
      await dh.getFileHandle(fn);
      return true;
    } catch (_e) {
      return false;
    }
  };

  /**
   * Lists directory tree structure.
   * @returns Tree structure with dirs and files
   */
  opfsUtil.treeList = async function (): Promise<TreeListEntry> {
    const doDir = async function callee(
      dirHandle: FileSystemDirectoryHandle,
      tgt: TreeListEntry,
    ) {
      tgt.name = dirHandle.name;
      tgt.dirs = [];
      tgt.files = [];
      // @ts-ignore - values() iterator types might be missing in some environments
      for await (const handle of dirHandle.values()) {
        if ("directory" === handle.kind) {
          const subDir = Object.create(null) as TreeListEntry;
          tgt.dirs.push(subDir);
          await callee(handle as FileSystemDirectoryHandle, subDir);
        } else {
          tgt.files.push(handle.name);
        }
      }
    };
    const root = Object.create(null) as TreeListEntry;
    await doDir(opfsUtil.rootDirectory!, root);
    return root;
  };

  /**
   * Removes all files and directories recursively.
   */
  opfsUtil.rmfr = async function (): Promise<void> {
    const dir = opfsUtil.rootDirectory!;
    const opt = { recurse: true };
    // @ts-ignore
    for await (const handle of dir.values()) {
      // @ts-ignore - removeEntry options might differ in types
      dir.removeEntry(handle.name, opt);
    }
  };

  /**
   * Removes a filesystem entry.
   * @param fsEntryName - Entry name to remove
   * @param recursive - Whether to remove recursively
   * @param throwOnError - Whether to throw on error
   * @returns Success status
   */
  opfsUtil.unlink = async function (
    fsEntryName: string,
    recursive = false,
    throwOnError = false,
  ): Promise<boolean> {
    try {
      const [hDir, filenamePart] = await opfsUtil.getDirForFilename!(
        fsEntryName,
        false,
      );
      await hDir.removeEntry(filenamePart, { recursive });
      return true;
    } catch (e: any) {
      if (throwOnError) {
        throw new Error(
          "unlink(" +
            fsEntryName +
            ") failed" +
            (e instanceof Error ? ": " + e.message : ""),
        );
      }
      return false;
    }
  };

  /**
   * Traverses directory structure.
   * @param opt - Options or callback function
   */
  opfsUtil.traverse = async function (
    opt: TraverseOptions | TraverseCallback,
  ): Promise<void> {
    // 1. Input handling
    const defaultOpt: TraverseOptions = {
      callback: (() => {}) as TraverseCallback, // Dummy default
      recursive: true,
      directory: opfsUtil.rootDirectory,
    };
    if ("function" === typeof opt) {
      opt = { callback: opt };
    }
    const finalOpt = Object.assign(defaultOpt, opt || {}) as TraverseOptions;

    // 2. Core processing
    const doDir = async function callee(
      dirHandle: FileSystemDirectoryHandle,
      depth: number,
    ): Promise<boolean | void> {
      // @ts-expect-error dirHandle.values is valid for DirectoryHandle
      for await (const handle of dirHandle.values()) {
        if (false === finalOpt.callback(handle, dirHandle, depth)) return false;
        else if (finalOpt.recursive && "directory" === handle.kind) {
          if (
            false ===
            (await callee(handle as FileSystemDirectoryHandle, depth + 1))
          )
            break;
        }
      }
    };
    if (finalOpt.directory) {
      await doDir(finalOpt.directory, 0);
    }
  };

  /**
   * Imports database from byte chunks.
   * @param filename - Target filename
   * @param callback - Chunk provider callback
   * @returns Number of bytes written
   */
  const importDbChunked = async function (
    filename: string,
    callback: () => Promise<Uint8Array | undefined>,
  ): Promise<number> {
    // 1. Input handling
    const [hDir, fnamePart] = await opfsUtil.getDirForFilename!(filename, true);
    const hFile = await hDir.getFileHandle(fnamePart, { create: true });
    // @ts-ignore - createSyncAccessHandle types
    let sah: any = await hFile.createSyncAccessHandle();

    // 2. Core processing
    let nWrote = 0;
    let chunk: Uint8Array | undefined;
    let checkedHeader = false;
    try {
      sah.truncate(0);
      while (undefined !== (chunk = await callback())) {
        if (chunk instanceof ArrayBuffer) chunk = new Uint8Array(chunk);
        if (0 === nWrote && chunk!.byteLength >= 15) {
          util.affirmDbHeader(chunk!);
          checkedHeader = true;
        }
        sah.write(chunk, { at: nWrote });
        nWrote += chunk!.byteLength;
      }
      if (nWrote < 512 || 0 !== nWrote % 512) {
        throw new Error(
          `Input size ${nWrote} is not correct for an SQLite database.`,
        );
      }
      if (!checkedHeader) {
        const header = new Uint8Array(20);
        sah.read(header, { at: 0 });
        util.affirmDbHeader(header);
      }
      sah.write(new Uint8Array([1, 1]), { at: 18 });

      // 3. Output handling
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

  /**
   * Imports database from bytes or chunked callback.
   * @param filename - Target filename
   * @param bytes - Data source
   * @returns Number of bytes written
   */
  opfsUtil.importDb = async function (
    filename: string,
    bytes: ArrayBuffer | Uint8Array | (() => Promise<Uint8Array | undefined>),
  ): Promise<number> {
    // 1. Input handling
    if (bytes instanceof Function) {
      return importDbChunked(filename, bytes);
    }
    if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
    util.affirmIsDb(bytes as Uint8Array);
    const n = (bytes as Uint8Array).byteLength;

    // 2. Core processing
    const [hDir, fnamePart] = await opfsUtil.getDirForFilename!(filename, true);
    let sah: any;
    let nWrote = 0;
    try {
      const hFile = await hDir.getFileHandle(fnamePart, { create: true });
      const sah = await hFile.createSyncAccessHandle();
      sah.truncate(0);
      nWrote = sah.write(bytes, { at: 0 });
      if (nWrote !== n) {
        throw new Error(`Expected to write ${n} bytes but wrote ${nWrote}.`);
      }
      sah.write(new Uint8Array([1, 1]), { at: 18 });

      // 3. Output handling
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

  /**
   * Creates metrics dumper and resetter.
   */
  opfsUtil.metrics = {
    /**
     * Dumps metrics to console.
     */
    dump: function (metrics: any, W: Worker) {
      let n = 0;
      let t = 0;
      let w = 0;
      for (const k in state.opIds) {
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
        "ms (incl. " + w + " ms of waiting on the async side)",
      );
      sqlite3.config.log("Serialization metrics:", metrics.s11n);
      W.postMessage({ type: "opfs-async-metrics" });
    },

    /**
     * Resets metrics counters.
     */
    reset: function (metrics: any) {
      const r = (m: any) => (m.count = m.time = m.wait = 0);
      for (const k in state.opIds) {
        r((metrics[k] = Object.create(null)));
      }
      let s = (metrics.s11n = Object.create(null));
      s = s.serialize = Object.create(null);
      s.count = s.time = 0;
      s = metrics.s11n.deserialize = Object.create(null);
      s.count = s.time = 0;
    },
  };

  /**
   * Creates debug utilities.
   */
  opfsUtil.debug = {
    asyncShutdown: function (
      opRun: (op: string) => void,
      warn: (...args: any[]) => void,
    ) {
      warn(
        "Shutting down OPFS async listener. The OPFS VFS will no longer work.",
      );
      opRun("opfs-async-shutdown");
    },
    asyncRestart: function (W: Worker, warn: (...args: any[]) => void) {
      warn(
        "Attempting to restart OPFS VFS async listener. Might work, might not.",
      );
      W.postMessage({ type: "opfs-async-restart" });
    },
  };

  return opfsUtil as OpfsUtilInterface;
}
