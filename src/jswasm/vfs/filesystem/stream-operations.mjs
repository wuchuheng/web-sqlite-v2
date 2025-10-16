import { ERRNO_CODES, MAX_OPEN_FDS } from "./constants.mjs";

/**
 * Exposes low-level stream bookkeeping utilities used to manage file
 * descriptor allocation and device registration.
 *
 * @param {import("./types.d.ts").MutableFS} FS
 * @returns {{
 *   MAX_OPEN_FDS: number,
 *   nextfd(): number,
 *   getStreamChecked(fd: number): import("./types.d.ts").FSStream,
 *   getStream(fd: number): import("./types.d.ts").FSStream | null,
 *   createStream(
 *     stream: Partial<import("./types.d.ts").FSStream>,
 *     fd?: number
 *   ): import("./types.d.ts").FSStream,
 *   closeStream(fd: number): void,
 *   dupStream(
 *     origStream: import("./types.d.ts").FSStream,
 *     fd?: number
 *   ): import("./types.d.ts").FSStream,
 *   chrdev_stream_ops: {
 *     open(stream: import("./types.d.ts").FSStream): void,
 *     llseek(): never,
 *   },
 *   major(dev: number): number,
 *   minor(dev: number): number,
 *   makedev(ma: number, mi: number): number,
 *   registerDevice(dev: number, ops: import("./types.d.ts").StreamOps): void,
 *   getDevice(dev: number): import("./types.d.ts").DeviceDefinition | undefined,
 * }}
 */
export function createStreamOperations(FS) {
    return {
        MAX_OPEN_FDS,
        nextfd() {
            for (let fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
                if (!FS.streams[fd]) {
                    return fd;
                }
            }
            throw new FS.ErrnoError(ERRNO_CODES.EMFILE);
        },
        getStreamChecked(fd) {
            const stream = FS.getStream(fd);
            if (!stream) {
                throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            }
            return stream;
        },
        getStream: (fd) => FS.streams[fd],
        createStream(stream, fd = -1) {
            stream = Object.assign(new FS.FSStream(), stream);
            if (fd === -1) {
                fd = FS.nextfd();
            }
            stream.fd = fd;
            FS.streams[fd] = stream;
            return stream;
        },
        closeStream(fd) {
            FS.streams[fd] = null;
        },
        dupStream(origStream, fd = -1) {
            const stream = FS.createStream(origStream, fd);
            stream.stream_ops?.dup?.(stream);
            return stream;
        },
        chrdev_stream_ops: {
            open(stream) {
                const device = FS.getDevice(stream.node.rdev);
                stream.stream_ops = device.stream_ops;
                stream.stream_ops.open?.(stream);
            },
            llseek() {
                throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
            },
        },
        major: (dev) => dev >> 8,
        minor: (dev) => dev & 0xff,
        makedev: (ma, mi) => (ma << 8) | mi,
        registerDevice(dev, ops) {
            FS.devices[dev] = { stream_ops: ops };
        },
        getDevice: (dev) => FS.devices[dev],
    };
}
