/**
 * Stream-level helpers for filesystem operations
 *
 * Provides high-level stream operations that build upon the core filesystem
 * primitives, handling file descriptor management, positioning, and I/O
 * operations with proper error handling and validation.
 */

import type { MutableFS, FSStream, FSNode } from "../base-state/base-state";

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

/** Extended MutableFS interface with stream helper methods */
interface MutableFSWithHelpers extends MutableFS {
  closeStream(fd: number): void;
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
  open(path: string, flags: number, mode?: number): FSStream;
  stat(path: string): { size: number; mode: number };
  close(stream: FSStream): void;
  isFile(mode: number): boolean;
  isDir(mode: number): boolean;
  nodePermissions(node: FSNode, perm: string): number;
}
import {
  UTF8ArrayToString,
  lengthBytesUTF8,
  stringToUTF8Array,
} from "../../../utils/utf8/utf8";
import {
  ERRNO_CODES,
  OPEN_FLAGS,
  STREAM_STATE_MASK,
} from "../constants/constants";

/** Write protection flag used with mmap/allocate helpers. */
const PROT_WRITE = 0x2;
/** Shared MAP_PRIVATE flag bit used by mmap. */
const MAP_PRIVATE = 0x2;

/**
 * Supplies stream-level helpers for interacting with file descriptors backed
 * by the filesystem implementation.
 *
 * @param {MutableFS} FS - The mutable filesystem state object
 * @returns {StreamHelpers} Object containing all stream helper functions
 */
export function createStreamHelpers(FS: MutableFS): StreamHelpers {
  const fsWithHelpers = FS as MutableFSWithHelpers;
  return {
    close(stream: FSStream): void {
      // 1. Input validation
      if (fsWithHelpers.isClosed(stream)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }

      // 2. Core processing
      if (stream.getdents) {
        stream.getdents = null;
      }

      // 3. Output handling
      try {
        stream.stream_ops.close?.(stream);
      } finally {
        fsWithHelpers.closeStream(stream.fd!);
      }
      stream.fd = null;
    },

    isClosed(stream: FSStream): boolean {
      return stream.fd === null;
    },

    llseek(stream: FSStream, offset: number, whence: number): number {
      // 1. Input validation
      if (fsWithHelpers.isClosed(stream)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }
      if (!stream.seekable || !stream.stream_ops.llseek) {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
      }
      if (whence !== 0 && whence !== 1 && whence !== 2) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }

      // 2. Core processing
      stream.position = stream.stream_ops.llseek(stream, offset, whence);
      stream.ungotten = [];

      // 3. Output handling
      return stream.position;
    },

    read(
      stream: FSStream,
      buffer: Uint8Array,
      offset: number,
      length: number,
      position?: number,
    ): number {
      // 1. Input validation
      if (length < 0 || (position !== undefined && position < 0)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      if (fsWithHelpers.isClosed(stream)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }
      if ((stream.flags & STREAM_STATE_MASK) === OPEN_FLAGS.O_WRONLY) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }
      if (fsWithHelpers.isDir(stream.node!.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
      }
      if (!stream.stream_ops.read) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }

      // 2. Core processing
      const seeking = typeof position !== "undefined";
      const readPosition = seeking ? position! : stream.position;

      if (!seeking && !stream.seekable) {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
      }

      const bytesRead = stream.stream_ops.read(
        stream,
        buffer,
        offset,
        length,
        readPosition,
      );

      // 3. Output handling
      if (!seeking) {
        stream.position += bytesRead;
      }
      return bytesRead;
    },

    write(
      stream: FSStream,
      buffer: Uint8Array | ArrayLike<number>,
      offset: number,
      length: number,
      position?: number,
      canOwn?: boolean,
    ): number {
      // 1. Input validation
      if (length < 0 || (position !== undefined && position < 0)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      if (fsWithHelpers.isClosed(stream)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }
      if ((stream.flags & STREAM_STATE_MASK) === OPEN_FLAGS.O_RDONLY) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }
      if (fsWithHelpers.isDir(stream.node!.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
      }
      if (!stream.stream_ops.write) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }

      // 2. Core processing
      if (stream.seekable && stream.flags & OPEN_FLAGS.O_APPEND) {
        fsWithHelpers.llseek(stream, 0, 2);
      }

      const seeking = typeof position !== "undefined";
      const writePosition = seeking ? position! : stream.position;

      if (!seeking && !stream.seekable) {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
      }

      const bytesWritten = stream.stream_ops.write(
        stream,
        buffer,
        offset,
        length,
        writePosition,
        canOwn,
      );

      // 3. Output handling
      if (!seeking) {
        stream.position += bytesWritten;
      }
      return bytesWritten;
    },

    allocate(stream: FSStream, offset: number, length: number): void {
      // 1. Input validation
      if (fsWithHelpers.isClosed(stream)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }
      if (offset < 0 || length <= 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      if ((stream.flags & STREAM_STATE_MASK) === OPEN_FLAGS.O_RDONLY) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }
      if (
        !fsWithHelpers.isFile(stream.node!.mode) &&
        !fsWithHelpers.isDir(stream.node!.mode)
      ) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
      }
      if (!stream.stream_ops.allocate) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTSUP);
      }

      // 2. Core processing
      stream.stream_ops.allocate(stream, offset, length);

      // 3. Output handling (void function)
    },

    mmap(
      stream: FSStream,
      length: number,
      position: number,
      prot: number,
      flags: number,
    ): { ptr: number; length: number } {
      // 1. Input validation
      if (
        (prot & PROT_WRITE) !== 0 &&
        (flags & MAP_PRIVATE) === 0 &&
        (stream.flags & STREAM_STATE_MASK) !== OPEN_FLAGS.O_RDWR
      ) {
        throw new FS.ErrnoError(ERRNO_CODES.EACCES);
      }
      if (fsWithHelpers.isClosed(stream)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }
      if ((stream.flags & STREAM_STATE_MASK) === OPEN_FLAGS.O_WRONLY) {
        throw new FS.ErrnoError(ERRNO_CODES.EACCES);
      }
      if (!stream.stream_ops.mmap) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
      }
      if (!length) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }

      // 2. Core processing
      return stream.stream_ops.mmap(stream, length, position, prot, flags);
    },

    msync(
      stream: FSStream,
      buffer: Uint8Array | ArrayLike<number>,
      offset: number,
      length: number,
      mmapFlags: number,
    ): number {
      // 1. Input validation
      if (!stream.stream_ops.msync) {
        return 0;
      }

      // 2. Core processing
      return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
    },

    ioctl(stream: FSStream, cmd: number, arg: number): number {
      // 1. Input validation
      if (!stream.stream_ops.ioctl) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
      }

      // 2. Core processing
      return stream.stream_ops.ioctl(stream, cmd, arg);
    },

    readFile(path: string, opts: ReadFileOptions = {}): Uint8Array | string {
      // 1. Input validation and defaults
      const flags = opts.flags || 0;
      const encoding = opts.encoding || "binary";

      if (encoding !== "utf8" && encoding !== "binary") {
        throw new Error(`Invalid encoding type "${encoding}"`);
      }

      // 2. Core processing
      const stream = fsWithHelpers.open(path, flags);
      try {
        const stat = fsWithHelpers.stat(path);
        const length = stat.size;
        const buf = new Uint8Array(length);
        fsWithHelpers.read(stream, buf, 0, length, 0);

        // 3. Output handling
        if (encoding === "utf8") {
          return UTF8ArrayToString(buf);
        } else {
          return buf;
        }
      } finally {
        fsWithHelpers.close(stream);
      }
    },

    writeFile(
      path: string,
      data: string | ArrayBufferView,
      opts: WriteFileOptions = {},
    ): void {
      // 1. Input validation and defaults
      const flags =
        opts.flags ||
        OPEN_FLAGS.O_WRONLY | OPEN_FLAGS.O_CREAT | OPEN_FLAGS.O_TRUNC;
      const stream = fsWithHelpers.open(path, flags, opts.mode);

      try {
        // 2. Core processing
        if (typeof data === "string") {
          const buf = new Uint8Array(lengthBytesUTF8(data) + 1);
          const actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          fsWithHelpers.write(
            stream,
            buf,
            0,
            actualNumBytes,
            undefined,
            opts.canOwn,
          );
        } else if (ArrayBuffer.isView(data)) {
          fsWithHelpers.write(
            stream,
            data as Uint8Array | ArrayLike<number>,
            0,
            data.byteLength,
            undefined,
            opts.canOwn,
          );
        } else {
          throw new Error("Unsupported data type");
        }
      } finally {
        // 3. Output handling (cleanup)
        fsWithHelpers.close(stream);
      }
    },

    cwd(): string {
      return FS.currentPath;
    },

    chdir(path: string): void {
      // 1. Input validation
      const lookup = FS.lookupPath(path, { follow: true });
      if (lookup.node === null) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }
      if (!fsWithHelpers.isDir(lookup.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
      }

      // 2. Permission validation
      const errCode = fsWithHelpers.nodePermissions(lookup.node, "x");
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }

      // 3. Output handling (state update)
      FS.currentPath = lookup.path;
    },
  };
}
