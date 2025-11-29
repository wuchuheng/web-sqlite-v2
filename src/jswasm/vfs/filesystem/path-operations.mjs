import { PATH } from "../../utils/path/path";
import { ERRNO_CODES } from "./constants/constants";

/**
 * Builds helpers for resolving and manipulating filesystem paths while keeping
 * the hash table that accelerates path lookups in sync.
 *
 * @param {import("./base-state.d.ts").MutableFS} FS
 * @param {import("./path-operations.d.ts").PathOperationsOptions} options
 * @returns {import("./path-operations.d.ts").PathOperations}
 */
export function createPathOperations(FS, { getPathFS }) {
    return {
        lookupPath(path, opts = {}) {
            const PATH_FS = getPathFS();
            path = PATH_FS.resolve(path);
            if (!path) return { path: "", node: null };
            const defaults = {
                follow_mount: true,
                recurse_count: 0,
            };
            opts = Object.assign(defaults, opts);
            if (opts.recurse_count > 8) {
                throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
            }
            const parts = path.split("/").filter((p) => !!p);
            let current = FS.root;
            let currentPath = "/";
            for (let i = 0; i < parts.length; i++) {
                const isLast = i === parts.length - 1;
                if (isLast && opts.parent) {
                    break;
                }
                current = FS.lookupNode(current, parts[i]);
                currentPath = PATH.join2(currentPath, parts[i]);
                if (FS.isMountpoint(current)) {
                    if (!isLast || (isLast && opts.follow_mount)) {
                        current = current.mounted.root;
                    }
                }
                if (!isLast || opts.follow) {
                    let count = 0;
                    while (FS.isLink(current.mode)) {
                        const link = FS.readlink(currentPath);
                        currentPath = PATH_FS.resolve(
                            PATH.dirname(currentPath),
                            link,
                        );
                        const lookup = FS.lookupPath(currentPath, {
                            recurse_count: opts.recurse_count + 1,
                        });
                        current = lookup.node;
                        if (count++ > 40) {
                            throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
                        }
                    }
                }
            }
            return { path: currentPath, node: current };
        },
        getPath(node) {
            let path;
            while (true) {
                if (FS.isRoot(node)) {
                    const mount = node.mount.mountpoint;
                    if (!path) return mount;
                    return mount[mount.length - 1] !== "/"
                        ? `${mount}/${path}`
                        : mount + path;
                }
                path = path ? `${node.name}/${path}` : node.name;
                node = node.parent;
            }
        },
        hashName(parentid, name) {
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
            }
            return ((parentid + hash) >>> 0) % FS.nameTable.length;
        },
        hashAddNode(node) {
            const hash = FS.hashName(node.parent.id, node.name);
            node.name_next = FS.nameTable[hash];
            FS.nameTable[hash] = node;
        },
        hashRemoveNode(node) {
            const hash = FS.hashName(node.parent.id, node.name);
            if (FS.nameTable[hash] === node) {
                FS.nameTable[hash] = node.name_next;
            } else {
                let current = FS.nameTable[hash];
                while (current) {
                    if (current.name_next === node) {
                        current.name_next = node.name_next;
                        break;
                    }
                    current = current.name_next;
                }
            }
        },
        lookupNode(parent, name) {
            const errCode = FS.mayLookup(parent);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            const hash = FS.hashName(parent.id, name);
            for (let node = FS.nameTable[hash]; node; node = node.name_next) {
                if (node.parent.id === parent.id && node.name === name) {
                    return node;
                }
            }
            return FS.lookup(parent, name);
        },
        createNode(parent, name, mode, rdev) {
            const node = new FS.FSNode(parent, name, mode, rdev).assignId(FS);
            FS.hashAddNode(node);
            return node;
        },
        destroyNode(node) {
            FS.hashRemoveNode(node);
        },
        isRoot(node) {
            return node === node.parent;
        },
        isMountpoint(node) {
            return !!node.mounted;
        },
    };
}
