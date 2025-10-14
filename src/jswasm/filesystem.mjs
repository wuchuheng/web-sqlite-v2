/**
 * @fileoverview Virtual File System (FS) implementation for SQLite3 WebAssembly
 *
 * This module provides a complete POSIX-like file system abstraction that runs
 * in memory. It supports:
 * - Directory and file operations (create, read, write, delete, rename)
 * - Symbolic links and device files
 * - Stream operations with seeking and memory mapping
 * - Permission checks and error handling
 * - Mount points for different file system types
 *
 * The FS is used by the SQLite3 WASM module to provide file I/O operations
 * for both in-memory databases and persistent OPFS-backed storage.
 */

import { PATH, createPathFS } from "./utils/path.mjs";
import {
    UTF8ArrayToString,
    lengthBytesUTF8,
    stringToUTF8Array,
} from "./utils/utf8.mjs";

/**
 * Creates and returns the FS (File System) object with all its methods and state.
 *
 * @param {Object} dependencies - Required dependencies for FS operations
 * @param {Function} dependencies.FS_createPreloadedFile - Function to create preloaded files
 * @param {Function} dependencies.FS_createDataFile - Function to create data files
 * @param {Function} dependencies.FS_modeStringToFlags - Function to convert mode strings to flags
 * @param {Function} dependencies.FS_getMode - Function to get mode from permissions
 * @param {Object} dependencies.Module - Emscripten Module object
 * @param {Function} dependencies.out - Output function for logging
 * @param {Function} dependencies.err - Error output function
 * @returns {Object} The FS object with all file system operations
 */
export function createFS({
    FS_createPreloadedFile,
    FS_createDataFile: _FS_createDataFile,
    FS_modeStringToFlags,
    FS_getMode,
    Module,
    out: _out,
    err,
}) {
    const FS = {
        root: null,
        mounts: [],
        devices: {},
        streams: [],
        nextInode: 1,
        nameTable: null,
        currentPath: "/",
        initialized: false,
        ignorePermissions: true,

        /**
         * Custom error class for file system errors with errno codes
         */
        ErrnoError: class {
            /**
             * @param {number} errno - POSIX error number
             */
            constructor(errno) {
                this.name = "ErrnoError";
                this.errno = errno;
            }
        },

        genericErrors: {},
        filesystems: null,
        syncFSRequests: 0,
        readFiles: {},

        /**
         * Stream class representing an open file descriptor
         */
        FSStream: class {
            constructor() {
                this.shared = {};
            }
            get object() {
                return this.node;
            }
            set object(val) {
                this.node = val;
            }
            get isRead() {
                return (this.flags & 2097155) !== 1;
            }
            get isWrite() {
                return (this.flags & 2097155) !== 0;
            }
            get isAppend() {
                return this.flags & 1024;
            }
            get flags() {
                return this.shared.flags;
            }
            set flags(val) {
                this.shared.flags = val;
            }
            get position() {
                return this.shared.position;
            }
            set position(val) {
                this.shared.position = val;
            }
        },

        /**
         * Node class representing a file system entry (file, directory, symlink, device)
         */
        FSNode: class {
            /**
             * @param {FSNode|null} parent - Parent node
             * @param {string} name - Node name
             * @param {number} mode - File mode and permissions
             * @param {number} rdev - Device number (for device files)
             */
            constructor(parent, name, mode, rdev) {
                // 1. Handle root node case
                if (!parent) {
                    // eslint-disable-next-line @typescript-eslint/no-this-alias
                    parent = this;
                }

                // 2. Initialize node properties
                this.parent = parent;
                this.mount = parent.mount;
                this.mounted = null;
                this.id = FS.nextInode++;
                this.name = name;
                this.mode = mode;
                this.node_ops = {};
                this.stream_ops = {};
                this.rdev = rdev;
                this.readMode = 292 | 73;
                this.writeMode = 146;
            }

            get read() {
                return (this.mode & this.readMode) === this.readMode;
            }
            set read(val) {
                if (val) {
                    this.mode |= this.readMode;
                } else {
                    this.mode &= ~this.readMode;
                }
            }
            get write() {
                return (this.mode & this.writeMode) === this.writeMode;
            }
            set write(val) {
                if (val) {
                    this.mode |= this.writeMode;
                } else {
                    this.mode &= ~this.writeMode;
                }
            }
            get isFolder() {
                return FS.isDir(this.mode);
            }
            get isDevice() {
                return FS.isChrdev(this.mode);
            }
        },

        /**
         * Looks up a path and returns the node and resolved path.
         *
         * @param {string} path - Path to lookup
         * @param {Object} opts - Lookup options
         * @param {boolean} opts.follow_mount - Whether to follow mount points
         * @param {number} opts.recurse_count - Recursion depth counter
         * @param {boolean} opts.parent - Whether to return parent directory
         * @param {boolean} opts.follow - Whether to follow symlinks
         * @returns {Object} Object with {path, node} properties
         */
        lookupPath(path, opts = {}) {
            // 1. Resolve and validate path
            path = PATH_FS.resolve(path);
            if (!path) return { path: "", node: null };

            // 2. Set default options
            const defaults = {
                follow_mount: true,
                recurse_count: 0,
            };
            opts = Object.assign(defaults, opts);

            // 3. Check recursion limit
            if (opts.recurse_count > 8) {
                throw new FS.ErrnoError(32);
            }

            // 4. Split path into parts
            const parts = path.split("/").filter((p) => !!p);

            // 5. Traverse path components
            let current = FS.root;
            let current_path = "/";

            for (let i = 0; i < parts.length; i++) {
                const islast = i === parts.length - 1;
                if (islast && opts.parent) {
                    break;
                }

                current = FS.lookupNode(current, parts[i]);
                current_path = PATH.join2(current_path, parts[i]);

                if (FS.isMountpoint(current)) {
                    if (!islast || (islast && opts.follow_mount)) {
                        current = current.mounted.root;
                    }
                }

                if (!islast || opts.follow) {
                    let count = 0;
                    while (FS.isLink(current.mode)) {
                        const link = FS.readlink(current_path);
                        current_path = PATH_FS.resolve(
                            PATH.dirname(current_path),
                            link
                        );

                        const lookup = FS.lookupPath(current_path, {
                            recurse_count: opts.recurse_count + 1,
                        });
                        current = lookup.node;

                        if (count++ > 40) {
                            throw new FS.ErrnoError(32);
                        }
                    }
                }
            }

            // 6. Return result
            return { path: current_path, node: current };
        },

        /**
         * Gets the full path for a given node.
         *
         * @param {FSNode} node - File system node
         * @returns {string} Full path to the node
         */
        getPath(node) {
            // 1. Initialize path
            let path;

            // 2. Traverse up to root
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

        /**
         * Generates a hash for a node name within a parent directory.
         *
         * @param {number} parentid - Parent node ID
         * @param {string} name - Node name
         * @returns {number} Hash value
         */
        hashName(parentid, name) {
            // 1. Initialize hash
            let hash = 0;

            // 2. Calculate hash
            for (let i = 0; i < name.length; i++) {
                hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
            }

            // 3. Return hash
            return ((parentid + hash) >>> 0) % FS.nameTable.length;
        },

        /**
         * Adds a node to the name hash table.
         *
         * @param {FSNode} node - Node to add
         */
        hashAddNode(node) {
            const hash = FS.hashName(node.parent.id, node.name);
            node.name_next = FS.nameTable[hash];
            FS.nameTable[hash] = node;
        },

        /**
         * Removes a node from the name hash table.
         *
         * @param {FSNode} node - Node to remove
         */
        hashRemoveNode(node) {
            // 1. Calculate hash
            const hash = FS.hashName(node.parent.id, node.name);

            // 2. Remove from hash table
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

        /**
         * Looks up a node by name in a parent directory.
         *
         * @param {FSNode} parent - Parent directory node
         * @param {string} name - Name to look up
         * @returns {FSNode} Found node
         * @throws {FS.ErrnoError} If lookup fails or permission denied
         */
        lookupNode(parent, name) {
            // 1. Check permissions
            const errCode = FS.mayLookup(parent);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }

            // 2. Search hash table
            const hash = FS.hashName(parent.id, name);
            for (
                let node = FS.nameTable[hash];
                node;
                node = node.name_next
            ) {
                const nodeName = node.name;
                if (node.parent.id === parent.id && nodeName === name) {
                    return node;
                }
            }

            // 3. Fallback to node_ops.lookup
            return FS.lookup(parent, name);
        },

        /**
         * Creates a new file system node.
         *
         * @param {FSNode} parent - Parent directory
         * @param {string} name - Node name
         * @param {number} mode - File mode
         * @param {number} rdev - Device number
         * @returns {FSNode} Created node
         */
        createNode(parent, name, mode, rdev) {
            // 1. Create node
            const node = new FS.FSNode(parent, name, mode, rdev);

            // 2. Add to hash table
            FS.hashAddNode(node);

            // 3. Return node
            return node;
        },

        /**
         * Destroys a node and removes it from the hash table.
         *
         * @param {FSNode} node - Node to destroy
         */
        destroyNode(node) {
            FS.hashRemoveNode(node);
        },

        /**
         * Checks if a node is the root node.
         *
         * @param {FSNode} node - Node to check
         * @returns {boolean} True if node is root
         */
        isRoot(node) {
            return node === node.parent;
        },

        /**
         * Checks if a node is a mount point.
         *
         * @param {FSNode} node - Node to check
         * @returns {boolean} True if node is a mount point
         */
        isMountpoint(node) {
            return !!node.mounted;
        },

        /**
         * Checks if a mode represents a regular file.
         *
         * @param {number} mode - File mode
         * @returns {boolean} True if regular file
         */
        isFile(mode) {
            return (mode & 61440) === 32768;
        },

        /**
         * Checks if a mode represents a directory.
         *
         * @param {number} mode - File mode
         * @returns {boolean} True if directory
         */
        isDir(mode) {
            return (mode & 61440) === 16384;
        },

        /**
         * Checks if a mode represents a symbolic link.
         *
         * @param {number} mode - File mode
         * @returns {boolean} True if symbolic link
         */
        isLink(mode) {
            return (mode & 61440) === 40960;
        },

        /**
         * Checks if a mode represents a character device.
         *
         * @param {number} mode - File mode
         * @returns {boolean} True if character device
         */
        isChrdev(mode) {
            return (mode & 61440) === 8192;
        },

        /**
         * Checks if a mode represents a block device.
         *
         * @param {number} mode - File mode
         * @returns {boolean} True if block device
         */
        isBlkdev(mode) {
            return (mode & 61440) === 24576;
        },

        /**
         * Checks if a mode represents a FIFO.
         *
         * @param {number} mode - File mode
         * @returns {boolean} True if FIFO
         */
        isFIFO(mode) {
            return (mode & 61440) === 4096;
        },

        /**
         * Checks if a mode represents a socket.
         *
         * @param {number} mode - File mode
         * @returns {boolean} True if socket
         */
        isSocket(mode) {
            return (mode & 49152) === 49152;
        },

        /**
         * Converts flags to permission string.
         *
         * @param {number} flag - Flags value
         * @returns {string} Permission string ("r", "w", or "rw")
         */
        flagsToPermissionString(flag) {
            // 1. Get base permissions
            let perms = ["r", "w", "rw"][flag & 3];

            // 2. Add write flag if needed
            if (flag & 512) {
                perms += "w";
            }

            // 3. Return result
            return perms;
        },

        /**
         * Checks node permissions.
         *
         * @param {FSNode} node - Node to check
         * @param {string} perms - Required permissions ("r", "w", "x")
         * @returns {number} 0 if allowed, errno if denied
         */
        nodePermissions(node, perms) {
            // 1. Check if permissions are ignored
            if (FS.ignorePermissions) {
                return 0;
            }

            // 2. Check read permission
            if (perms.includes("r") && !(node.mode & 292)) {
                return 2;
            } else if (perms.includes("w") && !(node.mode & 146)) {
                return 2;
            } else if (perms.includes("x") && !(node.mode & 73)) {
                return 2;
            }

            // 3. Return success
            return 0;
        },

        /**
         * Checks if lookup is allowed in a directory.
         *
         * @param {FSNode} dir - Directory node
         * @returns {number} 0 if allowed, errno if denied
         */
        mayLookup(dir) {
            // 1. Check if directory
            if (!FS.isDir(dir.mode)) return 54;

            // 2. Check execute permission
            const errCode = FS.nodePermissions(dir, "x");
            if (errCode) return errCode;

            // 3. Check if lookup operation exists
            if (!dir.node_ops.lookup) return 2;

            // 4. Return success
            return 0;
        },

        /**
         * Checks if creation is allowed in a directory.
         *
         * @param {FSNode} dir - Directory node
         * @param {string} name - Name to create
         * @returns {number} 0 if allowed, errno if denied
         */
        mayCreate(dir, name) {
            // 1. Check if name already exists
            try {
                FS.lookupNode(dir, name);
                return 20;
            } catch (_e) {}

            // 2. Check write and execute permissions
            return FS.nodePermissions(dir, "wx");
        },

        /**
         * Checks if deletion is allowed.
         *
         * @param {FSNode} dir - Directory node
         * @param {string} name - Name to delete
         * @param {boolean} isdir - Whether target is a directory
         * @returns {number} 0 if allowed, errno if denied
         */
        mayDelete(dir, name, isdir) {
            // 1. Look up node
            let node;
            try {
                node = FS.lookupNode(dir, name);
            } catch (e) {
                return e.errno;
            }

            // 2. Check directory permissions
            const errCode = FS.nodePermissions(dir, "wx");
            if (errCode) {
                return errCode;
            }

            // 3. Check if deleting directory
            if (isdir) {
                if (!FS.isDir(node.mode)) {
                    return 54;
                }
                if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
                    return 10;
                }
            } else {
                if (FS.isDir(node.mode)) {
                    return 31;
                }
            }

            // 4. Return success
            return 0;
        },

        /**
         * Checks if opening a file is allowed.
         *
         * @param {FSNode} node - Node to open
         * @param {number} flags - Open flags
         * @returns {number} 0 if allowed, errno if denied
         */
        mayOpen(node, flags) {
            // 1. Check if node exists
            if (!node) {
                return 44;
            }

            // 2. Check if symlink
            if (FS.isLink(node.mode)) {
                return 32;
            } else if (FS.isDir(node.mode)) {
                if (
                    FS.flagsToPermissionString(flags) !== "r" ||
                    flags & 512
                ) {
                    return 31;
                }
            }

            // 3. Check node permissions
            return FS.nodePermissions(
                node,
                FS.flagsToPermissionString(flags)
            );
        },

        MAX_OPEN_FDS: 4096,

        /**
         * Gets the next available file descriptor.
         *
         * @returns {number} Next available fd
         * @throws {FS.ErrnoError} If no file descriptors available
         */
        nextfd() {
            // 1. Search for available fd
            for (let fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
                if (!FS.streams[fd]) {
                    return fd;
                }
            }

            // 2. Throw error if none available
            throw new FS.ErrnoError(33);
        },

        /**
         * Gets a stream by fd and throws if not found.
         *
         * @param {number} fd - File descriptor
         * @returns {FSStream} Stream object
         * @throws {FS.ErrnoError} If stream not found
         */
        getStreamChecked(fd) {
            // 1. Get stream
            const stream = FS.getStream(fd);

            // 2. Check if exists
            if (!stream) {
                throw new FS.ErrnoError(8);
            }

            // 3. Return stream
            return stream;
        },

        /**
         * Gets a stream by fd.
         *
         * @param {number} fd - File descriptor
         * @returns {FSStream|undefined} Stream object or undefined
         */
        getStream: (fd) => FS.streams[fd],

        /**
         * Creates a new stream.
         *
         * @param {Object} stream - Stream properties
         * @param {number} fd - File descriptor (-1 to auto-assign)
         * @returns {FSStream} Created stream
         */
        createStream(stream, fd = -1) {
            // 1. Create stream object
            stream = Object.assign(new FS.FSStream(), stream);

            // 2. Get fd if not specified
            if (fd == -1) {
                fd = FS.nextfd();
            }

            // 3. Assign fd and register
            stream.fd = fd;
            FS.streams[fd] = stream;

            // 4. Return stream
            return stream;
        },

        /**
         * Closes a stream.
         *
         * @param {number} fd - File descriptor
         */
        closeStream(fd) {
            FS.streams[fd] = null;
        },

        /**
         * Duplicates a stream.
         *
         * @param {FSStream} origStream - Original stream
         * @param {number} fd - File descriptor (-1 to auto-assign)
         * @returns {FSStream} Duplicated stream
         */
        dupStream(origStream, fd = -1) {
            // 1. Create duplicate stream
            const stream = FS.createStream(origStream, fd);

            // 2. Call dup operation if available
            stream.stream_ops?.dup?.(stream);

            // 3. Return stream
            return stream;
        },

        /**
         * Stream operations for character devices.
         */
        chrdev_stream_ops: {
            open(stream) {
                const device = FS.getDevice(stream.node.rdev);
                stream.stream_ops = device.stream_ops;
                stream.stream_ops.open?.(stream);
            },
            llseek() {
                throw new FS.ErrnoError(70);
            },
        },

        /**
         * Extracts major device number.
         *
         * @param {number} dev - Device number
         * @returns {number} Major number
         */
        major: (dev) => dev >> 8,

        /**
         * Extracts minor device number.
         *
         * @param {number} dev - Device number
         * @returns {number} Minor number
         */
        minor: (dev) => dev & 0xff,

        /**
         * Creates a device number from major and minor.
         *
         * @param {number} ma - Major number
         * @param {number} mi - Minor number
         * @returns {number} Device number
         */
        makedev: (ma, mi) => (ma << 8) | mi,

        /**
         * Registers a device.
         *
         * @param {number} dev - Device number
         * @param {Object} ops - Device operations
         */
        registerDevice(dev, ops) {
            FS.devices[dev] = { stream_ops: ops };
        },

        /**
         * Gets a device by number.
         *
         * @param {number} dev - Device number
         * @returns {Object} Device object
         */
        getDevice: (dev) => FS.devices[dev],

        /**
         * Gets all mount points under a given mount.
         *
         * @param {Object} mount - Mount point
         * @returns {Array} Array of mount points
         */
        getMounts(mount) {
            // 1. Initialize result
            const mounts = [];
            const check = [mount];

            // 2. Traverse mount tree
            while (check.length) {
                const m = check.pop();
                mounts.push(m);
                check.push(...m.mounts);
            }

            // 3. Return result
            return mounts;
        },

        /**
         * Synchronizes file system to persistent storage.
         *
         * @param {boolean} populate - Whether to populate from storage
         * @param {Function} callback - Completion callback
         */
        syncfs(populate, callback) {
            // 1. Handle function overload
            if (typeof populate == "function") {
                callback = populate;
                populate = false;
            }

            // 2. Increment sync counter
            FS.syncFSRequests++;

            // 3. Warn if multiple syncs in flight
            if (FS.syncFSRequests > 1) {
                err(
                    `warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`
                );
            }

            // 4. Get all mounts
            const mounts = FS.getMounts(FS.root.mount);
            let completed = 0;

            function doCallback(errCode) {
                FS.syncFSRequests--;
                return callback(errCode);
            }

            function done(errCode) {
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
            }

            // 5. Sync each mount
            mounts.forEach((mount) => {
                if (!mount.type.syncfs) {
                    return done(null);
                }
                mount.type.syncfs(mount, populate, done);
            });
        },

        /**
         * Mounts a file system at a path.
         *
         * @param {Object} type - File system type
         * @param {Object} opts - Mount options
         * @param {string} mountpoint - Mount path
         * @returns {FSNode} Root node of mounted file system
         * @throws {FS.ErrnoError} On mount errors
         */
        mount(type, opts, mountpoint) {
            // 1. Check if root or pseudo mount
            const root = mountpoint === "/";
            const pseudo = !mountpoint;
            let node;

            // 2. Validate mount point
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

            // 3. Create mount object
            const mount = {
                type,
                opts,
                mountpoint,
                mounts: [],
            };

            // 4. Mount file system
            const mountRoot = type.mount(mount);
            mountRoot.mount = mount;
            mount.root = mountRoot;

            // 5. Set as root or attach to tree
            if (root) {
                FS.root = mountRoot;
            } else if (node) {
                node.mounted = mount;

                if (node.mount) {
                    node.mount.mounts.push(mount);
                }
            }

            // 6. Return mount root
            return mountRoot;
        },

        /**
         * Unmounts a file system.
         *
         * @param {string} mountpoint - Mount path
         * @throws {FS.ErrnoError} If not a mount point
         */
        unmount(mountpoint) {
            // 1. Look up mount point
            const lookup = FS.lookupPath(mountpoint, { follow_mount: false });

            // 2. Verify it's a mount point
            if (!FS.isMountpoint(lookup.node)) {
                throw new FS.ErrnoError(28);
            }

            // 3. Get mount info
            const node = lookup.node;
            const mount = node.mounted;
            const mounts = FS.getMounts(mount);

            // 4. Destroy all nodes in the mount
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

            // 5. Clear mount
            node.mounted = null;

            // 6. Remove from parent's mount list
            const idx = node.mount.mounts.indexOf(mount);
            node.mount.mounts.splice(idx, 1);
        },

        /**
         * Looks up a node using node_ops.lookup.
         *
         * @param {FSNode} parent - Parent directory
         * @param {string} name - Name to look up
         * @returns {FSNode} Found node
         */
        lookup(parent, name) {
            return parent.node_ops.lookup(parent, name);
        },

        /**
         * Creates a node (device, file, directory, etc.).
         *
         * @param {string} path - Path for new node
         * @param {number} mode - File mode
         * @param {number} dev - Device number
         * @returns {FSNode} Created node
         * @throws {FS.ErrnoError} On creation errors
         */
        mknod(path, mode, dev) {
            // 1. Look up parent directory
            const lookup = FS.lookupPath(path, { parent: true });
            const parent = lookup.node;
            const name = PATH.basename(path);

            // 2. Validate name
            if (!name || name === "." || name === "..") {
                throw new FS.ErrnoError(28);
            }

            // 3. Check if creation is allowed
            const errCode = FS.mayCreate(parent, name);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }

            // 4. Check if mknod operation exists
            if (!parent.node_ops.mknod) {
                throw new FS.ErrnoError(63);
            }

            // 5. Create node
            return parent.node_ops.mknod(parent, name, mode, dev);
        },

        /**
         * Creates a file.
         *
         * @param {string} path - File path
         * @param {number} mode - File mode (default: 438)
         * @returns {FSNode} Created file node
         */
        create(path, mode) {
            // 1. Set default mode
            mode = mode !== undefined ? mode : 438;

            // 2. Mask mode and set file type
            mode &= 4095;
            mode |= 32768;

            // 3. Create node
            return FS.mknod(path, mode, 0);
        },

        /**
         * Creates a directory.
         *
         * @param {string} path - Directory path
         * @param {number} mode - Directory mode (default: 511)
         * @returns {FSNode} Created directory node
         */
        mkdir(path, mode) {
            // 1. Set default mode
            mode = mode !== undefined ? mode : 511;

            // 2. Mask mode and set directory type
            mode &= 511 | 512;
            mode |= 16384;

            // 3. Create node
            return FS.mknod(path, mode, 0);
        },

        /**
         * Creates a directory tree (like mkdir -p).
         *
         * @param {string} path - Directory path
         * @param {number} mode - Directory mode
         */
        mkdirTree(path, mode) {
            // 1. Split path
            const dirs = path.split("/");
            let d = "";

            // 2. Create each directory
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

        /**
         * Creates a device node.
         *
         * @param {string} path - Device path
         * @param {number} mode - Device mode (default: 438)
         * @param {number} dev - Device number
         * @returns {FSNode} Created device node
         */
        mkdev(path, mode, dev) {
            // 1. Handle parameter overload
            if (typeof dev == "undefined") {
                dev = mode;
                mode = 438;
            }

            // 2. Set character device type
            mode |= 8192;

            // 3. Create node
            return FS.mknod(path, mode, dev);
        },

        /**
         * Creates a symbolic link.
         *
         * @param {string} oldpath - Target path
         * @param {string} newpath - Link path
         * @returns {FSNode} Created symlink node
         * @throws {FS.ErrnoError} On creation errors
         */
        symlink(oldpath, newpath) {
            // 1. Validate old path
            if (!PATH_FS.resolve(oldpath)) {
                throw new FS.ErrnoError(44);
            }

            // 2. Look up parent directory
            const lookup = FS.lookupPath(newpath, { parent: true });
            const parent = lookup.node;
            if (!parent) {
                throw new FS.ErrnoError(44);
            }

            // 3. Get link name
            const newname = PATH.basename(newpath);

            // 4. Check if creation is allowed
            const errCode = FS.mayCreate(parent, newname);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }

            // 5. Check if symlink operation exists
            if (!parent.node_ops.symlink) {
                throw new FS.ErrnoError(63);
            }

            // 6. Create symlink
            return parent.node_ops.symlink(parent, newname, oldpath);
        },

        /**
         * Renames a file or directory.
         *
         * @param {string} old_path - Old path
         * @param {string} new_path - New path
         * @throws {FS.ErrnoError} On rename errors
         */
        rename(old_path, new_path) {
            // 1. Get directory names
            const old_dirname = PATH.dirname(old_path);
            const new_dirname = PATH.dirname(new_path);
            const old_name = PATH.basename(old_path);
            const new_name = PATH.basename(new_path);

            // 2. Look up directories
            let lookup, old_dir, new_dir;

            lookup = FS.lookupPath(old_path, { parent: true });
            old_dir = lookup.node;
            lookup = FS.lookupPath(new_path, { parent: true });
            new_dir = lookup.node;

            // 3. Validate directories
            if (!old_dir || !new_dir) throw new FS.ErrnoError(44);

            // 4. Check if on same mount
            if (old_dir.mount !== new_dir.mount) {
                throw new FS.ErrnoError(75);
            }

            // 5. Look up old node
            const old_node = FS.lookupNode(old_dir, old_name);

            // 6. Validate paths
            let relative = PATH_FS.relative(old_path, new_dirname);
            if (relative.charAt(0) !== ".") {
                throw new FS.ErrnoError(28);
            }

            relative = PATH_FS.relative(new_path, old_dirname);
            if (relative.charAt(0) !== ".") {
                throw new FS.ErrnoError(55);
            }

            // 7. Look up new node (may not exist)
            let new_node;
            try {
                new_node = FS.lookupNode(new_dir, new_name);
            } catch (_e) {}

            // 8. Check if same node
            if (old_node === new_node) {
                return;
            }

            // 9. Check permissions
            const isdir = FS.isDir(old_node.mode);
            let errCode = FS.mayDelete(old_dir, old_name, isdir);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }

            errCode = new_node
                ? FS.mayDelete(new_dir, new_name, isdir)
                : FS.mayCreate(new_dir, new_name);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }

            // 10. Check if rename operation exists
            if (!old_dir.node_ops.rename) {
                throw new FS.ErrnoError(63);
            }

            // 11. Check if mounted
            if (
                FS.isMountpoint(old_node) ||
                (new_node && FS.isMountpoint(new_node))
            ) {
                throw new FS.ErrnoError(10);
            }

            // 12. Check write permission on old directory
            if (new_dir !== old_dir) {
                errCode = FS.nodePermissions(old_dir, "w");
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
            }

            // 13. Remove from hash table
            FS.hashRemoveNode(old_node);

            // 14. Perform rename
            try {
                old_dir.node_ops.rename(old_node, new_dir, new_name);
                old_node.parent = new_dir;
            } finally {
                FS.hashAddNode(old_node);
            }
        },

        /**
         * Removes a directory.
         *
         * @param {string} path - Directory path
         * @throws {FS.ErrnoError} On removal errors
         */
        rmdir(path) {
            // 1. Look up parent directory
            const lookup = FS.lookupPath(path, { parent: true });
            const parent = lookup.node;
            const name = PATH.basename(path);

            // 2. Look up directory to remove
            const node = FS.lookupNode(parent, name);

            // 3. Check if deletion is allowed
            const errCode = FS.mayDelete(parent, name, true);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }

            // 4. Check if rmdir operation exists
            if (!parent.node_ops.rmdir) {
                throw new FS.ErrnoError(63);
            }

            // 5. Check if mounted
            if (FS.isMountpoint(node)) {
                throw new FS.ErrnoError(10);
            }

            // 6. Remove directory
            parent.node_ops.rmdir(parent, name);
            FS.destroyNode(node);
        },

        /**
         * Reads directory contents.
         *
         * @param {string} path - Directory path
         * @returns {Array<string>} Array of entry names
         * @throws {FS.ErrnoError} If not a directory or read fails
         */
        readdir(path) {
            // 1. Look up directory
            const lookup = FS.lookupPath(path, { follow: true });
            const node = lookup.node;

            // 2. Check if readdir operation exists
            if (!node.node_ops.readdir) {
                throw new FS.ErrnoError(54);
            }

            // 3. Read directory
            return node.node_ops.readdir(node);
        },

        /**
         * Removes a file.
         *
         * @param {string} path - File path
         * @throws {FS.ErrnoError} On removal errors
         */
        unlink(path) {
            // 1. Look up parent directory
            const lookup = FS.lookupPath(path, { parent: true });
            const parent = lookup.node;
            if (!parent) {
                throw new FS.ErrnoError(44);
            }

            // 2. Get file name
            const name = PATH.basename(path);

            // 3. Look up file
            const node = FS.lookupNode(parent, name);

            // 4. Check if deletion is allowed
            const errCode = FS.mayDelete(parent, name, false);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }

            // 5. Check if unlink operation exists
            if (!parent.node_ops.unlink) {
                throw new FS.ErrnoError(63);
            }

            // 6. Check if mounted
            if (FS.isMountpoint(node)) {
                throw new FS.ErrnoError(10);
            }

            // 7. Remove file
            parent.node_ops.unlink(parent, name);
            FS.destroyNode(node);
        },

        /**
         * Reads a symbolic link.
         *
         * @param {string} path - Symlink path
         * @returns {string} Target path
         * @throws {FS.ErrnoError} If not a symlink or read fails
         */
        readlink(path) {
            // 1. Look up symlink
            const lookup = FS.lookupPath(path);
            const link = lookup.node;

            // 2. Validate link
            if (!link) {
                throw new FS.ErrnoError(44);
            }

            // 3. Check if readlink operation exists
            if (!link.node_ops.readlink) {
                throw new FS.ErrnoError(28);
            }

            // 4. Read link
            return PATH_FS.resolve(
                FS.getPath(link.parent),
                link.node_ops.readlink(link)
            );
        },

        /**
         * Gets file status.
         *
         * @param {string} path - File path
         * @param {boolean} dontFollow - Don't follow symlinks
         * @returns {Object} Stat object
         * @throws {FS.ErrnoError} If file not found
         */
        stat(path, dontFollow) {
            // 1. Look up file
            const lookup = FS.lookupPath(path, { follow: !dontFollow });
            const node = lookup.node;

            // 2. Validate node
            if (!node) {
                throw new FS.ErrnoError(44);
            }

            // 3. Check if getattr operation exists
            if (!node.node_ops.getattr) {
                throw new FS.ErrnoError(63);
            }

            // 4. Get attributes
            return node.node_ops.getattr(node);
        },

        /**
         * Gets file status without following symlinks.
         *
         * @param {string} path - File path
         * @returns {Object} Stat object
         */
        lstat(path) {
            return FS.stat(path, true);
        },

        /**
         * Changes file mode.
         *
         * @param {string|FSNode} path - File path or node
         * @param {number} mode - New mode
         * @param {boolean} dontFollow - Don't follow symlinks
         * @throws {FS.ErrnoError} If operation fails
         */
        chmod(path, mode, dontFollow) {
            // 1. Get node
            let node;
            if (typeof path == "string") {
                const lookup = FS.lookupPath(path, { follow: !dontFollow });
                node = lookup.node;
            } else {
                node = path;
            }

            // 2. Check if setattr operation exists
            if (!node.node_ops.setattr) {
                throw new FS.ErrnoError(63);
            }

            // 3. Set attributes
            node.node_ops.setattr(node, {
                mode: (mode & 4095) | (node.mode & ~4095),
                timestamp: Date.now(),
            });
        },

        /**
         * Changes file mode without following symlinks.
         *
         * @param {string} path - File path
         * @param {number} mode - New mode
         */
        lchmod(path, mode) {
            FS.chmod(path, mode, true);
        },

        /**
         * Changes file mode by file descriptor.
         *
         * @param {number} fd - File descriptor
         * @param {number} mode - New mode
         */
        fchmod(fd, mode) {
            const stream = FS.getStreamChecked(fd);
            FS.chmod(stream.node, mode);
        },

        /**
         * Changes file owner (no-op in this implementation).
         *
         * @param {string|FSNode} path - File path or node
         * @param {number} uid - User ID (unused)
         * @param {number} gid - Group ID (unused)
         * @param {boolean} dontFollow - Don't follow symlinks
         * @throws {FS.ErrnoError} If operation fails
         */
        chown(path, uid, gid, dontFollow) {
            // 1. Get node
            let node;
            if (typeof path == "string") {
                const lookup = FS.lookupPath(path, { follow: !dontFollow });
                node = lookup.node;
            } else {
                node = path;
            }

            // 2. Check if setattr operation exists
            if (!node.node_ops.setattr) {
                throw new FS.ErrnoError(63);
            }

            // 3. Set attributes (timestamp only)
            node.node_ops.setattr(node, {
                timestamp: Date.now(),
            });
        },

        /**
         * Changes file owner without following symlinks.
         *
         * @param {string} path - File path
         * @param {number} uid - User ID (unused)
         * @param {number} gid - Group ID (unused)
         */
        lchown(path, uid, gid) {
            FS.chown(path, uid, gid, true);
        },

        /**
         * Changes file owner by file descriptor.
         *
         * @param {number} fd - File descriptor
         * @param {number} uid - User ID (unused)
         * @param {number} gid - Group ID (unused)
         */
        fchown(fd, uid, gid) {
            const stream = FS.getStreamChecked(fd);
            FS.chown(stream.node, uid, gid);
        },

        /**
         * Truncates a file to a specified length.
         *
         * @param {string|FSNode} path - File path or node
         * @param {number} len - New length
         * @throws {FS.ErrnoError} If operation fails
         */
        truncate(path, len) {
            // 1. Validate length
            if (len < 0) {
                throw new FS.ErrnoError(28);
            }

            // 2. Get node
            let node;
            if (typeof path == "string") {
                const lookup = FS.lookupPath(path, { follow: true });
                node = lookup.node;
            } else {
                node = path;
            }

            // 3. Check if setattr operation exists
            if (!node.node_ops.setattr) {
                throw new FS.ErrnoError(63);
            }

            // 4. Check if directory
            if (FS.isDir(node.mode)) {
                throw new FS.ErrnoError(31);
            }

            // 5. Check if regular file
            if (!FS.isFile(node.mode)) {
                throw new FS.ErrnoError(28);
            }

            // 6. Check write permission
            const errCode = FS.nodePermissions(node, "w");
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }

            // 7. Set attributes
            node.node_ops.setattr(node, {
                size: len,
                timestamp: Date.now(),
            });
        },

        /**
         * Truncates a file by file descriptor.
         *
         * @param {number} fd - File descriptor
         * @param {number} len - New length
         * @throws {FS.ErrnoError} If operation fails
         */
        ftruncate(fd, len) {
            // 1. Get stream
            const stream = FS.getStreamChecked(fd);

            // 2. Check if writable
            if ((stream.flags & 2097155) === 0) {
                throw new FS.ErrnoError(28);
            }

            // 3. Truncate
            FS.truncate(stream.node, len);
        },

        /**
         * Sets file access and modification times.
         *
         * @param {string} path - File path
         * @param {number} atime - Access time
         * @param {number} mtime - Modification time
         */
        utime(path, atime, mtime) {
            // 1. Look up file
            const lookup = FS.lookupPath(path, { follow: true });
            const node = lookup.node;

            // 2. Set attributes
            node.node_ops.setattr(node, {
                timestamp: Math.max(atime, mtime),
            });
        },

        /**
         * Opens a file.
         *
         * @param {string|FSNode} path - File path or node
         * @param {number|string} flags - Open flags
         * @param {number} mode - File mode (for creation)
         * @returns {FSStream} Opened stream
         * @throws {FS.ErrnoError} If operation fails
         */
        open(path, flags, mode) {
            // 1. Validate path
            if (path === "") {
                throw new FS.ErrnoError(44);
            }

            // 2. Parse flags
            flags =
                typeof flags == "string"
                    ? FS_modeStringToFlags(flags)
                    : flags;

            // 3. Set mode if creating
            if (flags & 64) {
                mode = typeof mode == "undefined" ? 438 : mode;
                mode = (mode & 4095) | 32768;
            } else {
                mode = 0;
            }

            // 4. Get node
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

            // 5. Create file if requested
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

            // 6. Validate node
            if (!node) {
                throw new FS.ErrnoError(44);
            }

            // 7. Handle character devices
            if (FS.isChrdev(node.mode)) {
                flags &= ~512;
            }

            // 8. Check if directory opened with write flags
            if (flags & 65536 && !FS.isDir(node.mode)) {
                throw new FS.ErrnoError(54);
            }

            // 9. Check permissions
            if (!created) {
                const errCode = FS.mayOpen(node, flags);
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
            }

            // 10. Truncate if requested
            if (flags & 512 && !created) {
                FS.truncate(node, 0);
            }

            // 11. Clear creation flags
            flags &= ~(128 | 512 | 131072);

            // 12. Create stream
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

            // 13. Call open operation if available
            if (stream.stream_ops.open) {
                stream.stream_ops.open(stream);
            }

            // 14. Log read operations if requested
            if (Module["logReadFiles"] && !(flags & 1)) {
                if (!(path in FS.readFiles)) {
                    FS.readFiles[path] = 1;
                }
            }

            // 15. Return stream
            return stream;
        },

        /**
         * Closes a stream.
         *
         * @param {FSStream} stream - Stream to close
         * @throws {FS.ErrnoError} If stream already closed
         */
        close(stream) {
            // 1. Check if already closed
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(8);
            }

            // 2. Clear getdents state
            if (stream.getdents) stream.getdents = null;

            // 3. Call close operation
            try {
                if (stream.stream_ops.close) {
                    stream.stream_ops.close(stream);
                }
            } finally {
                FS.closeStream(stream.fd);
            }

            // 4. Clear fd
            stream.fd = null;
        },

        /**
         * Checks if a stream is closed.
         *
         * @param {FSStream} stream - Stream to check
         * @returns {boolean} True if closed
         */
        isClosed(stream) {
            return stream.fd === null;
        },

        /**
         * Seeks within a stream.
         *
         * @param {FSStream} stream - Stream to seek
         * @param {number} offset - Seek offset
         * @param {number} whence - Seek mode (0=SEEK_SET, 1=SEEK_CUR, 2=SEEK_END)
         * @returns {number} New position
         * @throws {FS.ErrnoError} If operation fails
         */
        llseek(stream, offset, whence) {
            // 1. Check if closed
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(8);
            }

            // 2. Check if seekable
            if (!stream.seekable || !stream.stream_ops.llseek) {
                throw new FS.ErrnoError(70);
            }

            // 3. Validate whence
            if (whence != 0 && whence != 1 && whence != 2) {
                throw new FS.ErrnoError(28);
            }

            // 4. Perform seek
            stream.position = stream.stream_ops.llseek(
                stream,
                offset,
                whence
            );
            stream.ungotten = [];

            // 5. Return position
            return stream.position;
        },

        /**
         * Reads from a stream.
         *
         * @param {FSStream} stream - Stream to read from
         * @param {Uint8Array} buffer - Buffer to read into
         * @param {number} offset - Buffer offset
         * @param {number} length - Number of bytes to read
         * @param {number} position - Position to read from (optional)
         * @returns {number} Number of bytes read
         * @throws {FS.ErrnoError} If operation fails
         */
        read(stream, buffer, offset, length, position) {
            // 1. Validate parameters
            if (length < 0 || position < 0) {
                throw new FS.ErrnoError(28);
            }

            // 2. Check if closed
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(8);
            }

            // 3. Check if write-only
            if ((stream.flags & 2097155) === 1) {
                throw new FS.ErrnoError(8);
            }

            // 4. Check if directory
            if (FS.isDir(stream.node.mode)) {
                throw new FS.ErrnoError(31);
            }

            // 5. Check if read operation exists
            if (!stream.stream_ops.read) {
                throw new FS.ErrnoError(28);
            }

            // 6. Determine position
            const seeking = typeof position != "undefined";
            if (!seeking) {
                position = stream.position;
            } else if (!stream.seekable) {
                throw new FS.ErrnoError(70);
            }

            // 7. Read data
            const bytesRead = stream.stream_ops.read(
                stream,
                buffer,
                offset,
                length,
                position
            );

            // 8. Update position if not seeking
            if (!seeking) stream.position += bytesRead;

            // 9. Return bytes read
            return bytesRead;
        },

        /**
         * Writes to a stream.
         *
         * @param {FSStream} stream - Stream to write to
         * @param {Uint8Array} buffer - Buffer to write from
         * @param {number} offset - Buffer offset
         * @param {number} length - Number of bytes to write
         * @param {number} position - Position to write to (optional)
         * @param {boolean} canOwn - Whether buffer can be owned by stream
         * @returns {number} Number of bytes written
         * @throws {FS.ErrnoError} If operation fails
         */
        write(stream, buffer, offset, length, position, canOwn) {
            // 1. Validate parameters
            if (length < 0 || position < 0) {
                throw new FS.ErrnoError(28);
            }

            // 2. Check if closed
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(8);
            }

            // 3. Check if read-only
            if ((stream.flags & 2097155) === 0) {
                throw new FS.ErrnoError(8);
            }

            // 4. Check if directory
            if (FS.isDir(stream.node.mode)) {
                throw new FS.ErrnoError(31);
            }

            // 5. Check if write operation exists
            if (!stream.stream_ops.write) {
                throw new FS.ErrnoError(28);
            }

            // 6. Seek to end if append mode
            if (stream.seekable && stream.flags & 1024) {
                FS.llseek(stream, 0, 2);
            }

            // 7. Determine position
            const seeking = typeof position != "undefined";
            if (!seeking) {
                position = stream.position;
            } else if (!stream.seekable) {
                throw new FS.ErrnoError(70);
            }

            // 8. Write data
            const bytesWritten = stream.stream_ops.write(
                stream,
                buffer,
                offset,
                length,
                position,
                canOwn
            );

            // 9. Update position if not seeking
            if (!seeking) stream.position += bytesWritten;

            // 10. Return bytes written
            return bytesWritten;
        },

        /**
         * Allocates space for a file.
         *
         * @param {FSStream} stream - Stream to allocate space for
         * @param {number} offset - Allocation offset
         * @param {number} length - Allocation length
         * @throws {FS.ErrnoError} If operation fails
         */
        allocate(stream, offset, length) {
            // 1. Check if closed
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(8);
            }

            // 2. Validate parameters
            if (offset < 0 || length <= 0) {
                throw new FS.ErrnoError(28);
            }

            // 3. Check if read-only
            if ((stream.flags & 2097155) === 0) {
                throw new FS.ErrnoError(8);
            }

            // 4. Check if file or directory
            if (
                !FS.isFile(stream.node.mode) &&
                !FS.isDir(stream.node.mode)
            ) {
                throw new FS.ErrnoError(43);
            }

            // 5. Check if allocate operation exists
            if (!stream.stream_ops.allocate) {
                throw new FS.ErrnoError(138);
            }

            // 6. Allocate space
            stream.stream_ops.allocate(stream, offset, length);
        },

        /**
         * Memory-maps a file.
         *
         * @param {FSStream} stream - Stream to map
         * @param {number} length - Mapping length
         * @param {number} position - Mapping position
         * @param {number} prot - Protection flags
         * @param {number} flags - Mapping flags
         * @returns {Object} Object with {ptr, allocated} properties
         * @throws {FS.ErrnoError} If operation fails
         */
        mmap(stream, length, position, prot, flags) {
            // 1. Validate flags
            if (
                (prot & 2) !== 0 &&
                (flags & 2) === 0 &&
                (stream.flags & 2097155) !== 2
            ) {
                throw new FS.ErrnoError(2);
            }
            if ((stream.flags & 2097155) === 1) {
                throw new FS.ErrnoError(2);
            }

            // 2. Check if mmap operation exists
            if (!stream.stream_ops.mmap) {
                throw new FS.ErrnoError(43);
            }

            // 3. Validate length
            if (!length) {
                throw new FS.ErrnoError(28);
            }

            // 4. Map file
            return stream.stream_ops.mmap(
                stream,
                length,
                position,
                prot,
                flags
            );
        },

        /**
         * Synchronizes memory-mapped region.
         *
         * @param {FSStream} stream - Stream to sync
         * @param {Uint8Array} buffer - Mapped buffer
         * @param {number} offset - Buffer offset
         * @param {number} length - Sync length
         * @param {number} mmapFlags - Mapping flags
         * @returns {number} 0 on success
         */
        msync(stream, buffer, offset, length, mmapFlags) {
            // 1. Check if msync operation exists
            if (!stream.stream_ops.msync) {
                return 0;
            }

            // 2. Sync region
            return stream.stream_ops.msync(
                stream,
                buffer,
                offset,
                length,
                mmapFlags
            );
        },

        /**
         * Performs ioctl operation on a stream.
         *
         * @param {FSStream} stream - Stream to control
         * @param {number} cmd - ioctl command
         * @param {number} arg - ioctl argument
         * @returns {number} Result value
         * @throws {FS.ErrnoError} If operation not supported
         */
        ioctl(stream, cmd, arg) {
            // 1. Check if ioctl operation exists
            if (!stream.stream_ops.ioctl) {
                throw new FS.ErrnoError(59);
            }

            // 2. Perform ioctl
            return stream.stream_ops.ioctl(stream, cmd, arg);
        },

        /**
         * Reads entire file contents.
         *
         * @param {string} path - File path
         * @param {Object} opts - Read options
         * @param {number} opts.flags - Open flags (default: 0)
         * @param {string} opts.encoding - Encoding ("utf8" or "binary", default: "binary")
         * @returns {string|Uint8Array} File contents
         * @throws {Error} If invalid encoding
         */
        readFile(path, opts = {}) {
            // 1. Set defaults
            opts.flags = opts.flags || 0;
            opts.encoding = opts.encoding || "binary";

            // 2. Validate encoding
            if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
                throw new Error(`Invalid encoding type "${opts.encoding}"`);
            }

            // 3. Open file
            let ret;
            const stream = FS.open(path, opts.flags);

            // 4. Get file size
            const stat = FS.stat(path);
            const length = stat.size;

            // 5. Read file
            const buf = new Uint8Array(length);
            FS.read(stream, buf, 0, length, 0);

            // 6. Convert encoding
            if (opts.encoding === "utf8") {
                ret = UTF8ArrayToString(buf);
            } else if (opts.encoding === "binary") {
                ret = buf;
            }

            // 7. Close file
            FS.close(stream);

            // 8. Return contents
            return ret;
        },

        /**
         * Writes entire file contents.
         *
         * @param {string} path - File path
         * @param {string|Uint8Array} data - Data to write
         * @param {Object} opts - Write options
         * @param {number} opts.flags - Open flags (default: 577)
         * @param {number} opts.mode - File mode
         * @param {boolean} opts.canOwn - Whether buffer can be owned
         * @throws {Error} If invalid data type
         */
        writeFile(path, data, opts = {}) {
            // 1. Set default flags
            opts.flags = opts.flags || 577;

            // 2. Open file
            const stream = FS.open(path, opts.flags, opts.mode);

            // 3. Write data based on type
            if (typeof data == "string") {
                const buf = new Uint8Array(lengthBytesUTF8(data) + 1);
                const actualNumBytes = stringToUTF8Array(
                    data,
                    buf,
                    0,
                    buf.length
                );
                FS.write(
                    stream,
                    buf,
                    0,
                    actualNumBytes,
                    undefined,
                    opts.canOwn
                );
            } else if (ArrayBuffer.isView(data)) {
                FS.write(
                    stream,
                    data,
                    0,
                    data.byteLength,
                    undefined,
                    opts.canOwn
                );
            } else {
                throw new Error("Unsupported data type");
            }

            // 4. Close file
            FS.close(stream);
        },

        /**
         * Gets current working directory.
         *
         * @returns {string} Current path
         */
        cwd: () => FS.currentPath,

        /**
         * Changes current working directory.
         *
         * @param {string} path - New directory path
         * @throws {FS.ErrnoError} If directory not found or not a directory
         */
        chdir(path) {
            // 1. Look up directory
            const lookup = FS.lookupPath(path, { follow: true });

            // 2. Validate node
            if (lookup.node === null) {
                throw new FS.ErrnoError(44);
            }

            // 3. Check if directory
            if (!FS.isDir(lookup.node.mode)) {
                throw new FS.ErrnoError(54);
            }

            // 4. Check execute permission
            const errCode = FS.nodePermissions(lookup.node, "x");
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }

            // 5. Update current path
            FS.currentPath = lookup.path;
        },

        /**
         * Creates default directories (/tmp, /home, /home/web_user).
         */
        createDefaultDirectories() {
            FS.mkdir("/tmp");
            FS.mkdir("/home");
            FS.mkdir("/home/web_user");
        },

        /**
         * Creates default device files.
         *
         * @param {Object} TTY - TTY operations module
         * @param {Function} randomFill - Random number generator
         */
        createDefaultDevices(TTY, randomFill) {
            // 1. Create /dev directory
            FS.mkdir("/dev");

            // 2. Register null device
            FS.registerDevice(FS.makedev(1, 3), {
                read: () => 0,
                write: (stream, buffer, offset, length, _pos) => length,
            });
            FS.mkdev("/dev/null", FS.makedev(1, 3));

            // 3. Register TTY devices
            TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
            TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
            FS.mkdev("/dev/tty", FS.makedev(5, 0));
            FS.mkdev("/dev/tty1", FS.makedev(6, 0));

            // 4. Create random device
            let randomBuffer = new Uint8Array(1024),
                randomLeft = 0;
            const randomByte = () => {
                if (randomLeft === 0) {
                    randomLeft = randomFill(randomBuffer).byteLength;
                }
                return randomBuffer[--randomLeft];
            };
            FS.createDevice("/dev", "random", randomByte);
            FS.createDevice("/dev", "urandom", randomByte);

            // 5. Create /dev/shm for shared memory
            FS.mkdir("/dev/shm");
            FS.mkdir("/dev/shm/tmp");
        },

        /**
         * Creates special directories (/proc).
         */
        createSpecialDirectories() {
            // 1. Create /proc directory
            FS.mkdir("/proc");
            const proc_self = FS.mkdir("/proc/self");
            FS.mkdir("/proc/self/fd");

            // 2. Mount /proc/self/fd with custom lookup
            FS.mount(
                {
                    mount() {
                        const node = FS.createNode(
                            proc_self,
                            "fd",
                            16384 | 511,
                            73
                        );
                        node.node_ops = {
                            lookup(parent, name) {
                                const fd = +name;
                                const stream = FS.getStreamChecked(fd);
                                const ret = {
                                    parent: null,
                                    mount: { mountpoint: "fake" },
                                    node_ops: {
                                        readlink: () => stream.path,
                                    },
                                };
                                ret.parent = ret;
                                return ret;
                            },
                        };
                        return node;
                    },
                },
                {},
                "/proc/self/fd"
            );
        },

        /**
         * Creates standard streams (stdin, stdout, stderr).
         *
         * @param {Function} input - Input function
         * @param {Function} output - Output function
         * @param {Function} error - Error function
         */
        createStandardStreams(input, output, error) {
            // 1. Create stdin
            if (input) {
                FS.createDevice("/dev", "stdin", input);
            } else {
                FS.symlink("/dev/tty", "/dev/stdin");
            }

            // 2. Create stdout
            if (output) {
                FS.createDevice("/dev", "stdout", null, output);
            } else {
                FS.symlink("/dev/tty", "/dev/stdout");
            }

            // 3. Create stderr
            if (error) {
                FS.createDevice("/dev", "stderr", null, error);
            } else {
                FS.symlink("/dev/tty1", "/dev/stderr");
            }

            // 4. Open standard streams
            FS.open("/dev/stdin", 0);
            FS.open("/dev/stdout", 1);
            FS.open("/dev/stderr", 1);
        },

        /**
         * Static initialization of file system.
         *
         * @param {Object} MEMFS - Memory file system module
         */
        staticInit(MEMFS) {
            // 1. Initialize generic errors
            [44].forEach((code) => {
                FS.genericErrors[code] = new FS.ErrnoError(code);
                FS.genericErrors[code].stack = "<generic error, no stack>";
            });

            // 2. Initialize name table
            FS.nameTable = new Array(4096);

            // 3. Mount root file system
            FS.mount(MEMFS, {}, "/");

            // 4. Create default directories
            FS.createDefaultDirectories();

            // 5. Set filesystems
            FS.filesystems = {
                MEMFS: MEMFS,
            };
        },

        /**
         * Initializes file system with standard streams.
         *
         * @param {Function} input - Input function
         * @param {Function} output - Output function
         * @param {Function} error - Error function
         */
        init(input, output, error) {
            // 1. Mark as initialized
            FS.initialized = true;

            // 2. Use Module defaults if not provided
            input ??= Module["stdin"];
            output ??= Module["stdout"];
            error ??= Module["stderr"];

            // 3. Create standard streams
            FS.createStandardStreams(input, output, error);
        },

        /**
         * Shuts down file system.
         */
        quit() {
            // 1. Mark as not initialized
            FS.initialized = false;

            // 2. Close all streams
            for (let i = 0; i < FS.streams.length; i++) {
                const stream = FS.streams[i];
                if (!stream) {
                    continue;
                }
                FS.close(stream);
            }
        },

        /**
         * Finds an object by path (deprecated, use FS.lookupPath instead).
         *
         * @param {string} path - Path to find
         * @param {boolean} dontResolveLastLink - Don't resolve last symlink
         * @returns {FSNode|null} Found node or null
         */
        findObject(path, dontResolveLastLink) {
            const ret = FS.analyzePath(path, dontResolveLastLink);
            if (!ret.exists) {
                return null;
            }
            return ret.object;
        },

        /**
         * Analyzes a path and returns detailed information.
         *
         * @param {string} path - Path to analyze
         * @param {boolean} dontResolveLastLink - Don't resolve last symlink
         * @returns {Object} Analysis result with node info
         */
        analyzePath(path, dontResolveLastLink) {
            // 1. Try to resolve path
            try {
                const lookup = FS.lookupPath(path, {
                    follow: !dontResolveLastLink,
                });
                path = lookup.path;
            } catch (_e) {}

            // 2. Initialize result
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

            // 3. Analyze path
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

            // 4. Return result
            return ret;
        },

        /**
         * Creates a path (mkdir -p).
         *
         * @param {string|FSNode} parent - Parent directory
         * @param {string} path - Path to create
         * @param {boolean} _canRead - Unused
         * @param {boolean} _canWrite - Unused
         * @returns {string} Created path
         */
        createPath(parent, path, _canRead, _canWrite) {
            // 1. Get parent path
            parent =
                typeof parent == "string" ? parent : FS.getPath(parent);

            // 2. Split path
            const parts = path.split("/").reverse();

            // 3. Create each directory
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

            // 4. Return final path
            return current;
        },

        /**
         * Creates a file node.
         *
         * @param {string|FSNode} parent - Parent directory
         * @param {string} name - File name
         * @param {Object} properties - Unused
         * @param {boolean} canRead - Read permission
         * @param {boolean} canWrite - Write permission
         * @returns {FSNode} Created file node
         */
        createFile(parent, name, properties, canRead, canWrite) {
            const path = PATH.join2(
                typeof parent == "string" ? parent : FS.getPath(parent),
                name
            );
            const mode = FS_getMode(canRead, canWrite);
            return FS.create(path, mode);
        },

        /**
         * Creates a data file.
         *
         * @param {string|FSNode} parent - Parent directory
         * @param {string} name - File name
         * @param {string|Array} data - File data
         * @param {boolean} canRead - Read permission
         * @param {boolean} canWrite - Write permission
         * @param {boolean} canOwn - Whether buffer can be owned
         */
        createDataFile(parent, name, data, canRead, canWrite, canOwn) {
            // 1. Get file path
            let path = name;
            if (parent) {
                parent =
                    typeof parent == "string" ? parent : FS.getPath(parent);
                path = name ? PATH.join2(parent, name) : parent;
            }

            // 2. Get file mode
            const mode = FS_getMode(canRead, canWrite);

            // 3. Create file
            const node = FS.create(path, mode);

            // 4. Write data if provided
            if (data) {
                if (typeof data == "string") {
                    const arr = new Array(data.length);
                    for (let i = 0, len = data.length; i < len; ++i)
                        arr[i] = data.charCodeAt(i);
                    data = arr;
                }

                FS.chmod(node, mode | 146);
                const stream = FS.open(node, 577);
                FS.write(stream, data, 0, data.length, 0, canOwn);
                FS.close(stream);
                FS.chmod(node, mode);
            }
        },

        /**
         * Creates a device node.
         *
         * @param {string|FSNode} parent - Parent directory
         * @param {string} name - Device name
         * @param {Function} input - Input function
         * @param {Function} output - Output function
         * @returns {FSNode} Created device node
         */
        createDevice(parent, name, input, output) {
            // 1. Get device path
            const path = PATH.join2(
                typeof parent == "string" ? parent : FS.getPath(parent),
                name
            );

            // 2. Get device mode
            const mode = FS_getMode(!!input, !!output);

            // 3. Create device major number
            FS.createDevice.major ??= 64;
            const dev = FS.makedev(FS.createDevice.major++, 0);

            // 4. Register device
            FS.registerDevice(dev, {
                open(stream) {
                    stream.seekable = false;
                },
                close(_stream) {
                    if (output?.buffer?.length) {
                        output(10);
                    }
                },
                read(stream, buffer, offset, length, _pos) {
                    let bytesRead = 0;
                    for (let i = 0; i < length; i++) {
                        let result;
                        try {
                            result = input();
                        } catch (_e) {
                            throw new FS.ErrnoError(29);
                        }
                        if (result === undefined && bytesRead === 0) {
                            throw new FS.ErrnoError(6);
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
                write(stream, buffer, offset, length, _pos) {
                    for (let i = 0; i < length; i++) {
                        try {
                            output(buffer[offset + i]);
                        } catch (_e) {
                            throw new FS.ErrnoError(29);
                        }
                    }
                    if (length) {
                        stream.node.timestamp = Date.now();
                    }
                    return length;
                },
            });

            // 5. Create device node
            return FS.mkdev(path, mode, dev);
        },

        /**
         * Forces loading of a lazy file.
         *
         * @param {Object} obj - Lazy file object
         * @returns {boolean} True if already loaded or loaded successfully
         * @throws {FS.ErrnoError} If loading fails
         */
        forceLoadFile(obj) {
            // 1. Check if already loaded
            if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
                return true;

            // 2. Throw error - lazy loading not supported
            if (typeof XMLHttpRequest != "undefined") {
                throw new Error(
                    "Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread."
                );
            }

            // 3. Not in browser, throw error
            throw new FS.ErrnoError(29);
        },

        /**
         * Creates a lazy-loaded file (deprecated).
         *
         * @param {string|FSNode} parent - Parent directory
         * @param {string} name - File name
         * @param {string} url - File URL
         * @param {boolean} canRead - Read permission
         * @param {boolean} canWrite - Write permission
         * @returns {FSNode} Created file node
         * @throws {Error} If used outside web worker
         */
        createLazyFile(_parent, _name, _url, _canRead, _canWrite) {
            // This is a complex deprecated function for lazy-loading files
            // from URLs. In production code, use --embed-file or --preload-file instead.

            throw new Error(
                "createLazyFile is deprecated. Use --embed-file or --preload-file in emcc."
            );
        },
    };

    // Assign the utility functions
    FS.createPreloadedFile = FS_createPreloadedFile;

    // Create PATH_FS with FS reference
    const PATH_FS = createPathFS(FS);

    return { FS, PATH_FS };
}
