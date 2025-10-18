import type { FSStream, MutableFS } from "./base-state.d.ts";

export interface StreamHelpers {
    close(stream: FSStream): void;
    isClosed(stream: FSStream): boolean;
    llseek(stream: FSStream, offset: number, whence: number): number;
    read(
        stream: FSStream,
        buffer: Uint8Array,
        offset: number,
        length: number,
        position?: number
    ): number;
    write(
        stream: FSStream,
        buffer: Uint8Array | ArrayLike<number>,
        offset: number,
        length: number,
        position?: number,
        canOwn?: boolean
    ): number;
    allocate(stream: FSStream, offset: number, length: number): void;
    mmap(
        stream: FSStream,
        length: number,
        position: number,
        prot: number,
        flags: number
    ): { ptr: number; length: number };
    msync(
        stream: FSStream,
        buffer: Uint8Array | ArrayLike<number>,
        offset: number,
        length: number,
        mmapFlags: number
    ): number;
    ioctl(stream: FSStream, cmd: number, arg: number): number;
    readFile(path: string, opts?: { flags?: number; encoding?: "utf8" | "binary" }): Uint8Array | string;
    writeFile(
        path: string,
        data: string | ArrayBufferView,
        opts?: { flags?: number; mode?: number; canOwn?: boolean }
    ): void;
    cwd(): string;
    chdir(path: string): void;
}

export function createStreamHelpers(FS: MutableFS): StreamHelpers;
