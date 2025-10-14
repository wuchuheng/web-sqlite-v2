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
import { PATH } from "./utils/path.mjs";
import {
    UTF8ArrayToString,
    lengthBytesUTF8,
    stringToUTF8Array,
} from "./utils/utf8.mjs";
import { createTTY } from "./tty-operations.mjs";
import { createMEMFS } from "./memfs.mjs";
import { createSYSCALLS } from "./syscalls.mjs";
import { createWASIFunctions } from "./wasi-functions.mjs";
import { createFS as createFileSystem } from "./filesystem.mjs";
import {
    randomFill as randomFillUtil,
    zeroMemory,
    alignMemory,
    createMmapAlloc,
} from "./utils/memory-utils.mjs";
import { createAsyncLoad } from "./utils/async-utils.mjs";
import { wrapSqlite3InitModule } from "./utils/sqlite3-init-wrapper.mjs";

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

        var randomFill = randomFillUtil;

        var mmapAlloc = createMmapAlloc(_emscripten_builtin_memalign, HEAPU8);

        var asyncLoad = createAsyncLoad(
            readAsync,
            getUniqueRunDependency,
            addRunDependency,
            removeRunDependency
        );

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

        // Create FS using the modular createFS function
        const fsModule = createFileSystem({
            FS_createPreloadedFile,
            FS_createDataFile,
            FS_modeStringToFlags,
            FS_getMode,
            Module,
            out,
            err,
        });

        var FS = fsModule.FS;
        var PATH_FS = fsModule.PATH_FS;

        // Create SYSCALLS and syscall functions using the extracted module
        const syscallsModule = createSYSCALLS(FS, PATH, HEAPU8, HEAP8, HEAP16, HEAP32, HEAPU32, HEAP64, UTF8ArrayToString, lengthBytesUTF8, stringToUTF8Array);
        const SYSCALLS = syscallsModule.SYSCALLS;
        const ___syscall_chmod = syscallsModule.___syscall_chmod;
        const ___syscall_faccessat = syscallsModule.___syscall_faccessat;
        const ___syscall_fchmod = syscallsModule.___syscall_fchmod;
        const ___syscall_fchown32 = syscallsModule.___syscall_fchown32;
        const ___syscall_fcntl64 = syscallsModule.___syscall_fcntl64;
        const ___syscall_fstat64 = syscallsModule.___syscall_fstat64;
        const ___syscall_ftruncate64 = syscallsModule.___syscall_ftruncate64;
        const ___syscall_getcwd = syscallsModule.___syscall_getcwd;
        const ___syscall_ioctl = syscallsModule.___syscall_ioctl;
        const ___syscall_lstat64 = syscallsModule.___syscall_lstat64;
        const ___syscall_mkdirat = syscallsModule.___syscall_mkdirat;
        const ___syscall_newfstatat = syscallsModule.___syscall_newfstatat;
        const ___syscall_openat = syscallsModule.___syscall_openat;
        const ___syscall_readlinkat = syscallsModule.___syscall_readlinkat;
        const ___syscall_rmdir = syscallsModule.___syscall_rmdir;
        const ___syscall_stat64 = syscallsModule.___syscall_stat64;
        const ___syscall_unlinkat = syscallsModule.___syscall_unlinkat;
        const ___syscall_utimensat = syscallsModule.___syscall_utimensat;

        // Create WASI functions using the extracted module
        const wasiFunctions = createWASIFunctions(
            FS,
            SYSCALLS,
            HEAP8,
            HEAP16,
            HEAP32,
            HEAPU8,
            HEAPU32,
            HEAP64,
            stringToUTF8Array
        );

        // Destructure WASI functions for use in wasmImports
        const {
            __emscripten_get_now_is_monotonic,
            __localtime_js,
            __mmap_js,
            __munmap_js,
            __tzset_js,
            _emscripten_date_now,
            _emscripten_get_now,
            _environ_get,
            _environ_sizes_get,
            _fd_close,
            _fd_fdstat_get,
            _fd_read,
            _fd_seek,
            _fd_sync,
            _fd_write,
        } = wasiFunctions;

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


        FS.createPreloadedFile = FS_createPreloadedFile;

        // Create MEMFS after FS is fully defined
        var MEMFS = createMEMFS(FS, HEAP8, mmapAlloc, (address, size) => zeroMemory(HEAPU8, address, size));

        // Initialize TTY operations with FS reference
        var TTY = createTTY(out, err, FS);

        // Call staticInit with MEMFS - this will setup the filesystem
        FS.staticInit(MEMFS);

        // Create default devices with TTY and randomFill
        FS.createDefaultDevices(TTY, randomFill);

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

sqlite3InitModule = wrapSqlite3InitModule(sqlite3InitModule);
export default sqlite3InitModule;
