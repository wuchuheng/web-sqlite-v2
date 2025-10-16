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
                this.readMode = 292 | 73;
                this.writeMode = 146;
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
                return (this.mode & 61440) === 16384;
            }
            get isDevice() {
                return (this.mode & 61440) === 8192;
            }
        },
    };
}
