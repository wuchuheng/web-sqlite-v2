import {
    MODE,
    OPEN_FLAGS,
    STREAM_STATE_MASK,
    PERMISSION,
} from "./constants.mjs";

/**
 * Creates the mutable filesystem state container that other helper modules
 * extend in order to expose POSIX-like filesystem behaviors.
 *
 * @returns {import("./base-state.d.ts").MutableFS}
 */
export function createBaseState() {
    return {
        root: null,
        mounts: [],
        devices: {},
        streams: [],
        nextInode: 1,
        nameTable: null,
        currentPath: "/",
        initialized: false,
        ignorePermissions: true,
        ErrnoError: class {
            constructor(errno) {
                this.name = "ErrnoError";
                this.errno = errno;
            }
        },
        genericErrors: {},
        filesystems: null,
        syncFSRequests: 0,
        readFiles: {},
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
                return (this.flags & STREAM_STATE_MASK) !== OPEN_FLAGS.O_WRONLY;
            }
            get isWrite() {
                return (this.flags & STREAM_STATE_MASK) !== OPEN_FLAGS.O_RDONLY;
            }
            get isAppend() {
                return (this.flags & OPEN_FLAGS.O_APPEND) !== 0;
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
        FSNode: class {
            constructor(parent, name, mode, rdev) {
                if (!parent) {
                    parent = this;
                }
                this.parent = parent;
                this.mount = parent.mount;
                this.mounted = null;
                this.id = null;
                this.name = name;
                this.mode = mode;
                this.node_ops = {};
                this.stream_ops = {};
                this.rdev = rdev;
                this.readMode = PERMISSION.READ_EXECUTE;
                this.writeMode = MODE.PERMISSION_WRITE;
            }
            assignId(fs) {
                this.id = fs.nextInode++;
                return this;
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
                return (this.mode & MODE.TYPE_MASK) === MODE.DIRECTORY;
            }
            get isDevice() {
                return (this.mode & MODE.TYPE_MASK) === MODE.CHARACTER_DEVICE;
            }
        },
    };
}
