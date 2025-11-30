import { PATH } from "../../utils/path/path";
import {
    ERRNO_CODES,
    MODE,
    OPEN_FLAGS,
    STREAM_STATE_MASK,
} from "./constants/constants";

/**
 * Creates metadata operations that handle file status, permissions,
 * ownership, content modification, and file opening operations.
 *
 * @param {import("./base-state.d.ts").MutableFS} FS
 * @param {import("./node-actions.d.ts").NodeActionsOptions} options
 * @returns {object} Metadata and file access operations
 */
export function createMetadataOperations(FS, { FS_modeStringToFlags, Module }) {
    return {
        stat(path, dontFollow) {
            const lookup = FS.lookupPath(path, { follow: !dontFollow });
            const node = lookup.node;
            if (!node) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
            }
            if (!node.node_ops.getattr) {
                throw new FS.ErrnoError(ERRNO_CODES.EPERM);
            }
            return node.node_ops.getattr(node);
        },

        lstat(path) {
            return FS.stat(path, true);
        },

        chmod(path, mode, dontFollow) {
            let node;
            if (typeof path == "string") {
                const lookup = FS.lookupPath(path, { follow: !dontFollow });
                node = lookup.node;
            } else {
                node = path;
            }
            if (!node.node_ops.setattr) {
                throw new FS.ErrnoError(ERRNO_CODES.EPERM);
            }
            node.node_ops.setattr(node, {
                mode:
                    (mode & MODE.PERMISSION_MASK) |
                    (node.mode & ~MODE.PERMISSION_MASK),
                timestamp: Date.now(),
            });
        },

        lchmod(path, mode) {
            FS.chmod(path, mode, true);
        },

        fchmod(fd, mode) {
            const stream = FS.getStreamChecked(fd);
            FS.chmod(stream.node, mode);
        },

        chown(path, uid, gid, dontFollow) {
            let node;
            if (typeof path == "string") {
                const lookup = FS.lookupPath(path, { follow: !dontFollow });
                node = lookup.node;
            } else {
                node = path;
            }
            if (!node.node_ops.setattr) {
                throw new FS.ErrnoError(ERRNO_CODES.EPERM);
            }
            node.node_ops.setattr(node, {
                timestamp: Date.now(),
            });
        },

        lchown(path, uid, gid) {
            FS.chown(path, uid, gid, true);
        },

        fchown(fd, uid, gid) {
            const stream = FS.getStreamChecked(fd);
            FS.chown(stream.node, uid, gid);
        },

        truncate(path, len) {
            if (len < 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
            }
            let node;
            if (typeof path == "string") {
                const lookup = FS.lookupPath(path, { follow: true });
                node = lookup.node;
            } else {
                node = path;
            }
            if (!node.node_ops.setattr) {
                throw new FS.ErrnoError(ERRNO_CODES.EPERM);
            }
            if (FS.isDir(node.mode)) {
                throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
            }
            if (!FS.isFile(node.mode)) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
            }
            const errCode = FS.nodePermissions(node, "w");
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            node.node_ops.setattr(node, {
                size: len,
                timestamp: Date.now(),
            });
        },

        ftruncate(fd, len) {
            const stream = FS.getStreamChecked(fd);
            if ((stream.flags & STREAM_STATE_MASK) === OPEN_FLAGS.O_RDONLY) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
            }
            FS.truncate(stream.node, len);
        },

        utime(path, atime, mtime) {
            const lookup = FS.lookupPath(path, { follow: true });
            const node = lookup.node;
            node.node_ops.setattr(node, {
                timestamp: Math.max(atime, mtime),
            });
        },

        open(path, flags, mode) {
            if (path === "") {
                throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
            }
            flags =
                typeof flags == "string" ? FS_modeStringToFlags(flags) : flags;
            if (flags & OPEN_FLAGS.O_CREAT) {
                mode =
                    typeof mode == "undefined"
                        ? MODE.DEFAULT_FILE_PERMISSIONS
                        : mode;
                mode = (mode & MODE.PERMISSION_MASK) | MODE.FILE;
            } else {
                mode = 0;
            }
            let node;
            if (typeof path == "object") {
                node = path;
            } else {
                path = PATH.normalize(path);
                try {
                    const lookup = FS.lookupPath(path, {
                        follow: !(flags & OPEN_FLAGS.O_NOFOLLOW),
                    });
                    node = lookup.node;
                } catch (_e) {}
            }
            let created = false;
            if (flags & OPEN_FLAGS.O_CREAT) {
                if (node) {
                    if (flags & OPEN_FLAGS.O_EXCL) {
                        throw new FS.ErrnoError(ERRNO_CODES.EEXIST);
                    }
                } else {
                    node = FS.mknod(path, mode, 0);
                    created = true;
                }
            }
            if (!node) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
            }
            if (FS.isChrdev(node.mode)) {
                flags &= ~OPEN_FLAGS.O_TRUNC;
            }
            if (flags & OPEN_FLAGS.O_DIRECTORY && !FS.isDir(node.mode)) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
            }
            if (!created) {
                const errCode = FS.mayOpen(node, flags);
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
            }
            if (flags & OPEN_FLAGS.O_TRUNC && !created) {
                FS.truncate(node, 0);
            }
            flags &= ~(
                OPEN_FLAGS.O_EXCL |
                OPEN_FLAGS.O_TRUNC |
                OPEN_FLAGS.O_NOFOLLOW
            );
            const stream = FS.createStream({
                node,
                path: FS.getPath(node),
                flags,
                seekable: true,
                position: 0,
                stream_ops: node.stream_ops,
                ungotten: [],
                error: false,
            });
            if (stream.stream_ops.open) {
                stream.stream_ops.open(stream);
            }
            if (
                Module?.logReadFiles &&
                // Only log files opened with read intent.
                (flags & OPEN_FLAGS.O_ACCMODE) !== OPEN_FLAGS.O_WRONLY &&
                typeof path === "string"
            ) {
                if (!(path in FS.readFiles)) {
                    FS.readFiles[path] = 1;
                }
            }
            return stream;
        },
    };
}
