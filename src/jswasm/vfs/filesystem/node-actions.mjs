import { PATH } from "../../utils/path.mjs";

/**
 * Generates high-level node manipulation helpers (create, rename, open, etc.)
 * that mirror POSIX semantics on top of the in-memory filesystem state.
 *
 * @param {import("./types.d.ts").MutableFS} FS
 * @param {{
 *   FS_modeStringToFlags: (mode: string) => number,
 *   getPathFS: () => {
 *     resolve: (...paths: string[]) => string,
 *     relative: (from: string, to: string) => string,
 *   },
 *   Module: Record<string, any>,
 * }} options
 * @returns {{
 *   create(path: string, mode?: number): import("./types.d.ts").FSNode,
 *   mkdir(path: string, mode?: number): import("./types.d.ts").FSNode,
 *   mkdirTree(path: string, mode?: number): void,
 *   mkdev(path: string, mode: number, dev?: number): import("./types.d.ts").FSNode,
 *   symlink(oldpath: string, newpath: string): import("./types.d.ts").FSNode,
 *   rename(oldPath: string, newPath: string): void,
 *   rmdir(path: string): void,
 *   readdir(path: string): string[],
 *   unlink(path: string): void,
 *   readlink(path: string): string,
 *   stat(path: string, dontFollow?: boolean): import("./types.d.ts").FSStats,
 *   lstat(path: string): import("./types.d.ts").FSStats,
 *   chmod(
 *     path: string | import("./types.d.ts").FSNode,
 *     mode: number,
 *     dontFollow?: boolean
 *   ): void,
 *   lchmod(path: string | import("./types.d.ts").FSNode, mode: number): void,
 *   fchmod(fd: number, mode: number): void,
 *   chown(
 *     path: string | import("./types.d.ts").FSNode,
 *     uid: number,
 *     gid: number,
 *     dontFollow?: boolean
 *   ): void,
 *   lchown(path: string | import("./types.d.ts").FSNode, uid: number, gid: number): void,
 *   fchown(fd: number, uid: number, gid: number): void,
 *   truncate(path: string | import("./types.d.ts").FSNode, len: number): void,
 *   ftruncate(fd: number, len: number): void,
 *   utime(path: string, atime: number, mtime: number): void,
 *   open(
 *     path: string | import("./types.d.ts").FSNode,
 *     flags: number | string,
 *     mode?: number
 *   ): import("./types.d.ts").FSStream,
 * }}
 */
export function createNodeActions(
    FS,
    { FS_modeStringToFlags, getPathFS, Module }
) {
    return {
        create(path, mode) {
            mode = mode !== undefined ? mode : 438;
            mode &= 4095;
            mode |= 32768;
            return FS.mknod(path, mode, 0);
        },
        mkdir(path, mode) {
            mode = mode !== undefined ? mode : 511;
            mode &= 511 | 512;
            mode |= 16384;
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
                    if (e.errno != 20) throw e;
                }
            }
        },
        mkdev(path, mode, dev) {
            if (typeof dev == "undefined") {
                dev = mode;
                mode = 438;
            }
            mode |= 8192;
            return FS.mknod(path, mode, dev);
        },
        symlink(oldpath, newpath) {
            const PATH_FS = getPathFS();
            if (!PATH_FS.resolve(oldpath)) {
                throw new FS.ErrnoError(44);
            }
            const lookup = FS.lookupPath(newpath, { parent: true });
            const parent = lookup.node;
            if (!parent) {
                throw new FS.ErrnoError(44);
            }
            const newname = PATH.basename(newpath);
            const errCode = FS.mayCreate(parent, newname);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            if (!parent.node_ops.symlink) {
                throw new FS.ErrnoError(63);
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
            if (!oldDir || !newDir) throw new FS.ErrnoError(44);
            if (oldDir.mount !== newDir.mount) {
                throw new FS.ErrnoError(75);
            }
            const oldNode = FS.lookupNode(oldDir, oldName);
            let relative = getPathFS().relative(oldPath, newDirname);
            if (relative.charAt(0) !== ".") {
                throw new FS.ErrnoError(28);
            }
            relative = getPathFS().relative(newPath, oldDirname);
            if (relative.charAt(0) !== ".") {
                throw new FS.ErrnoError(55);
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
                throw new FS.ErrnoError(63);
            }
            if (FS.isMountpoint(oldNode) || (newNode && FS.isMountpoint(newNode))) {
                throw new FS.ErrnoError(10);
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
                throw new FS.ErrnoError(63);
            }
            if (FS.isMountpoint(node)) {
                throw new FS.ErrnoError(10);
            }
            parent.node_ops.rmdir(parent, name);
            FS.destroyNode(node);
        },
        readdir(path) {
            const lookup = FS.lookupPath(path, { follow: true });
            const node = lookup.node;
            if (!node.node_ops.readdir) {
                throw new FS.ErrnoError(54);
            }
            return node.node_ops.readdir(node);
        },
        unlink(path) {
            const lookup = FS.lookupPath(path, { parent: true });
            const parent = lookup.node;
            if (!parent) {
                throw new FS.ErrnoError(44);
            }
            const name = PATH.basename(path);
            const node = FS.lookupNode(parent, name);
            const errCode = FS.mayDelete(parent, name, false);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            if (!parent.node_ops.unlink) {
                throw new FS.ErrnoError(63);
            }
            if (FS.isMountpoint(node)) {
                throw new FS.ErrnoError(10);
            }
            parent.node_ops.unlink(parent, name);
            FS.destroyNode(node);
        },
        readlink(path) {
            const PATH_FS = getPathFS();
            const lookup = FS.lookupPath(path);
            const link = lookup.node;
            if (!link) {
                throw new FS.ErrnoError(44);
            }
            if (!link.node_ops.readlink) {
                throw new FS.ErrnoError(28);
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
                throw new FS.ErrnoError(44);
            }
            if (!node.node_ops.getattr) {
                throw new FS.ErrnoError(63);
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
                throw new FS.ErrnoError(63);
            }
            node.node_ops.setattr(node, {
                mode: (mode & 4095) | (node.mode & ~4095),
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
                throw new FS.ErrnoError(63);
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
                throw new FS.ErrnoError(28);
            }
            let node;
            if (typeof path == "string") {
                const lookup = FS.lookupPath(path, { follow: true });
                node = lookup.node;
            } else {
                node = path;
            }
            if (!node.node_ops.setattr) {
                throw new FS.ErrnoError(63);
            }
            if (FS.isDir(node.mode)) {
                throw new FS.ErrnoError(31);
            }
            if (!FS.isFile(node.mode)) {
                throw new FS.ErrnoError(28);
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
            if ((stream.flags & 2097155) === 0) {
                throw new FS.ErrnoError(28);
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
                throw new FS.ErrnoError(44);
            }
            flags =
                typeof flags == "string" ? FS_modeStringToFlags(flags) : flags;
            if (flags & 64) {
                mode = typeof mode == "undefined" ? 438 : mode;
                mode = (mode & 4095) | 32768;
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
                        follow: !(flags & 131072),
                    });
                    node = lookup.node;
                } catch (_e) {}
            }
            let created = false;
            if (flags & 64) {
                if (node) {
                    if (flags & 128) {
                        throw new FS.ErrnoError(20);
                    }
                } else {
                    node = FS.mknod(path, mode, 0);
                    created = true;
                }
            }
            if (!node) {
                throw new FS.ErrnoError(44);
            }
            if (FS.isChrdev(node.mode)) {
                flags &= ~512;
            }
            if (flags & 65536 && !FS.isDir(node.mode)) {
                throw new FS.ErrnoError(54);
            }
            if (!created) {
                const errCode = FS.mayOpen(node, flags);
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
            }
            if (flags & 512 && !created) {
                FS.truncate(node, 0);
            }
            flags &= ~(128 | 512 | 131072);
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
            if (Module?.logReadFiles && !(flags & 1) && typeof path === "string") {
                if (!(path in FS.readFiles)) {
                    FS.readFiles[path] = 1;
                }
            }
            return stream;
        },
    };
}
