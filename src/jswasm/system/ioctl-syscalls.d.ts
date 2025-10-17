import type { IoctlSyscalls, SyscallFS, SyscallHelpers } from "../shared/system-types.d.ts";

/**
 * Creates the ioctl syscall implementation used for terminal control.
 */
export declare function createIoctlSyscalls(
    FS: SyscallFS,
    SYSCALLS: SyscallHelpers["SYSCALLS"],
    syscallGetVarargP: () => number,
    HEAP8: Int8Array,
    HEAP16: Int16Array,
    HEAP32: Int32Array
): IoctlSyscalls;
