/**
 * @fileoverview Heap-related helper installers for the wh-wasm utils.
 */

/**
 * Installs the legacy `sizeofIR` helper on the target.
 *
 * @param {import("./installer-context.mjs").WhWasmInstallerContext} context
 */
export function attachSizeHelpers(context) {
    const { target, ptrSizeof } = context;

    /**
     * Resolves the byte width for a given intermediate representation signature.
     *
     * @param {string} identifier
     * @returns {number | undefined}
     */
    target.sizeofIR = (identifier) => {
        switch (identifier) {
            case "i8":
                return 1;
            case "i16":
                return 2;
            case "i32":
            case "f32":
            case "float":
                return 4;
            case "i64":
            case "f64":
            case "double":
                return 8;
            case "*":
                return ptrSizeof;
            default:
                return ("" + identifier).endsWith("*") ? ptrSizeof : undefined;
        }
    };
}

/**
 * Adds memoised accessors for the WebAssembly heap buffers.
 *
 * @param {import("./installer-context.mjs").WhWasmInstallerContext} context
 */
export function attachHeapAccessors(context) {
    const { target } = context;
    const getHeap = () => context.getHeapViews();

    /**
     * Returns a signed 8-bit view of the wasm heap.
     *
     * @returns {Int8Array}
     */
    target.heap8 = () => getHeap().HEAP8;
    /**
     * Returns an unsigned 8-bit view of the wasm heap.
     *
     * @returns {Uint8Array}
     */
    target.heap8u = () => getHeap().HEAP8U;
    /**
     * Returns a signed 16-bit view of the wasm heap.
     *
     * @returns {Int16Array}
     */
    target.heap16 = () => getHeap().HEAP16;
    /**
     * Returns an unsigned 16-bit view of the wasm heap.
     *
     * @returns {Uint16Array}
     */
    target.heap16u = () => getHeap().HEAP16U;
    /**
     * Returns a signed 32-bit view of the wasm heap.
     *
     * @returns {Int32Array}
     */
    target.heap32 = () => getHeap().HEAP32;
    /**
     * Returns an unsigned 32-bit view of the wasm heap.
     *
     * @returns {Uint32Array}
     */
    target.heap32u = () => getHeap().HEAP32U;

    /**
     * Resolves a heap view based on a constructor or byte width indicator.
     *
     * @param {number | ArrayBufferView | typeof Int8Array | typeof Uint8Array | typeof Int16Array | typeof Uint16Array | typeof Int32Array | typeof Uint32Array | typeof Float32Array | typeof Float64Array | typeof BigInt64Array | typeof BigUint64Array} sizeIndicator
     * @param {boolean} [unsigned=true]
     * @returns {ArrayBufferView}
     */
    target.heapForSize = (sizeIndicator, unsigned = true) => {
        const heap = getHeap();
        switch (sizeIndicator) {
            case Int8Array:
                return heap.HEAP8;
            case Uint8Array:
                return heap.HEAP8U;
            case Int16Array:
                return heap.HEAP16;
            case Uint16Array:
                return heap.HEAP16U;
            case Int32Array:
                return heap.HEAP32;
            case Uint32Array:
                return heap.HEAP32U;
            case 8:
                return unsigned ? heap.HEAP8U : heap.HEAP8;
            case 16:
                return unsigned ? heap.HEAP16U : heap.HEAP16;
            case 32:
                return unsigned ? heap.HEAP32U : heap.HEAP32;
            case 64:
                if (heap.HEAP64) {
                    return unsigned ? heap.HEAP64U : heap.HEAP64;
                }
                break;
            default:
                if (
                    context.target.bigIntEnabled &&
                    (sizeIndicator === globalThis.BigUint64Array ||
                        sizeIndicator === globalThis.BigInt64Array)
                ) {
                    return sizeIndicator === globalThis.BigUint64Array
                        ? heap.HEAP64U
                        : heap.HEAP64;
                }
        }
        context.toss(
            "Invalid heapForSize() size: expecting 8, 16, 32, or 64 (BigInt)."
        );
    };
}
