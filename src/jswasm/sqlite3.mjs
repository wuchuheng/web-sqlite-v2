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
import { PATH } from "./utils/path/path.js";
import {
    UTF8ArrayToString,
    lengthBytesUTF8,
    stringToUTF8Array,
} from "./utils/utf8/utf8";
import { createTTY } from "./system/tty-operations.mjs";
import { createMEMFS } from "./vfs/memfs.mjs";
import { createSYSCALLS } from "./system/syscalls.mjs";
import { createWASIFunctions } from "./system/wasi-functions.mjs";
import { createFS as createFileSystem } from "./vfs/filesystem.mjs";
import {
    randomFill as randomFillUtil,
    zeroMemory,
    createMmapAlloc,
} from "./utils/memory-utils/memory-utils.js";
import { createAsyncLoad } from "./utils/async-utils/async-utils.js";
import { wrapSqlite3InitModule } from "./utils/sqlite3-init-wrapper/sqlite3-init-wrapper.js";
import { createWasmLoader } from "./utils/wasm-loader/wasm-loader.js";
import { attachSqlite3WasmExports } from "./wasm/sqlite3-wasm-exports.mjs";
import {
    detectEnvironment,
    createFileReaders,
} from "./runtime/environment-detector.mjs";
import {
    initializeWasmMemory,
    createMemoryManager,
} from "./runtime/memory-manager.mjs";
import { createLifecycleManager } from "./runtime/lifecycle-manager.mjs";
import {
    setupModuleLocateFile,
    createModuleLocateFile,
    setupConsoleOutput,
    createAbortFunction,
    initializeModule,
    applyModuleOverrides,
    runPreInitCallbacks,
} from "./runtime/module-configurator.mjs";

export let Module;

export let wasmExports;

/**
 * Main SQLite3 WebAssembly module initialization function.
 * This is the entry point for creating a new SQLite3 instance.
 *
 * @returns {import("@wuchuheng/web-sqlite").SQLite3InitModule} Module initialization function
 */
let sqlite3InitModule = (() => {
    const _scriptName = import.meta.url;

    /**
     * Initializes the SQLite3 WebAssembly module with the given configuration.
     *
     * @param {import("@wuchuheng/web-sqlite").SQLite3ModuleConfig} [moduleArg={}] - Module configuration options
     * @returns {Promise<import("@wuchuheng/web-sqlite").SQLite3API>} Promise that resolves to the initialized module
     */
    return function (moduleArg = {}) {
        // 1. Initialize module and promise
        Module = moduleArg;
        let readyPromiseResolve, readyPromiseReject;
        const readyPromise = new Promise((resolve, reject) => {
            readyPromiseResolve = resolve;
            readyPromiseReject = reject;
        });

        // 2. Detect environment and setup file readers
        const {
            ENVIRONMENT_IS_WEB: _ENVIRONMENT_IS_WEB,
            ENVIRONMENT_IS_WORKER,
            scriptDirectory,
        } = detectEnvironment();
        const { readAsync, readBinary } = createFileReaders(
            ENVIRONMENT_IS_WORKER,
        );

        // 3. Setup module configuration
        setupModuleLocateFile(Module, _scriptName);
        const moduleOverrides = initializeModule(Module, moduleArg);
        const locateFile = createModuleLocateFile(Module, scriptDirectory);
        const { out, err } = setupConsoleOutput(Module);
        const abort = createAbortFunction(Module, err, readyPromiseReject);

        // 4. Apply module overrides
        applyModuleOverrides(Module, moduleOverrides);

        // 5. Initialize WebAssembly memory
        const wasmBinary = Module["wasmBinary"];
        const wasmMemory = initializeWasmMemory(Module);
        const memoryManager = createMemoryManager(wasmMemory, Module);
        const { HEAP8, HEAPU8, HEAP16, HEAP32, HEAPU32, HEAP64 } =
            memoryManager;
        const _emscripten_resize_heap =
            memoryManager.createResizeHeapFunction();

        // 6. Setup utilities
        const randomFill = randomFillUtil;
        let mmapAlloc;

        // 7. Create file system helper functions
        const FS_createDataFile = (
            parent,
            name,
            fileData,
            canRead,
            canWrite,
            canOwn,
        ) => {
            FS.createDataFile(
                parent,
                name,
                fileData,
                canRead,
                canWrite,
                canOwn,
            );
        };

        const preloadPlugins = Module["preloadPlugins"] || [];
        const FS_handledByPreloadPlugin = (
            byteArray,
            fullname,
            finish,
            onerror,
        ) => {
            if (typeof globalThis.Browser !== "undefined") {
                globalThis.Browser.init();
            }

            let handled = false;
            preloadPlugins.forEach((plugin) => {
                if (handled) return;
                if (plugin["canHandle"](fullname)) {
                    plugin["handle"](byteArray, fullname, finish, onerror);
                    handled = true;
                }
            });
            return handled;
        };

        // 8. Create lifecycle manager
        let FS, PATH_FS, TTY;
        const lifecycleManager = createLifecycleManager(
            Module,
            {
                get initialized() {
                    return FS?.initialized;
                },
                init: () => FS?.init(),
            },
            { init: () => TTY?.init() },
        );

        const {
            addOnPreRun: _addOnPreRun,
            addOnInit,
            addOnPostRun: _addOnPostRun,
            addRunDependency,
            removeRunDependency,
            getUniqueRunDependency,
            run,
        } = lifecycleManager;

        lifecycleManager.setDependenciesFulfilled(function runCaller() {
            if (!Module.calledRun) run();
            if (!Module.calledRun)
                lifecycleManager.setDependenciesFulfilled(runCaller);
        });

        // 9. Create async load utility
        const asyncLoad = createAsyncLoad(
            readAsync,
            getUniqueRunDependency,
            addRunDependency,
            removeRunDependency,
        );

        const FS_createPreloadedFile = (
            parent,
            name,
            url,
            canRead,
            canWrite,
            onload,
            onerror,
            dontCreateFile,
            canOwn,
            preFinish,
        ) => {
            const fullname = name
                ? PATH_FS.resolve(PATH.join2(parent, name))
                : parent;
            const dep = getUniqueRunDependency(`cp ${fullname}`);

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
                            canOwn,
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
                        },
                    )
                ) {
                    return;
                }
                finish(byteArray);
            }

            addRunDependency(dep);
            if (typeof url === "string") {
                asyncLoad(url, processData, onerror);
            } else {
                processData(url);
            }
        };

        const FS_modeStringToFlags = (str) => {
            const flagModes = {
                r: 0,
                "r+": 2,
                w: 512 | 64 | 1,
                "w+": 512 | 64 | 2,
                a: 1024 | 64 | 1,
                "a+": 1024 | 64 | 2,
            };
            const flags = flagModes[str];
            if (typeof flags === "undefined") {
                throw new Error(`Unknown file open mode: ${str}`);
            }
            return flags;
        };

        const FS_getMode = (canRead, canWrite) => {
            let mode = 0;
            if (canRead) mode |= 292 | 73;
            if (canWrite) mode |= 146;
            return mode;
        };

        // 10. Create file system
        const fsModule = createFileSystem({
            FS_createPreloadedFile,
            FS_createDataFile,
            FS_modeStringToFlags,
            FS_getMode,
            Module,
            out,
            err,
        });

        FS = fsModule.FS;
        PATH_FS = fsModule.PATH_FS;

        // 11. Create system calls
        const syscallsModule = createSYSCALLS(
            FS,
            PATH,
            HEAPU8,
            HEAP8,
            HEAP16,
            HEAP32,
            HEAPU32,
            HEAP64,
            UTF8ArrayToString,
            lengthBytesUTF8,
            stringToUTF8Array,
        );
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

        // 12. Create WASI functions
        const wasiFunctions = createWASIFunctions(
            FS,
            SYSCALLS,
            HEAP8,
            HEAP16,
            HEAP32,
            HEAPU8,
            HEAPU32,
            HEAP64,
            stringToUTF8Array,
        );

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

        // 13. Attach preloaded file function
        FS.createPreloadedFile = FS_createPreloadedFile;

        // 14. Create MEMFS and TTY
        const MEMFS = createMEMFS(FS, HEAP8, mmapAlloc, (address, size) =>
            zeroMemory(HEAPU8, address, size),
        );
        TTY = createTTY(out, err, FS);

        // 15. Initialize file system
        FS.staticInit(MEMFS);
        FS.createDefaultDevices(TTY, randomFill);

        // 16. Create WASM imports
        const wasmImports = {
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

        // 17. Load WebAssembly module
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

        // 18. Attach SQLite3 exports and setup mmap
        const { emscriptenBuiltinMemalign } = attachSqlite3WasmExports(
            Module,
            wasmExports,
        );
        mmapAlloc = createMmapAlloc(emscriptenBuiltinMemalign, HEAPU8);
        Module["wasmMemory"] = wasmMemory;

        // 19. Store promise resolvers for lifecycle manager
        Module.readyPromiseResolve = readyPromiseResolve;
        Module.readyPromiseReject = readyPromiseReject;

        // 20. Execute preInit callbacks and start runtime
        runPreInitCallbacks(Module);
        run();

        // 21. Attach post-load init function
        Module.runSQLite3PostLoadInit = runSQLite3PostLoadInit;

        // 22. Return ready promise
        return readyPromise;
    };
})();

sqlite3InitModule = wrapSqlite3InitModule(sqlite3InitModule);
export default sqlite3InitModule;
