import { ERRNO_CODES, MODE, OPEN_FLAGS } from "./constants.mjs";

/**
 * Produces helpers for reasoning about POSIX mode bitmasks and validating
 * permissions for filesystem nodes.
 *
 * @param {import("./types.d.ts").MutableFS} FS
 * @returns {{
 *   isFile(mode: number): boolean,
 *   isDir(mode: number): boolean,
 *   isLink(mode: number): boolean,
 *   isChrdev(mode: number): boolean,
 *   isBlkdev(mode: number): boolean,
 *   isFIFO(mode: number): boolean,
 *   isSocket(mode: number): boolean,
 *   flagsToPermissionString(flag: number): string,
 *   nodePermissions(node: import("./types.d.ts").FSNode, perms: string): number,
 *   mayLookup(dir: import("./types.d.ts").FSNode): number,
 *   mayCreate(dir: import("./types.d.ts").FSNode, name: string): number,
 *   mayDelete(dir: import("./types.d.ts").FSNode, name: string, isdir: boolean): number,
 *   mayOpen(node: import("./types.d.ts").FSNode | null, flags: number): number,
 * }}
 */
export function createModeOperations(FS) {
    return {
        isFile(mode) {
            return (mode & MODE.TYPE_MASK) === MODE.FILE;
        },
        isDir(mode) {
            return (mode & MODE.TYPE_MASK) === MODE.DIRECTORY;
        },
        isLink(mode) {
            return (mode & MODE.TYPE_MASK) === MODE.SYMLINK;
        },
        isChrdev(mode) {
            return (mode & MODE.TYPE_MASK) === MODE.CHARACTER_DEVICE;
        },
        isBlkdev(mode) {
            return (mode & MODE.TYPE_MASK) === MODE.BLOCK_DEVICE;
        },
        isFIFO(mode) {
            return (mode & MODE.TYPE_MASK) === MODE.FIFO;
        },
        isSocket(mode) {
            return (mode & MODE.TYPE_MASK) === MODE.SOCKET;
        },
        flagsToPermissionString(flag) {
            let perms = ["r", "w", "rw"][flag & OPEN_FLAGS.O_ACCMODE];
            if (flag & OPEN_FLAGS.O_TRUNC) {
                perms += "w";
            }
            return perms;
        },
        nodePermissions(node, perms) {
            if (FS.ignorePermissions) {
                return 0;
            }
            if (perms.includes("r") && !(node.mode & MODE.PERMISSION_READ)) {
                return ERRNO_CODES.EACCES;
            } else if (
                perms.includes("w") &&
                !(node.mode & MODE.PERMISSION_WRITE)
            ) {
                return ERRNO_CODES.EACCES;
            } else if (
                perms.includes("x") &&
                !(node.mode & MODE.PERMISSION_EXECUTE)
            ) {
                return ERRNO_CODES.EACCES;
            }
            return 0;
        },
        mayLookup(dir) {
            if (!FS.isDir(dir.mode)) return ERRNO_CODES.ENOTDIR;
            const errCode = FS.nodePermissions(dir, "x");
            if (errCode) return errCode;
            if (!dir.node_ops.lookup) return ERRNO_CODES.EACCES;
            return 0;
        },
        mayCreate(dir, name) {
            try {
                FS.lookupNode(dir, name);
                return ERRNO_CODES.EEXIST;
            } catch (_e) {}
            return FS.nodePermissions(dir, "wx");
        },
        mayDelete(dir, name, isdir) {
            let node;
            try {
                node = FS.lookupNode(dir, name);
            } catch (e) {
                return e.errno;
            }
            const errCode = FS.nodePermissions(dir, "wx");
            if (errCode) {
                return errCode;
            }
            if (isdir) {
                if (!FS.isDir(node.mode)) {
                    return ERRNO_CODES.ENOTDIR;
                }
                if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
                    return ERRNO_CODES.EBUSY;
                }
            } else if (FS.isDir(node.mode)) {
                return ERRNO_CODES.EISDIR;
            }
            return 0;
        },
        mayOpen(node, flags) {
            if (!node) {
                return ERRNO_CODES.ENOENT;
            }
            if (FS.isLink(node.mode)) {
                return ERRNO_CODES.ELOOP;
            } else if (FS.isDir(node.mode)) {
                if (
                    FS.flagsToPermissionString(flags) !== "r" ||
                    flags & OPEN_FLAGS.O_TRUNC
                ) {
                    return ERRNO_CODES.EISDIR;
                }
            }
            return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
        },
    };
}
