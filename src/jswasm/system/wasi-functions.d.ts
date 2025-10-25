import type {
  SyscallFS,
  SyscallHelpers,
  WASIFunctionTable,
} from "../shared/system-types.d.ts";

/**
 * Assembles the WASI-compatible function suite backed by the virtual filesystem.
 */
export declare function createWASIFunctions(
  FS: SyscallFS,
  SYSCALLS: SyscallHelpers["SYSCALLS"],
  HEAP8: Int8Array,
  HEAP16: Int16Array,
  HEAP32: Int32Array,
  HEAPU8: Uint8Array,
  HEAPU32: Uint32Array,
  HEAP64: BigInt64Array,
  stringToUTF8Array: (
    value: string,
    heap: Uint8Array,
    outPtr: number,
    maxBytesToWrite: number,
  ) => number,
): WASIFunctionTable;
