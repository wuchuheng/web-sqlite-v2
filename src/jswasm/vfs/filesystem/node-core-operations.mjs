import { PATH } from "../../utils/path/path";
import { ERRNO_CODES, MODE } from "./constants/constants";

/**
 * Creates core filesystem operations that handle file/directory creation,
 * manipulation, and basic operations like symlinks and renames.
 *
 * @param {import("./base-state.d.ts").MutableFS} FS
 * @param {import("./node-actions.d.ts").NodeActionsOptions} options
 * @returns {object} Core filesystem operations
 */
export function createCoreOperations(FS, { getPathFS, _Module }) {
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
            if (
                FS.isMountpoint(oldNode) ||
                (newNode && FS.isMountpoint(newNode))
            ) {
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
                link.node_ops.readlink(link),
            );
        },
    };
}
