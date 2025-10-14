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
import { runSQLite3PostLoadInit } from "./wasm/sqlite3Apibootstrap.mjs";
import { PATH } from "./utils/path.mjs";
import {
    UTF8ArrayToString,
    lengthBytesUTF8,
    stringToUTF8Array,
} from "./utils/utf8.mjs";
import { createTTY } from "./system/tty-operations.mjs";
import { createMEMFS } from "./vfs/memfs.mjs";
import { createSYSCALLS } from "./system/syscalls.mjs";
import { createWASIFunctions } from "./system/wasi-functions.mjs";
import { createFS as createFileSystem } from "./vfs/filesystem.mjs";
import {
    randomFill as randomFillUtil,
    zeroMemory,
    alignMemory,
    createMmapAlloc,
} from "./utils/memory-utils.mjs";
import { createAsyncLoad } from "./utils/async-utils.mjs";
import { wrapSqlite3InitModule } from "./utils/sqlite3-init-wrapper.mjs";
import { createWasmLoader } from "./utils/wasm-loader.mjs";
import { attachSqlite3WasmExports } from "./wasm/sqlite3-wasm-exports.mjs";

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
            if (path === 'sqlite3.wasm') {
                return new URL('./wasm/sqlite3.wasm', import.meta.url).href;
            }
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

        var callRuntimeCallbacks = (callbacks) => {
            callbacks.forEach((f) => f(Module));
        };

        var randomFill = randomFillUtil;

        var mmapAlloc;

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
        const { createWasm } = createWasmLoader({
            Module,
            wasmBinary,
            locateFile,
            readAsync,
            readBinary,
            addRunDependency,
            removeRunDependency,
            readyPromiseReject,
            addOnInit,
            abort,
            err,
            getWasmImports: () => ({
                env: wasmImports,
                wasi_snapshot_preview1: wasmImports,
            }),
            setWasmExports: (exportsValue) => {
                wasmExports = exportsValue;
            },
        });
        wasmExports = createWasm();
        const { emscriptenBuiltinMemalign } = attachSqlite3WasmExports(
            Module,
            wasmExports
        );

        mmapAlloc = createMmapAlloc(emscriptenBuiltinMemalign, HEAPU8);

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
