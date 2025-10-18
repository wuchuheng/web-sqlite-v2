import type {
    FileSystemMount,
    FileSystemMountType,
    FSNode,
    MutableFS,
} from "./base-state.d.ts";

/**
 * Logger callbacks consumed by the mount operation helpers.
 */
export interface MountOperationsOptions {
    /** Reports non-fatal issues encountered during mount handling. */
    err(message: string): void;
}

/**
 * Helper surface for working with filesystem mounts and device nodes.
 */
export interface MountOperations {
    /** Returns the list of mounts reachable from the provided root. */
    getMounts(mount: FileSystemMount): FileSystemMount[];
    /** Synchronises all mounted filesystems. */
    syncfs(
        populate: boolean,
        callback: (errCode: number | null) => void
    ): void;
    /** Synchronises all mounted filesystems (populate defaults to false). */
    syncfs(
        callback: (errCode: number | null) => void
    ): void;
    /** Mounts a filesystem implementation at the supplied path. */
    mount(
        type: FileSystemMountType,
        opts: FileSystemMount["opts"],
        mountpoint: string
    ): FSNode;
    /** Removes a previously mounted filesystem. */
    unmount(mountpoint: string): void;
    /** Delegates lookup to the underlying node implementation. */
    lookup(parent: FSNode, name: string): FSNode;
    /** Creates a special node under the supplied path. */
    mknod(path: string, mode: number, dev: number): FSNode;
}

/**
 * Produces the mount helper facade tied to the filesystem state.
 */
export function createMountOperations(
    FS: MutableFS,
    options: MountOperationsOptions
): MountOperations;
