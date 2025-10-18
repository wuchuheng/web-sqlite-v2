import { PATH } from "../../utils/path.mjs";
import { ERRNO_CODES, MODE, OPEN_FLAGS, STREAM_STATE_MASK } from "./constants.mjs";

/**
 * Generates high-level node manipulation helpers (create, rename, open, etc.)
 * that mirror POSIX semantics on top of the in-memory filesystem state.
 *
 * @param {import("./base-state.d.ts").MutableFS} FS
 * @param {import("./node-actions.d.ts").NodeActionsOptions} options
 * @returns {import("./node-actions.d.ts").NodeActions}
 */
export function createNodeActions(
    FS,
    { FS_modeStringToFlags, getPathFS, Module }
) {
    return {
        create(path, mode) {
            mode = mode !== undefined ? mode : MODE.DEFAULT_FILE_PERMISSIONS;
            mode &= MODE.PERMISSION_MASK;
            mode |= MODE.FILE;
            return FS.mknod(path, mode, 0);
        },
        mkdir(path, mode) {
            mode =
                mode !== undefined ? mode : MODE.DEFAULT_DIRECTORY_PERMISSIONS;
            mode &= MODE.DIR_PERMISSION_WITH_STICKY;
            mode |= MODE.DIRECTORY;
            return FS.mknod(path, mode, 0);
        },
        mkdirTree(path, mode) {
            const dirs = path.split("/");
            let d = "";
            for (let i = 0; i < dirs.length; ++i) {
                if (!dirs[i]) continue;
                d += "/" + dirs[i];
                try {
                    FS.mkdir(d, mode);
                } catch (e) {
                    if (e.errno != ERRNO_CODES.EEXIST) throw e;
                }
            }
        },
        mkdev(path, mode, dev) {
            if (typeof dev == "undefined") {
                dev = mode;
                mode = MODE.DEFAULT_FILE_PERMISSIONS;
            }
            mode |= MODE.CHARACTER_DEVICE;
            return FS.mknod(path, mode, dev);
        },
        symlink(oldpath, newpath) {
            const PATH_FS = getPathFS();
            if (!PATH_FS.resolve(oldpath)) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
            }
            const lookup = FS.lookupPath(newpath, { parent: true });
            const parent = lookup.node;
            if (!parent) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
            }
            const newname = PATH.basename(newpath);
            const errCode = FS.mayCreate(parent, newname);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            if (!parent.node_ops.symlink) {
                throw new FS.ErrnoError(ERRNO_CODES.EPERM);
            }
            return parent.node_ops.symlink(parent, newname, oldpath);
        },
        rename(oldPath, newPath) {
            const oldDirname = PATH.dirname(oldPath);
            const newDirname = PATH.dirname(newPath);
            const oldName = PATH.basename(oldPath);
            const newName = PATH.basename(newPath);
            const oldLookup = FS.lookupPath(oldPath, { parent: true });
            const newLookup = FS.lookupPath(newPath, { parent: true });
            const oldDir = oldLookup.node;
            const newDir = newLookup.node;
            if (!oldDir || !newDir) throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
            if (oldDir.mount !== newDir.mount) {
                throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
            }
            const oldNode = FS.lookupNode(oldDir, oldName);
            let relative = getPathFS().relative(oldPath, newDirname);
            if (relative.charAt(0) !== ".") {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
            }
            relative = getPathFS().relative(newPath, oldDirname);
            if (relative.charAt(0) !== ".") {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
            }
            let newNode;
            try {
                newNode = FS.lookupNode(newDir, newName);
            } catch (_e) {}
            if (oldNode === newNode) {
                return;
            }
            const isdir = FS.isDir(oldNode.mode);
            let errCode = FS.mayDelete(oldDir, oldName, isdir);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            errCode = newNode
                ? FS.mayDelete(newDir, newName, isdir)
                : FS.mayCreate(newDir, newName);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            if (!oldDir.node_ops.rename) {
                throw new FS.ErrnoError(ERRNO_CODES.EPERM);
            }
            if (FS.isMountpoint(oldNode) || (newNode && FS.isMountpoint(newNode))) {
                throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
            }
            if (newDir !== oldDir) {
                errCode = FS.nodePermissions(oldDir, "w");
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
            }
            FS.hashRemoveNode(oldNode);
            try {
                oldDir.node_ops.rename(oldNode, newDir, newName);
                oldNode.parent = newDir;
            } finally {
                FS.hashAddNode(oldNode);
            }
        },
        rmdir(path) {
            const lookup = FS.lookupPath(path, { parent: true });
            const parent = lookup.node;
            const name = PATH.basename(path);
            const node = FS.lookupNode(parent, name);
            const errCode = FS.mayDelete(parent, name, true);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            if (!parent.node_ops.rmdir) {
                throw new FS.ErrnoError(ERRNO_CODES.EPERM);
            }
            if (FS.isMountpoint(node)) {
                throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
            }
            parent.node_ops.rmdir(parent, name);
            FS.destroyNode(node);
        },
        readdir(path) {
            const lookup = FS.lookupPath(path, { follow: true });
            const node = lookup.node;
            if (!node.node_ops.readdir) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
            }
            return node.node_ops.readdir(node);
        },
        unlink(path) {
            const lookup = FS.lookupPath(path, { parent: true });
            const parent = lookup.node;
            if (!parent) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
            }
            const name = PATH.basename(path);
            const node = FS.lookupNode(parent, name);
            const errCode = FS.mayDelete(parent, name, false);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            if (!parent.node_ops.unlink) {
                throw new FS.ErrnoError(ERRNO_CODES.EPERM);
            }
            if (FS.isMountpoint(node)) {
                throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
            }
            parent.node_ops.unlink(parent, name);
            FS.destroyNode(node);
        },
        readlink(path) {
            const PATH_FS = getPathFS();
            const lookup = FS.lookupPath(path);
            const link = lookup.node;
            if (!link) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
            }
            if (!link.node_ops.readlink) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
            }
            return PATH_FS.resolve(
                FS.getPath(link.parent),
                link.node_ops.readlink(link)
            );
        },
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
            flags &=
                ~(
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
