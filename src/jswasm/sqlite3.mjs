/*
 ** LICENSE for the sqlite3 WebAssembly/JavaScript APIs.
 **
 ** This bundle (typically released as sqlite3.js or sqlite3.mjs)
 ** is an amalgamation of JavaScript source code from two projects:
 **
 ** 1) https://emscripten.org: the Emscripten "glue code" is covered by
 **    the terms of the MIT license and University of Illinois/NCSA
 **    Open Source License, as described at:
 **
 **    https://emscripten.org/docs/introducing_emscripten/emscripten_license.html
 **
 ** 2) https://sqlite.org: all code and documentation labeled as being
 **    from this source are released under the same terms as the sqlite3
 **    C library:
 **
 ** 2022-10-16
 **
 ** The author disclaims copyright to this source code.  In place of a
 ** legal notice, here is a blessing:
 **
 ** *   May you do good and not evil.
 ** *   May you find forgiveness for yourself and forgive others.
 ** *   May you share freely, never taking more than you give.
 */
/*
 ** This code was built from sqlite3 version...
 **
 ** SQLITE_VERSION "3.50.4"
 ** SQLITE_VERSION_NUMBER 3050004
 ** SQLITE_SOURCE_ID "2025-07-30 19:33:53 4d8adfb30e03f9cf27f800a2c1ba3c48fb4ca1b08b0f5ed59a4d5ecbf45e20a3"
 **
 ** Using the Emscripten SDK version 3.1.70.
 */
import { runSQLite3PostLoadInit } from "./sqlite3Apibootstrap.mjs";
import { PATH, createPathFS } from "./utils/path.mjs";
import {
    UTF8ArrayToString,
    lengthBytesUTF8,
    stringToUTF8Array,
    intArrayFromString,
} from "./utils/utf8.mjs";

export let Module;

export let wasmExports;

var sqlite3InitModule = (() => {
    var _scriptName = import.meta.url;

    return function (moduleArg = {}) {
        var moduleRtn;

        Module = moduleArg;

        var readyPromiseResolve, readyPromiseReject;
        var readyPromise = new Promise((resolve, reject) => {
            readyPromiseResolve = resolve;
            readyPromiseReject = reject;
        });

        var ENVIRONMENT_IS_WEB = typeof window == "object";
        var ENVIRONMENT_IS_WORKER = typeof importScripts == "function";

        const sqlite3InitModuleState =
            globalThis.sqlite3InitModuleState ||
            Object.assign(Object.create(null), {
                debugModule: () => {},
            });
        delete globalThis.sqlite3InitModuleState;
        sqlite3InitModuleState.debugModule(
            "globalThis.location =",
            globalThis.location
        );

        Module["locateFile"] = function (path, _prefix) {
            return new URL(path, import.meta.url).href;
        }.bind(sqlite3InitModuleState);

        var moduleOverrides = Object.assign({}, Module);

        var thisProgram = "./this.program";

        var scriptDirectory = "";
        function locateFile(path) {
            if (Module["locateFile"]) {
                return Module["locateFile"](path, scriptDirectory);
            }
            return scriptDirectory + path;
        }

        var readAsync, readBinary;

        if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
            if (ENVIRONMENT_IS_WORKER) {
                scriptDirectory = self.location.href;
            } else if (
                typeof document != "undefined" &&
                document.currentScript
            ) {
                scriptDirectory = document.currentScript.src;
            }

            if (_scriptName) {
                scriptDirectory = _scriptName;
            }

            if (scriptDirectory.startsWith("blob:")) {
                scriptDirectory = "";
            } else {
                scriptDirectory = scriptDirectory.substr(
                    0,
                    scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1
                );
            }

            {
                if (ENVIRONMENT_IS_WORKER) {
                    readBinary = (url) => {
                        var xhr = new XMLHttpRequest();
                        xhr.open("GET", url, false);
                        xhr.responseType = "arraybuffer";
                        xhr.send(null);
                        return new Uint8Array(xhr.response);
                    };
                }

                readAsync = (url) => {
                    return fetch(url, { credentials: "same-origin" }).then(
                        (response) => {
                            if (response.ok) {
                                return response.arrayBuffer();
                            }
                            return Promise.reject(
                                new Error(
                                    response.status + " : " + response.url
                                )
                            );
                        }
                    );
                };
            }
        }

        var out = Module["print"] || console.log.bind(console);
        var err = Module["printErr"] || console.error.bind(console);

        Object.assign(Module, moduleOverrides);

        moduleOverrides = null;

        if (Module["thisProgram"]) thisProgram = Module["thisProgram"];

        var wasmBinary = Module["wasmBinary"];

        var wasmMemory;

        var ABORT = false;

        var HEAP8, HEAPU8, HEAP16, HEAP32, HEAPU32, HEAP64;

        function updateMemoryViews() {
            var b = wasmMemory.buffer;
            Module["HEAP8"] = HEAP8 = new Int8Array(b);
            Module["HEAP16"] = HEAP16 = new Int16Array(b);
            Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
            Module["HEAPU16"] = new Uint16Array(b);
            Module["HEAP32"] = HEAP32 = new Int32Array(b);
            Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
            Module["HEAPF32"] = new Float32Array(b);
            Module["HEAPF64"] = new Float64Array(b);
            Module["HEAP64"] = HEAP64 = new BigInt64Array(b);
            Module["HEAPU64"] = new BigUint64Array(b);
        }

        if (Module["wasmMemory"]) {
            wasmMemory = Module["wasmMemory"];
        } else {
            var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 16777216;

            wasmMemory = new WebAssembly.Memory({
                initial: INITIAL_MEMORY / 65536,

                maximum: 32768,
            });
        }

        updateMemoryViews();

        var __ATPRERUN__ = [];
        var __ATINIT__ = [];
        var __ATPOSTRUN__ = [];

        let runtimeInitialized = false;

        function preRun() {
            var preRuns = Module["preRun"];
            if (preRuns) {
                if (typeof preRuns == "function") preRuns = [preRuns];
                preRuns.forEach(addOnPreRun);
            }
            callRuntimeCallbacks(__ATPRERUN__);
        }

        function initRuntime() {
            runtimeInitialized = true;
            console.log(runtimeInitialized);

            if (!Module["noFSInit"] && !FS.initialized) FS.init();
            FS.ignorePermissions = false;

            TTY.init();
            callRuntimeCallbacks(__ATINIT__);
        }

        function postRun() {
            var postRuns = Module["postRun"];
            if (postRuns) {
                if (typeof postRuns == "function") postRuns = [postRuns];
                postRuns.forEach(addOnPostRun);
            }

            callRuntimeCallbacks(__ATPOSTRUN__);
        }

        function addOnPreRun(cb) {
            __ATPRERUN__.unshift(cb);
        }

        function addOnInit(cb) {
            __ATINIT__.unshift(cb);
        }

        function addOnPostRun(cb) {
            __ATPOSTRUN__.unshift(cb);
        }

        var runDependencies = 0;
        var runDependencyWatcher = null;
        var dependenciesFulfilled = null;

        function getUniqueRunDependency(id) {
            return id;
        }

        function addRunDependency(_id) {
            runDependencies++;

            Module["monitorRunDependencies"]?.(runDependencies);
        }

        function removeRunDependency(_id) {
            runDependencies--;

            Module["monitorRunDependencies"]?.(runDependencies);

            if (runDependencies == 0) {
                if (runDependencyWatcher !== null) {
                    clearInterval(runDependencyWatcher);
                    runDependencyWatcher = null;
                }
                if (dependenciesFulfilled) {
                    var callback = dependenciesFulfilled;
                    dependenciesFulfilled = null;
                    callback();
                }
            }
        }

        function abort(what) {
            Module["onAbort"]?.(what);

            what = "Aborted(" + what + ")";

            err(what);

            ABORT = true;

            what += ". Build with -sASSERTIONS for more info.";

            var e = new WebAssembly.RuntimeError(what);

            readyPromiseReject(e);

            throw e;
        }

        var dataURIPrefix = "data:application/octet-stream;base64,";

        var isDataURI = (filename) => filename.startsWith(dataURIPrefix);

        function findWasmBinary() {
            if (Module["locateFile"]) {
                var f = "sqlite3.wasm";
                if (!isDataURI(f)) {
                    return locateFile(f);
                }
                return f;
            }

            return new URL("sqlite3.wasm", import.meta.url).href;
        }

        var wasmBinaryFile;

        function getBinarySync(file) {
            if (file == wasmBinaryFile && wasmBinary) {
                return new Uint8Array(wasmBinary);
            }
            if (readBinary) {
                return readBinary(file);
            }
            throw "both async and sync fetching of the wasm failed";
        }

        function getBinaryPromise(binaryFile) {
            if (!wasmBinary) {
                return readAsync(binaryFile).then(
                    (response) => new Uint8Array(response),

                    () => getBinarySync(binaryFile)
                );
            }

            return Promise.resolve().then(() => getBinarySync(binaryFile));
        }

        function instantiateArrayBuffer(binaryFile, imports, receiver) {
            return getBinaryPromise(binaryFile)
                .then((binary) => {
                    return WebAssembly.instantiate(binary, imports);
                })
                .then(receiver, (reason) => {
                    err(`failed to asynchronously prepare wasm: ${reason}`);

                    abort(reason);
                });
        }

        function instantiateAsync(binary, binaryFile, imports, callback) {
            if (
                !binary &&
                typeof WebAssembly.instantiateStreaming == "function" &&
                !isDataURI(binaryFile) &&
                typeof fetch == "function"
            ) {
                return fetch(binaryFile, { credentials: "same-origin" }).then(
                    (response) => {
                        var result = WebAssembly.instantiateStreaming(
                            response,
                            imports
                        );

                        return result.then(callback, function (reason) {
                            err(`wasm streaming compile failed: ${reason}`);
                            err("falling back to ArrayBuffer instantiation");
                            return instantiateArrayBuffer(
                                binaryFile,
                                imports,
                                callback
                            );
                        });
                    }
                );
            }
            return instantiateArrayBuffer(binaryFile, imports, callback);
        }

        function getWasmImports() {
            return {
                env: wasmImports,
                wasi_snapshot_preview1: wasmImports,
            };
        }

        function createWasm() {
            var info = getWasmImports();

            function receiveInstance(instance, _module) {
                wasmExports = instance.exports;

                addOnInit(wasmExports["__wasm_call_ctors"]);

                removeRunDependency("wasm-instantiate");
                return wasmExports;
            }

            addRunDependency("wasm-instantiate");

            function receiveInstantiationResult(result) {
                receiveInstance(result["instance"]);
            }

            if (Module["instantiateWasm"]) {
                try {
                    return Module["instantiateWasm"](info, receiveInstance);
                } catch (e) {
                    err(
                        `Module.instantiateWasm callback failed with error: ${e}`
                    );

                    readyPromiseReject(e);
                }
            }

            wasmBinaryFile ??= findWasmBinary();

            instantiateAsync(
                wasmBinary,
                wasmBinaryFile,
                info,
                receiveInstantiationResult
            ).catch(readyPromiseReject);
            return {};
        }

        var callRuntimeCallbacks = (callbacks) => {
            callbacks.forEach((f) => f(Module));
        };

        var initRandomFill = () => {
            if (
                typeof crypto == "object" &&
                typeof crypto["getRandomValues"] == "function"
            ) {
                return (view) => crypto.getRandomValues(view);
            } else abort("initRandomDevice");
        };
        var randomFill = (view) => {
            return (randomFill = initRandomFill())(view);
        };

        var FS_stdin_getChar_buffer = [];

        var FS_stdin_getChar = () => {
            if (!FS_stdin_getChar_buffer.length) {
                var result = null;
                if (
                    typeof window != "undefined" &&
                    typeof window.prompt == "function"
                ) {
                    result = window.prompt("Input: ");
                    if (result !== null) {
                        result += "\n";
                    }
                }
                if (!result) {
                    return null;
                }
                FS_stdin_getChar_buffer = intArrayFromString(result, true);
            }
            return FS_stdin_getChar_buffer.shift();
        };
        var TTY = {
            ttys: [],
            init() {},
            shutdown() {},
            register(dev, ops) {
                TTY.ttys[dev] = { input: [], output: [], ops: ops };
                FS.registerDevice(dev, TTY.stream_ops);
            },
            stream_ops: {
                open(stream) {
                    var tty = TTY.ttys[stream.node.rdev];
                    if (!tty) {
                        throw new FS.ErrnoError(43);
                    }
                    stream.tty = tty;
                    stream.seekable = false;
                },
                close(stream) {
                    stream.tty.ops.fsync(stream.tty);
                },
                fsync(stream) {
                    stream.tty.ops.fsync(stream.tty);
                },
                read(stream, buffer, offset, length, _pos) {
                    if (!stream.tty || !stream.tty.ops.get_char) {
                        throw new FS.ErrnoError(60);
                    }
                    var bytesRead = 0;
                    for (var i = 0; i < length; i++) {
                        var result;
                        try {
                            result = stream.tty.ops.get_char(stream.tty);
                        } catch (_e) {
                            throw new FS.ErrnoError(29);
                        }
                        if (result === undefined && bytesRead === 0) {
                            throw new FS.ErrnoError(6);
                        }
                        if (result === null || result === undefined) break;
                        bytesRead++;
                        buffer[offset + i] = result;
                    }
                    if (bytesRead) {
                        stream.node.timestamp = Date.now();
                    }
                    return bytesRead;
                },
                write(stream, buffer, offset, length, _pos) {
                    if (!stream.tty || !stream.tty.ops.put_char) {
                        throw new FS.ErrnoError(60);
                    }
                    try {
                        for (var i = 0; i < length; i++) {
                            stream.tty.ops.put_char(
                                stream.tty,
                                buffer[offset + i]
                            );
                        }
                    } catch (_e) {
                        throw new FS.ErrnoError(29);
                    }
                    if (length) {
                        stream.node.timestamp = Date.now();
                    }
                    return i;
                },
            },
            default_tty_ops: {
                get_char(_tty) {
                    return FS_stdin_getChar();
                },
                put_char(tty, val) {
                    if (val === null || val === 10) {
                        out(UTF8ArrayToString(tty.output));
                        tty.output = [];
                    } else {
                        if (val != 0) tty.output.push(val);
                    }
                },
                fsync(tty) {
                    if (tty.output && tty.output.length > 0) {
                        out(UTF8ArrayToString(tty.output));
                        tty.output = [];
                    }
                },
                ioctl_tcgets(_tty) {
                    return {
                        c_iflag: 25856,
                        c_oflag: 5,
                        c_cflag: 191,
                        c_lflag: 35387,
                        c_cc: [
                            0x03, 0x1c, 0x7f, 0x15, 0x04, 0x00, 0x01, 0x00,
                            0x11, 0x13, 0x1a, 0x00, 0x12, 0x0f, 0x17, 0x16,
                            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        ],
                    };
                },
                ioctl_tcsets(_tty, _optional_actions, _data) {
                    return 0;
                },
                ioctl_tiocgwinsz(_tty) {
                    return [24, 80];
                },
            },
            default_tty1_ops: {
                put_char(tty, val) {
                    if (val === null || val === 10) {
                        err(UTF8ArrayToString(tty.output));
                        tty.output = [];
                    } else {
                        if (val != 0) tty.output.push(val);
                    }
                },
                fsync(tty) {
                    if (tty.output && tty.output.length > 0) {
                        err(UTF8ArrayToString(tty.output));
                        tty.output = [];
                    }
                },
            },
        };

        var zeroMemory = (address, size) => {
            HEAPU8.fill(0, address, address + size);
        };

        var alignMemory = (size, alignment) => {
            return Math.ceil(size / alignment) * alignment;
        };
        var mmapAlloc = (size) => {
            size = alignMemory(size, 65536);
            var ptr = _emscripten_builtin_memalign(65536, size);
            if (ptr) zeroMemory(ptr, size);
            return ptr;
        };
        var MEMFS = {
            ops_table: null,
            mount(_mount) {
                return MEMFS.createNode(null, "/", 16384 | 511, 0);
            },
            createNode(parent, name, mode, dev) {
                if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
                    throw new FS.ErrnoError(63);
                }
                MEMFS.ops_table ||= {
                    dir: {
                        node: {
                            getattr: MEMFS.node_ops.getattr,
                            setattr: MEMFS.node_ops.setattr,
                            lookup: MEMFS.node_ops.lookup,
                            mknod: MEMFS.node_ops.mknod,
                            rename: MEMFS.node_ops.rename,
                            unlink: MEMFS.node_ops.unlink,
                            rmdir: MEMFS.node_ops.rmdir,
                            readdir: MEMFS.node_ops.readdir,
                            symlink: MEMFS.node_ops.symlink,
                        },
                        stream: {
                            llseek: MEMFS.stream_ops.llseek,
                        },
                    },
                    file: {
                        node: {
                            getattr: MEMFS.node_ops.getattr,
                            setattr: MEMFS.node_ops.setattr,
                        },
                        stream: {
                            llseek: MEMFS.stream_ops.llseek,
                            read: MEMFS.stream_ops.read,
                            write: MEMFS.stream_ops.write,
                            allocate: MEMFS.stream_ops.allocate,
                            mmap: MEMFS.stream_ops.mmap,
                            msync: MEMFS.stream_ops.msync,
                        },
                    },
                    link: {
                        node: {
                            getattr: MEMFS.node_ops.getattr,
                            setattr: MEMFS.node_ops.setattr,
                            readlink: MEMFS.node_ops.readlink,
                        },
                        stream: {},
                    },
                    chrdev: {
                        node: {
                            getattr: MEMFS.node_ops.getattr,
                            setattr: MEMFS.node_ops.setattr,
                        },
                        stream: FS.chrdev_stream_ops,
                    },
                };
                var node = FS.createNode(parent, name, mode, dev);
                if (FS.isDir(node.mode)) {
                    node.node_ops = MEMFS.ops_table.dir.node;
                    node.stream_ops = MEMFS.ops_table.dir.stream;
                    node.contents = {};
                } else if (FS.isFile(node.mode)) {
                    node.node_ops = MEMFS.ops_table.file.node;
                    node.stream_ops = MEMFS.ops_table.file.stream;
                    node.usedBytes = 0;

                    node.contents = null;
                } else if (FS.isLink(node.mode)) {
                    node.node_ops = MEMFS.ops_table.link.node;
                    node.stream_ops = MEMFS.ops_table.link.stream;
                } else if (FS.isChrdev(node.mode)) {
                    node.node_ops = MEMFS.ops_table.chrdev.node;
                    node.stream_ops = MEMFS.ops_table.chrdev.stream;
                }
                node.timestamp = Date.now();

                if (parent) {
                    parent.contents[name] = node;
                    parent.timestamp = node.timestamp;
                }
                return node;
            },
            getFileDataAsTypedArray(node) {
                if (!node.contents) return new Uint8Array(0);
                if (node.contents.subarray)
                    return node.contents.subarray(0, node.usedBytes);
                return new Uint8Array(node.contents);
            },
            expandFileStorage(node, newCapacity) {
                var prevCapacity = node.contents ? node.contents.length : 0;
                if (prevCapacity >= newCapacity) return;

                var CAPACITY_DOUBLING_MAX = 1024 * 1024;
                newCapacity = Math.max(
                    newCapacity,
                    (prevCapacity *
                        (prevCapacity < CAPACITY_DOUBLING_MAX
                            ? 2.0
                            : 1.125)) >>>
                        0
                );
                if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
                var oldContents = node.contents;
                node.contents = new Uint8Array(newCapacity);
                if (node.usedBytes > 0)
                    node.contents.set(
                        oldContents.subarray(0, node.usedBytes),
                        0
                    );
            },
            resizeFileStorage(node, newSize) {
                if (node.usedBytes == newSize) return;
                if (newSize == 0) {
                    node.contents = null;
                    node.usedBytes = 0;
                } else {
                    var oldContents = node.contents;
                    node.contents = new Uint8Array(newSize);
                    if (oldContents) {
                        node.contents.set(
                            oldContents.subarray(
                                0,
                                Math.min(newSize, node.usedBytes)
                            )
                        );
                    }
                    node.usedBytes = newSize;
                }
            },
            node_ops: {
                getattr(node) {
                    var attr = {};

                    attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
                    attr.ino = node.id;
                    attr.mode = node.mode;
                    attr.nlink = 1;
                    attr.uid = 0;
                    attr.gid = 0;
                    attr.rdev = node.rdev;
                    if (FS.isDir(node.mode)) {
                        attr.size = 4096;
                    } else if (FS.isFile(node.mode)) {
                        attr.size = node.usedBytes;
                    } else if (FS.isLink(node.mode)) {
                        attr.size = node.link.length;
                    } else {
                        attr.size = 0;
                    }
                    attr.atime = new Date(node.timestamp);
                    attr.mtime = new Date(node.timestamp);
                    attr.ctime = new Date(node.timestamp);

                    attr.blksize = 4096;
                    attr.blocks = Math.ceil(attr.size / attr.blksize);
                    return attr;
                },
                setattr(node, attr) {
                    if (attr.mode !== undefined) {
                        node.mode = attr.mode;
                    }
                    if (attr.timestamp !== undefined) {
                        node.timestamp = attr.timestamp;
                    }
                    if (attr.size !== undefined) {
                        MEMFS.resizeFileStorage(node, attr.size);
                    }
                },
                lookup(_parent, _name) {
                    throw FS.genericErrors[44];
                },
                mknod(parent, name, mode, dev) {
                    return MEMFS.createNode(parent, name, mode, dev);
                },
                rename(old_node, new_dir, new_name) {
                    if (FS.isDir(old_node.mode)) {
                        var new_node;
                        try {
                            new_node = FS.lookupNode(new_dir, new_name);
                        } catch (_e) {}

                        if (new_node) {
                            for (var _i in new_node.contents) {
                                throw new FS.ErrnoError(55);
                            }
                        }
                    }

                    delete old_node.parent.contents[old_node.name];
                    old_node.parent.timestamp = Date.now();
                    old_node.name = new_name;
                    new_dir.contents[new_name] = old_node;
                    new_dir.timestamp = old_node.parent.timestamp;
                },
                unlink(parent, name) {
                    delete parent.contents[name];
                    parent.timestamp = Date.now();
                },
                rmdir(parent, name) {
                    var node = FS.lookupNode(parent, name);
                    for (var _i in node.contents) {
                        throw new FS.ErrnoError(55);
                    }
                    delete parent.contents[name];
                    parent.timestamp = Date.now();
                },
                readdir(node) {
                    var entries = [".", ".."];
                    for (var key of Object.keys(node.contents)) {
                        entries.push(key);
                    }
                    return entries;
                },
                symlink(parent, newname, oldpath) {
                    var node = MEMFS.createNode(
                        parent,
                        newname,
                        511 | 40960,
                        0
                    );
                    node.link = oldpath;
                    return node;
                },
                readlink(node) {
                    if (!FS.isLink(node.mode)) {
                        throw new FS.ErrnoError(28);
                    }
                    return node.link;
                },
            },
            stream_ops: {
                read(stream, buffer, offset, length, position) {
                    var contents = stream.node.contents;
                    if (position >= stream.node.usedBytes) return 0;
                    var size = Math.min(
                        stream.node.usedBytes - position,
                        length
                    );
                    if (size > 8 && contents.subarray) {
                        buffer.set(
                            contents.subarray(position, position + size),
                            offset
                        );
                    } else {
                        for (var i = 0; i < size; i++)
                            buffer[offset + i] = contents[position + i];
                    }
                    return size;
                },
                write(stream, buffer, offset, length, position, canOwn) {
                    if (buffer.buffer === HEAP8.buffer) {
                        canOwn = false;
                    }

                    if (!length) return 0;
                    var node = stream.node;
                    node.timestamp = Date.now();

                    if (
                        buffer.subarray &&
                        (!node.contents || node.contents.subarray)
                    ) {
                        if (canOwn) {
                            node.contents = buffer.subarray(
                                offset,
                                offset + length
                            );
                            node.usedBytes = length;
                            return length;
                        } else if (node.usedBytes === 0 && position === 0) {
                            node.contents = buffer.slice(
                                offset,
                                offset + length
                            );
                            node.usedBytes = length;
                            return length;
                        } else if (position + length <= node.usedBytes) {
                            node.contents.set(
                                buffer.subarray(offset, offset + length),
                                position
                            );
                            return length;
                        }
                    }

                    MEMFS.expandFileStorage(node, position + length);
                    if (node.contents.subarray && buffer.subarray) {
                        node.contents.set(
                            buffer.subarray(offset, offset + length),
                            position
                        );
                    } else {
                        for (var i = 0; i < length; i++) {
                            node.contents[position + i] = buffer[offset + i];
                        }
                    }
                    node.usedBytes = Math.max(
                        node.usedBytes,
                        position + length
                    );
                    return length;
                },
                llseek(stream, offset, whence) {
                    var position = offset;
                    if (whence === 1) {
                        position += stream.position;
                    } else if (whence === 2) {
                        if (FS.isFile(stream.node.mode)) {
                            position += stream.node.usedBytes;
                        }
                    }
                    if (position < 0) {
                        throw new FS.ErrnoError(28);
                    }
                    return position;
                },
                allocate(stream, offset, length) {
                    MEMFS.expandFileStorage(stream.node, offset + length);
                    stream.node.usedBytes = Math.max(
                        stream.node.usedBytes,
                        offset + length
                    );
                },
                mmap(stream, length, position, prot, flags) {
                    if (!FS.isFile(stream.node.mode)) {
                        throw new FS.ErrnoError(43);
                    }
                    var ptr;
                    var allocated;
                    var contents = stream.node.contents;

                    if (
                        !(flags & 2) &&
                        contents &&
                        contents.buffer === HEAP8.buffer
                    ) {
                        allocated = false;
                        ptr = contents.byteOffset;
                    } else {
                        allocated = true;
                        ptr = mmapAlloc(length);
                        if (!ptr) {
                            throw new FS.ErrnoError(48);
                        }
                        if (contents) {
                            if (
                                position > 0 ||
                                position + length < contents.length
                            ) {
                                if (contents.subarray) {
                                    contents = contents.subarray(
                                        position,
                                        position + length
                                    );
                                } else {
                                    contents = Array.prototype.slice.call(
                                        contents,
                                        position,
                                        position + length
                                    );
                                }
                            }
                            HEAP8.set(contents, ptr);
                        }
                    }
                    return { ptr, allocated };
                },
                msync(stream, buffer, offset, length, _mmapFlags) {
                    MEMFS.stream_ops.write(
                        stream,
                        buffer,
                        0,
                        length,
                        offset,
                        false
                    );

                    return 0;
                },
            },
        };

        var asyncLoad = (url, onload, onerror, noRunDep) => {
            var dep = !noRunDep ? getUniqueRunDependency(`al ${url}`) : "";
            readAsync(url).then(
                (arrayBuffer) => {
                    onload(new Uint8Array(arrayBuffer));
                    if (dep) removeRunDependency(dep);
                },
                (_err) => {
                    if (onerror) {
                        onerror();
                    } else {
                        throw `Loading data file "${url}" failed.`;
                    }
                }
            );
            if (dep) addRunDependency(dep);
        };

        var FS_createDataFile = (
            parent,
            name,
            fileData,
            canRead,
            canWrite,
            canOwn
        ) => {
            FS.createDataFile(
                parent,
                name,
                fileData,
                canRead,
                canWrite,
                canOwn
            );
        };

        var preloadPlugins = Module["preloadPlugins"] || [];
        var FS_handledByPreloadPlugin = (
            byteArray,
            fullname,
            finish,
            onerror
        ) => {
            if (typeof globalThis.Browser != "undefined")
                globalThis.Browser.init();

            var handled = false;
            preloadPlugins.forEach((plugin) => {
                if (handled) return;
                if (plugin["canHandle"](fullname)) {
                    plugin["handle"](byteArray, fullname, finish, onerror);
                    handled = true;
                }
            });
            return handled;
        };
        var FS_createPreloadedFile = (
            parent,
            name,
            url,
            canRead,
            canWrite,
            onload,
            onerror,
            dontCreateFile,
            canOwn,
            preFinish
        ) => {
            var fullname = name
                ? PATH_FS.resolve(PATH.join2(parent, name))
                : parent;
            var dep = getUniqueRunDependency(`cp ${fullname}`);
            function processData(byteArray) {
                function finish(byteArray) {
                    preFinish?.();
                    if (!dontCreateFile) {
                        FS_createDataFile(
                            parent,
                            name,
                            byteArray,
                            canRead,
                            canWrite,
                            canOwn
                        );
                    }
                    onload?.();
                    removeRunDependency(dep);
                }
                if (
                    FS_handledByPreloadPlugin(
                        byteArray,
                        fullname,
                        finish,
                        () => {
                            onerror?.();
                            removeRunDependency(dep);
                        }
                    )
                ) {
                    return;
                }
                finish(byteArray);
            }
            addRunDependency(dep);
            if (typeof url == "string") {
                asyncLoad(url, processData, onerror);
            } else {
                processData(url);
            }
        };

        var FS_modeStringToFlags = (str) => {
            var flagModes = {
                r: 0,
                "r+": 2,
                w: 512 | 64 | 1,
                "w+": 512 | 64 | 2,
                a: 1024 | 64 | 1,
                "a+": 1024 | 64 | 2,
            };
            var flags = flagModes[str];
            if (typeof flags == "undefined") {
                throw new Error(`Unknown file open mode: ${str}`);
            }
            return flags;
        };

        var FS_getMode = (canRead, canWrite) => {
            var mode = 0;
            if (canRead) mode |= 292 | 73;
            if (canWrite) mode |= 146;
            return mode;
        };

        var FS = {
            root: null,
            mounts: [],
            devices: {},
            streams: [],
            nextInode: 1,
            nameTable: null,
            currentPath: "/",
            initialized: false,
            ignorePermissions: true,
            ErrnoError: class {
                constructor(errno) {
                    this.name = "ErrnoError";
                    this.errno = errno;
                }
            },
            genericErrors: {},
            filesystems: null,
            syncFSRequests: 0,
            readFiles: {},
            FSStream: class {
                constructor() {
                    this.shared = {};
                }
                get object() {
                    return this.node;
                }
                set object(val) {
                    this.node = val;
                }
                get isRead() {
                    return (this.flags & 2097155) !== 1;
                }
                get isWrite() {
                    return (this.flags & 2097155) !== 0;
                }
                get isAppend() {
                    return this.flags & 1024;
                }
                get flags() {
                    return this.shared.flags;
                }
                set flags(val) {
                    this.shared.flags = val;
                }
                get position() {
                    return this.shared.position;
                }
                set position(val) {
                    this.shared.position = val;
                }
            },
            FSNode: class {
                constructor(parent, name, mode, rdev) {
                    if (!parent) {
                        // eslint-disable-next-line @typescript-eslint/no-this-alias
                        parent = this;
                    }
                    this.parent = parent;
                    this.mount = parent.mount;
                    this.mounted = null;
                    this.id = FS.nextInode++;
                    this.name = name;
                    this.mode = mode;
                    this.node_ops = {};
                    this.stream_ops = {};
                    this.rdev = rdev;
                    this.readMode = 292 | 73;
                    this.writeMode = 146;
                }
                get read() {
                    return (this.mode & this.readMode) === this.readMode;
                }
                set read(val) {
                    if (val) {
                        this.mode |= this.readMode;
                    } else {
                        this.mode &= ~this.readMode;
                    }
                }
                get write() {
                    return (this.mode & this.writeMode) === this.writeMode;
                }
                set write(val) {
                    if (val) {
                        this.mode |= this.writeMode;
                    } else {
                        this.mode &= ~this.writeMode;
                    }
                }
                get isFolder() {
                    return FS.isDir(this.mode);
                }
                get isDevice() {
                    return FS.isChrdev(this.mode);
                }
            },
            lookupPath(path, opts = {}) {
                path = PATH_FS.resolve(path);

                if (!path) return { path: "", node: null };

                var defaults = {
                    follow_mount: true,
                    recurse_count: 0,
                };
                opts = Object.assign(defaults, opts);

                if (opts.recurse_count > 8) {
                    throw new FS.ErrnoError(32);
                }

                var parts = path.split("/").filter((p) => !!p);

                var current = FS.root;
                var current_path = "/";

                for (var i = 0; i < parts.length; i++) {
                    var islast = i === parts.length - 1;
                    if (islast && opts.parent) {
                        break;
                    }

                    current = FS.lookupNode(current, parts[i]);
                    current_path = PATH.join2(current_path, parts[i]);

                    if (FS.isMountpoint(current)) {
                        if (!islast || (islast && opts.follow_mount)) {
                            current = current.mounted.root;
                        }
                    }

                    if (!islast || opts.follow) {
                        var count = 0;
                        while (FS.isLink(current.mode)) {
                            var link = FS.readlink(current_path);
                            current_path = PATH_FS.resolve(
                                PATH.dirname(current_path),
                                link
                            );

                            var lookup = FS.lookupPath(current_path, {
                                recurse_count: opts.recurse_count + 1,
                            });
                            current = lookup.node;

                            if (count++ > 40) {
                                throw new FS.ErrnoError(32);
                            }
                        }
                    }
                }

                return { path: current_path, node: current };
            },
            getPath(node) {
                var path;
                while (true) {
                    if (FS.isRoot(node)) {
                        var mount = node.mount.mountpoint;
                        if (!path) return mount;
                        return mount[mount.length - 1] !== "/"
                            ? `${mount}/${path}`
                            : mount + path;
                    }
                    path = path ? `${node.name}/${path}` : node.name;
                    node = node.parent;
                }
            },
            hashName(parentid, name) {
                var hash = 0;

                for (var i = 0; i < name.length; i++) {
                    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
                }
                return ((parentid + hash) >>> 0) % FS.nameTable.length;
            },
            hashAddNode(node) {
                var hash = FS.hashName(node.parent.id, node.name);
                node.name_next = FS.nameTable[hash];
                FS.nameTable[hash] = node;
            },
            hashRemoveNode(node) {
                var hash = FS.hashName(node.parent.id, node.name);
                if (FS.nameTable[hash] === node) {
                    FS.nameTable[hash] = node.name_next;
                } else {
                    var current = FS.nameTable[hash];
                    while (current) {
                        if (current.name_next === node) {
                            current.name_next = node.name_next;
                            break;
                        }
                        current = current.name_next;
                    }
                }
            },
            lookupNode(parent, name) {
                var errCode = FS.mayLookup(parent);
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
                var hash = FS.hashName(parent.id, name);
                for (
                    var node = FS.nameTable[hash];
                    node;
                    node = node.name_next
                ) {
                    var nodeName = node.name;
                    if (node.parent.id === parent.id && nodeName === name) {
                        return node;
                    }
                }

                return FS.lookup(parent, name);
            },
            createNode(parent, name, mode, rdev) {
                var node = new FS.FSNode(parent, name, mode, rdev);

                FS.hashAddNode(node);

                return node;
            },
            destroyNode(node) {
                FS.hashRemoveNode(node);
            },
            isRoot(node) {
                return node === node.parent;
            },
            isMountpoint(node) {
                return !!node.mounted;
            },
            isFile(mode) {
                return (mode & 61440) === 32768;
            },
            isDir(mode) {
                return (mode & 61440) === 16384;
            },
            isLink(mode) {
                return (mode & 61440) === 40960;
            },
            isChrdev(mode) {
                return (mode & 61440) === 8192;
            },
            isBlkdev(mode) {
                return (mode & 61440) === 24576;
            },
            isFIFO(mode) {
                return (mode & 61440) === 4096;
            },
            isSocket(mode) {
                return (mode & 49152) === 49152;
            },
            flagsToPermissionString(flag) {
                var perms = ["r", "w", "rw"][flag & 3];
                if (flag & 512) {
                    perms += "w";
                }
                return perms;
            },
            nodePermissions(node, perms) {
                if (FS.ignorePermissions) {
                    return 0;
                }

                if (perms.includes("r") && !(node.mode & 292)) {
                    return 2;
                } else if (perms.includes("w") && !(node.mode & 146)) {
                    return 2;
                } else if (perms.includes("x") && !(node.mode & 73)) {
                    return 2;
                }
                return 0;
            },
            mayLookup(dir) {
                if (!FS.isDir(dir.mode)) return 54;
                var errCode = FS.nodePermissions(dir, "x");
                if (errCode) return errCode;
                if (!dir.node_ops.lookup) return 2;
                return 0;
            },
            mayCreate(dir, name) {
                try {
                    FS.lookupNode(dir, name);
                    return 20;
                } catch (_e) {}
                return FS.nodePermissions(dir, "wx");
            },
            mayDelete(dir, name, isdir) {
                var node;
                try {
                    node = FS.lookupNode(dir, name);
                } catch (e) {
                    return e.errno;
                }
                var errCode = FS.nodePermissions(dir, "wx");
                if (errCode) {
                    return errCode;
                }
                if (isdir) {
                    if (!FS.isDir(node.mode)) {
                        return 54;
                    }
                    if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
                        return 10;
                    }
                } else {
                    if (FS.isDir(node.mode)) {
                        return 31;
                    }
                }
                return 0;
            },
            mayOpen(node, flags) {
                if (!node) {
                    return 44;
                }
                if (FS.isLink(node.mode)) {
                    return 32;
                } else if (FS.isDir(node.mode)) {
                    if (
                        FS.flagsToPermissionString(flags) !== "r" ||
                        flags & 512
                    ) {
                        return 31;
                    }
                }
                return FS.nodePermissions(
                    node,
                    FS.flagsToPermissionString(flags)
                );
            },
            MAX_OPEN_FDS: 4096,
            nextfd() {
                for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
                    if (!FS.streams[fd]) {
                        return fd;
                    }
                }
                throw new FS.ErrnoError(33);
            },
            getStreamChecked(fd) {
                var stream = FS.getStream(fd);
                if (!stream) {
                    throw new FS.ErrnoError(8);
                }
                return stream;
            },
            getStream: (fd) => FS.streams[fd],
            createStream(stream, fd = -1) {
                stream = Object.assign(new FS.FSStream(), stream);
                if (fd == -1) {
                    fd = FS.nextfd();
                }
                stream.fd = fd;
                FS.streams[fd] = stream;
                return stream;
            },
            closeStream(fd) {
                FS.streams[fd] = null;
            },
            dupStream(origStream, fd = -1) {
                var stream = FS.createStream(origStream, fd);
                stream.stream_ops?.dup?.(stream);
                return stream;
            },
            chrdev_stream_ops: {
                open(stream) {
                    var device = FS.getDevice(stream.node.rdev);

                    stream.stream_ops = device.stream_ops;

                    stream.stream_ops.open?.(stream);
                },
                llseek() {
                    throw new FS.ErrnoError(70);
                },
            },
            major: (dev) => dev >> 8,
            minor: (dev) => dev & 0xff,
            makedev: (ma, mi) => (ma << 8) | mi,
            registerDevice(dev, ops) {
                FS.devices[dev] = { stream_ops: ops };
            },
            getDevice: (dev) => FS.devices[dev],
            getMounts(mount) {
                var mounts = [];
                var check = [mount];

                while (check.length) {
                    var m = check.pop();

                    mounts.push(m);

                    check.push(...m.mounts);
                }

                return mounts;
            },
            syncfs(populate, callback) {
                if (typeof populate == "function") {
                    callback = populate;
                    populate = false;
                }

                FS.syncFSRequests++;

                if (FS.syncFSRequests > 1) {
                    err(
                        `warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`
                    );
                }

                var mounts = FS.getMounts(FS.root.mount);
                var completed = 0;

                function doCallback(errCode) {
                    FS.syncFSRequests--;
                    return callback(errCode);
                }

                function done(errCode) {
                    if (errCode) {
                        if (!done.errored) {
                            done.errored = true;
                            return doCallback(errCode);
                        }
                        return;
                    }
                    if (++completed >= mounts.length) {
                        doCallback(null);
                    }
                }

                mounts.forEach((mount) => {
                    if (!mount.type.syncfs) {
                        return done(null);
                    }
                    mount.type.syncfs(mount, populate, done);
                });
            },
            mount(type, opts, mountpoint) {
                var root = mountpoint === "/";
                var pseudo = !mountpoint;
                var node;

                if (root && FS.root) {
                    throw new FS.ErrnoError(10);
                } else if (!root && !pseudo) {
                    var lookup = FS.lookupPath(mountpoint, {
                        follow_mount: false,
                    });

                    mountpoint = lookup.path;
                    node = lookup.node;

                    if (FS.isMountpoint(node)) {
                        throw new FS.ErrnoError(10);
                    }

                    if (!FS.isDir(node.mode)) {
                        throw new FS.ErrnoError(54);
                    }
                }

                var mount = {
                    type,
                    opts,
                    mountpoint,
                    mounts: [],
                };

                var mountRoot = type.mount(mount);
                mountRoot.mount = mount;
                mount.root = mountRoot;

                if (root) {
                    FS.root = mountRoot;
                } else if (node) {
                    node.mounted = mount;

                    if (node.mount) {
                        node.mount.mounts.push(mount);
                    }
                }

                return mountRoot;
            },
            unmount(mountpoint) {
                var lookup = FS.lookupPath(mountpoint, { follow_mount: false });

                if (!FS.isMountpoint(lookup.node)) {
                    throw new FS.ErrnoError(28);
                }

                var node = lookup.node;
                var mount = node.mounted;
                var mounts = FS.getMounts(mount);

                Object.keys(FS.nameTable).forEach((hash) => {
                    var current = FS.nameTable[hash];

                    while (current) {
                        var next = current.name_next;

                        if (mounts.includes(current.mount)) {
                            FS.destroyNode(current);
                        }

                        current = next;
                    }
                });

                node.mounted = null;

                var idx = node.mount.mounts.indexOf(mount);
                node.mount.mounts.splice(idx, 1);
            },
            lookup(parent, name) {
                return parent.node_ops.lookup(parent, name);
            },
            mknod(path, mode, dev) {
                var lookup = FS.lookupPath(path, { parent: true });
                var parent = lookup.node;
                var name = PATH.basename(path);
                if (!name || name === "." || name === "..") {
                    throw new FS.ErrnoError(28);
                }
                var errCode = FS.mayCreate(parent, name);
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
                if (!parent.node_ops.mknod) {
                    throw new FS.ErrnoError(63);
                }
                return parent.node_ops.mknod(parent, name, mode, dev);
            },
            create(path, mode) {
                mode = mode !== undefined ? mode : 438;
                mode &= 4095;
                mode |= 32768;
                return FS.mknod(path, mode, 0);
            },
            mkdir(path, mode) {
                mode = mode !== undefined ? mode : 511;
                mode &= 511 | 512;
                mode |= 16384;
                return FS.mknod(path, mode, 0);
            },
            mkdirTree(path, mode) {
                var dirs = path.split("/");
                var d = "";
                for (var i = 0; i < dirs.length; ++i) {
                    if (!dirs[i]) continue;
                    d += "/" + dirs[i];
                    try {
                        FS.mkdir(d, mode);
                    } catch (e) {
                        if (e.errno != 20) throw e;
                    }
                }
            },
            mkdev(path, mode, dev) {
                if (typeof dev == "undefined") {
                    dev = mode;
                    mode = 438;
                }
                mode |= 8192;
                return FS.mknod(path, mode, dev);
            },
            symlink(oldpath, newpath) {
                if (!PATH_FS.resolve(oldpath)) {
                    throw new FS.ErrnoError(44);
                }
                var lookup = FS.lookupPath(newpath, { parent: true });
                var parent = lookup.node;
                if (!parent) {
                    throw new FS.ErrnoError(44);
                }
                var newname = PATH.basename(newpath);
                var errCode = FS.mayCreate(parent, newname);
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
                if (!parent.node_ops.symlink) {
                    throw new FS.ErrnoError(63);
                }
                return parent.node_ops.symlink(parent, newname, oldpath);
            },
            rename(old_path, new_path) {
                var old_dirname = PATH.dirname(old_path);
                var new_dirname = PATH.dirname(new_path);
                var old_name = PATH.basename(old_path);
                var new_name = PATH.basename(new_path);

                var lookup, old_dir, new_dir;

                lookup = FS.lookupPath(old_path, { parent: true });
                old_dir = lookup.node;
                lookup = FS.lookupPath(new_path, { parent: true });
                new_dir = lookup.node;

                if (!old_dir || !new_dir) throw new FS.ErrnoError(44);

                if (old_dir.mount !== new_dir.mount) {
                    throw new FS.ErrnoError(75);
                }

                var old_node = FS.lookupNode(old_dir, old_name);

                var relative = PATH_FS.relative(old_path, new_dirname);
                if (relative.charAt(0) !== ".") {
                    throw new FS.ErrnoError(28);
                }

                relative = PATH_FS.relative(new_path, old_dirname);
                if (relative.charAt(0) !== ".") {
                    throw new FS.ErrnoError(55);
                }

                var new_node;
                try {
                    new_node = FS.lookupNode(new_dir, new_name);
                } catch (_e) {}

                if (old_node === new_node) {
                    return;
                }

                var isdir = FS.isDir(old_node.mode);
                var errCode = FS.mayDelete(old_dir, old_name, isdir);
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }

                errCode = new_node
                    ? FS.mayDelete(new_dir, new_name, isdir)
                    : FS.mayCreate(new_dir, new_name);
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
                if (!old_dir.node_ops.rename) {
                    throw new FS.ErrnoError(63);
                }
                if (
                    FS.isMountpoint(old_node) ||
                    (new_node && FS.isMountpoint(new_node))
                ) {
                    throw new FS.ErrnoError(10);
                }

                if (new_dir !== old_dir) {
                    errCode = FS.nodePermissions(old_dir, "w");
                    if (errCode) {
                        throw new FS.ErrnoError(errCode);
                    }
                }

                FS.hashRemoveNode(old_node);

                try {
                    old_dir.node_ops.rename(old_node, new_dir, new_name);

                    old_node.parent = new_dir;
                } finally {
                    FS.hashAddNode(old_node);
                }
            },
            rmdir(path) {
                var lookup = FS.lookupPath(path, { parent: true });
                var parent = lookup.node;
                var name = PATH.basename(path);
                var node = FS.lookupNode(parent, name);
                var errCode = FS.mayDelete(parent, name, true);
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
                if (!parent.node_ops.rmdir) {
                    throw new FS.ErrnoError(63);
                }
                if (FS.isMountpoint(node)) {
                    throw new FS.ErrnoError(10);
                }
                parent.node_ops.rmdir(parent, name);
                FS.destroyNode(node);
            },
            readdir(path) {
                var lookup = FS.lookupPath(path, { follow: true });
                var node = lookup.node;
                if (!node.node_ops.readdir) {
                    throw new FS.ErrnoError(54);
                }
                return node.node_ops.readdir(node);
            },
            unlink(path) {
                var lookup = FS.lookupPath(path, { parent: true });
                var parent = lookup.node;
                if (!parent) {
                    throw new FS.ErrnoError(44);
                }
                var name = PATH.basename(path);
                var node = FS.lookupNode(parent, name);
                var errCode = FS.mayDelete(parent, name, false);
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
                if (!parent.node_ops.unlink) {
                    throw new FS.ErrnoError(63);
                }
                if (FS.isMountpoint(node)) {
                    throw new FS.ErrnoError(10);
                }
                parent.node_ops.unlink(parent, name);
                FS.destroyNode(node);
            },
            readlink(path) {
                var lookup = FS.lookupPath(path);
                var link = lookup.node;
                if (!link) {
                    throw new FS.ErrnoError(44);
                }
                if (!link.node_ops.readlink) {
                    throw new FS.ErrnoError(28);
                }
                return PATH_FS.resolve(
                    FS.getPath(link.parent),
                    link.node_ops.readlink(link)
                );
            },
            stat(path, dontFollow) {
                var lookup = FS.lookupPath(path, { follow: !dontFollow });
                var node = lookup.node;
                if (!node) {
                    throw new FS.ErrnoError(44);
                }
                if (!node.node_ops.getattr) {
                    throw new FS.ErrnoError(63);
                }
                return node.node_ops.getattr(node);
            },
            lstat(path) {
                return FS.stat(path, true);
            },
            chmod(path, mode, dontFollow) {
                var node;
                if (typeof path == "string") {
                    var lookup = FS.lookupPath(path, { follow: !dontFollow });
                    node = lookup.node;
                } else {
                    node = path;
                }
                if (!node.node_ops.setattr) {
                    throw new FS.ErrnoError(63);
                }
                node.node_ops.setattr(node, {
                    mode: (mode & 4095) | (node.mode & ~4095),
                    timestamp: Date.now(),
                });
            },
            lchmod(path, mode) {
                FS.chmod(path, mode, true);
            },
            fchmod(fd, mode) {
                var stream = FS.getStreamChecked(fd);
                FS.chmod(stream.node, mode);
            },
            chown(path, uid, gid, dontFollow) {
                var node;
                if (typeof path == "string") {
                    var lookup = FS.lookupPath(path, { follow: !dontFollow });
                    node = lookup.node;
                } else {
                    node = path;
                }
                if (!node.node_ops.setattr) {
                    throw new FS.ErrnoError(63);
                }
                node.node_ops.setattr(node, {
                    timestamp: Date.now(),
                });
            },
            lchown(path, uid, gid) {
                FS.chown(path, uid, gid, true);
            },
            fchown(fd, uid, gid) {
                var stream = FS.getStreamChecked(fd);
                FS.chown(stream.node, uid, gid);
            },
            truncate(path, len) {
                if (len < 0) {
                    throw new FS.ErrnoError(28);
                }
                var node;
                if (typeof path == "string") {
                    var lookup = FS.lookupPath(path, { follow: true });
                    node = lookup.node;
                } else {
                    node = path;
                }
                if (!node.node_ops.setattr) {
                    throw new FS.ErrnoError(63);
                }
                if (FS.isDir(node.mode)) {
                    throw new FS.ErrnoError(31);
                }
                if (!FS.isFile(node.mode)) {
                    throw new FS.ErrnoError(28);
                }
                var errCode = FS.nodePermissions(node, "w");
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
                node.node_ops.setattr(node, {
                    size: len,
                    timestamp: Date.now(),
                });
            },
            ftruncate(fd, len) {
                var stream = FS.getStreamChecked(fd);
                if ((stream.flags & 2097155) === 0) {
                    throw new FS.ErrnoError(28);
                }
                FS.truncate(stream.node, len);
            },
            utime(path, atime, mtime) {
                var lookup = FS.lookupPath(path, { follow: true });
                var node = lookup.node;
                node.node_ops.setattr(node, {
                    timestamp: Math.max(atime, mtime),
                });
            },
            open(path, flags, mode) {
                if (path === "") {
                    throw new FS.ErrnoError(44);
                }
                flags =
                    typeof flags == "string"
                        ? FS_modeStringToFlags(flags)
                        : flags;
                if (flags & 64) {
                    mode = typeof mode == "undefined" ? 438 : mode;
                    mode = (mode & 4095) | 32768;
                } else {
                    mode = 0;
                }
                var node;
                if (typeof path == "object") {
                    node = path;
                } else {
                    path = PATH.normalize(path);
                    try {
                        var lookup = FS.lookupPath(path, {
                            follow: !(flags & 131072),
                        });
                        node = lookup.node;
                    } catch (_e) {}
                }

                var created = false;
                if (flags & 64) {
                    if (node) {
                        if (flags & 128) {
                            throw new FS.ErrnoError(20);
                        }
                    } else {
                        node = FS.mknod(path, mode, 0);
                        created = true;
                    }
                }
                if (!node) {
                    throw new FS.ErrnoError(44);
                }

                if (FS.isChrdev(node.mode)) {
                    flags &= ~512;
                }

                if (flags & 65536 && !FS.isDir(node.mode)) {
                    throw new FS.ErrnoError(54);
                }

                if (!created) {
                    var errCode = FS.mayOpen(node, flags);
                    if (errCode) {
                        throw new FS.ErrnoError(errCode);
                    }
                }

                if (flags & 512 && !created) {
                    FS.truncate(node, 0);
                }

                flags &= ~(128 | 512 | 131072);

                var stream = FS.createStream({
                    node,
                    path: FS.getPath(node),
                    flags,
                    seekable: true,
                    position: 0,
                    stream_ops: node.stream_ops,

                    ungotten: [],
                    error: false,
                });

                if (stream.stream_ops.open) {
                    stream.stream_ops.open(stream);
                }
                if (Module["logReadFiles"] && !(flags & 1)) {
                    if (!(path in FS.readFiles)) {
                        FS.readFiles[path] = 1;
                    }
                }
                return stream;
            },
            close(stream) {
                if (FS.isClosed(stream)) {
                    throw new FS.ErrnoError(8);
                }
                if (stream.getdents) stream.getdents = null;
                try {
                    if (stream.stream_ops.close) {
                        stream.stream_ops.close(stream);
                    }
                } finally {
                    FS.closeStream(stream.fd);
                }
                stream.fd = null;
            },
            isClosed(stream) {
                return stream.fd === null;
            },
            llseek(stream, offset, whence) {
                if (FS.isClosed(stream)) {
                    throw new FS.ErrnoError(8);
                }
                if (!stream.seekable || !stream.stream_ops.llseek) {
                    throw new FS.ErrnoError(70);
                }
                if (whence != 0 && whence != 1 && whence != 2) {
                    throw new FS.ErrnoError(28);
                }
                stream.position = stream.stream_ops.llseek(
                    stream,
                    offset,
                    whence
                );
                stream.ungotten = [];
                return stream.position;
            },
            read(stream, buffer, offset, length, position) {
                if (length < 0 || position < 0) {
                    throw new FS.ErrnoError(28);
                }
                if (FS.isClosed(stream)) {
                    throw new FS.ErrnoError(8);
                }
                if ((stream.flags & 2097155) === 1) {
                    throw new FS.ErrnoError(8);
                }
                if (FS.isDir(stream.node.mode)) {
                    throw new FS.ErrnoError(31);
                }
                if (!stream.stream_ops.read) {
                    throw new FS.ErrnoError(28);
                }
                var seeking = typeof position != "undefined";
                if (!seeking) {
                    position = stream.position;
                } else if (!stream.seekable) {
                    throw new FS.ErrnoError(70);
                }
                var bytesRead = stream.stream_ops.read(
                    stream,
                    buffer,
                    offset,
                    length,
                    position
                );
                if (!seeking) stream.position += bytesRead;
                return bytesRead;
            },
            write(stream, buffer, offset, length, position, canOwn) {
                if (length < 0 || position < 0) {
                    throw new FS.ErrnoError(28);
                }
                if (FS.isClosed(stream)) {
                    throw new FS.ErrnoError(8);
                }
                if ((stream.flags & 2097155) === 0) {
                    throw new FS.ErrnoError(8);
                }
                if (FS.isDir(stream.node.mode)) {
                    throw new FS.ErrnoError(31);
                }
                if (!stream.stream_ops.write) {
                    throw new FS.ErrnoError(28);
                }
                if (stream.seekable && stream.flags & 1024) {
                    FS.llseek(stream, 0, 2);
                }
                var seeking = typeof position != "undefined";
                if (!seeking) {
                    position = stream.position;
                } else if (!stream.seekable) {
                    throw new FS.ErrnoError(70);
                }
                var bytesWritten = stream.stream_ops.write(
                    stream,
                    buffer,
                    offset,
                    length,
                    position,
                    canOwn
                );
                if (!seeking) stream.position += bytesWritten;
                return bytesWritten;
            },
            allocate(stream, offset, length) {
                if (FS.isClosed(stream)) {
                    throw new FS.ErrnoError(8);
                }
                if (offset < 0 || length <= 0) {
                    throw new FS.ErrnoError(28);
                }
                if ((stream.flags & 2097155) === 0) {
                    throw new FS.ErrnoError(8);
                }
                if (
                    !FS.isFile(stream.node.mode) &&
                    !FS.isDir(stream.node.mode)
                ) {
                    throw new FS.ErrnoError(43);
                }
                if (!stream.stream_ops.allocate) {
                    throw new FS.ErrnoError(138);
                }
                stream.stream_ops.allocate(stream, offset, length);
            },
            mmap(stream, length, position, prot, flags) {
                if (
                    (prot & 2) !== 0 &&
                    (flags & 2) === 0 &&
                    (stream.flags & 2097155) !== 2
                ) {
                    throw new FS.ErrnoError(2);
                }
                if ((stream.flags & 2097155) === 1) {
                    throw new FS.ErrnoError(2);
                }
                if (!stream.stream_ops.mmap) {
                    throw new FS.ErrnoError(43);
                }
                if (!length) {
                    throw new FS.ErrnoError(28);
                }
                return stream.stream_ops.mmap(
                    stream,
                    length,
                    position,
                    prot,
                    flags
                );
            },
            msync(stream, buffer, offset, length, mmapFlags) {
                if (!stream.stream_ops.msync) {
                    return 0;
                }
                return stream.stream_ops.msync(
                    stream,
                    buffer,
                    offset,
                    length,
                    mmapFlags
                );
            },
            ioctl(stream, cmd, arg) {
                if (!stream.stream_ops.ioctl) {
                    throw new FS.ErrnoError(59);
                }
                return stream.stream_ops.ioctl(stream, cmd, arg);
            },
            readFile(path, opts = {}) {
                opts.flags = opts.flags || 0;
                opts.encoding = opts.encoding || "binary";
                if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
                    throw new Error(`Invalid encoding type "${opts.encoding}"`);
                }
                var ret;
                var stream = FS.open(path, opts.flags);
                var stat = FS.stat(path);
                var length = stat.size;
                var buf = new Uint8Array(length);
                FS.read(stream, buf, 0, length, 0);
                if (opts.encoding === "utf8") {
                    ret = UTF8ArrayToString(buf);
                } else if (opts.encoding === "binary") {
                    ret = buf;
                }
                FS.close(stream);
                return ret;
            },
            writeFile(path, data, opts = {}) {
                opts.flags = opts.flags || 577;
                var stream = FS.open(path, opts.flags, opts.mode);
                if (typeof data == "string") {
                    var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
                    var actualNumBytes = stringToUTF8Array(
                        data,
                        buf,
                        0,
                        buf.length
                    );
                    FS.write(
                        stream,
                        buf,
                        0,
                        actualNumBytes,
                        undefined,
                        opts.canOwn
                    );
                } else if (ArrayBuffer.isView(data)) {
                    FS.write(
                        stream,
                        data,
                        0,
                        data.byteLength,
                        undefined,
                        opts.canOwn
                    );
                } else {
                    throw new Error("Unsupported data type");
                }
                FS.close(stream);
            },
            cwd: () => FS.currentPath,
            chdir(path) {
                var lookup = FS.lookupPath(path, { follow: true });
                if (lookup.node === null) {
                    throw new FS.ErrnoError(44);
                }
                if (!FS.isDir(lookup.node.mode)) {
                    throw new FS.ErrnoError(54);
                }
                var errCode = FS.nodePermissions(lookup.node, "x");
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
                FS.currentPath = lookup.path;
            },
            createDefaultDirectories() {
                FS.mkdir("/tmp");
                FS.mkdir("/home");
                FS.mkdir("/home/web_user");
            },
            createDefaultDevices() {
                FS.mkdir("/dev");

                FS.registerDevice(FS.makedev(1, 3), {
                    read: () => 0,
                    write: (stream, buffer, offset, length, _pos) => length,
                });
                FS.mkdev("/dev/null", FS.makedev(1, 3));

                TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
                TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
                FS.mkdev("/dev/tty", FS.makedev(5, 0));
                FS.mkdev("/dev/tty1", FS.makedev(6, 0));

                var randomBuffer = new Uint8Array(1024),
                    randomLeft = 0;
                var randomByte = () => {
                    if (randomLeft === 0) {
                        randomLeft = randomFill(randomBuffer).byteLength;
                    }
                    return randomBuffer[--randomLeft];
                };
                FS.createDevice("/dev", "random", randomByte);
                FS.createDevice("/dev", "urandom", randomByte);

                FS.mkdir("/dev/shm");
                FS.mkdir("/dev/shm/tmp");
            },
            createSpecialDirectories() {
                FS.mkdir("/proc");
                var proc_self = FS.mkdir("/proc/self");
                FS.mkdir("/proc/self/fd");
                FS.mount(
                    {
                        mount() {
                            var node = FS.createNode(
                                proc_self,
                                "fd",
                                16384 | 511,
                                73
                            );
                            node.node_ops = {
                                lookup(parent, name) {
                                    var fd = +name;
                                    var stream = FS.getStreamChecked(fd);
                                    var ret = {
                                        parent: null,
                                        mount: { mountpoint: "fake" },
                                        node_ops: {
                                            readlink: () => stream.path,
                                        },
                                    };
                                    ret.parent = ret;
                                    return ret;
                                },
                            };
                            return node;
                        },
                    },
                    {},
                    "/proc/self/fd"
                );
            },
            createStandardStreams(input, output, error) {
                if (input) {
                    FS.createDevice("/dev", "stdin", input);
                } else {
                    FS.symlink("/dev/tty", "/dev/stdin");
                }
                if (output) {
                    FS.createDevice("/dev", "stdout", null, output);
                } else {
                    FS.symlink("/dev/tty", "/dev/stdout");
                }
                if (error) {
                    FS.createDevice("/dev", "stderr", null, error);
                } else {
                    FS.symlink("/dev/tty1", "/dev/stderr");
                }

                var _stdin = FS.open("/dev/stdin", 0);
                var _stdout = FS.open("/dev/stdout", 1);
                var _stderr = FS.open("/dev/stderr", 1);
            },
            staticInit() {
                [44].forEach((code) => {
                    FS.genericErrors[code] = new FS.ErrnoError(code);
                    FS.genericErrors[code].stack = "<generic error, no stack>";
                });

                FS.nameTable = new Array(4096);

                FS.mount(MEMFS, {}, "/");

                FS.createDefaultDirectories();
                FS.createDefaultDevices();
                FS.createSpecialDirectories();

                FS.filesystems = {
                    MEMFS: MEMFS,
                };
            },
            init(input, output, error) {
                FS.initialized = true;

                input ??= Module["stdin"];
                output ??= Module["stdout"];
                error ??= Module["stderr"];

                FS.createStandardStreams(input, output, error);
            },
            quit() {
                FS.initialized = false;

                for (var i = 0; i < FS.streams.length; i++) {
                    var stream = FS.streams[i];
                    if (!stream) {
                        continue;
                    }
                    FS.close(stream);
                }
            },
            findObject(path, dontResolveLastLink) {
                var ret = FS.analyzePath(path, dontResolveLastLink);
                if (!ret.exists) {
                    return null;
                }
                return ret.object;
            },
            analyzePath(path, dontResolveLastLink) {
                try {
                    var lookup = FS.lookupPath(path, {
                        follow: !dontResolveLastLink,
                    });
                    path = lookup.path;
                } catch (_e) {}
                var ret = {
                    isRoot: false,
                    exists: false,
                    error: 0,
                    name: null,
                    path: null,
                    object: null,
                    parentExists: false,
                    parentPath: null,
                    parentObject: null,
                };
                try {
                    lookup = FS.lookupPath(path, { parent: true });
                    ret.parentExists = true;
                    ret.parentPath = lookup.path;
                    ret.parentObject = lookup.node;
                    ret.name = PATH.basename(path);
                    lookup = FS.lookupPath(path, {
                        follow: !dontResolveLastLink,
                    });
                    ret.exists = true;
                    ret.path = lookup.path;
                    ret.object = lookup.node;
                    ret.name = lookup.node.name;
                    ret.isRoot = lookup.path === "/";
                } catch (e) {
                    ret.error = e.errno;
                }
                return ret;
            },
            createPath(parent, path, _canRead, _canWrite) {
                parent =
                    typeof parent == "string" ? parent : FS.getPath(parent);
                var parts = path.split("/").reverse();
                while (parts.length) {
                    var part = parts.pop();
                    if (!part) continue;
                    var current = PATH.join2(parent, part);
                    try {
                        FS.mkdir(current);
                    } catch (_e) {}
                    parent = current;
                }
                return current;
            },
            createFile(parent, name, properties, canRead, canWrite) {
                var path = PATH.join2(
                    typeof parent == "string" ? parent : FS.getPath(parent),
                    name
                );
                var mode = FS_getMode(canRead, canWrite);
                return FS.create(path, mode);
            },
            createDataFile(parent, name, data, canRead, canWrite, canOwn) {
                var path = name;
                if (parent) {
                    parent =
                        typeof parent == "string" ? parent : FS.getPath(parent);
                    path = name ? PATH.join2(parent, name) : parent;
                }
                var mode = FS_getMode(canRead, canWrite);
                var node = FS.create(path, mode);
                if (data) {
                    if (typeof data == "string") {
                        var arr = new Array(data.length);
                        for (var i = 0, len = data.length; i < len; ++i)
                            arr[i] = data.charCodeAt(i);
                        data = arr;
                    }

                    FS.chmod(node, mode | 146);
                    var stream = FS.open(node, 577);
                    FS.write(stream, data, 0, data.length, 0, canOwn);
                    FS.close(stream);
                    FS.chmod(node, mode);
                }
            },
            createDevice(parent, name, input, output) {
                var path = PATH.join2(
                    typeof parent == "string" ? parent : FS.getPath(parent),
                    name
                );
                var mode = FS_getMode(!!input, !!output);
                FS.createDevice.major ??= 64;
                var dev = FS.makedev(FS.createDevice.major++, 0);

                FS.registerDevice(dev, {
                    open(stream) {
                        stream.seekable = false;
                    },
                    close(_stream) {
                        if (output?.buffer?.length) {
                            output(10);
                        }
                    },
                    read(stream, buffer, offset, length, _pos) {
                        var bytesRead = 0;
                        for (var i = 0; i < length; i++) {
                            var result;
                            try {
                                result = input();
                            } catch (_e) {
                                throw new FS.ErrnoError(29);
                            }
                            if (result === undefined && bytesRead === 0) {
                                throw new FS.ErrnoError(6);
                            }
                            if (result === null || result === undefined) break;
                            bytesRead++;
                            buffer[offset + i] = result;
                        }
                        if (bytesRead) {
                            stream.node.timestamp = Date.now();
                        }
                        return bytesRead;
                    },
                    write(stream, buffer, offset, length, _pos) {
                        for (var i = 0; i < length; i++) {
                            try {
                                output(buffer[offset + i]);
                            } catch (_e) {
                                throw new FS.ErrnoError(29);
                            }
                        }
                        if (length) {
                            stream.node.timestamp = Date.now();
                        }
                        return i;
                    },
                });
                return FS.mkdev(path, mode, dev);
            },
            forceLoadFile(obj) {
                if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
                    return true;
                if (typeof XMLHttpRequest != "undefined") {
                    throw new Error(
                        "Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread."
                    );
                } else {
                    try {
                        obj.contents = readBinary(obj.url);
                        obj.usedBytes = obj.contents.length;
                    } catch (_e) {
                        throw new FS.ErrnoError(29);
                    }
                }
            },
            createLazyFile(parent, name, url, canRead, canWrite) {
                class LazyUint8Array {
                    constructor() {
                        this.lengthKnown = false;
                        this.chunks = [];
                    }
                    get(idx) {
                        if (idx > this.length - 1 || idx < 0) {
                            return undefined;
                        }
                        var chunkOffset = idx % this.chunkSize;
                        var chunkNum = (idx / this.chunkSize) | 0;
                        return this.getter(chunkNum)[chunkOffset];
                    }
                    setDataGetter(getter) {
                        this.getter = getter;
                    }
                    cacheLength() {
                        var xhr = new XMLHttpRequest();
                        xhr.open("HEAD", url, false);
                        xhr.send(null);
                        if (
                            !(
                                (xhr.status >= 200 && xhr.status < 300) ||
                                xhr.status === 304
                            )
                        )
                            throw new Error(
                                "Couldn't load " +
                                    url +
                                    ". Status: " +
                                    xhr.status
                            );
                        var datalength = Number(
                            xhr.getResponseHeader("Content-length")
                        );
                        var header;
                        var hasByteServing =
                            (header = xhr.getResponseHeader("Accept-Ranges")) &&
                            header === "bytes";
                        var usesGzip =
                            (header =
                                xhr.getResponseHeader("Content-Encoding")) &&
                            header === "gzip";

                        var chunkSize = 1024 * 1024;

                        if (!hasByteServing) chunkSize = datalength;

                        var doXHR = (from, to) => {
                            if (from > to)
                                throw new Error(
                                    "invalid range (" +
                                        from +
                                        ", " +
                                        to +
                                        ") or no bytes requested!"
                                );
                            if (to > datalength - 1)
                                throw new Error(
                                    "only " +
                                        datalength +
                                        " bytes available! programmer error!"
                                );

                            var xhr = new XMLHttpRequest();
                            xhr.open("GET", url, false);
                            if (datalength !== chunkSize)
                                xhr.setRequestHeader(
                                    "Range",
                                    "bytes=" + from + "-" + to
                                );

                            xhr.responseType = "arraybuffer";
                            if (xhr.overrideMimeType) {
                                xhr.overrideMimeType(
                                    "text/plain; charset=x-user-defined"
                                );
                            }

                            xhr.send(null);
                            if (
                                !(
                                    (xhr.status >= 200 && xhr.status < 300) ||
                                    xhr.status === 304
                                )
                            )
                                throw new Error(
                                    "Couldn't load " +
                                        url +
                                        ". Status: " +
                                        xhr.status
                                );
                            if (xhr.response !== undefined) {
                                return new Uint8Array(xhr.response || []);
                            }
                            return intArrayFromString(
                                xhr.responseText || "",
                                true
                            );
                        };
                        this.setDataGetter((chunkNum) => {
                            var start = chunkNum * chunkSize;
                            var end = (chunkNum + 1) * chunkSize - 1;
                            end = Math.min(end, datalength - 1);
                            if (typeof this.chunks[chunkNum] == "undefined") {
                                this.chunks[chunkNum] = doXHR(start, end);
                            }
                            if (typeof this.chunks[chunkNum] == "undefined")
                                throw new Error("doXHR failed!");
                            return this.chunks[chunkNum];
                        });

                        if (usesGzip || !datalength) {
                            chunkSize = datalength = 1;
                            datalength = this.getter(0).length;
                            chunkSize = datalength;
                            out(
                                "LazyFiles on gzip forces download of the whole file when length is accessed"
                            );
                        }

                        this._length = datalength;
                        this._chunkSize = chunkSize;
                        this.lengthKnown = true;
                    }
                    get length() {
                        if (!this.lengthKnown) {
                            this.cacheLength();
                        }
                        return this._length;
                    }
                    get chunkSize() {
                        if (!this.lengthKnown) {
                            this.cacheLength();
                        }
                        return this._chunkSize;
                    }
                }

                /** Properties object for the file node. */
                var properties;
                if (typeof XMLHttpRequest != "undefined") {
                    if (!ENVIRONMENT_IS_WORKER)
                        throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
                    var lazyArray = new LazyUint8Array();
                    properties = { isDevice: false, contents: lazyArray };
                } else {
                    properties = { isDevice: false, url: url };
                }

                var node = FS.createFile(
                    parent,
                    name,
                    properties,
                    canRead,
                    canWrite
                );

                if (properties.contents) {
                    node.contents = properties.contents;
                } else if (properties.url) {
                    node.contents = null;
                    node.url = properties.url;
                }

                Object.defineProperties(node, {
                    usedBytes: {
                        get: function () {
                            return this.contents.length;
                        },
                    },
                });

                var stream_ops = {};
                var keys = Object.keys(node.stream_ops);
                keys.forEach((key) => {
                    var fn = node.stream_ops[key];
                    stream_ops[key] = (...args) => {
                        FS.forceLoadFile(node);
                        return fn(...args);
                    };
                });
                function writeChunks(stream, buffer, offset, length, position) {
                    var contents = stream.node.contents;
                    if (position >= contents.length) return 0;
                    var size = Math.min(contents.length - position, length);
                    if (contents.slice) {
                        for (let i = 0; i < size; i++) {
                            buffer[offset + i] = contents[position + i];
                        }
                    } else {
                        for (let i = 0; i < size; i++) {
                            buffer[offset + i] = contents.get(position + i);
                        }
                    }
                    return size;
                }

                stream_ops.read = (
                    stream,
                    buffer,
                    offset,
                    length,
                    position
                ) => {
                    FS.forceLoadFile(node);
                    return writeChunks(
                        stream,
                        buffer,
                        offset,
                        length,
                        position
                    );
                };

                stream_ops.mmap = (stream, length, position, _prot, _flags) => {
                    FS.forceLoadFile(node);
                    var ptr = mmapAlloc(length);
                    if (!ptr) {
                        throw new FS.ErrnoError(48);
                    }
                    writeChunks(stream, HEAP8, ptr, length, position);
                    return { ptr, allocated: true };
                };
                node.stream_ops = stream_ops;
                return node;
            },
        };

        var UTF8ToString = (ptr, maxBytesToRead) => {
            return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
        };
        var SYSCALLS = {
            DEFAULT_POLLMASK: 5,
            calculateAt(dirfd, path, allowEmpty) {
                if (PATH.isAbs(path)) {
                    return path;
                }

                var dir;
                if (dirfd === -100) {
                    dir = FS.cwd();
                } else {
                    var dirstream = SYSCALLS.getStreamFromFD(dirfd);
                    dir = dirstream.path;
                }
                if (path.length == 0) {
                    if (!allowEmpty) {
                        throw new FS.ErrnoError(44);
                    }
                    return dir;
                }
                return PATH.join2(dir, path);
            },
            doStat(func, path, buf) {
                var stat = func(path);
                HEAP32[buf >> 2] = stat.dev;
                HEAP32[(buf + 4) >> 2] = stat.mode;
                HEAPU32[(buf + 8) >> 2] = stat.nlink;
                HEAP32[(buf + 12) >> 2] = stat.uid;
                HEAP32[(buf + 16) >> 2] = stat.gid;
                HEAP32[(buf + 20) >> 2] = stat.rdev;
                HEAP64[(buf + 24) >> 3] = BigInt(stat.size);
                HEAP32[(buf + 32) >> 2] = 4096;
                HEAP32[(buf + 36) >> 2] = stat.blocks;
                var atime = stat.atime.getTime();
                var mtime = stat.mtime.getTime();
                var ctime = stat.ctime.getTime();
                HEAP64[(buf + 40) >> 3] = BigInt(Math.floor(atime / 1000));
                HEAPU32[(buf + 48) >> 2] = (atime % 1000) * 1000 * 1000;
                HEAP64[(buf + 56) >> 3] = BigInt(Math.floor(mtime / 1000));
                HEAPU32[(buf + 64) >> 2] = (mtime % 1000) * 1000 * 1000;
                HEAP64[(buf + 72) >> 3] = BigInt(Math.floor(ctime / 1000));
                HEAPU32[(buf + 80) >> 2] = (ctime % 1000) * 1000 * 1000;
                HEAP64[(buf + 88) >> 3] = BigInt(stat.ino);
                return 0;
            },
            doMsync(addr, stream, len, flags, offset) {
                if (!FS.isFile(stream.node.mode)) {
                    throw new FS.ErrnoError(43);
                }
                if (flags & 2) {
                    return 0;
                }
                var buffer = HEAPU8.slice(addr, addr + len);
                FS.msync(stream, buffer, offset, len, flags);
            },
            getStreamFromFD(fd) {
                var stream = FS.getStreamChecked(fd);
                return stream;
            },
            varargs: undefined,
            getStr(ptr) {
                var ret = UTF8ToString(ptr);
                return ret;
            },
        };
        function ___syscall_chmod(path, mode) {
            try {
                path = SYSCALLS.getStr(path);
                FS.chmod(path, mode);
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function ___syscall_faccessat(dirfd, path, amode, _flags) {
            try {
                path = SYSCALLS.getStr(path);
                path = SYSCALLS.calculateAt(dirfd, path);
                if (amode & ~7) {
                    return -28;
                }
                var lookup = FS.lookupPath(path, { follow: true });
                var node = lookup.node;
                if (!node) {
                    return -44;
                }
                var perms = "";
                if (amode & 4) perms += "r";
                if (amode & 2) perms += "w";
                if (amode & 1) perms += "x";
                if (perms && FS.nodePermissions(node, perms)) {
                    return -2;
                }
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function ___syscall_fchmod(fd, mode) {
            try {
                FS.fchmod(fd, mode);
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function ___syscall_fchown32(fd, owner, group) {
            try {
                FS.fchown(fd, owner, group);
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function syscallGetVarargI() {
            var ret = HEAP32[+SYSCALLS.varargs >> 2];
            SYSCALLS.varargs += 4;
            return ret;
        }
        var syscallGetVarargP = syscallGetVarargI;

        function ___syscall_fcntl64(fd, cmd, varargs) {
            SYSCALLS.varargs = varargs;
            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                let arg;
                switch (cmd) {
                    case 0: {
                        arg = syscallGetVarargI();
                        if (arg < 0) {
                            return -28;
                        }
                        while (FS.streams[arg]) {
                            arg++;
                        }
                        var newStream;
                        newStream = FS.dupStream(stream, arg);
                        return newStream.fd;
                    }
                    case 1:
                    case 2:
                        return 0;
                    case 3:
                        return stream.flags;
                    case 4: {
                        arg = syscallGetVarargI();
                        stream.flags |= arg;
                        return 0;
                    }
                    case 12: {
                        arg = syscallGetVarargP();
                        var offset = 0;

                        HEAP16[(arg + offset) >> 1] = 2;
                        return 0;
                    }
                    case 13:
                    case 14:
                        return 0;
                }
                return -28;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function ___syscall_fstat64(fd, buf) {
            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                return SYSCALLS.doStat(FS.stat, stream.path, buf);
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        var INT53_MAX = 9007199254740992;

        var INT53_MIN = -9007199254740992;
        var bigintToI53Checked = (num) =>
            num < INT53_MIN || num > INT53_MAX ? NaN : Number(num);
        function ___syscall_ftruncate64(fd, length) {
            length = bigintToI53Checked(length);

            try {
                if (isNaN(length)) return 61;
                FS.ftruncate(fd, length);
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
            return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
        };
        function ___syscall_getcwd(buf, size) {
            try {
                if (size === 0) return -28;
                var cwd = FS.cwd();
                var cwdLengthInBytes = lengthBytesUTF8(cwd) + 1;
                if (size < cwdLengthInBytes) return -68;
                stringToUTF8(cwd, buf, size);
                return cwdLengthInBytes;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function ___syscall_ioctl(fd, op, varargs) {
            SYSCALLS.varargs = varargs;
            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                let argp;
                switch (op) {
                    case 21509: {
                        if (!stream.tty) return -59;
                        return 0;
                    }
                    case 21505: {
                        if (!stream.tty) return -59;
                        if (stream.tty.ops.ioctl_tcgets) {
                            var termios = stream.tty.ops.ioctl_tcgets(stream);
                            argp = syscallGetVarargP();
                            HEAP32[argp >> 2] = termios.c_iflag || 0;
                            HEAP32[(argp + 4) >> 2] = termios.c_oflag || 0;
                            HEAP32[(argp + 8) >> 2] = termios.c_cflag || 0;
                            HEAP32[(argp + 12) >> 2] = termios.c_lflag || 0;
                            for (var i = 0; i < 32; i++) {
                                HEAP8[argp + i + 17] = termios.c_cc[i] || 0;
                            }
                            return 0;
                        }
                        return 0;
                    }
                    case 21510:
                    case 21511:
                    case 21512: {
                        if (!stream.tty) return -59;
                        return 0;
                    }
                    case 21506:
                    case 21507:
                    case 21508: {
                        if (!stream.tty) return -59;
                        if (stream.tty.ops.ioctl_tcsets) {
                            argp = syscallGetVarargP();
                            var c_iflag = HEAP32[argp >> 2];
                            var c_oflag = HEAP32[(argp + 4) >> 2];
                            var c_cflag = HEAP32[(argp + 8) >> 2];
                            var c_lflag = HEAP32[(argp + 12) >> 2];
                            var c_cc = [];
                            for (let i = 0; i < 32; i++) {
                                c_cc.push(HEAP8[argp + i + 17]);
                            }
                            return stream.tty.ops.ioctl_tcsets(stream.tty, op, {
                                c_iflag,
                                c_oflag,
                                c_cflag,
                                c_lflag,
                                c_cc,
                            });
                        }
                        return 0;
                    }
                    case 21519: {
                        if (!stream.tty) return -59;
                        argp = syscallGetVarargP();
                        HEAP32[argp >> 2] = 0;
                        return 0;
                    }
                    case 21520: {
                        if (!stream.tty) return -59;
                        return -28;
                    }
                    case 21531: {
                        argp = syscallGetVarargP();
                        return FS.ioctl(stream, op, argp);
                    }
                    case 21523: {
                        if (!stream.tty) return -59;
                        if (stream.tty.ops.ioctl_tiocgwinsz) {
                            var winsize = stream.tty.ops.ioctl_tiocgwinsz(
                                stream.tty
                            );
                            argp = syscallGetVarargP();
                            HEAP16[argp >> 1] = winsize[0];
                            HEAP16[(argp + 2) >> 1] = winsize[1];
                        }
                        return 0;
                    }
                    case 21524: {
                        if (!stream.tty) return -59;
                        return 0;
                    }
                    case 21515: {
                        if (!stream.tty) return -59;
                        return 0;
                    }
                    default:
                        return -28;
                }
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function ___syscall_lstat64(path, buf) {
            try {
                path = SYSCALLS.getStr(path);
                return SYSCALLS.doStat(FS.lstat, path, buf);
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function ___syscall_mkdirat(dirfd, path, mode) {
            try {
                path = SYSCALLS.getStr(path);
                path = SYSCALLS.calculateAt(dirfd, path);

                path = PATH.normalize(path);
                if (path[path.length - 1] === "/")
                    path = path.substr(0, path.length - 1);
                FS.mkdir(path, mode, 0);
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function ___syscall_newfstatat(dirfd, path, buf, flags) {
            try {
                path = SYSCALLS.getStr(path);
                var nofollow = flags & 256;
                var allowEmpty = flags & 4096;
                flags = flags & ~6400;
                path = SYSCALLS.calculateAt(dirfd, path, allowEmpty);
                return SYSCALLS.doStat(
                    nofollow ? FS.lstat : FS.stat,
                    path,
                    buf
                );
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function ___syscall_openat(dirfd, path, flags, varargs) {
            SYSCALLS.varargs = varargs;
            try {
                path = SYSCALLS.getStr(path);
                path = SYSCALLS.calculateAt(dirfd, path);
                var mode = varargs ? syscallGetVarargI() : 0;
                return FS.open(path, flags, mode).fd;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function ___syscall_readlinkat(dirfd, path, buf, bufsize) {
            try {
                path = SYSCALLS.getStr(path);
                path = SYSCALLS.calculateAt(dirfd, path);
                if (bufsize <= 0) return -28;
                var ret = FS.readlink(path);

                var len = Math.min(bufsize, lengthBytesUTF8(ret));
                var endChar = HEAP8[buf + len];
                stringToUTF8(ret, buf, bufsize + 1);

                HEAP8[buf + len] = endChar;
                return len;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function ___syscall_rmdir(path) {
            try {
                path = SYSCALLS.getStr(path);
                FS.rmdir(path);
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function ___syscall_stat64(path, buf) {
            try {
                path = SYSCALLS.getStr(path);
                return SYSCALLS.doStat(FS.stat, path, buf);
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function ___syscall_unlinkat(dirfd, path, flags) {
            try {
                path = SYSCALLS.getStr(path);
                path = SYSCALLS.calculateAt(dirfd, path);
                if (flags === 0) {
                    FS.unlink(path);
                } else if (flags === 512) {
                    FS.rmdir(path);
                } else {
                    abort("Invalid flags passed to unlinkat");
                }
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        var readI53FromI64 = (ptr) => {
            return HEAPU32[ptr >> 2] + HEAP32[(ptr + 4) >> 2] * 4294967296;
        };

        function ___syscall_utimensat(dirfd, path, times, _flags) {
            try {
                path = SYSCALLS.getStr(path);
                path = SYSCALLS.calculateAt(dirfd, path, true);
                var now = Date.now(),
                    atime,
                    mtime;
                if (!times) {
                    atime = now;
                    mtime = now;
                } else {
                    var seconds = readI53FromI64(times);
                    var nanoseconds = HEAP32[(times + 8) >> 2];
                    if (nanoseconds == 1073741823) {
                        atime = now;
                    } else if (nanoseconds == 1073741822) {
                        atime = -1;
                    } else {
                        atime = seconds * 1000 + nanoseconds / (1000 * 1000);
                    }
                    times += 16;
                    seconds = readI53FromI64(times);
                    nanoseconds = HEAP32[(times + 8) >> 2];
                    if (nanoseconds == 1073741823) {
                        mtime = now;
                    } else if (nanoseconds == 1073741822) {
                        mtime = -1;
                    } else {
                        mtime = seconds * 1000 + nanoseconds / (1000 * 1000);
                    }
                }

                if (mtime != -1 || atime != -1) {
                    FS.utime(path, atime, mtime);
                }
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        var nowIsMonotonic = 1;
        var __emscripten_get_now_is_monotonic = () => nowIsMonotonic;

        var isLeapYear = (year) =>
            year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

        var MONTH_DAYS_LEAP_CUMULATIVE = [
            0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335,
        ];

        var MONTH_DAYS_REGULAR_CUMULATIVE = [
            0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334,
        ];
        var ydayFromDate = (date) => {
            var leap = isLeapYear(date.getFullYear());
            var monthDaysCumulative = leap
                ? MONTH_DAYS_LEAP_CUMULATIVE
                : MONTH_DAYS_REGULAR_CUMULATIVE;
            var yday =
                monthDaysCumulative[date.getMonth()] + date.getDate() - 1;

            return yday;
        };

        function __localtime_js(time, tmPtr) {
            time = bigintToI53Checked(time);

            var date = new Date(time * 1000);
            HEAP32[tmPtr >> 2] = date.getSeconds();
            HEAP32[(tmPtr + 4) >> 2] = date.getMinutes();
            HEAP32[(tmPtr + 8) >> 2] = date.getHours();
            HEAP32[(tmPtr + 12) >> 2] = date.getDate();
            HEAP32[(tmPtr + 16) >> 2] = date.getMonth();
            HEAP32[(tmPtr + 20) >> 2] = date.getFullYear() - 1900;
            HEAP32[(tmPtr + 24) >> 2] = date.getDay();

            var yday = ydayFromDate(date) | 0;
            HEAP32[(tmPtr + 28) >> 2] = yday;
            HEAP32[(tmPtr + 36) >> 2] = -(date.getTimezoneOffset() * 60);

            var start = new Date(date.getFullYear(), 0, 1);
            var summerOffset = new Date(
                date.getFullYear(),
                6,
                1
            ).getTimezoneOffset();
            var winterOffset = start.getTimezoneOffset();
            var dst =
                (summerOffset != winterOffset &&
                    date.getTimezoneOffset() ==
                        Math.min(winterOffset, summerOffset)) | 0;
            HEAP32[(tmPtr + 32) >> 2] = dst;
        }

        function __mmap_js(len, prot, flags, fd, offset, allocated, addr) {
            offset = bigintToI53Checked(offset);

            try {
                if (isNaN(offset)) return 61;
                var stream = SYSCALLS.getStreamFromFD(fd);
                var res = FS.mmap(stream, len, offset, prot, flags);
                var ptr = res.ptr;
                HEAP32[allocated >> 2] = res.allocated;
                HEAPU32[addr >> 2] = ptr;
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        function __munmap_js(addr, len, prot, flags, fd, offset) {
            offset = bigintToI53Checked(offset);

            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                if (prot & 2) {
                    SYSCALLS.doMsync(addr, stream, len, flags, offset);
                }
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            }
        }

        var __tzset_js = (timezone, daylight, std_name, dst_name) => {
            var currentYear = new Date().getFullYear();
            var winter = new Date(currentYear, 0, 1);
            var summer = new Date(currentYear, 6, 1);
            var winterOffset = winter.getTimezoneOffset();
            var summerOffset = summer.getTimezoneOffset();

            var stdTimezoneOffset = Math.max(winterOffset, summerOffset);

            HEAPU32[timezone >> 2] = stdTimezoneOffset * 60;

            HEAP32[daylight >> 2] = Number(winterOffset != summerOffset);

            var extractZone = (timezoneOffset) => {
                var sign = timezoneOffset >= 0 ? "-" : "+";

                var absOffset = Math.abs(timezoneOffset);
                var hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
                var minutes = String(absOffset % 60).padStart(2, "0");

                return `UTC${sign}${hours}${minutes}`;
            };

            var winterName = extractZone(winterOffset);
            var summerName = extractZone(summerOffset);
            if (summerOffset < winterOffset) {
                stringToUTF8(winterName, std_name, 17);
                stringToUTF8(summerName, dst_name, 17);
            } else {
                stringToUTF8(winterName, dst_name, 17);
                stringToUTF8(summerName, std_name, 17);
            }
        };

        var _emscripten_date_now = () => Date.now();

        var _emscripten_get_now = () => performance.now();

        var getHeapMax = () => 2147483648;

        var growMemory = (size) => {
            var b = wasmMemory.buffer;
            var pages = ((size - b.byteLength + 65535) / 65536) | 0;
            try {
                wasmMemory.grow(pages);
                updateMemoryViews();
                return 1;
            } catch (_e) {}
        };
        var _emscripten_resize_heap = (requestedSize) => {
            var oldSize = HEAPU8.length;

            requestedSize >>>= 0;

            var maxHeapSize = getHeapMax();
            if (requestedSize > maxHeapSize) {
                return false;
            }

            for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
                var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);

                overGrownHeapSize = Math.min(
                    overGrownHeapSize,
                    requestedSize + 100663296
                );

                var newSize = Math.min(
                    maxHeapSize,
                    alignMemory(
                        Math.max(requestedSize, overGrownHeapSize),
                        65536
                    )
                );

                var replacement = growMemory(newSize);
                if (replacement) {
                    return true;
                }
            }
            return false;
        };

        var ENV = {};

        var getExecutableName = () => {
            return thisProgram || "./this.program";
        };
        var getEnvStrings = () => {
            if (!getEnvStrings.strings) {
                var lang =
                    (
                        (typeof navigator == "object" &&
                            navigator.languages &&
                            navigator.languages[0]) ||
                        "C"
                    ).replace("-", "_") + ".UTF-8";
                var env = {
                    USER: "web_user",
                    LOGNAME: "web_user",
                    PATH: "/",
                    PWD: "/",
                    HOME: "/home/web_user",
                    LANG: lang,
                    _: getExecutableName(),
                };

                for (var x in ENV) {
                    if (ENV[x] === undefined) delete env[x];
                    else env[x] = ENV[x];
                }
                var strings = [];
                for (let x in env) {
                    strings.push(`${x}=${env[x]}`);
                }
                getEnvStrings.strings = strings;
            }
            return getEnvStrings.strings;
        };

        var stringToAscii = (str, buffer) => {
            for (var i = 0; i < str.length; ++i) {
                HEAP8[buffer++] = str.charCodeAt(i);
            }

            HEAP8[buffer] = 0;
        };
        var _environ_get = (__environ, environ_buf) => {
            var bufSize = 0;
            getEnvStrings().forEach((string, i) => {
                var ptr = environ_buf + bufSize;
                HEAPU32[(__environ + i * 4) >> 2] = ptr;
                stringToAscii(string, ptr);
                bufSize += string.length + 1;
            });
            return 0;
        };

        var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
            var strings = getEnvStrings();
            HEAPU32[penviron_count >> 2] = strings.length;
            var bufSize = 0;
            strings.forEach((string) => (bufSize += string.length + 1));
            HEAPU32[penviron_buf_size >> 2] = bufSize;
            return 0;
        };

        function _fd_close(fd) {
            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                FS.close(stream);
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return e.errno;
            }
        }

        function _fd_fdstat_get(fd, pbuf) {
            try {
                var rightsBase = 0;
                var rightsInheriting = 0;
                var flags = 0;
                {
                    var stream = SYSCALLS.getStreamFromFD(fd);

                    var type = stream.tty
                        ? 2
                        : FS.isDir(stream.mode)
                        ? 3
                        : FS.isLink(stream.mode)
                        ? 7
                        : 4;
                }
                HEAP8[pbuf] = type;
                HEAP16[(pbuf + 2) >> 1] = flags;
                HEAP64[(pbuf + 8) >> 3] = BigInt(rightsBase);
                HEAP64[(pbuf + 16) >> 3] = BigInt(rightsInheriting);
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return e.errno;
            }
        }

        var doReadv = (stream, iov, iovcnt, offset) => {
            var ret = 0;
            for (var i = 0; i < iovcnt; i++) {
                var ptr = HEAPU32[iov >> 2];
                var len = HEAPU32[(iov + 4) >> 2];
                iov += 8;
                var curr = FS.read(stream, HEAP8, ptr, len, offset);
                if (curr < 0) return -1;
                ret += curr;
                if (curr < len) break;
                if (typeof offset != "undefined") {
                    offset += curr;
                }
            }
            return ret;
        };

        function _fd_read(fd, iov, iovcnt, pnum) {
            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                var num = doReadv(stream, iov, iovcnt);
                HEAPU32[pnum >> 2] = num;
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return e.errno;
            }
        }

        function _fd_seek(fd, offset, whence, newOffset) {
            offset = bigintToI53Checked(offset);

            try {
                if (isNaN(offset)) return 61;
                var stream = SYSCALLS.getStreamFromFD(fd);
                FS.llseek(stream, offset, whence);
                HEAP64[newOffset >> 3] = BigInt(stream.position);
                if (stream.getdents && offset === 0 && whence === 0)
                    stream.getdents = null;
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return e.errno;
            }
        }

        function _fd_sync(fd) {
            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                if (stream.stream_ops?.fsync) {
                    return stream.stream_ops.fsync(stream);
                }
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return e.errno;
            }
        }

        var doWritev = (stream, iov, iovcnt, offset) => {
            var ret = 0;
            for (var i = 0; i < iovcnt; i++) {
                var ptr = HEAPU32[iov >> 2];
                var len = HEAPU32[(iov + 4) >> 2];
                iov += 8;
                var curr = FS.write(stream, HEAP8, ptr, len, offset);
                if (curr < 0) return -1;
                ret += curr;
                if (curr < len) {
                    break;
                }
                if (typeof offset != "undefined") {
                    offset += curr;
                }
            }
            return ret;
        };

        function _fd_write(fd, iov, iovcnt, pnum) {
            try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                var num = doWritev(stream, iov, iovcnt);
                HEAPU32[pnum >> 2] = num;
                return 0;
            } catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return e.errno;
            }
        }

        FS.createPreloadedFile = FS_createPreloadedFile;

        // Create PATH_FS with FS reference for cwd() support - must be before FS.staticInit()
        const PATH_FS = createPathFS(FS);

        FS.staticInit();

        var wasmImports = {
            __syscall_chmod: ___syscall_chmod,

            __syscall_faccessat: ___syscall_faccessat,

            __syscall_fchmod: ___syscall_fchmod,

            __syscall_fchown32: ___syscall_fchown32,

            __syscall_fcntl64: ___syscall_fcntl64,

            __syscall_fstat64: ___syscall_fstat64,

            __syscall_ftruncate64: ___syscall_ftruncate64,

            __syscall_getcwd: ___syscall_getcwd,

            __syscall_ioctl: ___syscall_ioctl,

            __syscall_lstat64: ___syscall_lstat64,

            __syscall_mkdirat: ___syscall_mkdirat,

            __syscall_newfstatat: ___syscall_newfstatat,

            __syscall_openat: ___syscall_openat,

            __syscall_readlinkat: ___syscall_readlinkat,

            __syscall_rmdir: ___syscall_rmdir,

            __syscall_stat64: ___syscall_stat64,

            __syscall_unlinkat: ___syscall_unlinkat,

            __syscall_utimensat: ___syscall_utimensat,

            _emscripten_get_now_is_monotonic: __emscripten_get_now_is_monotonic,

            _localtime_js: __localtime_js,

            _mmap_js: __mmap_js,

            _munmap_js: __munmap_js,

            _tzset_js: __tzset_js,

            emscripten_date_now: _emscripten_date_now,

            emscripten_get_now: _emscripten_get_now,

            emscripten_resize_heap: _emscripten_resize_heap,

            environ_get: _environ_get,

            environ_sizes_get: _environ_sizes_get,

            fd_close: _fd_close,

            fd_fdstat_get: _fd_fdstat_get,

            fd_read: _fd_read,

            fd_seek: _fd_seek,

            fd_sync: _fd_sync,

            fd_write: _fd_write,

            memory: wasmMemory,
        };
        wasmExports = createWasm();
        var ___wasm_call_ctors = () =>
            (___wasm_call_ctors = wasmExports["__wasm_call_ctors"])();
        var _sqlite3_status64 = (Module["_sqlite3_status64"] = (
            a0,
            a1,
            a2,
            a3
        ) =>
            (_sqlite3_status64 = Module["_sqlite3_status64"] =
                wasmExports["sqlite3_status64"])(a0, a1, a2, a3));
        var _sqlite3_status = (Module["_sqlite3_status"] = (a0, a1, a2, a3) =>
            (_sqlite3_status = Module["_sqlite3_status"] =
                wasmExports["sqlite3_status"])(a0, a1, a2, a3));
        var _sqlite3_db_status = (Module["_sqlite3_db_status"] = (
            a0,
            a1,
            a2,
            a3,
            a4
        ) =>
            (_sqlite3_db_status = Module["_sqlite3_db_status"] =
                wasmExports["sqlite3_db_status"])(a0, a1, a2, a3, a4));
        var _sqlite3_msize = (Module["_sqlite3_msize"] = (a0) =>
            (_sqlite3_msize = Module["_sqlite3_msize"] =
                wasmExports["sqlite3_msize"])(a0));
        var _sqlite3_vfs_find = (Module["_sqlite3_vfs_find"] = (a0) =>
            (_sqlite3_vfs_find = Module["_sqlite3_vfs_find"] =
                wasmExports["sqlite3_vfs_find"])(a0));
        var _sqlite3_initialize = (Module["_sqlite3_initialize"] = () =>
            (_sqlite3_initialize = Module["_sqlite3_initialize"] =
                wasmExports["sqlite3_initialize"])());
        var _sqlite3_malloc = (Module["_sqlite3_malloc"] = (a0) =>
            (_sqlite3_malloc = Module["_sqlite3_malloc"] =
                wasmExports["sqlite3_malloc"])(a0));
        var _sqlite3_free = (Module["_sqlite3_free"] = (a0) =>
            (_sqlite3_free = Module["_sqlite3_free"] =
                wasmExports["sqlite3_free"])(a0));
        var _sqlite3_vfs_register = (Module["_sqlite3_vfs_register"] = (
            a0,
            a1
        ) =>
            (_sqlite3_vfs_register = Module["_sqlite3_vfs_register"] =
                wasmExports["sqlite3_vfs_register"])(a0, a1));
        var _sqlite3_vfs_unregister = (Module["_sqlite3_vfs_unregister"] = (
            a0
        ) =>
            (_sqlite3_vfs_unregister = Module["_sqlite3_vfs_unregister"] =
                wasmExports["sqlite3_vfs_unregister"])(a0));
        var _sqlite3_malloc64 = (Module["_sqlite3_malloc64"] = (a0) =>
            (_sqlite3_malloc64 = Module["_sqlite3_malloc64"] =
                wasmExports["sqlite3_malloc64"])(a0));
        var _sqlite3_realloc = (Module["_sqlite3_realloc"] = (a0, a1) =>
            (_sqlite3_realloc = Module["_sqlite3_realloc"] =
                wasmExports["sqlite3_realloc"])(a0, a1));
        var _sqlite3_realloc64 = (Module["_sqlite3_realloc64"] = (a0, a1) =>
            (_sqlite3_realloc64 = Module["_sqlite3_realloc64"] =
                wasmExports["sqlite3_realloc64"])(a0, a1));
        var _sqlite3_value_text = (Module["_sqlite3_value_text"] = (a0) =>
            (_sqlite3_value_text = Module["_sqlite3_value_text"] =
                wasmExports["sqlite3_value_text"])(a0));
        var _sqlite3_randomness = (Module["_sqlite3_randomness"] = (a0, a1) =>
            (_sqlite3_randomness = Module["_sqlite3_randomness"] =
                wasmExports["sqlite3_randomness"])(a0, a1));
        var _sqlite3_stricmp = (Module["_sqlite3_stricmp"] = (a0, a1) =>
            (_sqlite3_stricmp = Module["_sqlite3_stricmp"] =
                wasmExports["sqlite3_stricmp"])(a0, a1));
        var _sqlite3_strnicmp = (Module["_sqlite3_strnicmp"] = (a0, a1, a2) =>
            (_sqlite3_strnicmp = Module["_sqlite3_strnicmp"] =
                wasmExports["sqlite3_strnicmp"])(a0, a1, a2));
        var _sqlite3_uri_parameter = (Module["_sqlite3_uri_parameter"] = (
            a0,
            a1
        ) =>
            (_sqlite3_uri_parameter = Module["_sqlite3_uri_parameter"] =
                wasmExports["sqlite3_uri_parameter"])(a0, a1));
        var _sqlite3_uri_boolean = (Module["_sqlite3_uri_boolean"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_uri_boolean = Module["_sqlite3_uri_boolean"] =
                wasmExports["sqlite3_uri_boolean"])(a0, a1, a2));
        var _sqlite3_serialize = (Module["_sqlite3_serialize"] = (
            a0,
            a1,
            a2,
            a3
        ) =>
            (_sqlite3_serialize = Module["_sqlite3_serialize"] =
                wasmExports["sqlite3_serialize"])(a0, a1, a2, a3));
        var _sqlite3_prepare_v2 = (Module["_sqlite3_prepare_v2"] = (
            a0,
            a1,
            a2,
            a3,
            a4
        ) =>
            (_sqlite3_prepare_v2 = Module["_sqlite3_prepare_v2"] =
                wasmExports["sqlite3_prepare_v2"])(a0, a1, a2, a3, a4));
        var _sqlite3_step = (Module["_sqlite3_step"] = (a0) =>
            (_sqlite3_step = Module["_sqlite3_step"] =
                wasmExports["sqlite3_step"])(a0));
        var _sqlite3_column_int64 = (Module["_sqlite3_column_int64"] = (
            a0,
            a1
        ) =>
            (_sqlite3_column_int64 = Module["_sqlite3_column_int64"] =
                wasmExports["sqlite3_column_int64"])(a0, a1));
        var _sqlite3_reset = (Module["_sqlite3_reset"] = (a0) =>
            (_sqlite3_reset = Module["_sqlite3_reset"] =
                wasmExports["sqlite3_reset"])(a0));
        var _sqlite3_exec = (Module["_sqlite3_exec"] = (a0, a1, a2, a3, a4) =>
            (_sqlite3_exec = Module["_sqlite3_exec"] =
                wasmExports["sqlite3_exec"])(a0, a1, a2, a3, a4));
        var _sqlite3_column_int = (Module["_sqlite3_column_int"] = (a0, a1) =>
            (_sqlite3_column_int = Module["_sqlite3_column_int"] =
                wasmExports["sqlite3_column_int"])(a0, a1));
        var _sqlite3_finalize = (Module["_sqlite3_finalize"] = (a0) =>
            (_sqlite3_finalize = Module["_sqlite3_finalize"] =
                wasmExports["sqlite3_finalize"])(a0));
        var _sqlite3_file_control = (Module["_sqlite3_file_control"] = (
            a0,
            a1,
            a2,
            a3
        ) =>
            (_sqlite3_file_control = Module["_sqlite3_file_control"] =
                wasmExports["sqlite3_file_control"])(a0, a1, a2, a3));
        var _sqlite3_column_name = (Module["_sqlite3_column_name"] = (a0, a1) =>
            (_sqlite3_column_name = Module["_sqlite3_column_name"] =
                wasmExports["sqlite3_column_name"])(a0, a1));
        var _sqlite3_column_text = (Module["_sqlite3_column_text"] = (a0, a1) =>
            (_sqlite3_column_text = Module["_sqlite3_column_text"] =
                wasmExports["sqlite3_column_text"])(a0, a1));
        var _sqlite3_column_type = (Module["_sqlite3_column_type"] = (a0, a1) =>
            (_sqlite3_column_type = Module["_sqlite3_column_type"] =
                wasmExports["sqlite3_column_type"])(a0, a1));
        var _sqlite3_errmsg = (Module["_sqlite3_errmsg"] = (a0) =>
            (_sqlite3_errmsg = Module["_sqlite3_errmsg"] =
                wasmExports["sqlite3_errmsg"])(a0));
        var _sqlite3_deserialize = (Module["_sqlite3_deserialize"] = (
            a0,
            a1,
            a2,
            a3,
            a4,
            a5
        ) =>
            (_sqlite3_deserialize = Module["_sqlite3_deserialize"] =
                wasmExports["sqlite3_deserialize"])(a0, a1, a2, a3, a4, a5));
        var _sqlite3_clear_bindings = (Module["_sqlite3_clear_bindings"] = (
            a0
        ) =>
            (_sqlite3_clear_bindings = Module["_sqlite3_clear_bindings"] =
                wasmExports["sqlite3_clear_bindings"])(a0));
        var _sqlite3_value_blob = (Module["_sqlite3_value_blob"] = (a0) =>
            (_sqlite3_value_blob = Module["_sqlite3_value_blob"] =
                wasmExports["sqlite3_value_blob"])(a0));
        var _sqlite3_value_bytes = (Module["_sqlite3_value_bytes"] = (a0) =>
            (_sqlite3_value_bytes = Module["_sqlite3_value_bytes"] =
                wasmExports["sqlite3_value_bytes"])(a0));
        var _sqlite3_value_double = (Module["_sqlite3_value_double"] = (a0) =>
            (_sqlite3_value_double = Module["_sqlite3_value_double"] =
                wasmExports["sqlite3_value_double"])(a0));
        var _sqlite3_value_int = (Module["_sqlite3_value_int"] = (a0) =>
            (_sqlite3_value_int = Module["_sqlite3_value_int"] =
                wasmExports["sqlite3_value_int"])(a0));
        var _sqlite3_value_int64 = (Module["_sqlite3_value_int64"] = (a0) =>
            (_sqlite3_value_int64 = Module["_sqlite3_value_int64"] =
                wasmExports["sqlite3_value_int64"])(a0));
        var _sqlite3_value_subtype = (Module["_sqlite3_value_subtype"] = (a0) =>
            (_sqlite3_value_subtype = Module["_sqlite3_value_subtype"] =
                wasmExports["sqlite3_value_subtype"])(a0));
        var _sqlite3_value_pointer = (Module["_sqlite3_value_pointer"] = (
            a0,
            a1
        ) =>
            (_sqlite3_value_pointer = Module["_sqlite3_value_pointer"] =
                wasmExports["sqlite3_value_pointer"])(a0, a1));
        var _sqlite3_value_type = (Module["_sqlite3_value_type"] = (a0) =>
            (_sqlite3_value_type = Module["_sqlite3_value_type"] =
                wasmExports["sqlite3_value_type"])(a0));
        var _sqlite3_value_nochange = (Module["_sqlite3_value_nochange"] = (
            a0
        ) =>
            (_sqlite3_value_nochange = Module["_sqlite3_value_nochange"] =
                wasmExports["sqlite3_value_nochange"])(a0));
        var _sqlite3_value_frombind = (Module["_sqlite3_value_frombind"] = (
            a0
        ) =>
            (_sqlite3_value_frombind = Module["_sqlite3_value_frombind"] =
                wasmExports["sqlite3_value_frombind"])(a0));
        var _sqlite3_value_dup = (Module["_sqlite3_value_dup"] = (a0) =>
            (_sqlite3_value_dup = Module["_sqlite3_value_dup"] =
                wasmExports["sqlite3_value_dup"])(a0));
        var _sqlite3_value_free = (Module["_sqlite3_value_free"] = (a0) =>
            (_sqlite3_value_free = Module["_sqlite3_value_free"] =
                wasmExports["sqlite3_value_free"])(a0));
        var _sqlite3_result_blob = (Module["_sqlite3_result_blob"] = (
            a0,
            a1,
            a2,
            a3
        ) =>
            (_sqlite3_result_blob = Module["_sqlite3_result_blob"] =
                wasmExports["sqlite3_result_blob"])(a0, a1, a2, a3));
        var _sqlite3_result_error_toobig = (Module[
            "_sqlite3_result_error_toobig"
        ] = (a0) =>
            (_sqlite3_result_error_toobig = Module[
                "_sqlite3_result_error_toobig"
            ] =
                wasmExports["sqlite3_result_error_toobig"])(a0));
        var _sqlite3_result_error_nomem = (Module[
            "_sqlite3_result_error_nomem"
        ] = (a0) =>
            (_sqlite3_result_error_nomem = Module[
                "_sqlite3_result_error_nomem"
            ] =
                wasmExports["sqlite3_result_error_nomem"])(a0));
        var _sqlite3_result_double = (Module["_sqlite3_result_double"] = (
            a0,
            a1
        ) =>
            (_sqlite3_result_double = Module["_sqlite3_result_double"] =
                wasmExports["sqlite3_result_double"])(a0, a1));
        var _sqlite3_result_error = (Module["_sqlite3_result_error"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_result_error = Module["_sqlite3_result_error"] =
                wasmExports["sqlite3_result_error"])(a0, a1, a2));
        var _sqlite3_result_int = (Module["_sqlite3_result_int"] = (a0, a1) =>
            (_sqlite3_result_int = Module["_sqlite3_result_int"] =
                wasmExports["sqlite3_result_int"])(a0, a1));
        var _sqlite3_result_int64 = (Module["_sqlite3_result_int64"] = (
            a0,
            a1
        ) =>
            (_sqlite3_result_int64 = Module["_sqlite3_result_int64"] =
                wasmExports["sqlite3_result_int64"])(a0, a1));
        var _sqlite3_result_null = (Module["_sqlite3_result_null"] = (a0) =>
            (_sqlite3_result_null = Module["_sqlite3_result_null"] =
                wasmExports["sqlite3_result_null"])(a0));
        var _sqlite3_result_pointer = (Module["_sqlite3_result_pointer"] = (
            a0,
            a1,
            a2,
            a3
        ) =>
            (_sqlite3_result_pointer = Module["_sqlite3_result_pointer"] =
                wasmExports["sqlite3_result_pointer"])(a0, a1, a2, a3));
        var _sqlite3_result_subtype = (Module["_sqlite3_result_subtype"] = (
            a0,
            a1
        ) =>
            (_sqlite3_result_subtype = Module["_sqlite3_result_subtype"] =
                wasmExports["sqlite3_result_subtype"])(a0, a1));
        var _sqlite3_result_text = (Module["_sqlite3_result_text"] = (
            a0,
            a1,
            a2,
            a3
        ) =>
            (_sqlite3_result_text = Module["_sqlite3_result_text"] =
                wasmExports["sqlite3_result_text"])(a0, a1, a2, a3));
        var _sqlite3_result_zeroblob = (Module["_sqlite3_result_zeroblob"] = (
            a0,
            a1
        ) =>
            (_sqlite3_result_zeroblob = Module["_sqlite3_result_zeroblob"] =
                wasmExports["sqlite3_result_zeroblob"])(a0, a1));
        var _sqlite3_result_zeroblob64 = (Module["_sqlite3_result_zeroblob64"] =
            (a0, a1) =>
                (_sqlite3_result_zeroblob64 = Module[
                    "_sqlite3_result_zeroblob64"
                ] =
                    wasmExports["sqlite3_result_zeroblob64"])(a0, a1));
        var _sqlite3_result_error_code = (Module["_sqlite3_result_error_code"] =
            (a0, a1) =>
                (_sqlite3_result_error_code = Module[
                    "_sqlite3_result_error_code"
                ] =
                    wasmExports["sqlite3_result_error_code"])(a0, a1));
        var _sqlite3_user_data = (Module["_sqlite3_user_data"] = (a0) =>
            (_sqlite3_user_data = Module["_sqlite3_user_data"] =
                wasmExports["sqlite3_user_data"])(a0));
        var _sqlite3_context_db_handle = (Module["_sqlite3_context_db_handle"] =
            (a0) =>
                (_sqlite3_context_db_handle = Module[
                    "_sqlite3_context_db_handle"
                ] =
                    wasmExports["sqlite3_context_db_handle"])(a0));
        var _sqlite3_vtab_nochange = (Module["_sqlite3_vtab_nochange"] = (a0) =>
            (_sqlite3_vtab_nochange = Module["_sqlite3_vtab_nochange"] =
                wasmExports["sqlite3_vtab_nochange"])(a0));
        var _sqlite3_vtab_in_first = (Module["_sqlite3_vtab_in_first"] = (
            a0,
            a1
        ) =>
            (_sqlite3_vtab_in_first = Module["_sqlite3_vtab_in_first"] =
                wasmExports["sqlite3_vtab_in_first"])(a0, a1));
        var _sqlite3_vtab_in_next = (Module["_sqlite3_vtab_in_next"] = (
            a0,
            a1
        ) =>
            (_sqlite3_vtab_in_next = Module["_sqlite3_vtab_in_next"] =
                wasmExports["sqlite3_vtab_in_next"])(a0, a1));
        var _sqlite3_aggregate_context = (Module["_sqlite3_aggregate_context"] =
            (a0, a1) =>
                (_sqlite3_aggregate_context = Module[
                    "_sqlite3_aggregate_context"
                ] =
                    wasmExports["sqlite3_aggregate_context"])(a0, a1));
        var _sqlite3_get_auxdata = (Module["_sqlite3_get_auxdata"] = (a0, a1) =>
            (_sqlite3_get_auxdata = Module["_sqlite3_get_auxdata"] =
                wasmExports["sqlite3_get_auxdata"])(a0, a1));
        var _sqlite3_set_auxdata = (Module["_sqlite3_set_auxdata"] = (
            a0,
            a1,
            a2,
            a3
        ) =>
            (_sqlite3_set_auxdata = Module["_sqlite3_set_auxdata"] =
                wasmExports["sqlite3_set_auxdata"])(a0, a1, a2, a3));
        var _sqlite3_column_count = (Module["_sqlite3_column_count"] = (a0) =>
            (_sqlite3_column_count = Module["_sqlite3_column_count"] =
                wasmExports["sqlite3_column_count"])(a0));
        var _sqlite3_data_count = (Module["_sqlite3_data_count"] = (a0) =>
            (_sqlite3_data_count = Module["_sqlite3_data_count"] =
                wasmExports["sqlite3_data_count"])(a0));
        var _sqlite3_column_blob = (Module["_sqlite3_column_blob"] = (a0, a1) =>
            (_sqlite3_column_blob = Module["_sqlite3_column_blob"] =
                wasmExports["sqlite3_column_blob"])(a0, a1));
        var _sqlite3_column_bytes = (Module["_sqlite3_column_bytes"] = (
            a0,
            a1
        ) =>
            (_sqlite3_column_bytes = Module["_sqlite3_column_bytes"] =
                wasmExports["sqlite3_column_bytes"])(a0, a1));
        var _sqlite3_column_double = (Module["_sqlite3_column_double"] = (
            a0,
            a1
        ) =>
            (_sqlite3_column_double = Module["_sqlite3_column_double"] =
                wasmExports["sqlite3_column_double"])(a0, a1));
        var _sqlite3_column_value = (Module["_sqlite3_column_value"] = (
            a0,
            a1
        ) =>
            (_sqlite3_column_value = Module["_sqlite3_column_value"] =
                wasmExports["sqlite3_column_value"])(a0, a1));
        var _sqlite3_column_decltype = (Module["_sqlite3_column_decltype"] = (
            a0,
            a1
        ) =>
            (_sqlite3_column_decltype = Module["_sqlite3_column_decltype"] =
                wasmExports["sqlite3_column_decltype"])(a0, a1));
        var _sqlite3_bind_blob = (Module["_sqlite3_bind_blob"] = (
            a0,
            a1,
            a2,
            a3,
            a4
        ) =>
            (_sqlite3_bind_blob = Module["_sqlite3_bind_blob"] =
                wasmExports["sqlite3_bind_blob"])(a0, a1, a2, a3, a4));
        var _sqlite3_bind_double = (Module["_sqlite3_bind_double"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_bind_double = Module["_sqlite3_bind_double"] =
                wasmExports["sqlite3_bind_double"])(a0, a1, a2));
        var _sqlite3_bind_int = (Module["_sqlite3_bind_int"] = (a0, a1, a2) =>
            (_sqlite3_bind_int = Module["_sqlite3_bind_int"] =
                wasmExports["sqlite3_bind_int"])(a0, a1, a2));
        var _sqlite3_bind_int64 = (Module["_sqlite3_bind_int64"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_bind_int64 = Module["_sqlite3_bind_int64"] =
                wasmExports["sqlite3_bind_int64"])(a0, a1, a2));
        var _sqlite3_bind_null = (Module["_sqlite3_bind_null"] = (a0, a1) =>
            (_sqlite3_bind_null = Module["_sqlite3_bind_null"] =
                wasmExports["sqlite3_bind_null"])(a0, a1));
        var _sqlite3_bind_pointer = (Module["_sqlite3_bind_pointer"] = (
            a0,
            a1,
            a2,
            a3,
            a4
        ) =>
            (_sqlite3_bind_pointer = Module["_sqlite3_bind_pointer"] =
                wasmExports["sqlite3_bind_pointer"])(a0, a1, a2, a3, a4));
        var _sqlite3_bind_text = (Module["_sqlite3_bind_text"] = (
            a0,
            a1,
            a2,
            a3,
            a4
        ) =>
            (_sqlite3_bind_text = Module["_sqlite3_bind_text"] =
                wasmExports["sqlite3_bind_text"])(a0, a1, a2, a3, a4));
        var _sqlite3_bind_parameter_count = (Module[
            "_sqlite3_bind_parameter_count"
        ] = (a0) =>
            (_sqlite3_bind_parameter_count = Module[
                "_sqlite3_bind_parameter_count"
            ] =
                wasmExports["sqlite3_bind_parameter_count"])(a0));
        var _sqlite3_bind_parameter_name = (Module[
            "_sqlite3_bind_parameter_name"
        ] = (a0, a1) =>
            (_sqlite3_bind_parameter_name = Module[
                "_sqlite3_bind_parameter_name"
            ] =
                wasmExports["sqlite3_bind_parameter_name"])(a0, a1));
        var _sqlite3_bind_parameter_index = (Module[
            "_sqlite3_bind_parameter_index"
        ] = (a0, a1) =>
            (_sqlite3_bind_parameter_index = Module[
                "_sqlite3_bind_parameter_index"
            ] =
                wasmExports["sqlite3_bind_parameter_index"])(a0, a1));
        var _sqlite3_db_handle = (Module["_sqlite3_db_handle"] = (a0) =>
            (_sqlite3_db_handle = Module["_sqlite3_db_handle"] =
                wasmExports["sqlite3_db_handle"])(a0));
        var _sqlite3_stmt_readonly = (Module["_sqlite3_stmt_readonly"] = (a0) =>
            (_sqlite3_stmt_readonly = Module["_sqlite3_stmt_readonly"] =
                wasmExports["sqlite3_stmt_readonly"])(a0));
        var _sqlite3_stmt_isexplain = (Module["_sqlite3_stmt_isexplain"] = (
            a0
        ) =>
            (_sqlite3_stmt_isexplain = Module["_sqlite3_stmt_isexplain"] =
                wasmExports["sqlite3_stmt_isexplain"])(a0));
        var _sqlite3_stmt_explain = (Module["_sqlite3_stmt_explain"] = (
            a0,
            a1
        ) =>
            (_sqlite3_stmt_explain = Module["_sqlite3_stmt_explain"] =
                wasmExports["sqlite3_stmt_explain"])(a0, a1));
        var _sqlite3_stmt_busy = (Module["_sqlite3_stmt_busy"] = (a0) =>
            (_sqlite3_stmt_busy = Module["_sqlite3_stmt_busy"] =
                wasmExports["sqlite3_stmt_busy"])(a0));
        var _sqlite3_stmt_status = (Module["_sqlite3_stmt_status"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_stmt_status = Module["_sqlite3_stmt_status"] =
                wasmExports["sqlite3_stmt_status"])(a0, a1, a2));
        var _sqlite3_sql = (Module["_sqlite3_sql"] = (a0) =>
            (_sqlite3_sql = Module["_sqlite3_sql"] =
                wasmExports["sqlite3_sql"])(a0));
        var _sqlite3_expanded_sql = (Module["_sqlite3_expanded_sql"] = (a0) =>
            (_sqlite3_expanded_sql = Module["_sqlite3_expanded_sql"] =
                wasmExports["sqlite3_expanded_sql"])(a0));
        var _sqlite3_preupdate_old = (Module["_sqlite3_preupdate_old"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_preupdate_old = Module["_sqlite3_preupdate_old"] =
                wasmExports["sqlite3_preupdate_old"])(a0, a1, a2));
        var _sqlite3_preupdate_count = (Module["_sqlite3_preupdate_count"] = (
            a0
        ) =>
            (_sqlite3_preupdate_count = Module["_sqlite3_preupdate_count"] =
                wasmExports["sqlite3_preupdate_count"])(a0));
        var _sqlite3_preupdate_depth = (Module["_sqlite3_preupdate_depth"] = (
            a0
        ) =>
            (_sqlite3_preupdate_depth = Module["_sqlite3_preupdate_depth"] =
                wasmExports["sqlite3_preupdate_depth"])(a0));
        var _sqlite3_preupdate_blobwrite = (Module[
            "_sqlite3_preupdate_blobwrite"
        ] = (a0) =>
            (_sqlite3_preupdate_blobwrite = Module[
                "_sqlite3_preupdate_blobwrite"
            ] =
                wasmExports["sqlite3_preupdate_blobwrite"])(a0));
        var _sqlite3_preupdate_new = (Module["_sqlite3_preupdate_new"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_preupdate_new = Module["_sqlite3_preupdate_new"] =
                wasmExports["sqlite3_preupdate_new"])(a0, a1, a2));
        var _sqlite3_value_numeric_type = (Module[
            "_sqlite3_value_numeric_type"
        ] = (a0) =>
            (_sqlite3_value_numeric_type = Module[
                "_sqlite3_value_numeric_type"
            ] =
                wasmExports["sqlite3_value_numeric_type"])(a0));
        var _sqlite3_set_authorizer = (Module["_sqlite3_set_authorizer"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_set_authorizer = Module["_sqlite3_set_authorizer"] =
                wasmExports["sqlite3_set_authorizer"])(a0, a1, a2));
        var _sqlite3_strglob = (Module["_sqlite3_strglob"] = (a0, a1) =>
            (_sqlite3_strglob = Module["_sqlite3_strglob"] =
                wasmExports["sqlite3_strglob"])(a0, a1));
        var _sqlite3_strlike = (Module["_sqlite3_strlike"] = (a0, a1, a2) =>
            (_sqlite3_strlike = Module["_sqlite3_strlike"] =
                wasmExports["sqlite3_strlike"])(a0, a1, a2));
        var _sqlite3_auto_extension = (Module["_sqlite3_auto_extension"] = (
            a0
        ) =>
            (_sqlite3_auto_extension = Module["_sqlite3_auto_extension"] =
                wasmExports["sqlite3_auto_extension"])(a0));
        var _sqlite3_cancel_auto_extension = (Module[
            "_sqlite3_cancel_auto_extension"
        ] = (a0) =>
            (_sqlite3_cancel_auto_extension = Module[
                "_sqlite3_cancel_auto_extension"
            ] =
                wasmExports["sqlite3_cancel_auto_extension"])(a0));
        var _sqlite3_reset_auto_extension = (Module[
            "_sqlite3_reset_auto_extension"
        ] = () =>
            (_sqlite3_reset_auto_extension = Module[
                "_sqlite3_reset_auto_extension"
            ] =
                wasmExports["sqlite3_reset_auto_extension"])());
        var _sqlite3_prepare_v3 = (Module["_sqlite3_prepare_v3"] = (
            a0,
            a1,
            a2,
            a3,
            a4,
            a5
        ) =>
            (_sqlite3_prepare_v3 = Module["_sqlite3_prepare_v3"] =
                wasmExports["sqlite3_prepare_v3"])(a0, a1, a2, a3, a4, a5));
        var _sqlite3_create_module = (Module["_sqlite3_create_module"] = (
            a0,
            a1,
            a2,
            a3
        ) =>
            (_sqlite3_create_module = Module["_sqlite3_create_module"] =
                wasmExports["sqlite3_create_module"])(a0, a1, a2, a3));
        var _sqlite3_create_module_v2 = (Module["_sqlite3_create_module_v2"] = (
            a0,
            a1,
            a2,
            a3,
            a4
        ) =>
            (_sqlite3_create_module_v2 = Module["_sqlite3_create_module_v2"] =
                wasmExports["sqlite3_create_module_v2"])(a0, a1, a2, a3, a4));
        var _sqlite3_drop_modules = (Module["_sqlite3_drop_modules"] = (
            a0,
            a1
        ) =>
            (_sqlite3_drop_modules = Module["_sqlite3_drop_modules"] =
                wasmExports["sqlite3_drop_modules"])(a0, a1));
        var _sqlite3_declare_vtab = (Module["_sqlite3_declare_vtab"] = (
            a0,
            a1
        ) =>
            (_sqlite3_declare_vtab = Module["_sqlite3_declare_vtab"] =
                wasmExports["sqlite3_declare_vtab"])(a0, a1));
        var _sqlite3_vtab_on_conflict = (Module["_sqlite3_vtab_on_conflict"] = (
            a0
        ) =>
            (_sqlite3_vtab_on_conflict = Module["_sqlite3_vtab_on_conflict"] =
                wasmExports["sqlite3_vtab_on_conflict"])(a0));
        var _sqlite3_vtab_collation = (Module["_sqlite3_vtab_collation"] = (
            a0,
            a1
        ) =>
            (_sqlite3_vtab_collation = Module["_sqlite3_vtab_collation"] =
                wasmExports["sqlite3_vtab_collation"])(a0, a1));
        var _sqlite3_vtab_in = (Module["_sqlite3_vtab_in"] = (a0, a1, a2) =>
            (_sqlite3_vtab_in = Module["_sqlite3_vtab_in"] =
                wasmExports["sqlite3_vtab_in"])(a0, a1, a2));
        var _sqlite3_vtab_rhs_value = (Module["_sqlite3_vtab_rhs_value"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_vtab_rhs_value = Module["_sqlite3_vtab_rhs_value"] =
                wasmExports["sqlite3_vtab_rhs_value"])(a0, a1, a2));
        var _sqlite3_vtab_distinct = (Module["_sqlite3_vtab_distinct"] = (a0) =>
            (_sqlite3_vtab_distinct = Module["_sqlite3_vtab_distinct"] =
                wasmExports["sqlite3_vtab_distinct"])(a0));
        var _sqlite3_keyword_name = (Module["_sqlite3_keyword_name"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_keyword_name = Module["_sqlite3_keyword_name"] =
                wasmExports["sqlite3_keyword_name"])(a0, a1, a2));
        var _sqlite3_keyword_count = (Module["_sqlite3_keyword_count"] = () =>
            (_sqlite3_keyword_count = Module["_sqlite3_keyword_count"] =
                wasmExports["sqlite3_keyword_count"])());
        var _sqlite3_keyword_check = (Module["_sqlite3_keyword_check"] = (
            a0,
            a1
        ) =>
            (_sqlite3_keyword_check = Module["_sqlite3_keyword_check"] =
                wasmExports["sqlite3_keyword_check"])(a0, a1));
        var _sqlite3_complete = (Module["_sqlite3_complete"] = (a0) =>
            (_sqlite3_complete = Module["_sqlite3_complete"] =
                wasmExports["sqlite3_complete"])(a0));
        var _sqlite3_libversion = (Module["_sqlite3_libversion"] = () =>
            (_sqlite3_libversion = Module["_sqlite3_libversion"] =
                wasmExports["sqlite3_libversion"])());
        var _sqlite3_libversion_number = (Module["_sqlite3_libversion_number"] =
            () =>
                (_sqlite3_libversion_number = Module[
                    "_sqlite3_libversion_number"
                ] =
                    wasmExports["sqlite3_libversion_number"])());
        var _sqlite3_shutdown = (Module["_sqlite3_shutdown"] = () =>
            (_sqlite3_shutdown = Module["_sqlite3_shutdown"] =
                wasmExports["sqlite3_shutdown"])());
        var _sqlite3_last_insert_rowid = (Module["_sqlite3_last_insert_rowid"] =
            (a0) =>
                (_sqlite3_last_insert_rowid = Module[
                    "_sqlite3_last_insert_rowid"
                ] =
                    wasmExports["sqlite3_last_insert_rowid"])(a0));
        var _sqlite3_set_last_insert_rowid = (Module[
            "_sqlite3_set_last_insert_rowid"
        ] = (a0, a1) =>
            (_sqlite3_set_last_insert_rowid = Module[
                "_sqlite3_set_last_insert_rowid"
            ] =
                wasmExports["sqlite3_set_last_insert_rowid"])(a0, a1));
        var _sqlite3_changes64 = (Module["_sqlite3_changes64"] = (a0) =>
            (_sqlite3_changes64 = Module["_sqlite3_changes64"] =
                wasmExports["sqlite3_changes64"])(a0));
        var _sqlite3_changes = (Module["_sqlite3_changes"] = (a0) =>
            (_sqlite3_changes = Module["_sqlite3_changes"] =
                wasmExports["sqlite3_changes"])(a0));
        var _sqlite3_total_changes64 = (Module["_sqlite3_total_changes64"] = (
            a0
        ) =>
            (_sqlite3_total_changes64 = Module["_sqlite3_total_changes64"] =
                wasmExports["sqlite3_total_changes64"])(a0));
        var _sqlite3_total_changes = (Module["_sqlite3_total_changes"] = (a0) =>
            (_sqlite3_total_changes = Module["_sqlite3_total_changes"] =
                wasmExports["sqlite3_total_changes"])(a0));
        var _sqlite3_txn_state = (Module["_sqlite3_txn_state"] = (a0, a1) =>
            (_sqlite3_txn_state = Module["_sqlite3_txn_state"] =
                wasmExports["sqlite3_txn_state"])(a0, a1));
        var _sqlite3_close_v2 = (Module["_sqlite3_close_v2"] = (a0) =>
            (_sqlite3_close_v2 = Module["_sqlite3_close_v2"] =
                wasmExports["sqlite3_close_v2"])(a0));
        var _sqlite3_busy_handler = (Module["_sqlite3_busy_handler"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_busy_handler = Module["_sqlite3_busy_handler"] =
                wasmExports["sqlite3_busy_handler"])(a0, a1, a2));
        var _sqlite3_progress_handler = (Module["_sqlite3_progress_handler"] = (
            a0,
            a1,
            a2,
            a3
        ) =>
            (_sqlite3_progress_handler = Module["_sqlite3_progress_handler"] =
                wasmExports["sqlite3_progress_handler"])(a0, a1, a2, a3));
        var _sqlite3_busy_timeout = (Module["_sqlite3_busy_timeout"] = (
            a0,
            a1
        ) =>
            (_sqlite3_busy_timeout = Module["_sqlite3_busy_timeout"] =
                wasmExports["sqlite3_busy_timeout"])(a0, a1));
        var _sqlite3_interrupt = (Module["_sqlite3_interrupt"] = (a0) =>
            (_sqlite3_interrupt = Module["_sqlite3_interrupt"] =
                wasmExports["sqlite3_interrupt"])(a0));
        var _sqlite3_is_interrupted = (Module["_sqlite3_is_interrupted"] = (
            a0
        ) =>
            (_sqlite3_is_interrupted = Module["_sqlite3_is_interrupted"] =
                wasmExports["sqlite3_is_interrupted"])(a0));
        var _sqlite3_create_function = (Module["_sqlite3_create_function"] = (
            a0,
            a1,
            a2,
            a3,
            a4,
            a5,
            a6,
            a7
        ) =>
            (_sqlite3_create_function = Module["_sqlite3_create_function"] =
                wasmExports["sqlite3_create_function"])(
                a0,
                a1,
                a2,
                a3,
                a4,
                a5,
                a6,
                a7
            ));
        var _sqlite3_create_function_v2 = (Module[
            "_sqlite3_create_function_v2"
        ] = (a0, a1, a2, a3, a4, a5, a6, a7, a8) =>
            (_sqlite3_create_function_v2 = Module[
                "_sqlite3_create_function_v2"
            ] =
                wasmExports["sqlite3_create_function_v2"])(
                a0,
                a1,
                a2,
                a3,
                a4,
                a5,
                a6,
                a7,
                a8
            ));
        var _sqlite3_create_window_function = (Module[
            "_sqlite3_create_window_function"
        ] = (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) =>
            (_sqlite3_create_window_function = Module[
                "_sqlite3_create_window_function"
            ] =
                wasmExports["sqlite3_create_window_function"])(
                a0,
                a1,
                a2,
                a3,
                a4,
                a5,
                a6,
                a7,
                a8,
                a9
            ));
        var _sqlite3_overload_function = (Module["_sqlite3_overload_function"] =
            (a0, a1, a2) =>
                (_sqlite3_overload_function = Module[
                    "_sqlite3_overload_function"
                ] =
                    wasmExports["sqlite3_overload_function"])(a0, a1, a2));
        var _sqlite3_trace_v2 = (Module["_sqlite3_trace_v2"] = (
            a0,
            a1,
            a2,
            a3
        ) =>
            (_sqlite3_trace_v2 = Module["_sqlite3_trace_v2"] =
                wasmExports["sqlite3_trace_v2"])(a0, a1, a2, a3));
        var _sqlite3_commit_hook = (Module["_sqlite3_commit_hook"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_commit_hook = Module["_sqlite3_commit_hook"] =
                wasmExports["sqlite3_commit_hook"])(a0, a1, a2));
        var _sqlite3_update_hook = (Module["_sqlite3_update_hook"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_update_hook = Module["_sqlite3_update_hook"] =
                wasmExports["sqlite3_update_hook"])(a0, a1, a2));
        var _sqlite3_rollback_hook = (Module["_sqlite3_rollback_hook"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_rollback_hook = Module["_sqlite3_rollback_hook"] =
                wasmExports["sqlite3_rollback_hook"])(a0, a1, a2));
        var _sqlite3_preupdate_hook = (Module["_sqlite3_preupdate_hook"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_preupdate_hook = Module["_sqlite3_preupdate_hook"] =
                wasmExports["sqlite3_preupdate_hook"])(a0, a1, a2));
        var _sqlite3_error_offset = (Module["_sqlite3_error_offset"] = (a0) =>
            (_sqlite3_error_offset = Module["_sqlite3_error_offset"] =
                wasmExports["sqlite3_error_offset"])(a0));
        var _sqlite3_errcode = (Module["_sqlite3_errcode"] = (a0) =>
            (_sqlite3_errcode = Module["_sqlite3_errcode"] =
                wasmExports["sqlite3_errcode"])(a0));
        var _sqlite3_extended_errcode = (Module["_sqlite3_extended_errcode"] = (
            a0
        ) =>
            (_sqlite3_extended_errcode = Module["_sqlite3_extended_errcode"] =
                wasmExports["sqlite3_extended_errcode"])(a0));
        var _sqlite3_errstr = (Module["_sqlite3_errstr"] = (a0) =>
            (_sqlite3_errstr = Module["_sqlite3_errstr"] =
                wasmExports["sqlite3_errstr"])(a0));
        var _sqlite3_limit = (Module["_sqlite3_limit"] = (a0, a1, a2) =>
            (_sqlite3_limit = Module["_sqlite3_limit"] =
                wasmExports["sqlite3_limit"])(a0, a1, a2));
        var _sqlite3_open = (Module["_sqlite3_open"] = (a0, a1) =>
            (_sqlite3_open = Module["_sqlite3_open"] =
                wasmExports["sqlite3_open"])(a0, a1));
        var _sqlite3_open_v2 = (Module["_sqlite3_open_v2"] = (a0, a1, a2, a3) =>
            (_sqlite3_open_v2 = Module["_sqlite3_open_v2"] =
                wasmExports["sqlite3_open_v2"])(a0, a1, a2, a3));
        var _sqlite3_create_collation = (Module["_sqlite3_create_collation"] = (
            a0,
            a1,
            a2,
            a3,
            a4
        ) =>
            (_sqlite3_create_collation = Module["_sqlite3_create_collation"] =
                wasmExports["sqlite3_create_collation"])(a0, a1, a2, a3, a4));
        var _sqlite3_create_collation_v2 = (Module[
            "_sqlite3_create_collation_v2"
        ] = (a0, a1, a2, a3, a4, a5) =>
            (_sqlite3_create_collation_v2 = Module[
                "_sqlite3_create_collation_v2"
            ] =
                wasmExports["sqlite3_create_collation_v2"])(
                a0,
                a1,
                a2,
                a3,
                a4,
                a5
            ));
        var _sqlite3_collation_needed = (Module["_sqlite3_collation_needed"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3_collation_needed = Module["_sqlite3_collation_needed"] =
                wasmExports["sqlite3_collation_needed"])(a0, a1, a2));
        var _sqlite3_get_autocommit = (Module["_sqlite3_get_autocommit"] = (
            a0
        ) =>
            (_sqlite3_get_autocommit = Module["_sqlite3_get_autocommit"] =
                wasmExports["sqlite3_get_autocommit"])(a0));
        var _sqlite3_table_column_metadata = (Module[
            "_sqlite3_table_column_metadata"
        ] = (a0, a1, a2, a3, a4, a5, a6, a7, a8) =>
            (_sqlite3_table_column_metadata = Module[
                "_sqlite3_table_column_metadata"
            ] =
                wasmExports["sqlite3_table_column_metadata"])(
                a0,
                a1,
                a2,
                a3,
                a4,
                a5,
                a6,
                a7,
                a8
            ));
        var _sqlite3_extended_result_codes = (Module[
            "_sqlite3_extended_result_codes"
        ] = (a0, a1) =>
            (_sqlite3_extended_result_codes = Module[
                "_sqlite3_extended_result_codes"
            ] =
                wasmExports["sqlite3_extended_result_codes"])(a0, a1));
        var _sqlite3_uri_key = (Module["_sqlite3_uri_key"] = (a0, a1) =>
            (_sqlite3_uri_key = Module["_sqlite3_uri_key"] =
                wasmExports["sqlite3_uri_key"])(a0, a1));
        var _sqlite3_uri_int64 = (Module["_sqlite3_uri_int64"] = (a0, a1, a2) =>
            (_sqlite3_uri_int64 = Module["_sqlite3_uri_int64"] =
                wasmExports["sqlite3_uri_int64"])(a0, a1, a2));
        var _sqlite3_db_name = (Module["_sqlite3_db_name"] = (a0, a1) =>
            (_sqlite3_db_name = Module["_sqlite3_db_name"] =
                wasmExports["sqlite3_db_name"])(a0, a1));
        var _sqlite3_db_filename = (Module["_sqlite3_db_filename"] = (a0, a1) =>
            (_sqlite3_db_filename = Module["_sqlite3_db_filename"] =
                wasmExports["sqlite3_db_filename"])(a0, a1));
        var _sqlite3_db_readonly = (Module["_sqlite3_db_readonly"] = (a0, a1) =>
            (_sqlite3_db_readonly = Module["_sqlite3_db_readonly"] =
                wasmExports["sqlite3_db_readonly"])(a0, a1));
        var _sqlite3_compileoption_used = (Module[
            "_sqlite3_compileoption_used"
        ] = (a0) =>
            (_sqlite3_compileoption_used = Module[
                "_sqlite3_compileoption_used"
            ] =
                wasmExports["sqlite3_compileoption_used"])(a0));
        var _sqlite3_compileoption_get = (Module["_sqlite3_compileoption_get"] =
            (a0) =>
                (_sqlite3_compileoption_get = Module[
                    "_sqlite3_compileoption_get"
                ] =
                    wasmExports["sqlite3_compileoption_get"])(a0));
        var _sqlite3session_diff = (Module["_sqlite3session_diff"] = (
            a0,
            a1,
            a2,
            a3
        ) =>
            (_sqlite3session_diff = Module["_sqlite3session_diff"] =
                wasmExports["sqlite3session_diff"])(a0, a1, a2, a3));
        var _sqlite3session_attach = (Module["_sqlite3session_attach"] = (
            a0,
            a1
        ) =>
            (_sqlite3session_attach = Module["_sqlite3session_attach"] =
                wasmExports["sqlite3session_attach"])(a0, a1));
        var _sqlite3session_create = (Module["_sqlite3session_create"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3session_create = Module["_sqlite3session_create"] =
                wasmExports["sqlite3session_create"])(a0, a1, a2));
        var _sqlite3session_delete = (Module["_sqlite3session_delete"] = (a0) =>
            (_sqlite3session_delete = Module["_sqlite3session_delete"] =
                wasmExports["sqlite3session_delete"])(a0));
        var _sqlite3session_table_filter = (Module[
            "_sqlite3session_table_filter"
        ] = (a0, a1, a2) =>
            (_sqlite3session_table_filter = Module[
                "_sqlite3session_table_filter"
            ] =
                wasmExports["sqlite3session_table_filter"])(a0, a1, a2));
        var _sqlite3session_changeset = (Module["_sqlite3session_changeset"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3session_changeset = Module["_sqlite3session_changeset"] =
                wasmExports["sqlite3session_changeset"])(a0, a1, a2));
        var _sqlite3session_changeset_strm = (Module[
            "_sqlite3session_changeset_strm"
        ] = (a0, a1, a2) =>
            (_sqlite3session_changeset_strm = Module[
                "_sqlite3session_changeset_strm"
            ] =
                wasmExports["sqlite3session_changeset_strm"])(a0, a1, a2));
        var _sqlite3session_patchset_strm = (Module[
            "_sqlite3session_patchset_strm"
        ] = (a0, a1, a2) =>
            (_sqlite3session_patchset_strm = Module[
                "_sqlite3session_patchset_strm"
            ] =
                wasmExports["sqlite3session_patchset_strm"])(a0, a1, a2));
        var _sqlite3session_patchset = (Module["_sqlite3session_patchset"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3session_patchset = Module["_sqlite3session_patchset"] =
                wasmExports["sqlite3session_patchset"])(a0, a1, a2));
        var _sqlite3session_enable = (Module["_sqlite3session_enable"] = (
            a0,
            a1
        ) =>
            (_sqlite3session_enable = Module["_sqlite3session_enable"] =
                wasmExports["sqlite3session_enable"])(a0, a1));
        var _sqlite3session_indirect = (Module["_sqlite3session_indirect"] = (
            a0,
            a1
        ) =>
            (_sqlite3session_indirect = Module["_sqlite3session_indirect"] =
                wasmExports["sqlite3session_indirect"])(a0, a1));
        var _sqlite3session_isempty = (Module["_sqlite3session_isempty"] = (
            a0
        ) =>
            (_sqlite3session_isempty = Module["_sqlite3session_isempty"] =
                wasmExports["sqlite3session_isempty"])(a0));
        var _sqlite3session_memory_used = (Module[
            "_sqlite3session_memory_used"
        ] = (a0) =>
            (_sqlite3session_memory_used = Module[
                "_sqlite3session_memory_used"
            ] =
                wasmExports["sqlite3session_memory_used"])(a0));
        var _sqlite3session_object_config = (Module[
            "_sqlite3session_object_config"
        ] = (a0, a1, a2) =>
            (_sqlite3session_object_config = Module[
                "_sqlite3session_object_config"
            ] =
                wasmExports["sqlite3session_object_config"])(a0, a1, a2));
        var _sqlite3session_changeset_size = (Module[
            "_sqlite3session_changeset_size"
        ] = (a0) =>
            (_sqlite3session_changeset_size = Module[
                "_sqlite3session_changeset_size"
            ] =
                wasmExports["sqlite3session_changeset_size"])(a0));

        var _sqlite3changeset_start = (Module["_sqlite3changeset_start"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3changeset_start = Module["_sqlite3changeset_start"] =
                wasmExports["sqlite3changeset_start"])(a0, a1, a2));
        var _sqlite3changeset_start_v2 = (Module["_sqlite3changeset_start_v2"] =
            (a0, a1, a2, a3) =>
                (_sqlite3changeset_start_v2 = Module[
                    "_sqlite3changeset_start_v2"
                ] =
                    wasmExports["sqlite3changeset_start_v2"])(a0, a1, a2, a3));
        var _sqlite3changeset_start_strm = (Module[
            "_sqlite3changeset_start_strm"
        ] = (a0, a1, a2) =>
            (_sqlite3changeset_start_strm = Module[
                "_sqlite3changeset_start_strm"
            ] =
                wasmExports["sqlite3changeset_start_strm"])(a0, a1, a2));
        var _sqlite3changeset_start_v2_strm = (Module[
            "_sqlite3changeset_start_v2_strm"
        ] = (a0, a1, a2, a3) =>
            (_sqlite3changeset_start_v2_strm = Module[
                "_sqlite3changeset_start_v2_strm"
            ] =
                wasmExports["sqlite3changeset_start_v2_strm"])(a0, a1, a2, a3));
        var _sqlite3changeset_next = (Module["_sqlite3changeset_next"] = (a0) =>
            (_sqlite3changeset_next = Module["_sqlite3changeset_next"] =
                wasmExports["sqlite3changeset_next"])(a0));
        var _sqlite3changeset_op = (Module["_sqlite3changeset_op"] = (
            a0,
            a1,
            a2,
            a3,
            a4
        ) =>
            (_sqlite3changeset_op = Module["_sqlite3changeset_op"] =
                wasmExports["sqlite3changeset_op"])(a0, a1, a2, a3, a4));
        var _sqlite3changeset_pk = (Module["_sqlite3changeset_pk"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3changeset_pk = Module["_sqlite3changeset_pk"] =
                wasmExports["sqlite3changeset_pk"])(a0, a1, a2));
        var _sqlite3changeset_old = (Module["_sqlite3changeset_old"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3changeset_old = Module["_sqlite3changeset_old"] =
                wasmExports["sqlite3changeset_old"])(a0, a1, a2));
        var _sqlite3changeset_new = (Module["_sqlite3changeset_new"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3changeset_new = Module["_sqlite3changeset_new"] =
                wasmExports["sqlite3changeset_new"])(a0, a1, a2));
        var _sqlite3changeset_conflict = (Module["_sqlite3changeset_conflict"] =
            (a0, a1, a2) =>
                (_sqlite3changeset_conflict = Module[
                    "_sqlite3changeset_conflict"
                ] =
                    wasmExports["sqlite3changeset_conflict"])(a0, a1, a2));
        var _sqlite3changeset_fk_conflicts = (Module[
            "_sqlite3changeset_fk_conflicts"
        ] = (a0, a1) =>
            (_sqlite3changeset_fk_conflicts = Module[
                "_sqlite3changeset_fk_conflicts"
            ] =
                wasmExports["sqlite3changeset_fk_conflicts"])(a0, a1));
        var _sqlite3changeset_finalize = (Module["_sqlite3changeset_finalize"] =
            (a0) =>
                (_sqlite3changeset_finalize = Module[
                    "_sqlite3changeset_finalize"
                ] =
                    wasmExports["sqlite3changeset_finalize"])(a0));
        var _sqlite3changeset_invert = (Module["_sqlite3changeset_invert"] = (
            a0,
            a1,
            a2,
            a3
        ) =>
            (_sqlite3changeset_invert = Module["_sqlite3changeset_invert"] =
                wasmExports["sqlite3changeset_invert"])(a0, a1, a2, a3));
        var _sqlite3changeset_invert_strm = (Module[
            "_sqlite3changeset_invert_strm"
        ] = (a0, a1, a2, a3) =>
            (_sqlite3changeset_invert_strm = Module[
                "_sqlite3changeset_invert_strm"
            ] =
                wasmExports["sqlite3changeset_invert_strm"])(a0, a1, a2, a3));
        var _sqlite3changeset_apply_v2 = (Module["_sqlite3changeset_apply_v2"] =
            (a0, a1, a2, a3, a4, a5, a6, a7, a8) =>
                (_sqlite3changeset_apply_v2 = Module[
                    "_sqlite3changeset_apply_v2"
                ] =
                    wasmExports["sqlite3changeset_apply_v2"])(
                    a0,
                    a1,
                    a2,
                    a3,
                    a4,
                    a5,
                    a6,
                    a7,
                    a8
                ));
        var _sqlite3changeset_apply = (Module["_sqlite3changeset_apply"] = (
            a0,
            a1,
            a2,
            a3,
            a4,
            a5
        ) =>
            (_sqlite3changeset_apply = Module["_sqlite3changeset_apply"] =
                wasmExports["sqlite3changeset_apply"])(a0, a1, a2, a3, a4, a5));
        var _sqlite3changeset_apply_v2_strm = (Module[
            "_sqlite3changeset_apply_v2_strm"
        ] = (a0, a1, a2, a3, a4, a5, a6, a7, a8) =>
            (_sqlite3changeset_apply_v2_strm = Module[
                "_sqlite3changeset_apply_v2_strm"
            ] =
                wasmExports["sqlite3changeset_apply_v2_strm"])(
                a0,
                a1,
                a2,
                a3,
                a4,
                a5,
                a6,
                a7,
                a8
            ));
        var _sqlite3changeset_apply_strm = (Module[
            "_sqlite3changeset_apply_strm"
        ] = (a0, a1, a2, a3, a4, a5) =>
            (_sqlite3changeset_apply_strm = Module[
                "_sqlite3changeset_apply_strm"
            ] =
                wasmExports["sqlite3changeset_apply_strm"])(
                a0,
                a1,
                a2,
                a3,
                a4,
                a5
            ));
        var _sqlite3changegroup_new = (Module["_sqlite3changegroup_new"] = (
            a0
        ) =>
            (_sqlite3changegroup_new = Module["_sqlite3changegroup_new"] =
                wasmExports["sqlite3changegroup_new"])(a0));
        var _sqlite3changegroup_add = (Module["_sqlite3changegroup_add"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3changegroup_add = Module["_sqlite3changegroup_add"] =
                wasmExports["sqlite3changegroup_add"])(a0, a1, a2));
        var _sqlite3changegroup_output = (Module["_sqlite3changegroup_output"] =
            (a0, a1, a2) =>
                (_sqlite3changegroup_output = Module[
                    "_sqlite3changegroup_output"
                ] =
                    wasmExports["sqlite3changegroup_output"])(a0, a1, a2));
        var _sqlite3changegroup_add_strm = (Module[
            "_sqlite3changegroup_add_strm"
        ] = (a0, a1, a2) =>
            (_sqlite3changegroup_add_strm = Module[
                "_sqlite3changegroup_add_strm"
            ] =
                wasmExports["sqlite3changegroup_add_strm"])(a0, a1, a2));
        var _sqlite3changegroup_output_strm = (Module[
            "_sqlite3changegroup_output_strm"
        ] = (a0, a1, a2) =>
            (_sqlite3changegroup_output_strm = Module[
                "_sqlite3changegroup_output_strm"
            ] =
                wasmExports["sqlite3changegroup_output_strm"])(a0, a1, a2));
        var _sqlite3changegroup_delete = (Module["_sqlite3changegroup_delete"] =
            (a0) =>
                (_sqlite3changegroup_delete = Module[
                    "_sqlite3changegroup_delete"
                ] =
                    wasmExports["sqlite3changegroup_delete"])(a0));
        var _sqlite3changeset_concat = (Module["_sqlite3changeset_concat"] = (
            a0,
            a1,
            a2,
            a3,
            a4,
            a5
        ) =>
            (_sqlite3changeset_concat = Module["_sqlite3changeset_concat"] =
                wasmExports["sqlite3changeset_concat"])(
                a0,
                a1,
                a2,
                a3,
                a4,
                a5
            ));
        var _sqlite3changeset_concat_strm = (Module[
            "_sqlite3changeset_concat_strm"
        ] = (a0, a1, a2, a3, a4, a5) =>
            (_sqlite3changeset_concat_strm = Module[
                "_sqlite3changeset_concat_strm"
            ] =
                wasmExports["sqlite3changeset_concat_strm"])(
                a0,
                a1,
                a2,
                a3,
                a4,
                a5
            ));
        var _sqlite3session_config = (Module["_sqlite3session_config"] = (
            a0,
            a1
        ) =>
            (_sqlite3session_config = Module["_sqlite3session_config"] =
                wasmExports["sqlite3session_config"])(a0, a1));
        var _sqlite3_sourceid = (Module["_sqlite3_sourceid"] = () =>
            (_sqlite3_sourceid = Module["_sqlite3_sourceid"] =
                wasmExports["sqlite3_sourceid"])());
        var _sqlite3__wasm_pstack_ptr = (Module["_sqlite3__wasm_pstack_ptr"] =
            () =>
                (_sqlite3__wasm_pstack_ptr = Module[
                    "_sqlite3__wasm_pstack_ptr"
                ] =
                    wasmExports["sqlite3__wasm_pstack_ptr"])());
        var _sqlite3__wasm_pstack_restore = (Module[
            "_sqlite3__wasm_pstack_restore"
        ] = (a0) =>
            (_sqlite3__wasm_pstack_restore = Module[
                "_sqlite3__wasm_pstack_restore"
            ] =
                wasmExports["sqlite3__wasm_pstack_restore"])(a0));
        var _sqlite3__wasm_pstack_alloc = (Module[
            "_sqlite3__wasm_pstack_alloc"
        ] = (a0) =>
            (_sqlite3__wasm_pstack_alloc = Module[
                "_sqlite3__wasm_pstack_alloc"
            ] =
                wasmExports["sqlite3__wasm_pstack_alloc"])(a0));
        var _sqlite3__wasm_pstack_remaining = (Module[
            "_sqlite3__wasm_pstack_remaining"
        ] = () =>
            (_sqlite3__wasm_pstack_remaining = Module[
                "_sqlite3__wasm_pstack_remaining"
            ] =
                wasmExports["sqlite3__wasm_pstack_remaining"])());
        var _sqlite3__wasm_pstack_quota = (Module[
            "_sqlite3__wasm_pstack_quota"
        ] = () =>
            (_sqlite3__wasm_pstack_quota = Module[
                "_sqlite3__wasm_pstack_quota"
            ] =
                wasmExports["sqlite3__wasm_pstack_quota"])());
        var _sqlite3__wasm_db_error = (Module["_sqlite3__wasm_db_error"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3__wasm_db_error = Module["_sqlite3__wasm_db_error"] =
                wasmExports["sqlite3__wasm_db_error"])(a0, a1, a2));
        var _sqlite3__wasm_test_struct = (Module["_sqlite3__wasm_test_struct"] =
            (a0) =>
                (_sqlite3__wasm_test_struct = Module[
                    "_sqlite3__wasm_test_struct"
                ] =
                    wasmExports["sqlite3__wasm_test_struct"])(a0));
        var _sqlite3__wasm_enum_json = (Module["_sqlite3__wasm_enum_json"] =
            () =>
                (_sqlite3__wasm_enum_json = Module["_sqlite3__wasm_enum_json"] =
                    wasmExports["sqlite3__wasm_enum_json"])());
        var _sqlite3__wasm_vfs_unlink = (Module["_sqlite3__wasm_vfs_unlink"] = (
            a0,
            a1
        ) =>
            (_sqlite3__wasm_vfs_unlink = Module["_sqlite3__wasm_vfs_unlink"] =
                wasmExports["sqlite3__wasm_vfs_unlink"])(a0, a1));
        var _sqlite3__wasm_db_vfs = (Module["_sqlite3__wasm_db_vfs"] = (
            a0,
            a1
        ) =>
            (_sqlite3__wasm_db_vfs = Module["_sqlite3__wasm_db_vfs"] =
                wasmExports["sqlite3__wasm_db_vfs"])(a0, a1));
        var _sqlite3__wasm_db_reset = (Module["_sqlite3__wasm_db_reset"] = (
            a0
        ) =>
            (_sqlite3__wasm_db_reset = Module["_sqlite3__wasm_db_reset"] =
                wasmExports["sqlite3__wasm_db_reset"])(a0));
        var _sqlite3__wasm_db_export_chunked = (Module[
            "_sqlite3__wasm_db_export_chunked"
        ] = (a0, a1) =>
            (_sqlite3__wasm_db_export_chunked = Module[
                "_sqlite3__wasm_db_export_chunked"
            ] =
                wasmExports["sqlite3__wasm_db_export_chunked"])(a0, a1));
        var _sqlite3__wasm_db_serialize = (Module[
            "_sqlite3__wasm_db_serialize"
        ] = (a0, a1, a2, a3, a4) =>
            (_sqlite3__wasm_db_serialize = Module[
                "_sqlite3__wasm_db_serialize"
            ] =
                wasmExports["sqlite3__wasm_db_serialize"])(a0, a1, a2, a3, a4));
        var _sqlite3__wasm_vfs_create_file = (Module[
            "_sqlite3__wasm_vfs_create_file"
        ] = (a0, a1, a2, a3) =>
            (_sqlite3__wasm_vfs_create_file = Module[
                "_sqlite3__wasm_vfs_create_file"
            ] =
                wasmExports["sqlite3__wasm_vfs_create_file"])(a0, a1, a2, a3));
        var _sqlite3__wasm_posix_create_file = (Module[
            "_sqlite3__wasm_posix_create_file"
        ] = (a0, a1, a2) =>
            (_sqlite3__wasm_posix_create_file = Module[
                "_sqlite3__wasm_posix_create_file"
            ] =
                wasmExports["sqlite3__wasm_posix_create_file"])(a0, a1, a2));
        var _sqlite3__wasm_kvvfsMakeKeyOnPstack = (Module[
            "_sqlite3__wasm_kvvfsMakeKeyOnPstack"
        ] = (a0, a1) =>
            (_sqlite3__wasm_kvvfsMakeKeyOnPstack = Module[
                "_sqlite3__wasm_kvvfsMakeKeyOnPstack"
            ] =
                wasmExports["sqlite3__wasm_kvvfsMakeKeyOnPstack"])(a0, a1));
        var _sqlite3__wasm_kvvfs_methods = (Module[
            "_sqlite3__wasm_kvvfs_methods"
        ] = () =>
            (_sqlite3__wasm_kvvfs_methods = Module[
                "_sqlite3__wasm_kvvfs_methods"
            ] =
                wasmExports["sqlite3__wasm_kvvfs_methods"])());
        var _sqlite3__wasm_vtab_config = (Module["_sqlite3__wasm_vtab_config"] =
            (a0, a1, a2) =>
                (_sqlite3__wasm_vtab_config = Module[
                    "_sqlite3__wasm_vtab_config"
                ] =
                    wasmExports["sqlite3__wasm_vtab_config"])(a0, a1, a2));
        var _sqlite3__wasm_db_config_ip = (Module[
            "_sqlite3__wasm_db_config_ip"
        ] = (a0, a1, a2, a3) =>
            (_sqlite3__wasm_db_config_ip = Module[
                "_sqlite3__wasm_db_config_ip"
            ] =
                wasmExports["sqlite3__wasm_db_config_ip"])(a0, a1, a2, a3));
        var _sqlite3__wasm_db_config_pii = (Module[
            "_sqlite3__wasm_db_config_pii"
        ] = (a0, a1, a2, a3, a4) =>
            (_sqlite3__wasm_db_config_pii = Module[
                "_sqlite3__wasm_db_config_pii"
            ] =
                wasmExports["sqlite3__wasm_db_config_pii"])(
                a0,
                a1,
                a2,
                a3,
                a4
            ));
        var _sqlite3__wasm_db_config_s = (Module["_sqlite3__wasm_db_config_s"] =
            (a0, a1, a2) =>
                (_sqlite3__wasm_db_config_s = Module[
                    "_sqlite3__wasm_db_config_s"
                ] =
                    wasmExports["sqlite3__wasm_db_config_s"])(a0, a1, a2));
        var _sqlite3__wasm_config_i = (Module["_sqlite3__wasm_config_i"] = (
            a0,
            a1
        ) =>
            (_sqlite3__wasm_config_i = Module["_sqlite3__wasm_config_i"] =
                wasmExports["sqlite3__wasm_config_i"])(a0, a1));
        var _sqlite3__wasm_config_ii = (Module["_sqlite3__wasm_config_ii"] = (
            a0,
            a1,
            a2
        ) =>
            (_sqlite3__wasm_config_ii = Module["_sqlite3__wasm_config_ii"] =
                wasmExports["sqlite3__wasm_config_ii"])(a0, a1, a2));
        var _sqlite3__wasm_config_j = (Module["_sqlite3__wasm_config_j"] = (
            a0,
            a1
        ) =>
            (_sqlite3__wasm_config_j = Module["_sqlite3__wasm_config_j"] =
                wasmExports["sqlite3__wasm_config_j"])(a0, a1));
        var _sqlite3__wasm_qfmt_token = (Module["_sqlite3__wasm_qfmt_token"] = (
            a0,
            a1
        ) =>
            (_sqlite3__wasm_qfmt_token = Module["_sqlite3__wasm_qfmt_token"] =
                wasmExports["sqlite3__wasm_qfmt_token"])(a0, a1));
        var _sqlite3__wasm_init_wasmfs = (Module["_sqlite3__wasm_init_wasmfs"] =
            (a0) =>
                (_sqlite3__wasm_init_wasmfs = Module[
                    "_sqlite3__wasm_init_wasmfs"
                ] =
                    wasmExports["sqlite3__wasm_init_wasmfs"])(a0));
        var _sqlite3__wasm_test_intptr = (Module["_sqlite3__wasm_test_intptr"] =
            (a0) =>
                (_sqlite3__wasm_test_intptr = Module[
                    "_sqlite3__wasm_test_intptr"
                ] =
                    wasmExports["sqlite3__wasm_test_intptr"])(a0));
        var _sqlite3__wasm_test_voidptr = (Module[
            "_sqlite3__wasm_test_voidptr"
        ] = (a0) =>
            (_sqlite3__wasm_test_voidptr = Module[
                "_sqlite3__wasm_test_voidptr"
            ] =
                wasmExports["sqlite3__wasm_test_voidptr"])(a0));
        var _sqlite3__wasm_test_int64_max = (Module[
            "_sqlite3__wasm_test_int64_max"
        ] = () =>
            (_sqlite3__wasm_test_int64_max = Module[
                "_sqlite3__wasm_test_int64_max"
            ] =
                wasmExports["sqlite3__wasm_test_int64_max"])());
        var _sqlite3__wasm_test_int64_min = (Module[
            "_sqlite3__wasm_test_int64_min"
        ] = () =>
            (_sqlite3__wasm_test_int64_min = Module[
                "_sqlite3__wasm_test_int64_min"
            ] =
                wasmExports["sqlite3__wasm_test_int64_min"])());
        var _sqlite3__wasm_test_int64_times2 = (Module[
            "_sqlite3__wasm_test_int64_times2"
        ] = (a0) =>
            (_sqlite3__wasm_test_int64_times2 = Module[
                "_sqlite3__wasm_test_int64_times2"
            ] =
                wasmExports["sqlite3__wasm_test_int64_times2"])(a0));
        var _sqlite3__wasm_test_int64_minmax = (Module[
            "_sqlite3__wasm_test_int64_minmax"
        ] = (a0, a1) =>
            (_sqlite3__wasm_test_int64_minmax = Module[
                "_sqlite3__wasm_test_int64_minmax"
            ] =
                wasmExports["sqlite3__wasm_test_int64_minmax"])(a0, a1));
        var _sqlite3__wasm_test_int64ptr = (Module[
            "_sqlite3__wasm_test_int64ptr"
        ] = (a0) =>
            (_sqlite3__wasm_test_int64ptr = Module[
                "_sqlite3__wasm_test_int64ptr"
            ] =
                wasmExports["sqlite3__wasm_test_int64ptr"])(a0));
        var _sqlite3__wasm_test_stack_overflow = (Module[
            "_sqlite3__wasm_test_stack_overflow"
        ] = (a0) =>
            (_sqlite3__wasm_test_stack_overflow = Module[
                "_sqlite3__wasm_test_stack_overflow"
            ] =
                wasmExports["sqlite3__wasm_test_stack_overflow"])(a0));
        var _sqlite3__wasm_test_str_hello = (Module[
            "_sqlite3__wasm_test_str_hello"
        ] = (a0) =>
            (_sqlite3__wasm_test_str_hello = Module[
                "_sqlite3__wasm_test_str_hello"
            ] =
                wasmExports["sqlite3__wasm_test_str_hello"])(a0));
        var _sqlite3__wasm_SQLTester_strglob = (Module[
            "_sqlite3__wasm_SQLTester_strglob"
        ] = (a0, a1) =>
            (_sqlite3__wasm_SQLTester_strglob = Module[
                "_sqlite3__wasm_SQLTester_strglob"
            ] =
                wasmExports["sqlite3__wasm_SQLTester_strglob"])(a0, a1));
        var _malloc = (Module["_malloc"] = (a0) =>
            (_malloc = Module["_malloc"] = wasmExports["malloc"])(a0));
        var _free = (Module["_free"] = (a0) =>
            (_free = Module["_free"] = wasmExports["free"])(a0));
        var _realloc = (Module["_realloc"] = (a0, a1) =>
            (_realloc = Module["_realloc"] = wasmExports["realloc"])(a0, a1));
        var _emscripten_builtin_memalign = (a0, a1) =>
            (_emscripten_builtin_memalign =
                wasmExports["emscripten_builtin_memalign"])(a0, a1);
        var __emscripten_stack_restore = (a0) =>
            (__emscripten_stack_restore =
                wasmExports["_emscripten_stack_restore"])(a0);
        var __emscripten_stack_alloc = (a0) =>
            (__emscripten_stack_alloc = wasmExports["_emscripten_stack_alloc"])(
                a0
            );
        var _emscripten_stack_get_current = () =>
            (_emscripten_stack_get_current =
                wasmExports["emscripten_stack_get_current"])();

        Module["wasmMemory"] = wasmMemory;

        var calledRun;
        var calledPrerun;

        dependenciesFulfilled = function runCaller() {
            if (!calledRun) run();
            if (!calledRun) dependenciesFulfilled = runCaller;
        };

        function run() {
            if (runDependencies > 0) {
                return;
            }

            if (!calledPrerun) {
                calledPrerun = 1;
                preRun();

                if (runDependencies > 0) {
                    return;
                }
            }

            function doRun() {
                if (calledRun) return;
                calledRun = 1;
                Module["calledRun"] = 1;

                if (ABORT) return;

                initRuntime();

                readyPromiseResolve(Module);
                Module["onRuntimeInitialized"]?.();

                postRun();
            }

            if (Module["setStatus"]) {
                Module["setStatus"]("Running...");
                setTimeout(() => {
                    setTimeout(() => Module["setStatus"](""), 1);
                    doRun();
                }, 1);
            } else {
                doRun();
            }
        }

        if (Module["preInit"]) {
            if (typeof Module["preInit"] == "function")
                Module["preInit"] = [Module["preInit"]];
            while (Module["preInit"].length > 0) {
                Module["preInit"].pop()();
            }
        }

        run();

        Module.runSQLite3PostLoadInit = runSQLite3PostLoadInit;

        moduleRtn = readyPromise;

        return moduleRtn;
    };
})();

const toExportForESM = (function () {
    const originalInit = sqlite3InitModule;
    if (!originalInit) {
        throw new Error(
            "Expecting globalThis.sqlite3InitModule to be defined by the Emscripten build."
        );
    }

    const initModuleState = (globalThis.sqlite3InitModuleState = Object.assign(
        Object.create(null),
        {
            moduleScript: globalThis?.document?.currentScript,
            isWorker: "undefined" !== typeof WorkerGlobalScope,
            location: globalThis.location,
            urlParams: globalThis?.location?.href
                ? new URL(globalThis.location.href).searchParams
                : new URLSearchParams(),
        }
    ));
    initModuleState.debugModule = initModuleState.urlParams.has(
        "sqlite3.debugModule"
    )
        ? (...args) => console.warn("sqlite3.debugModule:", ...args)
        : () => {};

    if (initModuleState.urlParams.has("sqlite3.dir")) {
        initModuleState.sqlite3Dir =
            initModuleState.urlParams.get("sqlite3.dir") + "/";
    } else if (initModuleState.moduleScript) {
        const li = initModuleState.moduleScript.src.split("/");
        li.pop();
        initModuleState.sqlite3Dir = li.join("/") + "/";
    }

    globalThis.sqlite3InitModule = function ff(...args) {
        return originalInit(...args)
            .then((EmscriptenModule) => {
                EmscriptenModule.runSQLite3PostLoadInit(EmscriptenModule);
                const s = EmscriptenModule.sqlite3;
                s.scriptInfo = initModuleState;

                if (ff.__isUnderTest) s.__isUnderTest = true;
                const f = s.asyncPostInit;
                delete s.asyncPostInit;
                const rv = f();
                return rv;
            })
            .catch((e) => {
                console.error("Exception loading sqlite3 module:", e);
                throw e;
            });
    };
    globalThis.sqlite3InitModule.ready = originalInit.ready;

    if (globalThis.sqlite3InitModuleState.moduleScript) {
        const sim = globalThis.sqlite3InitModuleState;
        let src = sim.moduleScript.src.split("/");
        src.pop();
        sim.scriptDir = src.join("/") + "/";
    }
    initModuleState.debugModule("sqlite3InitModuleState =", initModuleState);
    return globalThis.sqlite3InitModule;
})();
sqlite3InitModule = toExportForESM;
export default sqlite3InitModule;
