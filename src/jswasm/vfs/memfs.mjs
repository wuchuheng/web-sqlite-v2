/**
 * MEMFS - In-Memory File System Implementation
 *
 * This module provides a complete in-memory file system implementation
 * for use with Emscripten/WebAssembly SQLite3.
 */

/** File system constants. */
const FS_CONSTANTS = {
    /** Directory mode (16384 = S_IFDIR). */
    DIR_MODE: 16384,
    /** All permissions (511 = 0777 octal). */
    ALL_PERMISSIONS: 511,
    /** Symbolic link mode (40960 = S_IFLNK). */
    SYMLINK_MODE: 40960,
    /** Default directory size. */
    DIR_SIZE: 4096,
    /** Minimum file capacity. */
    MIN_CAPACITY: 256,
    /** Capacity doubling maximum (1MB). */
    CAPACITY_DOUBLING_MAX: 1024 * 1024,
    /** Growth factor below threshold. */
    GROWTH_FACTOR_LOW: 2.0,
    /** Growth factor above threshold. */
    GROWTH_FACTOR_HIGH: 1.125,
    /** Efficient copy threshold. */
    EFFICIENT_COPY_THRESHOLD: 8,
};

/** Seek modes for llseek operation. */
const SEEK_MODE = {
    /** SEEK_SET: Set position to offset. */
    SET: 0,
    /** SEEK_CUR: Set position to current + offset. */
    CUR: 1,
    /** SEEK_END: Set position to end + offset. */
    END: 2,
};

/** Memory mapping flags. */
const MMAP_FLAGS = {
    /** MAP_PRIVATE flag. */
    MAP_PRIVATE: 2,
};

/**
 * Creates and returns the MEMFS file system implementation.
 * @param {Object} FS - The file system module reference
 * @param {Object} HEAP8 - WebAssembly heap reference for Int8Array
 * @param {Function} mmapAlloc - Memory allocation function for mmap
 * @param {Function} _zeroMemory - Function to zero memory regions (unused)
 * @returns {Object} MEMFS implementation object
 */
export function createMEMFS(FS, HEAP8, mmapAlloc, _zeroMemory) {
    const MEMFS = {
        ops_table: null,

        /**
         * Mounts the MEMFS file system.
         * @param {Object} _mount - Mount configuration (unused)
         * @returns {Object} Root node of the file system
         */
        mount(_mount) {
            return MEMFS.createNode(
                null,
                "/",
                FS_CONSTANTS.DIR_MODE | FS_CONSTANTS.ALL_PERMISSIONS,
                0
            );
        },

        /**
         * Creates a new file system node.
         * @param {Object} parent - Parent node
         * @param {string} name - Node name
         * @param {number} mode - File mode/permissions
         * @param {number} dev - Device number
         * @returns {Object} Created node
         */
        createNode(parent, name, mode, dev) {
            // 1. Input handling
            if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
                throw new FS.ErrnoError(63);
            }

            // 2. Core processing
            if (!MEMFS.ops_table) {
                MEMFS.ops_table = {
                    dir: {
                        node: {
                            getattr: MEMFS.node_ops.getattr,
                            setattr: MEMFS.node_ops.setattr,
                            lookup: MEMFS.node_ops.lookup,
                            mknod: MEMFS.node_ops.mknod,
                            rename: MEMFS.node_ops.rename,
                            unlink: MEMFS.node_ops.unlink,
                            rmdir: MEMFS.node_ops.rmdir,
                            readdir: MEMFS.node_ops.readdir,
                            symlink: MEMFS.node_ops.symlink,
                        },
                        stream: {
                            llseek: MEMFS.stream_ops.llseek,
                        },
                    },
                    file: {
                        node: {
                            getattr: MEMFS.node_ops.getattr,
                            setattr: MEMFS.node_ops.setattr,
                        },
                        stream: {
                            llseek: MEMFS.stream_ops.llseek,
                            read: MEMFS.stream_ops.read,
                            write: MEMFS.stream_ops.write,
                            allocate: MEMFS.stream_ops.allocate,
                            mmap: MEMFS.stream_ops.mmap,
                            msync: MEMFS.stream_ops.msync,
                        },
                    },
                    link: {
                        node: {
                            getattr: MEMFS.node_ops.getattr,
                            setattr: MEMFS.node_ops.setattr,
                            readlink: MEMFS.node_ops.readlink,
                        },
                        stream: {},
                    },
                    chrdev: {
                        node: {
                            getattr: MEMFS.node_ops.getattr,
                            setattr: MEMFS.node_ops.setattr,
                        },
                        stream: FS.chrdev_stream_ops,
                    },
                };
            }

            const node = FS.createNode(parent, name, mode, dev);

            if (FS.isDir(node.mode)) {
                node.node_ops = MEMFS.ops_table.dir.node;
                node.stream_ops = MEMFS.ops_table.dir.stream;
                node.contents = {};
            } else if (FS.isFile(node.mode)) {
                node.node_ops = MEMFS.ops_table.file.node;
                node.stream_ops = MEMFS.ops_table.file.stream;
                node.usedBytes = 0;
                node.contents = null;
            } else if (FS.isLink(node.mode)) {
                node.node_ops = MEMFS.ops_table.link.node;
                node.stream_ops = MEMFS.ops_table.link.stream;
            } else if (FS.isChrdev(node.mode)) {
                node.node_ops = MEMFS.ops_table.chrdev.node;
                node.stream_ops = MEMFS.ops_table.chrdev.stream;
            }

            node.timestamp = Date.now();

            // 3. Output handling
            if (parent) {
                parent.contents[name] = node;
                parent.timestamp = node.timestamp;
            }
            return node;
        },

        /**
         * Gets file data as a typed array.
         * @param {Object} node - File node
         * @returns {Uint8Array} File contents as typed array
         */
        getFileDataAsTypedArray(node) {
            if (!node.contents) return new Uint8Array(0);
            if (node.contents.subarray)
                return node.contents.subarray(0, node.usedBytes);
            return new Uint8Array(node.contents);
        },

        /**
         * Expands file storage capacity.
         * @param {Object} node - File node
         * @param {number} newCapacity - New capacity in bytes
         */
        expandFileStorage(node, newCapacity) {
            // 1. Input handling
            const prevCapacity = node.contents ? node.contents.length : 0;
            if (prevCapacity >= newCapacity) return;

            // 2. Core processing
            newCapacity = Math.max(
                newCapacity,
                (prevCapacity *
                    (prevCapacity < FS_CONSTANTS.CAPACITY_DOUBLING_MAX
                        ? FS_CONSTANTS.GROWTH_FACTOR_LOW
                        : FS_CONSTANTS.GROWTH_FACTOR_HIGH)) >>>
                    0
            );
            if (prevCapacity !== 0)
                newCapacity = Math.max(newCapacity, FS_CONSTANTS.MIN_CAPACITY);

            const oldContents = node.contents;
            node.contents = new Uint8Array(newCapacity);

            // 3. Output handling
            if (node.usedBytes > 0)
                node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
        },

        /**
         * Resizes file storage to exact size.
         * @param {Object} node - File node
         * @param {number} newSize - New size in bytes
         */
        resizeFileStorage(node, newSize) {
            // 1. Input handling
            if (node.usedBytes === newSize) return;

            // 2. Core processing
            if (newSize === 0) {
                node.contents = null;
                node.usedBytes = 0;
            } else {
                const oldContents = node.contents;
                node.contents = new Uint8Array(newSize);
                if (oldContents) {
                    node.contents.set(
                        oldContents.subarray(
                            0,
                            Math.min(newSize, node.usedBytes)
                        )
                    );
                }
                node.usedBytes = newSize;
            }
        },

        node_ops: {
            /**
             * Gets file attributes.
             * @param {Object} node - File node
             * @returns {Object} File attributes
             */
            getattr(node) {
                // 1. Input handling
                const attr = {};

                // 2. Core processing
                attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
                attr.ino = node.id;
                attr.mode = node.mode;
                attr.nlink = 1;
                attr.uid = 0;
                attr.gid = 0;
                attr.rdev = node.rdev;

                if (FS.isDir(node.mode)) {
                    attr.size = FS_CONSTANTS.DIR_SIZE;
                } else if (FS.isFile(node.mode)) {
                    attr.size = node.usedBytes;
                } else if (FS.isLink(node.mode)) {
                    attr.size = node.link.length;
                } else {
                    attr.size = 0;
                }

                attr.atime = new Date(node.timestamp);
                attr.mtime = new Date(node.timestamp);
                attr.ctime = new Date(node.timestamp);
                attr.blksize = FS_CONSTANTS.DIR_SIZE;
                attr.blocks = Math.ceil(attr.size / attr.blksize);

                // 3. Output handling
                return attr;
            },

            /**
             * Sets file attributes.
             * @param {Object} node - File node
             * @param {Object} attr - Attributes to set
             */
            setattr(node, attr) {
                if (attr.mode !== undefined) {
                    node.mode = attr.mode;
                }
                if (attr.timestamp !== undefined) {
                    node.timestamp = attr.timestamp;
                }
                if (attr.size !== undefined) {
                    MEMFS.resizeFileStorage(node, attr.size);
                }
            },

            /**
             * Looks up a child node (throws error - not found).
             * @param {Object} _parent - Parent node
             * @param {string} _name - Child name
             * @throws {FS.ErrnoError} Always throws not found error
             */
            lookup(_parent, _name) {
                throw FS.genericErrors[44];
            },

            /**
             * Creates a new node.
             * @param {Object} parent - Parent node
             * @param {string} name - Node name
             * @param {number} mode - File mode
             * @param {number} dev - Device number
             * @returns {Object} Created node
             */
            mknod(parent, name, mode, dev) {
                return MEMFS.createNode(parent, name, mode, dev);
            },

            /**
             * Renames a node.
             * @param {Object} old_node - Node to rename
             * @param {Object} new_dir - New parent directory
             * @param {string} new_name - New name
             */
            rename(old_node, new_dir, new_name) {
                // 1. Input handling
                if (FS.isDir(old_node.mode)) {
                    let new_node;
                    try {
                        new_node = FS.lookupNode(new_dir, new_name);
                    } catch (_e) {}

                    if (new_node) {
                        for (const _key in new_node.contents) {
                            throw new FS.ErrnoError(55);
                        }
                    }
                }

                // 2. Core processing
                delete old_node.parent.contents[old_node.name];
                old_node.parent.timestamp = Date.now();
                old_node.name = new_name;
                new_dir.contents[new_name] = old_node;
                new_dir.timestamp = old_node.parent.timestamp;
            },

            /**
             * Unlinks (deletes) a file.
             * @param {Object} parent - Parent directory
             * @param {string} name - File name to delete
             */
            unlink(parent, name) {
                delete parent.contents[name];
                parent.timestamp = Date.now();
            },

            /**
             * Removes a directory.
             * @param {Object} parent - Parent directory
             * @param {string} name - Directory name to remove
             */
            rmdir(parent, name) {
                // 1. Input handling
                const node = FS.lookupNode(parent, name);
                for (const _key in node.contents) {
                    throw new FS.ErrnoError(55);
                }

                // 2. Core processing
                delete parent.contents[name];
                parent.timestamp = Date.now();
            },

            /**
             * Reads directory contents.
             * @param {Object} node - Directory node
             * @returns {Array} Directory entries
             */
            readdir(node) {
                // 1. Input handling
                const entries = [".", ".."];

                // 2. Core processing
                for (const key of Object.keys(node.contents)) {
                    entries.push(key);
                }

                // 3. Output handling
                return entries;
            },

            /**
             * Creates a symbolic link.
             * @param {Object} parent - Parent directory
             * @param {string} newname - Link name
             * @param {string} oldpath - Target path
             * @returns {Object} Created link node
             */
            symlink(parent, newname, oldpath) {
                const node = MEMFS.createNode(
                    parent,
                    newname,
                    FS_CONSTANTS.ALL_PERMISSIONS | FS_CONSTANTS.SYMLINK_MODE,
                    0
                );
                node.link = oldpath;
                return node;
            },

            /**
             * Reads a symbolic link target.
             * @param {Object} node - Link node
             * @returns {string} Link target path
             */
            readlink(node) {
                if (!FS.isLink(node.mode)) {
                    throw new FS.ErrnoError(28);
                }
                return node.link;
            },
        },

        stream_ops: {
            /**
             * Reads data from a file stream.
             * @param {Object} stream - File stream
             * @param {Uint8Array} buffer - Buffer to read into
             * @param {number} offset - Buffer offset
             * @param {number} length - Bytes to read
             * @param {number} position - File position
             * @returns {number} Bytes actually read
             */
            read(stream, buffer, offset, length, position) {
                // 1. Input handling
                const contents = stream.node.contents;
                if (position >= stream.node.usedBytes) return 0;

                // 2. Core processing
                const size = Math.min(stream.node.usedBytes - position, length);
                if (
                    size > FS_CONSTANTS.EFFICIENT_COPY_THRESHOLD &&
                    contents.subarray
                ) {
                    buffer.set(
                        contents.subarray(position, position + size),
                        offset
                    );
                } else {
                    for (let i = 0; i < size; i++)
                        buffer[offset + i] = contents[position + i];
                }

                // 3. Output handling
                return size;
            },

            /**
             * Writes data to a file stream.
             * @param {Object} stream - File stream
             * @param {Uint8Array} buffer - Buffer to write from
             * @param {number} offset - Buffer offset
             * @param {number} length - Bytes to write
             * @param {number} position - File position
             * @param {boolean} canOwn - Whether buffer can be owned
             * @returns {number} Bytes actually written
             */
            write(stream, buffer, offset, length, position, canOwn) {
                // 1. Input handling
                if (buffer.buffer === HEAP8.buffer) {
                    canOwn = false;
                }
                if (!length) return 0;

                const node = stream.node;
                node.timestamp = Date.now();

                // 2. Core processing
                if (
                    buffer.subarray &&
                    (!node.contents || node.contents.subarray)
                ) {
                    if (canOwn) {
                        node.contents = buffer.subarray(
                            offset,
                            offset + length
                        );
                        node.usedBytes = length;
                        return length;
                    } else if (node.usedBytes === 0 && position === 0) {
                        node.contents = buffer.slice(offset, offset + length);
                        node.usedBytes = length;
                        return length;
                    } else if (position + length <= node.usedBytes) {
                        node.contents.set(
                            buffer.subarray(offset, offset + length),
                            position
                        );
                        return length;
                    }
                }

                MEMFS.expandFileStorage(node, position + length);
                if (node.contents.subarray && buffer.subarray) {
                    node.contents.set(
                        buffer.subarray(offset, offset + length),
                        position
                    );
                } else {
                    for (let i = 0; i < length; i++) {
                        node.contents[position + i] = buffer[offset + i];
                    }
                }

                // 3. Output handling
                node.usedBytes = Math.max(node.usedBytes, position + length);
                return length;
            },

            /**
             * Seeks to a position in the file.
             * @param {Object} stream - File stream
             * @param {number} offset - Seek offset
             * @param {number} whence - Seek mode (0=set, 1=cur, 2=end)
             * @returns {number} New position
             */
            llseek(stream, offset, whence) {
                // 1. Input handling
                let position = offset;
                if (whence === SEEK_MODE.CUR) {
                    position += stream.position;
                } else if (whence === SEEK_MODE.END) {
                    if (FS.isFile(stream.node.mode)) {
                        position += stream.node.usedBytes;
                    }
                }

                // 2. Core processing
                if (position < 0) {
                    throw new FS.ErrnoError(28);
                }

                // 3. Output handling
                return position;
            },

            /**
             * Allocates space for a file.
             * @param {Object} stream - File stream
             * @param {number} offset - Allocation offset
             * @param {number} length - Allocation length
             */
            allocate(stream, offset, length) {
                MEMFS.expandFileStorage(stream.node, offset + length);
                stream.node.usedBytes = Math.max(
                    stream.node.usedBytes,
                    offset + length
                );
            },

            /**
             * Memory maps a file.
             * @param {Object} stream - File stream
             * @param {number} length - Map length
             * @param {number} position - File position
             * @param {number} prot - Protection flags
             * @param {number} flags - Mapping flags
             * @returns {Object} Memory mapping result
             */
            mmap(stream, length, position, prot, flags) {
                // 1. Input handling
                if (!FS.isFile(stream.node.mode)) {
                    throw new FS.ErrnoError(43);
                }

                let ptr;
                let allocated;
                let contents = stream.node.contents;

                // 2. Core processing
                if (
                    !(flags & MMAP_FLAGS.MAP_PRIVATE) &&
                    contents &&
                    contents.buffer === HEAP8.buffer
                ) {
                    allocated = false;
                    ptr = contents.byteOffset;
                } else {
                    allocated = true;
                    ptr = mmapAlloc(length);
                    if (!ptr) {
                        throw new FS.ErrnoError(48);
                    }
                    if (contents) {
                        if (
                            position > 0 ||
                            position + length < contents.length
                        ) {
                            if (contents.subarray) {
                                contents = contents.subarray(
                                    position,
                                    position + length
                                );
                            } else {
                                contents = Array.prototype.slice.call(
                                    contents,
                                    position,
                                    position + length
                                );
                            }
                        }
                        HEAP8.set(contents, ptr);
                    }
                }

                // 3. Output handling
                return { ptr, allocated };
            },

            /**
             * Synchronizes memory-mapped file.
             * @param {Object} stream - File stream
             * @param {Uint8Array} buffer - Buffer to sync
             * @param {number} offset - Buffer offset
             * @param {number} length - Length to sync
             * @param {number} _mmapFlags - Memory mapping flags (unused)
             * @returns {number} Success status (0)
             */
            msync(stream, buffer, offset, length, _mmapFlags) {
                MEMFS.stream_ops.write(
                    stream,
                    buffer,
                    0,
                    length,
                    offset,
                    false
                );
                return 0;
            },
        },
    };

    return MEMFS;
}
