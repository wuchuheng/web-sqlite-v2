export function createModeOperations(FS) {
    return {
        isFile(mode) {
            return (mode & 61440) === 32768;
        },
        isDir(mode) {
            return (mode & 61440) === 16384;
        },
        isLink(mode) {
            return (mode & 61440) === 40960;
        },
        isChrdev(mode) {
            return (mode & 61440) === 8192;
        },
        isBlkdev(mode) {
            return (mode & 61440) === 24576;
        },
        isFIFO(mode) {
            return (mode & 61440) === 4096;
        },
        isSocket(mode) {
            return (mode & 49152) === 49152;
        },
        flagsToPermissionString(flag) {
            let perms = ["r", "w", "rw"][flag & 3];
            if (flag & 512) {
                perms += "w";
            }
            return perms;
        },
        nodePermissions(node, perms) {
            if (FS.ignorePermissions) {
                return 0;
            }
            if (perms.includes("r") && !(node.mode & 292)) {
                return 2;
            } else if (perms.includes("w") && !(node.mode & 146)) {
                return 2;
            } else if (perms.includes("x") && !(node.mode & 73)) {
                return 2;
            }
            return 0;
        },
        mayLookup(dir) {
            if (!FS.isDir(dir.mode)) return 54;
            const errCode = FS.nodePermissions(dir, "x");
            if (errCode) return errCode;
            if (!dir.node_ops.lookup) return 2;
            return 0;
        },
        mayCreate(dir, name) {
            try {
                FS.lookupNode(dir, name);
                return 20;
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
                    return 54;
                }
                if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
                    return 10;
                }
            } else if (FS.isDir(node.mode)) {
                return 31;
            }
            return 0;
        },
        mayOpen(node, flags) {
            if (!node) {
                return 44;
            }
            if (FS.isLink(node.mode)) {
                return 32;
            } else if (FS.isDir(node.mode)) {
                if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
                    return 31;
                }
            }
            return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
        },
    };
}
