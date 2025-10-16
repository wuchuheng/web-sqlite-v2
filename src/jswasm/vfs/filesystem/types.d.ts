export interface ErrnoError extends Error {
    errno: number;
}

export interface FSStats {
    size?: number;
    mode?: number;
    timestamp?: number;
}

export interface FSStreamShared {
    flags?: number;
    position?: number;
}

export interface StreamOps {
    open?(stream: FSStream): void;
    close?(stream: FSStream): void;
    llseek?(stream: FSStream, offset: number, whence: number): number;
    read?(stream: FSStream, buffer: Uint8Array, offset: number, length: number, position: number): number;
    write?(stream: FSStream, buffer: Uint8Array | ArrayLike<number>, offset: number, length: number, position: number, canOwn?: boolean): number;
    allocate?(stream: FSStream, offset: number, length: number): void;
    mmap?(stream: FSStream, length: number, position: number, prot: number, flags: number): { ptr: number; length: number };
    msync?(stream: FSStream, buffer: Uint8Array | ArrayLike<number>, offset: number, length: number, mmapFlags: number): number;
    ioctl?(stream: FSStream, cmd: number, arg: number): number;
    dup?(stream: FSStream): void;
}

export interface NodeOps {
    lookup?(parent: FSNode, name: string): FSNode;
    mknod?(parent: FSNode, name: string, mode: number, dev: number): FSNode;
    symlink?(parent: FSNode, name: string, target: string): FSNode;
    rename?(node: FSNode, newDir: FSNode, newName: string): void;
    rmdir?(parent: FSNode, name: string): void;
    readdir?(node: FSNode): string[];
    unlink?(parent: FSNode, name: string): void;
    readlink?(node: FSNode): string;
    getattr?(node: FSNode): FSStats;
    setattr?(node: FSNode, stats: Partial<FSStats>): void;
}

export interface FileSystemMountType {
    mount(mount: FileSystemMount): FSNode;
    syncfs?(mount: FileSystemMount, populate: boolean, done: (errCode: number | null) => void): void;
}

export interface FileSystemMount {
    type: FileSystemMountType;
    opts: Record<string, unknown>;
    mountpoint: string;
    mounts: FileSystemMount[];
    root: FSNode;
}

export interface DeviceDefinition {
    stream_ops: StreamOps;
}

export interface FSNode {
    parent: FSNode;
    mount: FileSystemMount;
    mounted: FileSystemMount | null;
    id: number | null;
    name: string;
    mode: number;
    node_ops: NodeOps;
    stream_ops: StreamOps;
    rdev: number;
    readMode: number;
    writeMode: number;
    assignId(fs: MutableFS): FSNode;
    read: boolean;
    write: boolean;
    isFolder: boolean;
    isDevice: boolean;
}

export interface FSStream {
    shared: FSStreamShared;
    node?: FSNode;
    flags: number;
    position: number;
    fd: number | null;
    path?: string;
    seekable?: boolean;
    stream_ops: StreamOps;
    ungotten?: number[];
    error?: boolean;
    getdents?: null;
    object: FSNode;
    isRead: boolean;
    isWrite: boolean;
    isAppend: boolean;
}

export interface MutableFS {
    root: FSNode | null;
    mounts: FileSystemMount[];
    devices: Record<number, DeviceDefinition>;
    streams: Array<FSStream | null>;
    nextInode: number;
    nameTable: Array<FSNode | null> | null;
    currentPath: string;
    initialized: boolean;
    ignorePermissions: boolean;
    ErrnoError: new (errno: number) => ErrnoError;
    genericErrors: Record<number, ErrnoError>;
    filesystems: Record<string, unknown> | null;
    syncFSRequests: number;
    readFiles: Record<string, number>;
    FSStream: new () => FSStream;
    FSNode: new (parent: FSNode, name: string, mode: number, rdev: number) => FSNode;
}
