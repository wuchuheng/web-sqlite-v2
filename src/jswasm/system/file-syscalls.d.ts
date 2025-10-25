import type {
  FileSyscalls,
  PathUtilities,
  SyscallFS,
  SyscallHelpers,
} from "../shared/system-types.d.ts";

/**
 * Creates file-operation syscall implementations such as openat and chmod.
 */
export declare function createFileSyscalls(
  FS: SyscallFS,
  PATH: PathUtilities,
  SYSCALLS: SyscallHelpers["SYSCALLS"],
  syscallGetVarargI: () => number,
  syscallGetVarargP: () => number,
  bigintToI53Checked: (value: bigint) => number,
  readI53FromI64: (ptr: number) => number,
  stringToUTF8: (
    value: string,
    outPtr: number,
    maxBytesToWrite: number,
  ) => number,
  lengthBytesUTF8: (value: string) => number,
  HEAP8: Int8Array,
  HEAP16: Int16Array,
  HEAP32: Int32Array,
): FileSyscalls;
