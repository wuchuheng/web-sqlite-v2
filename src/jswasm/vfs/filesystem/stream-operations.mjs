export function createStreamOperations(FS) {
    return {
        MAX_OPEN_FDS: 4096,
        nextfd() {
            for (let fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
                if (!FS.streams[fd]) {
                    return fd;
                }
            }
            throw new FS.ErrnoError(33);
        },
        getStreamChecked(fd) {
            const stream = FS.getStream(fd);
            if (!stream) {
                throw new FS.ErrnoError(8);
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
                throw new FS.ErrnoError(70);
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
