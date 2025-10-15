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

    target.heap8 = () => getHeap().HEAP8;
    target.heap8u = () => getHeap().HEAP8U;
    target.heap16 = () => getHeap().HEAP16;
    target.heap16u = () => getHeap().HEAP16U;
    target.heap32 = () => getHeap().HEAP32;
    target.heap32u = () => getHeap().HEAP32U;

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
