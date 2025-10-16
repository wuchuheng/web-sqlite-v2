import { UTF8ArrayToString, lengthBytesUTF8, stringToUTF8Array } from "../../utils/utf8.mjs";

export function createStreamHelpers(FS) {
    return {
        close(stream) {
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(8);
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
                throw new FS.ErrnoError(8);
            }
            if (!stream.seekable || !stream.stream_ops.llseek) {
                throw new FS.ErrnoError(70);
            }
            if (whence != 0 && whence != 1 && whence != 2) {
                throw new FS.ErrnoError(28);
            }
            stream.position = stream.stream_ops.llseek(stream, offset, whence);
            stream.ungotten = [];
            return stream.position;
        },
        read(stream, buffer, offset, length, position) {
            if (length < 0 || position < 0) {
                throw new FS.ErrnoError(28);
            }
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(8);
            }
            if ((stream.flags & 2097155) === 1) {
                throw new FS.ErrnoError(8);
            }
            if (FS.isDir(stream.node.mode)) {
                throw new FS.ErrnoError(31);
            }
            if (!stream.stream_ops.read) {
                throw new FS.ErrnoError(28);
            }
            const seeking = typeof position != "undefined";
            if (!seeking) {
                position = stream.position;
            } else if (!stream.seekable) {
                throw new FS.ErrnoError(70);
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
                throw new FS.ErrnoError(28);
            }
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(8);
            }
            if ((stream.flags & 2097155) === 0) {
                throw new FS.ErrnoError(8);
            }
            if (FS.isDir(stream.node.mode)) {
                throw new FS.ErrnoError(31);
            }
            if (!stream.stream_ops.write) {
                throw new FS.ErrnoError(28);
            }
            if (stream.seekable && stream.flags & 1024) {
                FS.llseek(stream, 0, 2);
            }
            const seeking = typeof position != "undefined";
            if (!seeking) {
                position = stream.position;
            } else if (!stream.seekable) {
                throw new FS.ErrnoError(70);
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
                throw new FS.ErrnoError(8);
            }
            if (offset < 0 || length <= 0) {
                throw new FS.ErrnoError(28);
            }
            if ((stream.flags & 2097155) === 0) {
                throw new FS.ErrnoError(8);
            }
            if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
                throw new FS.ErrnoError(43);
            }
            if (!stream.stream_ops.allocate) {
                throw new FS.ErrnoError(138);
            }
            stream.stream_ops.allocate(stream, offset, length);
        },
        mmap(stream, length, position, prot, flags) {
            if (
                (prot & 2) !== 0 &&
                (flags & 2) === 0 &&
                (stream.flags & 2097155) !== 2
            ) {
                throw new FS.ErrnoError(2);
            }
            if ((stream.flags & 2097155) === 1) {
                throw new FS.ErrnoError(2);
            }
            if (!stream.stream_ops.mmap) {
                throw new FS.ErrnoError(43);
            }
            if (!length) {
                throw new FS.ErrnoError(28);
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
                throw new FS.ErrnoError(59);
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
            opts.flags = opts.flags || 577;
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
                throw new FS.ErrnoError(44);
            }
            if (!FS.isDir(lookup.node.mode)) {
                throw new FS.ErrnoError(54);
            }
            const errCode = FS.nodePermissions(lookup.node, "x");
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            FS.currentPath = lookup.path;
        },
    };
}
