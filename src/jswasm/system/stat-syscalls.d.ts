import type { StatSyscalls, SyscallFS, SyscallHelpers } from "../shared/system-types.d.ts";

/**
 * Creates stat-family syscall implementations backed by the virtual filesystem.
 */
export declare function createStatSyscalls(
    FS: SyscallFS,
    SYSCALLS: SyscallHelpers["SYSCALLS"]
): StatSyscalls;
