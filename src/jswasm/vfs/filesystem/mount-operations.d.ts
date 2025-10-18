import type {
    FileSystemMount,
    FileSystemMountType,
    FSNode,
    MutableFS,
} from "./types.d.ts";

export interface MountOperationsOptions {
    err(message: string): void;
}

export interface MountOperations {
    getMounts(mount: FileSystemMount): FileSystemMount[];
    syncfs(
        populate: boolean,
        callback: (errCode: number | null) => void
    ): void;
    syncfs(
        callback: (errCode: number | null) => void
    ): void;
    mount(
        type: FileSystemMountType,
        opts: Record<string, unknown>,
        mountpoint: string
    ): FSNode;
    unmount(mountpoint: string): void;
    lookup(parent: FSNode, name: string): FSNode;
    mknod(path: string, mode: number, dev: number): FSNode;
}

export function createMountOperations(
    FS: MutableFS,
    options: MountOperationsOptions
): MountOperations;
