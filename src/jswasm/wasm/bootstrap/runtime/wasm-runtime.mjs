/**
 * @typedef {import("./wasm-runtime.d.ts").CreateWasmRuntimeOptions} CreateWasmRuntimeOptions
 * @typedef {import("./wasm-runtime.d.ts").WasmRuntimeBinding} WasmRuntimeBinding
 * @typedef {import("./wasm-runtime.d.ts").WasmRuntimeExtensions} WasmRuntimeExtensions
 * @typedef {import("./wasm-runtime.d.ts").Sqlite3Facade} Sqlite3Facade
 */

/**
 * Builds the higher-level WASM helpers required by the bootstrapper. The
 * returned extensions mirror the behaviour of the upstream sqlite3 WASM glue
 * while giving us a cleaner seam for testing and dependency injection.
 *
 * @param {CreateWasmRuntimeOptions} options
 * @returns {WasmRuntimeBinding}
 */
export function createWasmRuntime(options) {
    const { config, wasm, WasmAllocError, toss3, util, capi } = options;
    const { allocExportName, deallocExportName, reallocExportName } = config;

    /**
     * Looks up a function export and throws if it is missing. This keeps the
     * subsequent extension logic tidy and produces actionable errors.
     *
     * @param {string} exportName
     * @returns {Function}
     */
    const requireExport = (exportName) => {
        const fn = wasm.exports[exportName];
        if (typeof fn !== "function") {
            toss3("Missing required WASM export:", exportName);
        }
        return fn;
    };

    const allocImpl =
        /** @type {(bytes: number) => import("./wasm-runtime.d.ts").WasmPointer} */ (
            requireExport(allocExportName)
        );
    const deallocImpl =
        /** @type {(ptr: import("./wasm-runtime.d.ts").WasmPointer) => void} */ (
            requireExport(deallocExportName)
        );
    const reallocImpl = /** @type {
        (ptr: import("./wasm-runtime.d.ts").WasmPointer, bytes: number) => import("./wasm-runtime.d.ts").WasmPointer
    } */ (requireExport(reallocExportName));

    /**
     * Ensures we bind the sqlite3 facade only once the object exists. The lazy
     * getter protects `pstack.call()` consumers from observing an incomplete
     * bootstrap.
     */
    let sqlite3Facade;
    const resolveSqlite3 = () => {
        if (!sqlite3Facade) {
            toss3("Attempted to use pstack.call() before sqlite3 was ready.");
        }
        return sqlite3Facade;
    };

    /**
     * Allocates `bytes` of wasm memory using the configured allocator.
     *
     * @param {number} bytes
     * @returns {import("./wasm-runtime.d.ts").WasmPointer}
     */
    const alloc = (bytes) =>
        allocImpl(bytes) ||
        WasmAllocError.toss("Failed to allocate", bytes, "bytes.");

    /**
     * Resizes an existing allocation or frees it when `bytes` is zero.
     *
     * @param {import("./wasm-runtime.d.ts").WasmPointer | null} ptr
     * @param {number} bytes
     * @returns {import("./wasm-runtime.d.ts").WasmPointer}
     */
    const realloc = (ptr, bytes) => {
        const result = reallocImpl(ptr, bytes);
        if (!bytes) {
            return 0;
        }
        if (!result) {
            WasmAllocError.toss("Failed to reallocate", bytes, "bytes.");
        }
        return result;
    };

    /**
     * Copies typed-array data into wasm memory, allocating a destination buffer.
     *
     * @param {ArrayBufferView | ArrayBuffer} source
     * @returns {import("./wasm-runtime.d.ts").WasmPointer}
     */
    const allocFromTypedArray = (source) => {
        let typedArray = source;
        if (typedArray instanceof ArrayBuffer) {
            typedArray = new Uint8Array(typedArray);
        }
        util.affirmBindableTypedArray(typedArray);
        const destination = alloc(typedArray.byteLength || 1);
        wasm.heapForSize(
            /** @type {ArrayBufferView} */ (typedArray).constructor,
        ).set(
            typedArray.byteLength
                ? /** @type {ArrayBufferView} */ (typedArray)
                : [0],
            destination,
        );
        return destination;
    };

    let compileOptionCache;
    const compileOptionPattern = /^([^=]+)=(.+)/;
    const compileOptionInteger = /^-?\d+$/;

    /**
     * Recreates the convenience wrapper from the upstream bundle that exposes
     * compile-time options. The function lazily walks the linked list provided
     * by the C API and caches the results for subsequent lookups.
     *
     * @type {WasmRuntimeExtensions["compileOptionUsed"]}
     */
    const compileOptionUsed = (optName) => {
        if (typeof optName === "string") {
            return !!capi.sqlite3_compileoption_used(optName);
        }
        if (Array.isArray(optName)) {
            const result = Object.create(null);
            optName.forEach((option) => {
                result[option] = !!capi.sqlite3_compileoption_used(option);
            });
            return result;
        }
        if (optName && typeof optName === "object") {
            const target = /** @type {Record<string, boolean>} */ (optName);
            Object.keys(target).forEach((key) => {
                target[key] = !!capi.sqlite3_compileoption_used(key);
            });
            return target;
        }
        if (arguments.length === 0) {
            if (compileOptionCache) {
                return compileOptionCache;
            }
            const result = Object.create(null);
            let index = 0;
            while (true) {
                const entry = capi.sqlite3_compileoption_get(index++);
                if (!entry) {
                    break;
                }
                const match = compileOptionPattern.exec(entry);
                if (match) {
                    const [, key, value] = match;
                    result[key] = compileOptionInteger.test(value)
                        ? Number(value)
                        : value;
                } else {
                    result[entry] = true;
                }
            }
            compileOptionCache = result;
            return result;
        }
        return false;
    };

    const pstackRestore = /** @type {(pointer: number) => void} */ (
        requireExport("sqlite3__wasm_pstack_restore")
    );
    const pstackAlloc = /** @type {(bytes: number) => number} */ (
        requireExport("sqlite3__wasm_pstack_alloc")
    );
    const pstackPointer = /** @type {() => number} */ (
        requireExport("sqlite3__wasm_pstack_ptr")
    );
    const pstackQuota = /** @type {() => number} */ (
        requireExport("sqlite3__wasm_pstack_quota")
    );
    const pstackRemaining = /** @type {() => number} */ (
        requireExport("sqlite3__wasm_pstack_remaining")
    );

    const pstack = Object.assign(Object.create(null), {
        restore: pstackRestore,
        /**
         * Allocates bytes from the temporary stack, accepting IR signatures.
         *
         * @param {number | string} byteCount
         * @returns {import("./wasm-runtime.d.ts").WasmPointer}
         */
        alloc(byteCount) {
            let size = byteCount;
            if (typeof size === "string") {
                size = wasm.sizeofIR(size);
                if (!size) {
                    WasmAllocError.toss(
                        "Invalid value for pstack.alloc(",
                        byteCount,
                        ")",
                    );
                }
            }
            const pointer = pstackAlloc(size);
            if (!pointer) {
                WasmAllocError.toss(
                    "Could not allocate",
                    size,
                    "bytes from the pstack.",
                );
            }
            return pointer;
        },
        /**
         * Allocates `chunkCount` contiguous chunks from the pstack.
         *
         * @param {number} chunkCount
         * @param {number | string} chunkSize
         * @returns {import("./wasm-runtime.d.ts").WasmPointer[]}
         */
        allocChunks(chunkCount, chunkSize) {
            let size = chunkSize;
            if (typeof size === "string") {
                size = wasm.sizeofIR(size);
                if (!size) {
                    WasmAllocError.toss(
                        "Invalid size value for allocChunks(",
                        chunkSize,
                        ")",
                    );
                }
            }
            const basePointer = pstackAlloc(chunkCount * size);
            if (!basePointer) {
                WasmAllocError.toss(
                    "Could not allocate",
                    chunkCount * size,
                    "bytes from the pstack.",
                );
            }
            const result = [];
            for (let index = 0; index < chunkCount; ++index) {
                result.push(basePointer + index * size);
            }
            return result;
        },
        /**
         * Allocates pointer slots using the pstack allocator.
         *
         * @param {number} [count=1]
         * @param {boolean} [safePtrSize=true]
         * @returns {import("./wasm-runtime.d.ts").WasmPointer | import("./wasm-runtime.d.ts").WasmPointer[]}
         */
        allocPtr(count = 1, safePtrSize = true) {
            const bytes = safePtrSize ? 8 : wasm.ptrSizeof;
            return count === 1
                ? pstackAlloc(bytes)
                : this.allocChunks(count, bytes);
        },
        /**
         * Executes a callback while automatically restoring the pstack.
         *
         * @template T
         * @param {(sqlite3: import("./sqlite3-facade-namespace.d.ts").Sqlite3Facade) => T} callback
         * @returns {T}
         */
        call(callback) {
            const stackPos = pstackPointer();
            try {
                return callback(resolveSqlite3());
            } finally {
                pstackRestore(stackPos);
            }
        },
    });

    Object.defineProperties(pstack, {
        pointer: {
            enumerable: true,
            get: pstackPointer,
        },
        quota: {
            enumerable: true,
            get: pstackQuota,
        },
        remaining: {
            enumerable: true,
            get: pstackRemaining,
        },
    });

    /**
     * @type {WasmRuntimeExtensions}
     */
    const extensions = {
        allocFromTypedArray,
        alloc,
        realloc,
        dealloc: deallocImpl,
        compileOptionUsed,
        pstack,
    };

    /**
     * @param {Sqlite3Facade} fac
     */
    const bindSqlite3 = (fac) => {
        sqlite3Facade = fac;
    };

    return { extensions, bindSqlite3 };
}
