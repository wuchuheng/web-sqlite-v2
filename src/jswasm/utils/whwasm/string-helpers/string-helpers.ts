/**
 * @fileoverview String and UTF-8 helpers for the wh-wasm utilities.
 */

import type {
  WhWasmHelperTarget,
  WhWasmInstallerContext,
} from "../installer-context/installer-context";
import { assertAllocator } from "../utils/utils";

type WasmPointer = number | bigint;
type Utf8Buffer = Uint8Array | Int8Array;
type PointerAllocator = (size: number) => number;

type StringHelperTarget = WhWasmHelperTarget & {
  isPtr: (value: unknown) => value is WasmPointer;
  heap8u: () => Uint8Array;
  alloc: PointerAllocator;
  dealloc: (pointer: number) => void;
  cstrlen?: (ptr: WasmPointer | null) => number | null;
  cstrToJs?: (ptr: WasmPointer | null) => string | null;
  jstrlen?: (value: unknown) => number | null;
  jstrcpy?: (
    value: string,
    target: Utf8Buffer,
    offset?: number,
    maxBytes?: number,
    addNul?: boolean,
  ) => number;
  cstrncpy?: (tgtPtr: WasmPointer, srcPtr: WasmPointer, n: number) => number;
  jstrToUintArray?: (value: string, addNul?: boolean) => Uint8Array;
  allocCString?: (
    value: string,
    returnWithLength?: boolean,
  ) => WasmPointer | [WasmPointer, number] | null;
};

type AllocCStringInternal = NonNullable<
  WhWasmInstallerContext["allocCStringInternal"]
>;

const toNumberPointer = (pointer: WasmPointer): number =>
  typeof pointer === "bigint" ? Number(pointer) : pointer;

const decodeUtf8Slice = (
  cache: WhWasmInstallerContext["cache"],
  view: Uint8Array,
  begin: number,
  end: number,
): string => {
  const sabCtor =
    typeof SharedArrayBuffer === "undefined" ? undefined : SharedArrayBuffer;
  const buffer =
    sabCtor && view.buffer instanceof sabCtor
      ? view.slice(begin, end)
      : view.subarray(begin, end);
  return cache.utf8Decoder.decode(buffer);
};

/**
 * Adds string conversion helpers (cstrlen, cstrToJs, etc.) to the target.
 *
 * @param context Shared installer context populated with wasm utilities.
 */
export function attachStringUtilities(context: WhWasmInstallerContext): void {
  // 1. Input handling
  const target = context.target as StringHelperTarget;
  const { cache } = context;

  // 2. Core processing
  target.cstrlen = (ptr: WasmPointer | null) => {
    if (!ptr || !target.isPtr(ptr)) {
      return null;
    }
    const heap = context.getHeapViews().HEAP8U!;
    const start = toNumberPointer(ptr);
    let position = start;
    while (heap[position] !== 0) {
      position += 1;
    }
    return position - start;
  };

  target.cstrToJs = (ptr: WasmPointer | null) => {
    const length = target.cstrlen!(ptr);
    if (length === null) {
      return null;
    }
    if (length === 0) {
      return "";
    }
    const heap = context.getHeapViews().HEAP8U!;
    const start = toNumberPointer(ptr as WasmPointer);
    return decodeUtf8Slice(cache, heap, start, start + length);
  };

  target.jstrlen = (value: unknown) => {
    if (typeof value !== "string") {
      return null;
    }
    let length = 0;
    for (let index = 0; index < value.length; index += 1) {
      let code = value.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdfff) {
        code =
          (0x10000 + ((code & 0x3ff) << 10)) |
          (value.charCodeAt(++index) & 0x3ff);
      }
      if (code <= 0x7f) length += 1;
      else if (code <= 0x7ff) length += 2;
      else if (code <= 0xffff) length += 3;
      else length += 4;
    }
    return length;
  };

  target.jstrcpy = (
    jstr: string,
    tgt: Utf8Buffer,
    offset = 0,
    maxBytes = -1,
    addNul = true,
  ) => {
    if (!(tgt instanceof Int8Array) && !(tgt instanceof Uint8Array)) {
      context.toss("jstrcpy() target must be an Int8Array or Uint8Array.");
    }
    const targetBuffer = tgt;
    const boundedMax = maxBytes < 0 ? targetBuffer.length - offset : maxBytes;
    if (!(boundedMax > 0) || !(offset >= 0)) {
      return 0;
    }

    const begin = offset;
    const end = offset + boundedMax - (addNul ? 1 : 0);
    for (let i = 0; i < jstr.length && offset < end; i += 1) {
      let code = jstr.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdfff) {
        code =
          (0x10000 + ((code & 0x3ff) << 10)) | (jstr.charCodeAt(++i) & 0x3ff);
      }
      if (code <= 0x7f) {
        targetBuffer[offset++] = code;
      } else if (code <= 0x7ff) {
        if (offset + 1 >= end) break;
        targetBuffer[offset++] = 0xc0 | (code >> 6);
        targetBuffer[offset++] = 0x80 | (code & 0x3f);
      } else if (code <= 0xffff) {
        if (offset + 2 >= end) break;
        targetBuffer[offset++] = 0xe0 | (code >> 12);
        targetBuffer[offset++] = 0x80 | ((code >> 6) & 0x3f);
        targetBuffer[offset++] = 0x80 | (code & 0x3f);
      } else {
        if (offset + 3 >= end) break;
        targetBuffer[offset++] = 0xf0 | (code >> 18);
        targetBuffer[offset++] = 0x80 | ((code >> 12) & 0x3f);
        targetBuffer[offset++] = 0x80 | ((code >> 6) & 0x3f);
        targetBuffer[offset++] = 0x80 | (code & 0x3f);
      }
    }

    if (addNul) {
      targetBuffer[offset++] = 0;
    }
    return offset - begin;
  };

  target.cstrncpy = (tgtPtr: WasmPointer, srcPtr: WasmPointer, n: number) => {
    if (!tgtPtr || !srcPtr) {
      context.toss("cstrncpy() does not accept NULL strings.");
    }
    let limit = n;
    if (n < 0) {
      const length = target.cstrlen!(srcPtr);
      limit = (length ?? 0) + 1;
    } else if (!(n > 0)) {
      return 0;
    }

    const heap = target.heap8u();
    const dst = toNumberPointer(tgtPtr);
    const src = toNumberPointer(srcPtr);
    let i = 0;
    let ch: number | undefined;
    for (; i < limit && (ch = heap[src + i]); i += 1) {
      heap[dst + i] = ch;
    }
    if (i < limit) {
      heap[dst + i] = 0;
      i += 1;
    }
    return i;
  };

  target.jstrToUintArray = (value: string, addNul = false) =>
    cache.utf8Encoder.encode(addNul ? `${value}\0` : value);

  const allocCStringInternal: AllocCStringInternal = (
    jstr,
    returnWithLength,
    allocator,
    funcName,
  ) => {
    assertAllocator(context, funcName);
    if (typeof jstr !== "string") {
      return null;
    }
    const bytes = cache.utf8Encoder.encode(jstr);
    const ptr = allocator(bytes.length + 1);
    const heap = context.getHeapViews().HEAP8U!;
    heap.set(bytes, ptr);
    heap[ptr + bytes.length] = 0;
    return returnWithLength ? [ptr, bytes.length] : ptr;
  };

  context.allocCStringInternal = allocCStringInternal;

  target.allocCString = (jstr: string, returnWithLength = false) =>
    allocCStringInternal(
      jstr,
      returnWithLength,
      target.alloc,
      "allocCString()",
    );

  // 3. Output handling
}
