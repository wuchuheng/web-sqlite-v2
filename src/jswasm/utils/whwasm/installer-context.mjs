/**
 * @fileoverview Shared context object used while installing the wh-wasm helpers.
 * Encapsulates the mutable target object plus caches and utility methods that
 * other helper modules rely on.
 */

/**
 * Shared context that keeps track of the target, caches, and pointer metadata.
 */
export class WhWasmInstallerContext {
    /**
     * @param {import("./installer-context.d.ts").WhWasmHelperTarget} target - The mutable WASM helper target.
     */
    constructor(target) {
        /**
         * Mutable object that exposes the public API for the WASM helpers.
         * @type {import("./installer-context.d.ts").WhWasmHelperTarget}
         */
        this.target = target;

        /**
         * Bookkeeping cache reused across helper modules.
         * @type {import("./installer-context.d.ts").WhWasmInstallerCache}
         */
        this.cache = {
            heapSize: 0,
            memory: null,
            freeFuncIndexes: [],
            scopedAlloc: [],
            utf8Decoder: new TextDecoder(),
            utf8Encoder: new TextEncoder("utf-8"),
            xWrap: Object.assign(Object.create(null), {
                convert: Object.assign(Object.create(null), {
                    arg: new Map(),
                    result: new Map(),
                }),
            }),
        };

        /**
         * Pointer intermediate representation used by the target.
         * @type {"i32"|"i64"}
         */
        this.ptrIR = target.pointerIR || "i32";
        if (!["i32", "i64"].includes(this.ptrIR)) {
            this.toss("Unhandled ptrSizeof:", this.ptrIR);
        }

        /**
         * Pointer size (in bytes) derived from {@link ptrIR}.
         * @type {4|8}
         */
        this.ptrSizeof = this.ptrIR === "i32" ? 4 : 8;

        /**
         * Internal function used by the function-table helpers.
         * @type {((fn: (...args: import("./installer-context.d.ts").WhWasmValue[]) => import("./installer-context.d.ts").WhWasmValue, sig: string, scoped: boolean) => number) | null}
         */
        this.installFunctionInternal = null;

        /**
         * Shared CString allocator helper defined by the string helpers.
         * @type {(
         *   (
         *       value: string,
         *       nulTerminate: boolean,
         *       stackAlloc: (size: number) => number,
         *       signature: string
         *   ) => number | [number, number] | null
         * ) | null}
         */
        this.allocCStringInternal = null;
    }

    /**
     * Throws a consistent Error with a joined message.
     * @param {...unknown} args - Message parts to join.
     * @throws {Error} Always throws.
     */
    toss(...args) {
        throw new Error(args.join(" "));
    }

    /**
     * Resolves the active {@link WebAssembly.Memory} instance for the target.
     *
     * @returns {WebAssembly.Memory} Memory used by the target helpers.
     */
    resolveMemory() {
        const { cache, target } = this;
        if (!cache.memory) {
            cache.memory =
                target.memory instanceof WebAssembly.Memory
                    ? target.memory
                    : target.exports.memory;
        }
        return cache.memory;
    }

    /**
     * Lazily constructs typed-array views over the underlying WASM heap.
     *
     * @returns {import("./installer-context.d.ts").WhWasmInstallerCache} Cache enriched with up-to-date typed arrays.
     */
    getHeapViews() {
        const { cache, target } = this;
        const memory = this.resolveMemory();
        if (
            cache.heapSize === memory.buffer.byteLength &&
            cache.HEAP8 &&
            cache.HEAP8U
        ) {
            return cache;
        }

        const buffer = memory.buffer;
        cache.HEAP8 = new Int8Array(buffer);
        cache.HEAP8U = new Uint8Array(buffer);
        cache.HEAP16 = new Int16Array(buffer);
        cache.HEAP16U = new Uint16Array(buffer);
        cache.HEAP32 = new Int32Array(buffer);
        cache.HEAP32U = new Uint32Array(buffer);
        cache.HEAP32F = new Float32Array(buffer);
        cache.HEAP64F = new Float64Array(buffer);
        if (target.bigIntEnabled) {
            cache.HEAP64 = new BigInt64Array(buffer);
            cache.HEAP64U = new BigUint64Array(buffer);
        } else {
            cache.HEAP64 = undefined;
            cache.HEAP64U = undefined;
        }
        cache.heapSize = buffer.byteLength;
        return cache;
    }
}
