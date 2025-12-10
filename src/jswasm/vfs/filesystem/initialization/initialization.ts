import {
  ERRNO_CODES,
  MODE,
  OPEN_FLAGS,
  MAX_OPEN_FDS,
} from "../constants/constants.js";

import type {
  FileSystemMountType,
  MutableFS as BaseMutableFS,
  FSNode,
  StreamOps,
  FSStream,
} from "../base-state/base-state";

import type { RuntimeModule } from "../../../shared/runtime-types.d.ts";

// Local type definitions for the initialization helpers
export interface InitializationHelpers {
  createDefaultDirectories(): void;
  createDefaultDevices(
    TTY: {
      register: (dev: number, ops: StreamOps) => void;
      default_tty_ops: StreamOps;
      default_tty1_ops: StreamOps;
    },
    randomFill: (buffer: Uint8Array) => Uint8Array,
  ): void;
  createSpecialDirectories(): void;
  createStandardStreams(
    input?: (() => number) | null,
    output?: ((value: number) => void) | null,
    error?: ((value: number) => void) | null,
  ): void;
  staticInit(MEMFS: FileSystemMountType): void;
  init(
    input?: (() => number) | null,
    output?: ((value: number) => void) | null,
    error?: ((value: number) => void) | null,
  ): void;
  quit(): void;
}

export interface InitializationOptions {
  Module?: RuntimeModule;
}

// Extend the base MutableFS interface to include filesystem operation methods
// These methods are added by other modules in the full filesystem implementation
export interface MutableFS extends BaseMutableFS {
  // Filesystem operations
  mkdir(path: string): FSNode;
  registerDevice(dev: number, definition: StreamOps): void;
  mkdev(path: string, dev: number): void;
  createDevice(
    path: string,
    name: string,
    input?: (() => number) | null,
    output?: ((value: number) => void) | null,
  ): void;
  symlink(target: string, linkPath: string): void;
  open(path: string, flags: number): void;
  mount(
    type: FileSystemMountType,
    opts: Record<string, unknown>,
    mountpoint: string,
  ): void;
  close(stream: FSStream): void;
  getStreamChecked(fd: number): FSStream;
  createNode(parent: FSNode, name: string, mode: number, rdev: number): FSNode;

  // Helper methods added by other modules
  createDefaultDirectories(): void;
  createStandardStreams(
    input?: (() => number) | null,
    output?: ((value: number) => void) | null,
    error?: ((value: number) => void) | null,
  ): void;

  // Device creation
  makedev(major: number, minor: number): number;
}

/**
 * Creates helper routines that bootstrap the filesystem and wire up default
 * devices, directories, and streams for the runtime.
 *
 * @param {MutableFS} FS - The mutable filesystem state to operate on
 * @param {InitializationOptions} options - Configuration options including Module reference
 * @returns {InitializationHelpers} Helper functions for filesystem initialization
 */
export function createInitializationHelpers(
  FS: MutableFS,
  { Module }: InitializationOptions,
): InitializationHelpers {
  return {
    createDefaultDirectories() {
      // 1. Input handling - none required

      // 2. Core processing - create standard directory hierarchy
      FS.mkdir("/tmp");
      FS.mkdir("/home");
      FS.mkdir("/home/web_user");

      // 3. Output handling - directories created successfully
    },

    createDefaultDevices(TTY, randomFill) {
      // 1. Input handling - validate TTY and randomFill
      if (!TTY?.register || !TTY.default_tty_ops || !TTY.default_tty1_ops) {
        throw new Error("TTY operations not properly configured");
      }
      if (typeof randomFill !== "function") {
        throw new Error("randomFill must be a function");
      }

      // 2. Core processing - setup device infrastructure
      FS.mkdir("/dev");

      // Register null device
      FS.registerDevice(FS.makedev(1, 3), {
        read: () => 0,
        write: (
          _stream: FSStream,
          _buffer: Uint8Array | ArrayLike<number>,
          _offset: number,
          length: number,
        ) => length,
      });
      FS.mkdev("/dev/null", FS.makedev(1, 3));

      // Register TTY devices
      TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
      TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
      FS.mkdev("/dev/tty", FS.makedev(5, 0));
      FS.mkdev("/dev/tty1", FS.makedev(6, 0));

      // Setup random number generators
      const RANDOM_DEVICE_CHUNK_SIZE = 1024;
      const randomBuffer = new Uint8Array(RANDOM_DEVICE_CHUNK_SIZE);
      let randomLeft = 0;

      const randomByte = () => {
        // 1. Input handling - check buffer level
        if (randomLeft === 0) {
          // 2. Core processing - refill buffer
          randomLeft = randomFill(randomBuffer).byteLength;
        }
        // 3. Output handling - return random byte
        return randomBuffer[--randomLeft];
      };

      FS.createDevice("/dev", "random", randomByte);
      FS.createDevice("/dev", "urandom", randomByte);
      FS.mkdir("/dev/shm");
      FS.mkdir("/dev/shm/tmp");

      // 3. Output handling - devices created successfully
    },

    createSpecialDirectories() {
      // 1. Input handling - none required

      // 2. Core processing - create /proc filesystem structure
      FS.mkdir("/proc");
      const procSelf = FS.mkdir("/proc/self");
      FS.mkdir("/proc/self/fd");

      // Mount synthetic filesystem for fd entries
      FS.mount(
        {
          mount(): FSNode {
            // 1. Input handling - create node with proper permissions
            const node = FS.createNode(
              procSelf,
              "fd",
              MODE.DIRECTORY | MODE.DIR_PERMISSION_MASK,
              // Match the execute bits we expect the synthetic entries to expose.
              MODE.PERMISSION_EXECUTE,
            );

            // 2. Core processing - setup fd lookup operations
            const nodeOps = {
              lookup(_parent: FSNode, name: string) {
                // 1. Input handling - parse file descriptor
                const fd = +name;
                const stream = FS.getStreamChecked(fd);

                // 2. Core processing - create synthetic node structure
                const ret = {
                  parent: null as unknown as FSNode,
                  mount: { mountpoint: "fake" },
                  node_ops: {
                    readlink: () => stream.path || "",
                  },
                };

                // 3. Output handling - self-referencing parent
                ret.parent = ret as unknown as FSNode;
                return ret as unknown as FSNode;
              },
            };

            // Type assertion to assign the node_ops
            node.node_ops = nodeOps;

            // 3. Output handling - return mounted node
            return node;
          },
        },
        {},
        "/proc/self/fd",
      );
    },

    createStandardStreams(
      input: (() => number) | null | undefined,
      output: ((value: number) => void) | null | undefined,
      error: ((value: number) => void) | null | undefined,
    ) {
      // 1. Input handling - process stdio configuration

      // 2. Core processing - setup standard input/output/error streams
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

      // 3. Output handling - open streams with appropriate flags
      FS.open("/dev/stdin", OPEN_FLAGS.O_RDONLY);
      FS.open("/dev/stdout", OPEN_FLAGS.O_WRONLY);
      FS.open("/dev/stderr", OPEN_FLAGS.O_WRONLY);
    },

    staticInit(MEMFS: FileSystemMountType) {
      // 1. Input handling - validate MEMFS
      if (!MEMFS?.mount) {
        throw new Error("MEMFS must provide a mount function");
      }

      // 2. Core processing - initialize filesystem backing store
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

      // 3. Output handling - filesystem initialized
    },

    init(
      input: (() => number) | null | undefined,
      output: ((value: number) => void) | null | undefined,
      error: ((value: number) => void) | null | undefined,
    ) {
      // 1. Input handling - resolve stdio callbacks from Module
      input ??= Module?.["stdin"] as (() => number) | null;
      output ??= Module?.["stdout"] as ((value: number) => void) | null;
      error ??= Module?.["stderr"] as ((value: number) => void) | null;

      // 2. Core processing - mark filesystem as initialized
      FS.initialized = true;

      // Setup standard streams
      FS.createStandardStreams(input, output, error);

      // 3. Output handling - initialization complete
    },

    quit() {
      // 1. Input handling - none required

      // 2. Core processing - cleanup all open streams
      FS.initialized = false;
      for (let i = 0; i < FS.streams.length; i++) {
        const stream = FS.streams[i];
        if (!stream) {
          continue;
        }
        FS.close(stream);
      }

      // 3. Output handling - cleanup complete
    },
  };
}
