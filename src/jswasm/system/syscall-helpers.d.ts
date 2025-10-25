import type {
  PathUtilities,
  SyscallFS,
  SyscallHelpers,
} from "../shared/system-types.d.ts";

/**
 * Creates the shared syscall helper utilities leveraged by the syscall modules.
 */
export declare function createSyscallHelpers(
  FS: SyscallFS,
  PATH: PathUtilities,
  HEAPU8: Uint8Array,
  HEAP8: Int8Array,
  HEAP16: Int16Array,
  HEAP32: Int32Array,
  HEAPU32: Uint32Array,
  HEAP64: BigInt64Array,
  UTF8ArrayToString: (
    heap: Uint8Array,
    ptr: number,
    maxBytesToRead?: number,
  ) => string,
  lengthBytesUTF8: (value: string) => number,
  stringToUTF8Array: (
    value: string,
    heap: Uint8Array,
    outPtr: number,
    maxBytesToWrite: number,
  ) => number,
): SyscallHelpers;
