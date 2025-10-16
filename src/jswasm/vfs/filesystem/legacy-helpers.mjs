import { PATH } from "../../utils/path.mjs";
import {
    DEVICE_MAJOR_BASE,
    ERRNO_CODES,
    MODE,
    OPEN_FLAGS,
} from "./constants.mjs";

/**
 * Restores legacy compatibility helpers that mirror historical FS APIs used by
 * older Emscripten callers while delegating work to the modern helpers.
 *
 * @param {import("./types.d.ts").MutableFS} FS
 * @param {{ FS_getMode: (canRead: boolean, canWrite: boolean) => number }} options
 * @returns {{
 *   findObject(path: string, dontResolveLastLink?: boolean): import("./types.d.ts").FSNode | null,
 *   analyzePath(
 *     path: string,
 *     dontResolveLastLink?: boolean
 *   ): {
 *     isRoot: boolean,
 *     exists: boolean,
 *     error: number,
 *     name: string | null,
 *     path: string | null,
 *     object: import("./types.d.ts").FSNode | null,
 *     parentExists: boolean,
 *     parentPath: string | null,
 *     parentObject: import("./types.d.ts").FSNode | null,
 *   },
 *   createPath(
 *     parent: string | import("./types.d.ts").FSNode,
 *     path: string,
 *     _canRead?: boolean,
 *     _canWrite?: boolean
 *   ): string,
 *   createFile(
 *     parent: string | import("./types.d.ts").FSNode,
 *     name: string,
 *     _properties: unknown,
 *     canRead: boolean,
 *     canWrite: boolean
 *   ): import("./types.d.ts").FSNode,
 *   createDataFile(
 *     parent: string | import("./types.d.ts").FSNode | null,
 *     name: string,
 *     data: string | ArrayLike<number> | null,
 *     canRead: boolean,
 *     canWrite: boolean,
 *     canOwn?: boolean
 *   ): void,
 *   createDevice(
 *     parent: string | import("./types.d.ts").FSNode,
 *     name: string,
 *     input?: (() => number | null | undefined) | null,
 *     output?: ((value: number) => void) | null
 *   ): import("./types.d.ts").FSNode,
 *   forceLoadFile(obj: import("./types.d.ts").FSNode): boolean,
 *   createLazyFile(): never,
 * }}
 */
export function createLegacyHelpers(FS, { FS_getMode }) {
    return {
        findObject(path, dontResolveLastLink) {
            const ret = FS.analyzePath(path, dontResolveLastLink);
            if (!ret.exists) {
                return null;
            }
            return ret.object;
        },
        analyzePath(path, dontResolveLastLink) {
            try {
                const lookup = FS.lookupPath(path, {
                    follow: !dontResolveLastLink,
                });
                path = lookup.path;
            } catch (_e) {}
            const ret = {
                isRoot: false,
                exists: false,
                error: 0,
                name: null,
                path: null,
                object: null,
                parentExists: false,
                parentPath: null,
                parentObject: null,
            };
            try {
                let lookup = FS.lookupPath(path, { parent: true });
                ret.parentExists = true;
                ret.parentPath = lookup.path;
                ret.parentObject = lookup.node;
                ret.name = PATH.basename(path);
                lookup = FS.lookupPath(path, {
                    follow: !dontResolveLastLink,
                });
                ret.exists = true;
                ret.path = lookup.path;
                ret.object = lookup.node;
                ret.name = lookup.node.name;
                ret.isRoot = lookup.path === "/";
            } catch (e) {
                ret.error = e.errno;
            }
            return ret;
        },
        createPath(parent, path, _canRead, _canWrite) {
            parent = typeof parent == "string" ? parent : FS.getPath(parent);
            const parts = path.split("/").reverse();
            let current = parent;
            while (parts.length) {
                const part = parts.pop();
                if (!part) continue;
                current = PATH.join2(parent, part);
                try {
                    FS.mkdir(current);
                } catch (_e) {}
                parent = current;
            }
            return current;
        },
        createFile(parent, name, _properties, canRead, canWrite) {
            const path = PATH.join2(
                typeof parent == "string" ? parent : FS.getPath(parent),
                name
            );
            const mode = FS_getMode(canRead, canWrite);
            return FS.create(path, mode);
        },
        createDataFile(parent, name, data, canRead, canWrite, canOwn) {
            let path = name;
            if (parent) {
                parent = typeof parent == "string" ? parent : FS.getPath(parent);
                path = name ? PATH.join2(parent, name) : parent;
            }
            const mode = FS_getMode(canRead, canWrite);
            const node = FS.create(path, mode);
            if (data) {
                if (typeof data == "string") {
                    const arr = new Array(data.length);
                    for (let i = 0, len = data.length; i < len; ++i)
                        arr[i] = data.charCodeAt(i);
                    data = arr;
                }
                FS.chmod(node, mode | MODE.PERMISSION_WRITE);
                const stream = FS.open(
                    node,
                    OPEN_FLAGS.O_WRONLY | OPEN_FLAGS.O_CREAT | OPEN_FLAGS.O_TRUNC
                );
                FS.write(stream, data, 0, data.length, 0, canOwn);
                FS.close(stream);
                FS.chmod(node, mode);
            }
        },
        createDevice(parent, name, input, output) {
            const path = PATH.join2(
                typeof parent == "string" ? parent : FS.getPath(parent),
                name
            );
            const mode = FS_getMode(!!input, !!output);
            FS.createDevice.major ??= DEVICE_MAJOR_BASE;
            const dev = FS.makedev(FS.createDevice.major++, 0);
            FS.registerDevice(dev, {
                open(stream) {
                    stream.seekable = false;
                },
                close(_stream) {
                    if (output?.buffer?.length) {
                        output(0x0a);
                    }
                },
                read(stream, buffer, offset, length) {
                    let bytesRead = 0;
                    for (let i = 0; i < length; i++) {
                        let result;
                        try {
                            result = input();
                        } catch (_e) {
                            throw new FS.ErrnoError(ERRNO_CODES.EIO);
                        }
                        if (result === undefined && bytesRead === 0) {
                            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
                        }
                        if (result === null || result === undefined) break;
                        bytesRead++;
                        buffer[offset + i] = result;
                    }
                    if (bytesRead) {
                        stream.node.timestamp = Date.now();
                    }
                    return bytesRead;
                },
                write(stream, buffer, offset, length) {
                    for (let i = 0; i < length; i++) {
                        try {
                            output(buffer[offset + i]);
                        } catch (_e) {
                            throw new FS.ErrnoError(ERRNO_CODES.EIO);
                        }
                    }
                    if (length) {
                        stream.node.timestamp = Date.now();
                    }
                    return length;
                },
            });
            return FS.mkdev(path, mode, dev);
        },
        forceLoadFile(obj) {
            if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
                return true;
            if (typeof XMLHttpRequest != "undefined") {
                throw new Error(
                    "Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread."
                );
            }
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
        },
        createLazyFile() {
            throw new Error(
                "createLazyFile is deprecated. Use --embed-file or --preload-file in emcc."
            );
        },
    };
}
