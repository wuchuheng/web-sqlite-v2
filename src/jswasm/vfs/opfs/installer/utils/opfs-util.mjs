/**
 * Creates utility functions for OPFS filesystem operations.
 * @param {object} deps - Dependencies object
 * @returns {object} OPFS utility interface
 */
export function createOpfsUtil(deps) {
  const { state, util, sqlite3 } = deps;

  const opfsUtil = Object.create(null);

  /**
   * Generates a random filename.
   * @param {number} len - Filename length (default 16)
   * @returns {string} Random filename
   */
  opfsUtil.randomFilename = function f(len = 16) {
    if (!f._chars) {
      f._chars = 'abcdefghijklmnopqrstuvwxyz' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + '012346789';
      f._n = f._chars.length;
    }
    const a = [];
    for (let i = 0; i < len; ++i) {
      const ndx = ((Math.random() * (f._n * 64)) % f._n) | 0;
      a[i] = f._chars[ndx];
    }
    return a.join('');
  };

  /**
   * Resolves and normalizes a file path.
   * @param {string} filename - Input filename
   * @param {boolean} splitIt - Whether to split into components
   * @returns {string|Array} Path or path components
   */
  opfsUtil.getResolvedPath = function (filename, splitIt) {
    const p = new URL(filename, 'file://irrelevant').pathname;
    return splitIt ? p.split('/').filter((v) => !!v) : p;
  };

  /**
   * Gets directory handle for a filename.
   * @param {string} absFilename - Absolute filename
   * @param {boolean} createDirs - Whether to create missing directories
   * @returns {Promise<Array>} Directory handle and filename
   */
  opfsUtil.getDirForFilename = async function (absFilename, createDirs = false) {
    // 1. Input handling
    const path = opfsUtil.getResolvedPath(absFilename, true);
    const filename = path.pop();

    // 2. Core processing
    let dh = opfsUtil.rootDirectory;
    for (const dirName of path) {
      if (dirName) {
        dh = await dh.getDirectoryHandle(dirName, { create: !!createDirs });
      }
    }

    // 3. Output handling
    return [dh, filename];
  };

  /**
   * Creates a directory.
   * @param {string} absDirName - Absolute directory path
   * @returns {Promise<boolean>} Success status
   */
  opfsUtil.mkdir = async function (absDirName) {
    try {
      await opfsUtil.getDirForFilename(absDirName + '/filepart', true);
      return true;
    } catch (_e) {
      return false;
    }
  };

  /**
   * Checks if a filesystem entry exists.
   * @param {string} fsEntryName - Entry name to check
   * @returns {Promise<boolean>} True if exists
   */
  opfsUtil.entryExists = async function (fsEntryName) {
    try {
      const [dh, fn] = await opfsUtil.getDirForFilename(fsEntryName);
      await dh.getFileHandle(fn);
      return true;
    } catch (_e) {
      return false;
    }
  };

  /**
   * Lists directory tree structure.
   * @returns {Promise<object>} Tree structure with dirs and files
   */
  opfsUtil.treeList = async function () {
    const doDir = async function callee(dirHandle, tgt) {
      tgt.name = dirHandle.name;
      tgt.dirs = [];
      tgt.files = [];
      for await (const handle of dirHandle.values()) {
        if ('directory' === handle.kind) {
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

  /**
   * Removes all files and directories recursively.
   * @returns {Promise<void>}
   */
  opfsUtil.rmfr = async function () {
    const dir = opfsUtil.rootDirectory;
    const opt = { recurse: true };
    for await (const handle of dir.values()) {
      dir.removeEntry(handle.name, opt);
    }
  };

  /**
   * Removes a filesystem entry.
   * @param {string} fsEntryName - Entry name to remove
   * @param {boolean} recursive - Whether to remove recursively
   * @param {boolean} throwOnError - Whether to throw on error
   * @returns {Promise<boolean>} Success status
   */
  opfsUtil.unlink = async function (fsEntryName, recursive = false, throwOnError = false) {
    try {
      const [hDir, filenamePart] = await opfsUtil.getDirForFilename(fsEntryName, false);
      await hDir.removeEntry(filenamePart, { recursive });
      return true;
    } catch (e) {
      if (throwOnError) {
        throw new Error('unlink(', arguments[0], ') failed: ' + e.message, { cause: e });
      }
      return false;
    }
  };

  /**
   * Traverses directory structure.
   * @param {object|Function} opt - Options or callback function
   * @returns {Promise<void>}
   */
  opfsUtil.traverse = async function (opt) {
    // 1. Input handling
    const defaultOpt = {
      recursive: true,
      directory: opfsUtil.rootDirectory,
    };
    if ('function' === typeof opt) {
      opt = { callback: opt };
    }
    opt = Object.assign(defaultOpt, opt || {});

    // 2. Core processing
    const doDir = async function callee(dirHandle, depth) {
      for await (const handle of dirHandle.values()) {
        if (false === opt.callback(handle, dirHandle, depth)) return false;
        else if (opt.recursive && 'directory' === handle.kind) {
          if (false === (await callee(handle, depth + 1))) break;
        }
      }
    };
    doDir(opt.directory, 0);
  };

  /**
   * Imports database from byte chunks.
   * @param {string} filename - Target filename
   * @param {Function} callback - Chunk provider callback
   * @returns {Promise<number>} Number of bytes written
   */
  const importDbChunked = async function (filename, callback) {
    // 1. Input handling
    const [hDir, fnamePart] = await opfsUtil.getDirForFilename(filename, true);
    const hFile = await hDir.getFileHandle(fnamePart, { create: true });
    let sah = await hFile.createSyncAccessHandle();

    // 2. Core processing
    let nWrote = 0;
    let chunk;
    let checkedHeader = false;
    try {
      sah.truncate(0);
      while (undefined !== (chunk = await callback())) {
        if (chunk instanceof ArrayBuffer) chunk = new Uint8Array(chunk);
        if (0 === nWrote && chunk.byteLength >= 15) {
          util.affirmDbHeader(chunk);
          checkedHeader = true;
        }
        sah.write(chunk, { at: nWrote });
        nWrote += chunk.byteLength;
      }
      if (nWrote < 512 || 0 !== nWrote % 512) {
        throw new Error(`Input size ${nWrote} is not correct for an SQLite database.`);
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
      await sah.close();
      sah = undefined;
      await hDir.removeEntry(fnamePart).catch(() => {});
      throw e;
    } finally {
      if (sah) await sah.close();
    }
  };

  /**
   * Imports database from bytes or chunked callback.
   * @param {string} filename - Target filename
   * @param {Function|ArrayBuffer|Uint8Array} bytes - Data source
   * @returns {Promise<number>} Number of bytes written
   */
  opfsUtil.importDb = async function (filename, bytes) {
    // 1. Input handling
    if (bytes instanceof Function) {
      return importDbChunked(filename, bytes);
    }
    if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
    util.affirmIsDb(bytes);
    const n = bytes.byteLength;

    // 2. Core processing
    const [hDir, fnamePart] = await opfsUtil.getDirForFilename(filename, true);
    let sah;
    let nWrote = 0;
    try {
      const hFile = await hDir.getFileHandle(fnamePart, { create: true });
      sah = await hFile.createSyncAccessHandle();
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
   * @param {object} metrics - Metrics object
   * @param {Worker} W - Worker instance
   */
  opfsUtil.metrics = {
    /**
     * Dumps metrics to console.
     */
    dump: function (metrics, W) {
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
        'metrics for',
        globalThis.location.href,
        ':',
        metrics,
        '\nTotal of',
        n,
        'op(s) for',
        t,
        'ms (incl. ' + w + ' ms of waiting on the async side)'
      );
      sqlite3.config.log('Serialization metrics:', metrics.s11n);
      W.postMessage({ type: 'opfs-async-metrics' });
    },

    /**
     * Resets metrics counters.
     */
    reset: function (metrics) {
      const r = (m) => ((m.count = m.time = m.wait = 0));
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
   * @param {Function} opRun - Operation runner
   * @param {Worker} W - Worker instance
   * @param {Function} warn - Warning logger
   */
  opfsUtil.debug = {
    asyncShutdown: function (opRun, warn) {
      warn('Shutting down OPFS async listener. The OPFS VFS will no longer work.');
      opRun('opfs-async-shutdown');
    },
    asyncRestart: function (W, warn) {
      warn('Attempting to restart OPFS VFS async listener. Might work, might not.');
      W.postMessage({ type: 'opfs-async-restart' });
    },
  };

  return opfsUtil;
}
