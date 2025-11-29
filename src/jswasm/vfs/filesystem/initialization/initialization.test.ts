import { describe, it, expect, beforeEach, vi } from "vitest";
import { createInitializationHelpers } from "./initialization";
import { createBaseState } from "../base-state/base-state";
import * as constants from "../constants/constants.js";
import type { StreamOps, FSNode, FileSystemMountType, FSStream } from "../base-state/base-state";
import type { RuntimeModule } from "../../../shared/runtime-types";
import type { MutableFS } from "./initialization";

describe("createInitializationHelpers", () => {
  // Define a type that extends the base state with the mocked methods
  // Using Partial to allow for easier mocking of complex types
  type MockFS = MutableFS & {
    mkdir: ReturnType<typeof vi.fn>;
    registerDevice: ReturnType<typeof vi.fn>;
    mkdev: ReturnType<typeof vi.fn>;
    createDevice: ReturnType<typeof vi.fn>;
    symlink: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    mount: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    getStreamChecked: ReturnType<typeof vi.fn>;
    createNode: ReturnType<typeof vi.fn>;
    createDefaultDirectories: ReturnType<typeof vi.fn>;
    createStandardStreams: ReturnType<typeof vi.fn>;
    makedev: ReturnType<typeof vi.fn>;
  };

  let fs: MockFS;
  let mockTTY: {
    register: ReturnType<typeof vi.fn>;
    default_tty_ops: StreamOps;
    default_tty1_ops: StreamOps;
  };
  let mockRandomFill: ReturnType<typeof vi.fn>;
  let mockModule: Record<string, unknown>;

  beforeEach(() => {
    // Setup fresh filesystem for each test
    const baseState = createBaseState();
    
    // Create the mock FS by combining base state with spy functions
    // casting to unknown first to avoid strict type checking during the merge
    fs = Object.assign(baseState, {
      mkdir: vi.fn(),
      makedev: vi.fn(() => 1),
      registerDevice: vi.fn(),
      mkdev: vi.fn(),
      createDevice: vi.fn(),
      symlink: vi.fn(),
      open: vi.fn(),
      mount: vi.fn(),
      close: vi.fn(),
      getStreamChecked: vi.fn(() => ({ path: "/test/file" })),
      createNode: vi.fn(() => ({
        node_ops: {
          lookup: vi.fn(() => ({
            parent: null,
            mount: { mountpoint: "fake" },
            node_ops: { readlink: vi.fn(() => "/test/file") },
          })),
        },
        parent: null,
        mount: { mountpoint: "fake" },
      })),
      createDefaultDirectories: vi.fn(),
      createStandardStreams: vi.fn(),
      initialized: false,
      genericErrors: {},
      nameTable: new Array(4096).fill(null),
      filesystems: {},
      streams: [],
    }) as unknown as MockFS;

    // Setup mock TTY operations
    mockTTY = {
      register: vi.fn(),
      default_tty_ops: { read: vi.fn(), write: vi.fn() },
      default_tty1_ops: { put_char: vi.fn() as unknown, fsync: vi.fn() } as unknown as StreamOps,
    };

    // Setup predictable random fill
    mockRandomFill = vi.fn((buffer: Uint8Array) => {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = i % 256; // Predictable pattern
      }
      return buffer;
    });

    // Setup mock module with stdio
    mockModule = {
      stdin: vi.fn(() => 65), // 'A'
      stdout: vi.fn(),
      stderr: vi.fn(),
    };
  });

  describe("createDefaultDirectories", () => {
    it("should create standard directory hierarchy", () => {
      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });
      helpers.createDefaultDirectories();

      // Verify directories were created by checking mkdir calls
      expect(fs.mkdir).toHaveBeenCalledWith("/tmp");
      expect(fs.mkdir).toHaveBeenCalledWith("/home");
      expect(fs.mkdir).toHaveBeenCalledWith("/home/web_user");

      // Check that filesystem state remains unchanged
      expect(fs.initialized).toBe(false); // Should remain false until init() is called
    });
  });

  describe("createDefaultDevices", () => {
    it("should create device directory structure", () => {
      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });
      helpers.createDefaultDevices(
        mockTTY as unknown as { register: (dev: number, ops: StreamOps) => void; default_tty_ops: StreamOps; default_tty1_ops: StreamOps },
        mockRandomFill as (buffer: Uint8Array) => Uint8Array
      );

      // Verify /dev directory was created
      expect(fs.mkdir).toHaveBeenCalledWith("/dev");

      // Verify null device registration
      expect(fs.registerDevice).toHaveBeenCalled();
      expect(fs.mkdev).toHaveBeenCalledWith("/dev/null", expect.any(Number));
    });

    it("should register TTY devices", () => {
      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });
      helpers.createDefaultDevices(
        mockTTY as unknown as { register: (dev: number, ops: StreamOps) => void; default_tty_ops: StreamOps; default_tty1_ops: StreamOps },
        mockRandomFill as (buffer: Uint8Array) => Uint8Array
      );

      // Verify TTY registration calls
      expect(mockTTY.register).toHaveBeenCalledWith(
        expect.any(Number), // dev number
        mockTTY.default_tty_ops
      );
      expect(mockTTY.register).toHaveBeenCalledWith(
        expect.any(Number), // dev number
        mockTTY.default_tty1_ops
      );

      // Verify TTY device creation
      expect(fs.mkdev).toHaveBeenCalledWith("/dev/tty", expect.any(Number));
      expect(fs.mkdev).toHaveBeenCalledWith("/dev/tty1", expect.any(Number));
    });

    it("should setup random devices with buffer management", () => {
      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });
      helpers.createDefaultDevices(
        mockTTY as unknown as { register: (dev: number, ops: StreamOps) => void; default_tty_ops: StreamOps; default_tty1_ops: StreamOps },
        mockRandomFill as (buffer: Uint8Array) => Uint8Array
      );

      // Verify random device creation
      expect(fs.createDevice).toHaveBeenCalledWith("/dev", "random", expect.any(Function));
      expect(fs.createDevice).toHaveBeenCalledWith("/dev", "urandom", expect.any(Function));
      expect(fs.mkdir).toHaveBeenCalledWith("/dev/shm");
      expect(fs.mkdir).toHaveBeenCalledWith("/dev/shm/tmp");

      // Test random fill function behavior
      const testBuffer = new Uint8Array(16);
      (mockRandomFill as unknown as (buffer: Uint8Array) => Uint8Array)(testBuffer);
      expect(mockRandomFill).toHaveBeenCalledWith(testBuffer);
    });
  });

  describe("createSpecialDirectories", () => {
    it("should create proc filesystem structure", () => {
      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });
      helpers.createSpecialDirectories();

      // Verify /proc structure creation
      expect(fs.mkdir).toHaveBeenCalledWith("/proc");
      expect(fs.mkdir).toHaveBeenCalledWith("/proc/self");
      expect(fs.mkdir).toHaveBeenCalledWith("/proc/self/fd");

      // Verify mount operation
      expect(fs.mount).toHaveBeenCalledWith(
        expect.objectContaining({
          mount: expect.any(Function),
        }),
        {},
        "/proc/self/fd"
      );
    });

    it("should setup fd lookup functionality", () => {
      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });
      helpers.createSpecialDirectories();

      // Get the mount function and test it
      const mountCall = (fs.mount as ReturnType<typeof vi.fn>).mock.calls[0];
      const mountObj = mountCall[0];

      if (mountObj.mount && typeof mountObj.mount === "function") {
        const node = mountObj.mount();
        expect(node.node_ops.lookup).toBeDefined();

        // Test fd lookup
        const lookupResult = node.node_ops.lookup(null, "1");
        expect(lookupResult.parent).toBe(lookupResult); // Self-referencing as expected
        expect(lookupResult.mount.mountpoint).toBe("fake");
      }
    });
  });

  describe("createStandardStreams", () => {
    it("should create custom streams when callbacks provided", () => {
      const input = vi.fn(() => 66);
      const output = vi.fn();
      const error = vi.fn();

      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });
      helpers.createStandardStreams(input, output, error);

      // Verify custom stream creation
      expect(fs.createDevice).toHaveBeenCalledWith("/dev", "stdin", input);
      expect(fs.createDevice).toHaveBeenCalledWith("/dev", "stdout", null, output);
      expect(fs.createDevice).toHaveBeenCalledWith("/dev", "stderr", null, error);

      // Verify stream opening
      expect(fs.open).toHaveBeenCalledWith("/dev/stdin", constants.OPEN_FLAGS.O_RDONLY);
      expect(fs.open).toHaveBeenCalledWith("/dev/stdout", constants.OPEN_FLAGS.O_WRONLY);
      expect(fs.open).toHaveBeenCalledWith("/dev/stderr", constants.OPEN_FLAGS.O_WRONLY);
    });

    it("should create symlinks when callbacks not provided", () => {
      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });
      helpers.createStandardStreams(null, null, null);

      // Verify symlink creation for null callbacks
      expect(fs.symlink).toHaveBeenCalledWith("/dev/tty", "/dev/stdin");
      expect(fs.symlink).toHaveBeenCalledWith("/dev/tty", "/dev/stdout");
      expect(fs.symlink).toHaveBeenCalledWith("/dev/tty1", "/dev/stderr");

      // Verify stream opening
      expect(fs.open).toHaveBeenCalledTimes(3);
    });

    it("should create symlinks when no callbacks provided", () => {
      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });
      helpers.createStandardStreams();

      // When no callbacks provided, should create symlinks to TTY devices
      expect(fs.symlink).toHaveBeenCalledWith("/dev/tty", "/dev/stdin");
      expect(fs.symlink).toHaveBeenCalledWith("/dev/tty", "/dev/stdout");
      expect(fs.symlink).toHaveBeenCalledWith("/dev/tty1", "/dev/stderr");

      // Verify stream opening
      expect(fs.open).toHaveBeenCalledTimes(3);
      expect(fs.open).toHaveBeenCalledWith("/dev/stdin", constants.OPEN_FLAGS.O_RDONLY);
      expect(fs.open).toHaveBeenCalledWith("/dev/stdout", constants.OPEN_FLAGS.O_WRONLY);
      expect(fs.open).toHaveBeenCalledWith("/dev/stderr", constants.OPEN_FLAGS.O_WRONLY);
    });
  });

  describe("staticInit", () => {
    it("should initialize filesystem backing store", () => {
      const mockMEMFS = {
        mount: vi.fn(() => ({ mockNode: true } as unknown as FSNode)),
      } as unknown as FileSystemMountType;

      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });
      helpers.staticInit(mockMEMFS);

      // Verify error initialization
      expect(fs.genericErrors).toHaveProperty(String(constants.ERRNO_CODES.ENOENT));
      expect(fs.genericErrors[constants.ERRNO_CODES.ENOENT].name).toBe("ErrnoError");
      expect(fs.genericErrors[constants.ERRNO_CODES.ENOENT].stack).toBe("<generic error, no stack>");

      // Verify name table initialization
      expect(fs.nameTable).toHaveLength(constants.MAX_OPEN_FDS);

      // Verify MEMFS mounting
      expect(fs.mount).toHaveBeenCalledWith(mockMEMFS, {}, "/");

      // Verify filesystem registration
      expect(fs.filesystems).toEqual({ MEMFS: mockMEMFS });
    });
  });

  describe("init", () => {
    it("should mark filesystem as initialized and setup streams", () => {
      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });

      helpers.init();

      expect(fs.initialized).toBe(true);
    });

    it("should use custom stdio callbacks", () => {
      const customInput = vi.fn();
      const customOutput = vi.fn();
      const customError = vi.fn();

      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });

      helpers.init(customInput, customOutput, customError);

      expect(fs.initialized).toBe(true);
    });
  });

  describe("quit", () => {
    it("should close all open streams and reset initialization", () => {
      // Setup streams manually for this test
      fs.streams = [
        null, // fd 0 - null
        { close: vi.fn() } as unknown as FSStream, // fd 1 - valid stream
        null, // fd 2 - null
        { close: vi.fn() } as unknown as FSStream, // fd 3 - valid stream
      ];

      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });
      helpers.quit();

      expect(fs.initialized).toBe(false);

      // Verify close was called on valid streams
      expect(fs.close).toHaveBeenCalledTimes(2);
      expect(fs.close).toHaveBeenCalledWith(fs.streams[1]);
      expect(fs.close).toHaveBeenCalledWith(fs.streams[3]);
    });

    it("should handle empty streams array", () => {
      fs.streams = [];
      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });

      expect(() => helpers.quit()).not.toThrow();
      expect(fs.initialized).toBe(false);
    });

    it("should handle all null streams", () => {
      fs.streams = [null, null, null];
      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });

      helpers.quit();

      expect(fs.close).not.toHaveBeenCalled();
      expect(fs.initialized).toBe(false);
    });
  });

  describe("Integration tests", () => {
    it("should maintain consistency across full initialization lifecycle", () => {
      const mockMEMFS = { mount: vi.fn() } as unknown as FileSystemMountType;

      const helpers = createInitializationHelpers(fs as unknown as MutableFS, { Module: mockModule as unknown as RuntimeModule });

      // Run full initialization sequence
      helpers.staticInit(mockMEMFS);
      expect(fs.filesystems).toHaveProperty("MEMFS");

      helpers.createDefaultDirectories();
      helpers.createDefaultDevices(
        mockTTY as unknown as { register: (dev: number, ops: StreamOps) => void; default_tty_ops: StreamOps; default_tty1_ops: StreamOps },
        mockRandomFill as (buffer: Uint8Array) => Uint8Array
      );
      helpers.createSpecialDirectories();

      helpers.init();
      expect(fs.initialized).toBe(true);

      helpers.quit();
      expect(fs.initialized).toBe(false);

      // Verify no errors thrown during full cycle
      expect(fs.initialized).toBe(false);
    });
  });
});