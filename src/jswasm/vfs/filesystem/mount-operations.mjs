import { PATH } from "../../utils/path.mjs";

export function createMountOperations(FS, { err }) {
    return {
        getMounts(mount) {
            const mounts = [];
            const check = [mount];
            while (check.length) {
                const m = check.pop();
                mounts.push(m);
                check.push(...m.mounts);
            }
            return mounts;
        },
        syncfs(populate, callback) {
            if (typeof populate == "function") {
                callback = populate;
                populate = false;
            }
            FS.syncFSRequests++;
            if (FS.syncFSRequests > 1) {
                err(
                    `warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`
                );
            }
            const mounts = FS.getMounts(FS.root.mount);
            let completed = 0;
            const doCallback = (errCode) => {
                FS.syncFSRequests--;
                return callback(errCode);
            };
            const done = (errCode) => {
                if (errCode) {
                    if (!done.errored) {
                        done.errored = true;
                        return doCallback(errCode);
                    }
                    return;
                }
                if (++completed >= mounts.length) {
                    doCallback(null);
                }
            };
            mounts.forEach((mount) => {
                if (!mount.type.syncfs) {
                    return done(null);
                }
                mount.type.syncfs(mount, populate, done);
            });
        },
        mount(type, opts, mountpoint) {
            const root = mountpoint === "/";
            const pseudo = !mountpoint;
            let node;
            if (root && FS.root) {
                throw new FS.ErrnoError(10);
            } else if (!root && !pseudo) {
                const lookup = FS.lookupPath(mountpoint, {
                    follow_mount: false,
                });
                mountpoint = lookup.path;
                node = lookup.node;
                if (FS.isMountpoint(node)) {
                    throw new FS.ErrnoError(10);
                }
                if (!FS.isDir(node.mode)) {
                    throw new FS.ErrnoError(54);
                }
            }
            const mount = {
                type,
                opts,
                mountpoint,
                mounts: [],
            };
            const mountRoot = type.mount(mount);
            mountRoot.mount = mount;
            mount.root = mountRoot;
            if (root) {
                FS.root = mountRoot;
            } else if (node) {
                node.mounted = mount;
                if (node.mount) {
                    node.mount.mounts.push(mount);
                }
            }
            return mountRoot;
        },
        unmount(mountpoint) {
            const lookup = FS.lookupPath(mountpoint, { follow_mount: false });
            if (!FS.isMountpoint(lookup.node)) {
                throw new FS.ErrnoError(28);
            }
            const node = lookup.node;
            const mount = node.mounted;
            const mounts = FS.getMounts(mount);
            Object.keys(FS.nameTable).forEach((hash) => {
                let current = FS.nameTable[hash];
                while (current) {
                    const next = current.name_next;
                    if (mounts.includes(current.mount)) {
                        FS.destroyNode(current);
                    }
                    current = next;
                }
            });
            node.mounted = null;
            const idx = node.mount.mounts.indexOf(mount);
            node.mount.mounts.splice(idx, 1);
        },
        lookup(parent, name) {
            return parent.node_ops.lookup(parent, name);
        },
        mknod(path, mode, dev) {
            const lookup = FS.lookupPath(path, { parent: true });
            const parent = lookup.node;
            const name = PATH.basename(path);
            if (!name || name === "." || name === "..") {
                throw new FS.ErrnoError(28);
            }
            const errCode = FS.mayCreate(parent, name);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            if (!parent.node_ops.mknod) {
                throw new FS.ErrnoError(63);
            }
            return parent.node_ops.mknod(parent, name, mode, dev);
        },
    };
}
