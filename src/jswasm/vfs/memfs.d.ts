import type {
    FSNode,
    FSStream,
    MutableFS,
    NodeOps,
    StreamOps,
} from "./filesystem/base-state.d.ts";

export interface MemfsNode extends FSNode {
    contents: Uint8Array | { [name: string]: MemfsNode } | null;
    usedBytes: number;
    link?: string;
    timestamp: number;
}

export interface MemfsOpsTable {
    dir: { node: NodeOps; stream: StreamOps };
    file: { node: NodeOps; stream: StreamOps };
    link: { node: NodeOps; stream: StreamOps };
    chrdev: { node: NodeOps; stream: StreamOps };
}

export interface MemfsInstance {
    ops_table: MemfsOpsTable | null;
    mount(config: Record<string, unknown>): MemfsNode;
    createNode(parent: MemfsNode | null, name: string, mode: number, dev: number): MemfsNode;
    getFileDataAsTypedArray(node: MemfsNode): Uint8Array;
    expandFileStorage(node: MemfsNode, newCapacity: number): void;
    resizeFileStorage(node: MemfsNode, newSize: number): void;
    node_ops: {
        getattr(node: MemfsNode): {
            dev: number;
            ino: number;
            mode: number;
            nlink: number;
            uid: number;
            gid: number;
            rdev: number;
            size: number;
            atime: Date;
            mtime: Date;
            ctime: Date;
            blksize: number;
            blocks: number;
        };
        setattr(node: MemfsNode, attr: { mode?: number; timestamp?: number; size?: number }): void;
        lookup(parent: MemfsNode, name: string): never;
        mknod(parent: MemfsNode | null, name: string, mode: number, dev: number): MemfsNode;
        rename(oldNode: MemfsNode, newDir: MemfsNode, newName: string): void;
        unlink(parent: MemfsNode, name: string): void;
        rmdir(parent: MemfsNode, name: string): void;
        readdir(node: MemfsNode): string[];
        symlink(parent: MemfsNode, name: string, target: string): MemfsNode;
        readlink(node: MemfsNode): string;
    };
    stream_ops: {
        read(stream: FSStream, buffer: Uint8Array, offset: number, length: number, position: number): number;
        write(
            stream: FSStream,
            buffer: Uint8Array | ArrayLike<number>,
            offset: number,
            length: number,
            position: number,
            canOwn?: boolean
        ): number;
        llseek(stream: FSStream, offset: number, whence: number): number;
        allocate(stream: FSStream, offset: number, length: number): void;
        mmap(
            stream: FSStream,
            length: number,
            position: number,
            prot: number,
            flags: number
        ): { ptr: number; allocated: boolean };
        msync(
            stream: FSStream,
            buffer: Uint8Array | ArrayLike<number>,
            offset: number,
            length: number,
            mmapFlags: number
        ): number;
    };
}

export function createMEMFS(
    FS: MutableFS & { chrdev_stream_ops: StreamOps },
    HEAP8: Int8Array,
    mmapAlloc: (size: number) => number,
    zeroMemory: (pointer: number, byteCount: number) => void
): MemfsInstance;
