import { ERRNO_CODES, MODE, OPEN_FLAGS, MAX_OPEN_FDS } from "./constants.mjs";

/**
 * Creates helper routines that bootstrap the filesystem and wire up default
 * devices, directories, and streams for the runtime.
 *
 * @param {import("./types.d.ts").MutableFS} FS
 * @param {{ Module: Record<string, any> }} options
 * @returns {{
 *   createDefaultDirectories(): void,
 *   createDefaultDevices(
 *     TTY: {
 *       register(dev: number, ops: import("./types.d.ts").StreamOps): void,
 *       default_tty_ops: import("./types.d.ts").StreamOps,
 *       default_tty1_ops: import("./types.d.ts").StreamOps,
 *     },
 *     randomFill: (buffer: Uint8Array) => Uint8Array
 *   ): void,
 *   createSpecialDirectories(): void,
 *   createStandardStreams(
 *     input?: (() => number) | null,
 *     output?: ((value: number) => void) | null,
 *     error?: ((value: number) => void) | null
 *   ): void,
 *   staticInit(MEMFS: import("./types.d.ts").FileSystemMountType): void,
 *   init(
 *     input?: (() => number) | null,
 *     output?: ((value: number) => void) | null,
 *     error?: ((value: number) => void) | null
 *   ): void,
 *   quit(): void,
 * }}
 */
export function createInitializationHelpers(FS, { Module }) {
    return {
        createDefaultDirectories() {
            FS.mkdir("/tmp");
            FS.mkdir("/home");
            FS.mkdir("/home/web_user");
        },
        createDefaultDevices(TTY, randomFill) {
            FS.mkdir("/dev");
            FS.registerDevice(FS.makedev(1, 3), {
                read: () => 0,
                write: (stream, buffer, offset, length) => length,
            });
            FS.mkdev("/dev/null", FS.makedev(1, 3));
            TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
            TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
            FS.mkdev("/dev/tty", FS.makedev(5, 0));
            FS.mkdev("/dev/tty1", FS.makedev(6, 0));
            const RANDOM_DEVICE_CHUNK_SIZE = 1024;
            let randomBuffer = new Uint8Array(RANDOM_DEVICE_CHUNK_SIZE),
                randomLeft = 0;
            const randomByte = () => {
                if (randomLeft === 0) {
                    randomLeft = randomFill(randomBuffer).byteLength;
                }
                return randomBuffer[--randomLeft];
            };
            FS.createDevice("/dev", "random", randomByte);
            FS.createDevice("/dev", "urandom", randomByte);
            FS.mkdir("/dev/shm");
            FS.mkdir("/dev/shm/tmp");
        },
        createSpecialDirectories() {
            FS.mkdir("/proc");
            const procSelf = FS.mkdir("/proc/self");
            FS.mkdir("/proc/self/fd");
            FS.mount(
                {
                    mount() {
                        const node = FS.createNode(
                            procSelf,
                            "fd",
                            MODE.DIRECTORY | MODE.DIR_PERMISSION_MASK,
                            // Match the execute bits we expect the synthetic entries to expose.
                            MODE.PERMISSION_EXECUTE
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
        createStandardStreams(input, output, error) {
            if (input) {
                FS.createDevice("/dev", "stdin", input);
            } else {
                FS.symlink("/dev/tty", "/dev/stdin");
            }
            if (output) {
                FS.createDevice("/dev", "stdout", null, output);
            } else {
                FS.symlink("/dev/tty", "/dev/stdout");
            }
            if (error) {
                FS.createDevice("/dev", "stderr", null, error);
            } else {
                FS.symlink("/dev/tty1", "/dev/stderr");
            }
            FS.open("/dev/stdin", OPEN_FLAGS.O_RDONLY);
            FS.open("/dev/stdout", OPEN_FLAGS.O_WRONLY);
            FS.open("/dev/stderr", OPEN_FLAGS.O_WRONLY);
        },
        staticInit(MEMFS) {
            [ERRNO_CODES.ENOENT].forEach((code) => {
                FS.genericErrors[code] = new FS.ErrnoError(code);
                FS.genericErrors[code].stack = "<generic error, no stack>";
            });
            FS.nameTable = new Array(MAX_OPEN_FDS);
            FS.mount(MEMFS, {}, "/");
            FS.createDefaultDirectories();
            FS.filesystems = {
                MEMFS,
            };
        },
        init(input, output, error) {
            FS.initialized = true;
            input ??= Module["stdin"];
            output ??= Module["stdout"];
            error ??= Module["stderr"];
            FS.createStandardStreams(input, output, error);
        },
        quit() {
            FS.initialized = false;
            for (let i = 0; i < FS.streams.length; i++) {
                const stream = FS.streams[i];
                if (!stream) {
                    continue;
                }
                FS.close(stream);
            }
        },
    };
}
