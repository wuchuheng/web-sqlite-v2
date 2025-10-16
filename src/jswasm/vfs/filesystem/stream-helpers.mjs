import { UTF8ArrayToString, lengthBytesUTF8, stringToUTF8Array } from "../../utils/utf8.mjs";
import { ERRNO_CODES, OPEN_FLAGS, STREAM_STATE_MASK } from "./constants.mjs";

/** Write protection flag used with mmap/allocate helpers. */
const PROT_WRITE = 0x2;
/** Shared MAP_PRIVATE flag bit used by mmap. */
const MAP_PRIVATE = 0x2;

/**
 * Supplies stream-level helpers for interacting with file descriptors backed
 * by the filesystem implementation.
 *
 * @param {import("./types.d.ts").MutableFS} FS
 * @returns {{
 *   close(stream: import("./types.d.ts").FSStream): void,
 *   isClosed(stream: import("./types.d.ts").FSStream): boolean,
 *   llseek(stream: import("./types.d.ts").FSStream, offset: number, whence: number): number,
 *   read(
 *     stream: import("./types.d.ts").FSStream,
 *     buffer: Uint8Array,
 *     offset: number,
 *     length: number,
 *     position?: number
 *   ): number,
 *   write(
 *     stream: import("./types.d.ts").FSStream,
 *     buffer: Uint8Array | ArrayLike<number>,
 *     offset: number,
 *     length: number,
 *     position?: number,
 *     canOwn?: boolean
 *   ): number,
 *   allocate(stream: import("./types.d.ts").FSStream, offset: number, length: number): void,
 *   mmap(
 *     stream: import("./types.d.ts").FSStream,
 *     length: number,
 *     position: number,
 *     prot: number,
 *     flags: number
 *   ): { ptr: number, length: number },
 *   msync(
 *     stream: import("./types.d.ts").FSStream,
 *     buffer: Uint8Array | ArrayLike<number>,
 *     offset: number,
 *     length: number,
 *     mmapFlags: number
 *   ): number,
 *   ioctl(stream: import("./types.d.ts").FSStream, cmd: number, arg: number): number,
 *   readFile(
 *     path: string,
 *     opts?: { flags?: number, encoding?: "utf8" | "binary" }
 *   ): Uint8Array | string,
 *   writeFile(
 *     path: string,
 *     data: string | ArrayBufferView,
 *     opts?: { flags?: number, mode?: number, canOwn?: boolean }
 *   ): void,
 *   cwd(): string,
 *   chdir(path: string): void,
 * }}
 */
export function createStreamHelpers(FS) {
    return {
        close(stream) {
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            }
            if (stream.getdents) stream.getdents = null;
            try {
                stream.stream_ops.close?.(stream);
            } finally {
                FS.closeStream(stream.fd);
            }
            stream.fd = null;
        },
        isClosed(stream) {
            return stream.fd === null;
        },
        llseek(stream, offset, whence) {
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            }
            if (!stream.seekable || !stream.stream_ops.llseek) {
                throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
            }
            if (whence != 0 && whence != 1 && whence != 2) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
            }
            stream.position = stream.stream_ops.llseek(stream, offset, whence);
            stream.ungotten = [];
            return stream.position;
        },
        read(stream, buffer, offset, length, position) {
            if (length < 0 || position < 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
            }
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            }
            if ((stream.flags & STREAM_STATE_MASK) === OPEN_FLAGS.O_WRONLY) {
                throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            }
            if (FS.isDir(stream.node.mode)) {
                throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
            }
            if (!stream.stream_ops.read) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
            }
            const seeking = typeof position != "undefined";
            if (!seeking) {
                position = stream.position;
            } else if (!stream.seekable) {
                throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
            }
            const bytesRead = stream.stream_ops.read(
                stream,
                buffer,
                offset,
                length,
                position
            );
            if (!seeking) stream.position += bytesRead;
            return bytesRead;
        },
        write(stream, buffer, offset, length, position, canOwn) {
            if (length < 0 || position < 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
            }
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            }
            if ((stream.flags & STREAM_STATE_MASK) === OPEN_FLAGS.O_RDONLY) {
                throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            }
            if (FS.isDir(stream.node.mode)) {
                throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
            }
            if (!stream.stream_ops.write) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
            }
            if (stream.seekable && stream.flags & OPEN_FLAGS.O_APPEND) {
                FS.llseek(stream, 0, 2);
            }
            const seeking = typeof position != "undefined";
            if (!seeking) {
                position = stream.position;
            } else if (!stream.seekable) {
                throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
            }
            const bytesWritten = stream.stream_ops.write(
                stream,
                buffer,
                offset,
                length,
                position,
                canOwn
            );
            if (!seeking) stream.position += bytesWritten;
            return bytesWritten;
        },
        allocate(stream, offset, length) {
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            }
            if (offset < 0 || length <= 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
            }
            if ((stream.flags & STREAM_STATE_MASK) === OPEN_FLAGS.O_RDONLY) {
                throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            }
            if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
                throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
            }
            if (!stream.stream_ops.allocate) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTSUP);
            }
            stream.stream_ops.allocate(stream, offset, length);
        },
        mmap(stream, length, position, prot, flags) {
            if (
                (prot & PROT_WRITE) !== 0 &&
                (flags & MAP_PRIVATE) === 0 &&
                (stream.flags & STREAM_STATE_MASK) !== OPEN_FLAGS.O_RDWR
            ) {
                throw new FS.ErrnoError(ERRNO_CODES.EACCES);
            }
            if (FS.isClosed(stream)) {
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
            return stream.stream_ops.mmap(stream, length, position, prot, flags);
        },
        msync(stream, buffer, offset, length, mmapFlags) {
            if (!stream.stream_ops.msync) {
                return 0;
            }
            return stream.stream_ops.msync(
                stream,
                buffer,
                offset,
                length,
                mmapFlags
            );
        },
        ioctl(stream, cmd, arg) {
            if (!stream.stream_ops.ioctl) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
            }
            return stream.stream_ops.ioctl(stream, cmd, arg);
        },
        readFile(path, opts = {}) {
            opts.flags = opts.flags || 0;
            opts.encoding = opts.encoding || "binary";
            if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
                throw new Error(`Invalid encoding type "${opts.encoding}"`);
            }
            let ret;
            const stream = FS.open(path, opts.flags);
            const stat = FS.stat(path);
            const length = stat.size;
            const buf = new Uint8Array(length);
            FS.read(stream, buf, 0, length, 0);
            if (opts.encoding === "utf8") {
                ret = UTF8ArrayToString(buf);
            } else {
                ret = buf;
            }
            FS.close(stream);
            return ret;
        },
        writeFile(path, data, opts = {}) {
            opts.flags =
                opts.flags ||
                (OPEN_FLAGS.O_WRONLY | OPEN_FLAGS.O_CREAT | OPEN_FLAGS.O_TRUNC);
            const stream = FS.open(path, opts.flags, opts.mode);
            if (typeof data == "string") {
                const buf = new Uint8Array(lengthBytesUTF8(data) + 1);
                const actualNumBytes = stringToUTF8Array(
                    data,
                    buf,
                    0,
                    buf.length
                );
                FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
            } else if (ArrayBuffer.isView(data)) {
                FS.write(
                    stream,
                    data,
                    0,
                    data.byteLength,
                    undefined,
                    opts.canOwn
                );
            } else {
                throw new Error("Unsupported data type");
            }
            FS.close(stream);
        },
        cwd: () => FS.currentPath,
        chdir(path) {
            const lookup = FS.lookupPath(path, { follow: true });
            if (lookup.node === null) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
            }
            if (!FS.isDir(lookup.node.mode)) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
            }
            const errCode = FS.nodePermissions(lookup.node, "x");
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            FS.currentPath = lookup.path;
        },
    };
}
