import type {
    FSNode,
    FSStats,
    FSStream,
    MutableFS,
} from "./base-state.d.ts";
import type { PathFsUtilities } from "../../utils/path.d.ts";
import type { RuntimeModule } from "../../shared/runtime-types.d.ts";

/**
 * Configuration surface required to construct the node manipulation helpers.
 */
export interface NodeActionsOptions {
    /** Converts POSIX mode strings into flag bitmasks. */
    FS_modeStringToFlags(mode: string): number;
    /** Lazily retrieves the PATH_FS helper used for symlink resolution. */
    getPathFS(): PathFsUtilities;
    /** Reference to the runtime module for interacting with FS helpers. */
    Module: RuntimeModule;
}

/**
 * High-level filesystem operations that operate on node paths or descriptors.
 */
export interface NodeActions {
    create(path: string, mode?: number): FSNode;
    mkdir(path: string, mode?: number): FSNode;
    mkdirTree(path: string, mode?: number): void;
    mkdev(path: string, mode: number, dev?: number): FSNode;
    symlink(oldPath: string, newPath: string): FSNode;
    rename(oldPath: string, newPath: string): void;
    rmdir(path: string): void;
    readdir(path: string): string[];
    unlink(path: string): void;
    readlink(path: string): string;
    stat(path: string, dontFollow?: boolean): FSStats;
    lstat(path: string): FSStats;
    chmod(path: string | FSNode, mode: number, dontFollow?: boolean): void;
    lchmod(path: string | FSNode, mode: number): void;
    fchmod(fd: number, mode: number): void;
    chown(path: string | FSNode, uid: number, gid: number, dontFollow?: boolean): void;
    lchown(path: string | FSNode, uid: number, gid: number): void;
    fchown(fd: number, uid: number, gid: number): void;
    truncate(path: string | FSNode, length: number): void;
    ftruncate(fd: number, length: number): void;
    utime(path: string, atime: number, mtime: number): void;
    open(path: string | FSNode, flags: number | string, mode?: number): FSStream;
}

/**
 * Creates the node helper facade for the supplied filesystem implementation.
 */
export function createNodeActions(
    FS: MutableFS,
    options: NodeActionsOptions
): NodeActions;
