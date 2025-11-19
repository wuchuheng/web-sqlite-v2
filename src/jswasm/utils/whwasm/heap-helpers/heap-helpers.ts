import type {
  WhWasmHelperTarget,
  WhWasmInstallerContext,
} from "../installer-context/installer-context";

type HeapSelector =
  | number
  | typeof Int8Array
  | typeof Uint8Array
  | typeof Int16Array
  | typeof Uint16Array
  | typeof Int32Array
  | typeof Uint32Array
  | typeof Float32Array
  | typeof Float64Array
  | typeof BigInt64Array
  | typeof BigUint64Array;

type SizeHelperTarget = WhWasmHelperTarget & {
  sizeofIR?: (identifier: string) => number | undefined;
};

type HeapHelperTarget = WhWasmHelperTarget & {
  heap8?: () => Int8Array;
  heap8u?: () => Uint8Array;
  heap16?: () => Int16Array;
  heap16u?: () => Uint16Array;
  heap32?: () => Int32Array;
  heap32u?: () => Uint32Array;
  heapForSize?: (
    sizeIndicator: HeapSelector,
    unsigned?: boolean,
  ) => ArrayBufferView;
};

/**
 * Registers the `sizeofIR` helper used by legacy struct helpers.
 *
 * @param context Installer context providing pointer metadata.
 */
export function attachSizeHelpers(context: WhWasmInstallerContext): void {
  const target = context.target as SizeHelperTarget;
  const { ptrSizeof } = context;

  target.sizeofIR = (identifier: string): number | undefined => {
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
        return `${identifier}`.endsWith("*") ? ptrSizeof : undefined;
    }
  };
}

/**
 * Adds memoized typed-array accessors and selector helpers for the wasm heap.
 *
 * @param context Installer context providing heap view access.
 */
export function attachHeapAccessors(context: WhWasmInstallerContext): void {
  const target = context.target as HeapHelperTarget;
  const getHeap = () => context.getHeapViews();

  target.heap8 = () => getHeap().HEAP8!;
  target.heap8u = () => getHeap().HEAP8U!;
  target.heap16 = () => getHeap().HEAP16!;
  target.heap16u = () => getHeap().HEAP16U!;
  target.heap32 = () => getHeap().HEAP32!;
  target.heap32u = () => getHeap().HEAP32U!;

  target.heapForSize = (sizeIndicator: HeapSelector, unsigned = true) => {
    const heap = getHeap();
    switch (sizeIndicator) {
      case Int8Array:
        return heap.HEAP8!;
      case Uint8Array:
        return heap.HEAP8U!;
      case Int16Array:
        return heap.HEAP16!;
      case Uint16Array:
        return heap.HEAP16U!;
      case Int32Array:
        return heap.HEAP32!;
      case Uint32Array:
        return heap.HEAP32U!;
      case 8:
        return unsigned ? heap.HEAP8U! : heap.HEAP8!;
      case 16:
        return unsigned ? heap.HEAP16U! : heap.HEAP16!;
      case 32:
        return unsigned ? heap.HEAP32U! : heap.HEAP32!;
      case 64:
        if (heap.HEAP64 && heap.HEAP64U) {
          return unsigned ? heap.HEAP64U : heap.HEAP64;
        }
        break;
      default:
        if (
          context.target.bigIntEnabled &&
          (sizeIndicator === BigUint64Array ||
            sizeIndicator === BigInt64Array) &&
          heap.HEAP64 &&
          heap.HEAP64U
        ) {
          return sizeIndicator === BigUint64Array ? heap.HEAP64U : heap.HEAP64;
        }
    }
    return context.toss(
      "Invalid heapForSize() size: expecting 8, 16, 32, or 64 (BigInt).",
    );
  };
}
