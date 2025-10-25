import type { FSStream, MutableFS } from "./base-state.d.ts";

/** Optional flags accepted by the readFile helper. */
export interface ReadFileOptions {
  /** File descriptor flags to use when opening the file. */
  flags?: number;
  /** Optional encoding forcing UTF-8 decoding. */
  encoding?: "utf8" | "binary";
}

/** Optional flags accepted by the writeFile helper. */
export interface WriteFileOptions {
  /** File descriptor flags to use when creating the file. */
  flags?: number;
  /** Mode applied to the file when created. */
  mode?: number;
  /** Indicates whether the buffer ownership can be transferred. */
  canOwn?: boolean;
}

/**
 * High-level stream helpers that build upon the filesystem primitives.
 */
export interface StreamHelpers {
  close(stream: FSStream): void;
  isClosed(stream: FSStream): boolean;
  llseek(stream: FSStream, offset: number, whence: number): number;
  read(
    stream: FSStream,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position?: number,
  ): number;
  write(
    stream: FSStream,
    buffer: Uint8Array | ArrayLike<number>,
    offset: number,
    length: number,
    position?: number,
    canOwn?: boolean,
  ): number;
  allocate(stream: FSStream, offset: number, length: number): void;
  mmap(
    stream: FSStream,
    length: number,
    position: number,
    prot: number,
    flags: number,
  ): { ptr: number; length: number };
  msync(
    stream: FSStream,
    buffer: Uint8Array | ArrayLike<number>,
    offset: number,
    length: number,
    mmapFlags: number,
  ): number;
  ioctl(stream: FSStream, cmd: number, arg: number): number;
  readFile(path: string, opts?: ReadFileOptions): Uint8Array | string;
  writeFile(
    path: string,
    data: string | ArrayBufferView,
    opts?: WriteFileOptions,
  ): void;
  cwd(): string;
  chdir(path: string): void;
}

/**
 * Creates the stream helper facade for the supplied filesystem state.
 */
export function createStreamHelpers(FS: MutableFS): StreamHelpers;
