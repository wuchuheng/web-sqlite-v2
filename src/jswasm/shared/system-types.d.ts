import type { FSNode, FSStats, FSStream, StreamOps } from "../vfs/filesystem/base-state.d.ts";
import type { RuntimeFS } from "./runtime-types.d.ts";

/**
 * Virtual filesystem helpers for working with POSIX-style paths.
 */
export interface PathUtilities {
    /** Determines whether the provided path is absolute. */
    isAbs(path: string): boolean;
    /** Joins two path segments into a normalized path. */
    join2(a: string, b: string): string;
    /** Normalizes a path by collapsing redundant segments. */
    normalize(path: string): string;
}

/**
 * Extended filesystem interface with the surface required by the syscall layer.
 */
export interface SyscallFS extends RuntimeFS {
    /** Array of registered file streams indexed by descriptor. */
    streams: Array<FSStream | null>;
    /** Creates a duplicate of the provided stream. */
    dupStream(stream: FSStream, fd: number): FSStream;
    /** Retrieves the current working directory. */
    cwd(): string;
    /** Checks whether the provided mode represents a file. */
    isFile(mode: number): boolean;
    /** Checks whether the provided mode represents a directory. */
    isDir(mode: number): boolean;
    /** Checks whether the provided mode represents a symbolic link. */
    isLink(mode: number): boolean;
    /** Performs chmod on the specified path. */
    chmod(path: string, mode: number): void;
    /** Performs fchmod on the specified descriptor. */
    fchmod(fd: number, mode: number): void;
    /** Updates ownership for the specified descriptor. */
    fchown(fd: number, owner: number, group: number): void;
    /** Looks up a path within the filesystem. */
    lookupPath(path: string, options: { follow: boolean }): { node: FSNode };
    /** Checks node permissions with the given mask. */
    nodePermissions(node: FSNode, perms: string): boolean;
    /** Retrieves a checked stream from a descriptor. */
    getStreamChecked(fd: number): FSStream & { path: string; node: FSNode; mode: number; stream_ops?: StreamOps };
    /** Truncates a file to the specified size. */
    ftruncate(fd: number, length: number): void;
    /** Creates a directory at the provided path. */
    mkdir(path: string, mode: number, dev?: number): void;
    /** Opens a path and returns the resulting stream. */
    open(path: string, flags: number, mode?: number): FSStream & { fd: number };
    /** Reads a symbolic link target. */
    readlink(path: string): string;
    /** Removes a directory. */
    rmdir(path: string): void;
    /** Removes a file. */
    unlink(path: string): void;
    /** Updates file timestamps. */
    utime(path: string, atime: number, mtime: number): void;
    /** Performs synchronous memory update for a mapped file. */
    msync(stream: FSStream, buffer: Uint8Array, offset: number, length: number, flags: number): void;
    /** Reads bytes from a stream into the heap. */
    read(stream: FSStream, heap: Int8Array, ptr: number, length: number, offset?: number): number;
    /** Writes bytes from the heap into a stream. */
    write(stream: FSStream, heap: Int8Array, ptr: number, length: number, offset?: number): number;
    /** Performs seek operations on a stream. */
    llseek(stream: FSStream, offset: number, whence: number): void;
    /** Maps a file into memory. */
    mmap(stream: FSStream, length: number, offset: number, prot: number, flags: number): { ptr: number; allocated: number };
    /** Closes a stream. */
    close(stream: FSStream): void;
    /** Retrieves file statistics for a path. */
    stat(path: string): FSStats & {
        dev: number;
        ino: number;
        mode: number;
        nlink: number;
        uid: number;
        gid: number;
        rdev: number;
        size: number;
        blksize?: number;
        blocks: number;
        atime: Date;
        mtime: Date;
        ctime: Date;
    };
    /** Retrieves file statistics without following symlinks. */
    lstat(path: string): ReturnType<SyscallFS["stat"]>;
}

/**
 * Helper bag containing the SYSCALLS object and typed utility functions.
 */
export interface SyscallHelpers {
    /** Shared helper methods used across syscall implementations. */
    SYSCALLS: {
        /** Default poll mask applied to descriptor operations. */
        DEFAULT_POLLMASK: number;
        /** Pointer to the current varargs list. */
        varargs: number | undefined;
        /** Resolves a path relative to a directory descriptor. */
        calculateAt(dirfd: number, path: string, allowEmpty?: boolean): string;
        /** Executes a stat-like function and writes the result into memory. */
        doStat(
            func: (path: string) => ReturnType<SyscallFS["stat"]>,
            path: string,
            buf: number
        ): number;
        /** Performs a memory-mapped sync back to the underlying file. */
        doMsync(addr: number, stream: FSStream, len: number, flags: number, offset: number): number;
        /** Retrieves a file stream from a descriptor. */
        getStreamFromFD(fd: number): ReturnType<SyscallFS["getStreamChecked"]>;
        /** Reads a UTF-8 string from memory. */
        getStr(ptr: number): string;
    };
    /** Reads the next integer argument from the varargs list. */
    syscallGetVarargI(): number;
    /** Reads the next pointer argument from the varargs list. */
    syscallGetVarargP(): number;
    /** Converts a bigint into a safe JavaScript number when possible. */
    bigintToI53Checked(value: bigint): number;
    /** Reads a 53-bit integer from a 64-bit pointer. */
    readI53FromI64(ptr: number): number;
    /** Decodes a UTF-8 string from memory. */
    UTF8ToString(ptr: number, maxBytesToRead?: number): string;
    /** Encodes a string as UTF-8 into the heap. */
    stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): number;
    /** Calculates the number of bytes required to encode a string as UTF-8. */
    lengthBytesUTF8(str: string): number;
}

/**
 * Contract returned by the stat syscall factory.
 */
export interface StatSyscalls {
    ___syscall_stat64(path: number, buf: number): number;
    ___syscall_lstat64(path: number, buf: number): number;
    ___syscall_fstat64(fd: number, buf: number): number;
    ___syscall_newfstatat(dirfd: number, path: number, buf: number, flags: number): number;
}

/**
 * Contract returned by the file syscall factory.
 */
export interface FileSyscalls {
    ___syscall_chmod(path: number, mode: number): number;
    ___syscall_fchmod(fd: number, mode: number): number;
    ___syscall_fchown32(fd: number, owner: number, group: number): number;
    ___syscall_faccessat(dirfd: number, path: number, amode: number, flags: number): number;
    ___syscall_fcntl64(fd: number, cmd: number, varargs: number): number;
    ___syscall_ftruncate64(fd: number, length: number): number;
    ___syscall_getcwd(buf: number, size: number): number;
    ___syscall_mkdirat(dirfd: number, path: number, mode: number): number;
    ___syscall_openat(dirfd: number, path: number, flags: number, varargs: number): number;
    ___syscall_readlinkat(dirfd: number, path: number, buf: number, bufsize: number): number;
    ___syscall_rmdir(path: number): number;
    ___syscall_unlinkat(dirfd: number, path: number, flags: number): number;
    ___syscall_utimensat(dirfd: number, path: number, times: number, flags: number): number;
}

/**
 * Contract returned by the ioctl syscall factory.
 */
export interface IoctlSyscalls {
    ___syscall_ioctl(fd: number, op: number, varargs: number): number;
}

/**
 * Unified syscall interface returned by {@link createSYSCALLS}.
 */
export interface UnifiedSyscalls extends StatSyscalls, FileSyscalls, IoctlSyscalls {
    /** Shared helper utilities exposed for integration with WASI helpers. */
    SYSCALLS: SyscallHelpers["SYSCALLS"];
}

/**
 * Shape of the WASI function table assembled for sqlite3.mjs.
 */
export interface WASIFunctionTable {
    __emscripten_get_now_is_monotonic(): number;
    __localtime_js(time: bigint, tmPtr: number): void;
    __mmap_js(
        len: number,
        prot: number,
        flags: number,
        fd: number,
        offset: bigint,
        allocated: number,
        addr: number
    ): number;
    __munmap_js(addr: number, len: number, prot: number, flags: number, fd: number, offset: bigint): number | undefined;
    __tzset_js(timezone: number, daylight: number, std_name: number, dst_name: number): void;
    _emscripten_date_now(): number;
    _emscripten_get_now(): number;
    _environ_get(__environ: number, environ_buf: number): number;
    _environ_sizes_get(penviron_count: number, penviron_buf_size: number): number;
    _fd_close(fd: number): number;
    _fd_fdstat_get(fd: number, pbuf: number): number;
    _fd_read(fd: number, iov: number, iovcnt: number, pnum: number): number;
    _fd_seek(fd: number, offset: bigint, whence: number, newOffset: number): number;
    _fd_sync(fd: number): number;
    _fd_write(fd: number, iov: number, iovcnt: number, pnum: number): number;
}

/**
 * Shape of the exports returned by the WebAssembly module bootstrap.
 */
export interface SyscallBootstrapExports {
    createSYSCALLS: (
        FS: SyscallFS,
        PATH: PathUtilities,
        HEAPU8: Uint8Array,
        HEAP8: Int8Array,
        HEAP16: Int16Array,
        HEAP32: Int32Array,
        HEAPU32: Uint32Array,
        HEAP64: BigInt64Array,
        UTF8ArrayToString: (heap: Uint8Array, ptr: number, maxBytesToRead?: number) => string,
        lengthBytesUTF8: (str: string) => number,
        stringToUTF8Array: (str: string, heap: Uint8Array, outPtr: number, maxBytesToWrite: number) => number
    ) => UnifiedSyscalls;
    createWASIFunctions: (
        FS: SyscallFS,
        SYSCALLS: SyscallHelpers["SYSCALLS"],
        HEAP8: Int8Array,
        HEAP16: Int16Array,
        HEAP32: Int32Array,
        HEAPU8: Uint8Array,
        HEAPU32: Uint32Array,
        HEAP64: BigInt64Array,
        stringToUTF8Array: (str: string, heap: Uint8Array, outPtr: number, maxBytesToWrite: number) => number
    ) => WASIFunctionTable;
}
