import { ERRNO_CODES, MAX_OPEN_FDS } from "../constants/constants";
import type {
  DeviceDefinition,
  FSStream,
  MutableFS,
  StreamOps,
} from "../base-state/base-state";

/**
 * Extended MutableFS interface that includes the methods required by stream operations.
 * This interface extends the base MutableFS with stream helper methods that are added
 * by this module during runtime initialization.
 */
export interface StreamOperationsFS extends MutableFS {
  /** Maximum number of simultaneously open file descriptors. */
  MAX_OPEN_FDS: number;
  /** Finds the next available file descriptor. */
  nextfd(): number;
  /** Gets a stream without error checking. */
  getStream(fd: number): FSStream | null;
  /** Creates a new stream with optional file descriptor. */
  createStream(stream: Partial<FSStream>, fd?: number): FSStream;
  /** Gets a registered character device. */
  getDevice(dev: number): DeviceDefinition | undefined;
}

/**
 * Low-level stream bookkeeping helpers exposed by the filesystem facade.
 */
export interface StreamOperations {
  /** Maximum number of simultaneously open file descriptors. */
  readonly MAX_OPEN_FDS: number;
  /** Finds the next available file descriptor. */
  nextfd(): number;
  /** Gets a stream with error checking for bad file descriptor. */
  getStreamChecked(fd: number): FSStream;
  /** Gets a stream without error checking. */
  getStream(fd: number): FSStream | null;
  /** Creates a new stream with optional file descriptor. */
  createStream(stream: Partial<FSStream>, fd?: number): FSStream;
  /** Closes a stream by clearing its file descriptor. */
  closeStream(fd: number): void;
  /** Duplicates an existing stream. */
  dupStream(original: FSStream, fd?: number): FSStream;
  /** Character device stream operations. */
  chrdev_stream_ops: {
    /** Opens a character device stream. */
    open(stream: FSStream): void;
    /** Seeks on a character device (always throws ESPIPE). */
    llseek(): never;
  };
  /** Extracts major device number from device ID. */
  major(dev: number): number;
  /** Extracts minor device number from device ID. */
  minor(dev: number): number;
  /** Creates device ID from major and minor numbers. */
  makedev(major: number, minor: number): number;
  /** Registers a character device with the filesystem. */
  registerDevice(dev: number, ops: StreamOps): void;
  /** Gets a registered character device. */
  getDevice(dev: number): DeviceDefinition | undefined;
}

/**
 * Constructs the stream bookkeeping helpers for the given filesystem state.
 *
 * @param FS - The mutable filesystem state to extend with stream operations
 * @returns Stream operations instance for managing file descriptors and devices
 */
export function createStreamOperations(FS: MutableFS): StreamOperations {
  // Cast FS to the extended interface expected by the operations
  // This is safe because the runtime FS object implements these methods
  const streamFS = FS as StreamOperationsFS;
  return {
    MAX_OPEN_FDS,

    /**
     * Finds the next available file descriptor.
     *
     * @returns {number} The next available file descriptor
     * @throws {ErrnoError} When all file descriptors are in use (EMFILE)
     */
    nextfd() {
      // 1. Input handling - no inputs

      // 2. Core processing - iterate through file descriptors
      for (let fd = 0; fd <= streamFS.MAX_OPEN_FDS; fd++) {
        if (!streamFS.streams[fd]) {
          return fd;
        }
      }

      // 3. Output handling - throw error when no descriptors available
      throw new streamFS.ErrnoError(ERRNO_CODES.EMFILE);
    },

    /**
     * Gets a stream with error checking.
     *
     * @param fd - File descriptor to retrieve
     * @returns {FSStream} The stream for the given file descriptor
     * @throws {ErrnoError} When file descriptor is invalid (EBADF)
     */
    getStreamChecked(fd) {
      // 1. Input handling - validate fd parameter (implicit)

      // 2. Core processing - get stream with validation
      const stream = streamFS.getStream(fd);
      if (!stream) {
        // 3. Output handling - throw error for bad file descriptor
        throw new streamFS.ErrnoError(ERRNO_CODES.EBADF);
      }

      return stream;
    },

    /**
     * Gets a stream without error checking.
     *
     * @param fd - File descriptor to retrieve
     * @returns {FSStream | null} The stream or null if not found
     */
    getStream: (fd) => streamFS.streams[fd],

    /**
     * Creates a new stream instance.
     *
     * @param stream - Partial stream properties to assign
     * @param fd - Optional file descriptor (auto-assigned if -1)
     * @returns {FSStream} The created stream instance
     */
    createStream(stream, fd = -1) {
      // 1. Input handling - assign default fd value
      const actualFd = fd === -1 ? streamFS.nextfd() : fd;

      // 2. Core processing - create stream instance and assign properties
      const newStream = Object.assign(new streamFS.FSStream(), stream);
      newStream.fd = actualFd;
      streamFS.streams[actualFd] = newStream;

      // 3. Output handling - return created stream
      return newStream;
    },

    /**
     * Closes a stream by clearing its file descriptor slot.
     *
     * @param fd - File descriptor to close
     */
    closeStream(fd) {
      // 1. Input handling - validate fd parameter (implicit)

      // 2. Core processing - clear the stream slot
      streamFS.streams[fd] = null;

      // 3. Output handling - no return value
    },

    /**
     * Duplicates an existing stream.
     *
     * @param origStream - Original stream to duplicate
     * @param fd - Optional file descriptor for duplicate (auto-assigned if -1)
     * @returns {FSStream} The duplicated stream
     */
    dupStream(origStream, fd = -1) {
      // 1. Input handling - assign default fd value

      // 2. Core processing - create duplicate and call dup callback
      const stream = streamFS.createStream(origStream, fd);
      stream.stream_ops?.dup?.(stream);

      // 3. Output handling - return duplicated stream
      return stream;
    },

    chrdev_stream_ops: {
      /**
       * Opens a character device stream.
       *
       * @param stream - Stream to open as character device
       */
      open(stream) {
        // 1. Input handling - validate stream parameter
        if (!stream.node) {
          throw new streamFS.ErrnoError(ERRNO_CODES.EINVAL);
        }

        // 2. Core processing - get device and set stream operations
        const device = streamFS.getDevice(stream.node.rdev);
        if (device) {
          stream.stream_ops = device.stream_ops;
          stream.stream_ops.open?.(stream);
        } else {
          throw new streamFS.ErrnoError(ERRNO_CODES.ENXIO);
        }

        // 3. Output handling - no return value
      },

      /**
       * Seeks on a character device (illegal operation).
       *
       * @throws {ErrnoError} Always throws ESPIPE for character devices
       */
      llseek() {
        // 1. Input handling - no inputs

        // 2. Core processing - character devices don't support seeking

        // 3. Output handling - always throw illegal seek error
        throw new streamFS.ErrnoError(ERRNO_CODES.ESPIPE);
      },
    },

    /**
     * Extracts the major device number from a device ID.
     *
     * @param dev - Device ID containing major and minor numbers
     * @returns {number} Major device number (high 8 bits)
     */
    major: (dev) => dev >> 8,

    /**
     * Extracts the minor device number from a device ID.
     *
     * @param dev - Device ID containing major and minor numbers
     * @returns {number} Minor device number (low 8 bits)
     */
    minor: (dev) => dev & 0xff,

    /**
     * Creates a device ID from major and minor numbers.
     *
     * @param ma - Major device number
     * @param mi - Minor device number
     * @returns {number} Combined device ID
     */
    makedev: (ma, mi) => (ma << 8) | mi,

    /**
     * Registers a character device with the filesystem.
     *
     * @param dev - Device ID
     * @param ops - Stream operations for the device
     */
    registerDevice(dev, ops) {
      // 1. Input handling - validate parameters (implicit)

      // 2. Core processing - store device definition
      streamFS.devices[dev] = { stream_ops: ops };

      // 3. Output handling - no return value
    },

    /**
     * Gets a registered character device.
     *
     * @param dev - Device ID to retrieve
     * @returns {DeviceDefinition | undefined} Device definition or undefined if not found
     */
    getDevice: (dev) => streamFS.devices[dev],
  };
}
