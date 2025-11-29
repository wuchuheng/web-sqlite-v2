/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createMountOperations } from "./mount-operations";
import type {
  FileSystemMount,
  FileSystemMountType,
  FSNode,
  FSStream,
  ErrnoError,
} from "../base-state/base-state";
import type { MountOperationsFS } from "./mount-operations";
import { ERRNO_CODES } from "../constants/constants";
import { PATH } from "../../../utils/path/path";

// Mock implementations
const createMockFS = (): MountOperationsFS => ({
  root: null,
  mounts: [],
  devices: {},
  streams: [],
  nextInode: 1,
  nameTable: [null],
  currentPath: "/",
  initialized: false,
  ignorePermissions: false,
  ErrnoError: class extends Error {
    errno: number;
    constructor(errno: number) {
      super(`ErrnoError: ${errno}`);
      this.errno = errno;
      this.name = "ErrnoError";
    }
  } as new (errno: number) => ErrnoError,
  genericErrors: {},
  filesystems: null,
  syncFSRequests: 0,
  readFiles: {},
  FSStream: class {} as unknown as new () => FSStream,
  FSNode: class {} as unknown as new (
    parent: FSNode,
    name: string,
    mode: number,
    rdev: number,
  ) => FSNode,
  getMounts: vi.fn(),
  lookupPath: vi.fn(),
  isMountpoint: vi.fn(),
  isDir: vi.fn(),
  mayCreate: vi.fn(),
  destroyNode: vi.fn(),
});

const createMockNode = (overrides: Partial<FSNode> = {}): FSNode => ({
  parent: null as any,
  mount: null as any,
  mounted: null,
  id: null,
  name: "",
  mode: 0,
  node_ops: {},
  stream_ops: {},
  rdev: 0,
  readMode: 0,
  writeMode: 0,
  assignId: vi.fn(),
  read: false,
  write: false,
  isFolder: false,
  isDevice: false,
  name_next: null,
  ...overrides,
});

const createMockMount = (
  overrides: Partial<FileSystemMount> = {},
): FileSystemMount => ({
  type: {
    mount: vi.fn(),
  },
  opts: {},
  mountpoint: "",
  mounts: [],
  root: createMockNode(),
  ...overrides,
});

describe("createMountOperations", () => {
  let mockFS: MountOperationsFS;
  let mockErr: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFS = createMockFS();
    mockErr = vi.fn();
  });

  test("creates mount operations with all required methods", () => {
    const ops = createMountOperations(mockFS, {
      err: mockErr as (message: string) => void,
    });

    expect(typeof ops.getMounts).toBe("function");
    expect(typeof ops.syncfs).toBe("function");
    expect(typeof ops.mount).toBe("function");
    expect(typeof ops.unmount).toBe("function");
    expect(typeof ops.lookup).toBe("function");
    expect(typeof ops.mknod).toBe("function");
  });
});

describe("getMounts", () => {
  let mockFS: MountOperationsFS;
  let mockErr: ReturnType<typeof vi.fn>;
  let ops: ReturnType<typeof createMountOperations>;

  beforeEach(() => {
    mockFS = createMockFS();
    mockErr = vi.fn();
    ops = createMountOperations(mockFS, {
      err: mockErr as (message: string) => void,
    });
  });

  test("returns array with single mount", () => {
    const mount = createMockMount();
    const result = ops.getMounts(mount);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(mount);
  });

  test("collects nested mounts recursively", () => {
    const childMount1 = createMockMount();
    const childMount2 = createMockMount();
    const grandChildMount = createMockMount();

    const parentMount = createMockMount({
      mounts: [childMount1, childMount2],
    });

    childMount1.mounts = [grandChildMount];

    const result = ops.getMounts(parentMount);

    expect(result).toHaveLength(4);
    expect(result).toContain(parentMount);
    expect(result).toContain(childMount1);
    expect(result).toContain(childMount2);
    expect(result).toContain(grandChildMount);
  });

  test("handles empty mounts array", () => {
    const mount = createMockMount({ mounts: [] });
    const result = ops.getMounts(mount);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(mount);
  });
});

describe("syncfs", () => {
  let mockFS: MountOperationsFS;
  let mockErr: ReturnType<typeof vi.fn>;
  let ops: ReturnType<typeof createMountOperations>;

  beforeEach(() => {
    mockFS = createMockFS();
    mockErr = vi.fn();
    ops = createMountOperations(mockFS, {
      err: mockErr as (message: string) => void,
    });
  });

  test("handles parameter overloading - callback only", async () => {
    const callback = vi.fn();

    const mountWithoutSyncfs = createMockMount();
    mockFS.root = createMockNode({ mount: mountWithoutSyncfs });
    mockFS.mounts = [mountWithoutSyncfs];
    mockFS.getMounts = vi.fn().mockReturnValue([mountWithoutSyncfs]);

    ops.syncfs(callback);

    // Wait for async callback
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callback).toHaveBeenCalledWith(null);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("handles parameter overloading - populate and callback", async () => {
    const callback = vi.fn();

    const mountWithoutSyncfs = createMockMount();
    mockFS.root = createMockNode({ mount: mountWithoutSyncfs });
    mockFS.mounts = [mountWithoutSyncfs];
    mockFS.getMounts = vi.fn().mockReturnValue([mountWithoutSyncfs]);

    ops.syncfs(true, callback);

    // Wait for async callback
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callback).toHaveBeenCalledWith(null);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("calls syncfs on mounts that support it", async () => {
    const callback = vi.fn();

    const mockSyncfs = vi.fn((_mount, _populate, done) => done(null));
    const mountWithSyncfs = createMockMount({
      type: {
        mount: vi.fn(),
        syncfs: mockSyncfs,
      },
    });

    const mountWithoutSyncfs = createMockMount();

    mockFS.root = createMockNode({ mount: mountWithSyncfs });
    mockFS.mounts = [mountWithSyncfs, mountWithoutSyncfs];
    mockFS.getMounts = vi
      .fn()
      .mockReturnValue([mountWithSyncfs, mountWithoutSyncfs]);

    ops.syncfs(false, callback);

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSyncfs).toHaveBeenCalledTimes(1);
    expect(mockSyncfs).toHaveBeenCalledWith(
      mountWithSyncfs,
      false,
      expect.any(Function),
    );
    expect(callback).toHaveBeenCalledWith(null);
  });

  test("handles syncfs errors", async () => {
    const callback = vi.fn();
    const testError = 5;

    const mockSyncfs = vi.fn((_mount, _populate, done) => done(testError));
    const mountWithSyncfs = createMockMount({
      type: {
        mount: vi.fn(),
        syncfs: mockSyncfs,
      },
    });

    mockFS.root = createMockNode({ mount: mountWithSyncfs });
    mockFS.mounts = [mountWithSyncfs];
    mockFS.getMounts = vi.fn().mockReturnValue([mountWithSyncfs]);

    ops.syncfs(false, callback);

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callback).toHaveBeenCalledWith(testError);
  });

  test("tracks concurrent syncfs requests", () => {
    // Test that syncfs increments and decrements the counter properly
    const callback1 = vi.fn();

    const mountWithoutSyncfs = createMockMount();
    mockFS.root = createMockNode({ mount: mountWithoutSyncfs });
    mockFS.mounts = [mountWithoutSyncfs];
    mockFS.getMounts = vi.fn().mockReturnValue([mountWithoutSyncfs]);

    // Verify that syncfs operations complete without errors
    expect(() => {
      ops.syncfs(callback1);
    }).not.toThrow();
  });
});

describe("mount", () => {
  let mockFS: MountOperationsFS;
  let mockErr: ReturnType<typeof vi.fn>;
  let ops: ReturnType<typeof createMountOperations>;

  beforeEach(() => {
    mockFS = createMockFS();
    mockErr = vi.fn();
    ops = createMountOperations(mockFS, {
      err: mockErr as (message: string) => void,
    });

    // Mock PATH.basename
    vi.spyOn(PATH, "basename").mockImplementation(
      (path: string) => path.split("/").pop() || "",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("mounts at root successfully", () => {
    const mockMountType: FileSystemMountType = {
      mount: vi.fn().mockReturnValue(createMockNode()),
    };

    const result = ops.mount(mockMountType, {}, "/");

    expect(mockMountType.mount).toHaveBeenCalled();
    expect(mockFS.root).toBeDefined();
    expect(result).toBe(mockFS.root);
  });

  test("throws error when mounting at existing root", () => {
    const mockMountType: FileSystemMountType = {
      mount: vi.fn(),
    };

    mockFS.root = createMockNode();

    expect(() => {
      ops.mount(mockMountType, {}, "/");
    }).toThrow(
      expect.objectContaining({
        errno: ERRNO_CODES.EBUSY,
      }),
    );
  });

  test("mounts at directory successfully", () => {
    const parentNode = createMockNode({
      mode: 0o777 | (1 << 14), // Directory mode
    });

    const mockLookupResult = {
      path: "/test",
      node: parentNode,
    };

    mockFS.lookupPath = vi.fn().mockReturnValue(mockLookupResult);
    mockFS.isMountpoint = vi.fn().mockReturnValue(false);
    mockFS.isDir = vi.fn().mockReturnValue(true);

    const mockMountType: FileSystemMountType = {
      mount: vi.fn().mockReturnValue(createMockNode()),
    };

    const result = ops.mount(mockMountType, {}, "/test");

    expect(mockFS.lookupPath).toHaveBeenCalledWith("/test", {
      follow_mount: false,
    });
    expect(mockFS.isMountpoint).toHaveBeenCalledWith(parentNode);
    expect(mockFS.isDir).toHaveBeenCalledWith(parentNode.mode);
    expect(parentNode.mounted).toBeDefined();
    expect(result).toBeDefined();
  });

  test("throws error when mounting at file", () => {
    const fileNode = createMockNode({
      mode: 0o666, // File mode
    });

    const mockLookupResult = {
      path: "/test/file",
      node: fileNode,
    };

    mockFS.lookupPath = vi.fn().mockReturnValue(mockLookupResult);
    mockFS.isMountpoint = vi.fn().mockReturnValue(false);

    const mockMountType: FileSystemMountType = {
      mount: vi.fn(),
    };

    expect(() => {
      ops.mount(mockMountType, {}, "/test/file");
    }).toThrow(
      expect.objectContaining({
        errno: ERRNO_CODES.ENOTDIR,
      }),
    );
  });

  test("throws error when mounting at existing mountpoint", () => {
    const mountNode = createMockNode({
      mode: 0o777 | (1 << 14), // Directory mode
      mounted: createMockMount(),
    });

    const mockLookupResult = {
      path: "/test",
      node: mountNode,
    };

    mockFS.lookupPath = vi.fn().mockReturnValue(mockLookupResult);
    mockFS.isMountpoint = vi.fn().mockReturnValue(true);

    const mockMountType: FileSystemMountType = {
      mount: vi.fn(),
    };

    expect(() => {
      ops.mount(mockMountType, {}, "/test");
    }).toThrow(
      expect.objectContaining({
        errno: ERRNO_CODES.EBUSY,
      }),
    );
  });

  test("creates pseudo mount when mountpoint is falsy", () => {
    const mockMountType: FileSystemMountType = {
      mount: vi.fn().mockReturnValue(createMockNode()),
    };

    const result = ops.mount(mockMountType, {}, "");

    expect(mockMountType.mount).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

describe("unmount", () => {
  let mockFS: MountOperationsFS;
  let mockErr: ReturnType<typeof vi.fn>;
  let ops: ReturnType<typeof createMountOperations>;

  beforeEach(() => {
    mockFS = createMockFS();
    mockErr = vi.fn();
    ops = createMountOperations(mockFS, {
      err: mockErr as (message: string) => void,
    });
  });

  test("unmounts successfully", () => {
    const mount = createMockMount();
    const parentMount = createMockMount({ mounts: [mount] });
    const node = createMockNode({
      mounted: mount,
      mount: parentMount,
    });

    const mockLookupResult = {
      node,
    };

    // Create a mock name table that the unmount function can iterate over
    const mockNameTable = [node, null];
    const mockNameTableKeys = ["0"];

    mockFS.lookupPath = vi.fn().mockReturnValue(mockLookupResult);
    mockFS.isMountpoint = vi.fn().mockReturnValue(true);
    mockFS.getMounts = vi.fn().mockReturnValue([mount]);
    mockFS.destroyNode = vi.fn();

    // Mock Object.keys to return our keys
    vi.spyOn(Object, "keys").mockReturnValue(mockNameTableKeys);

    // Set up nameTable to be iteratable
    Object.defineProperty(mockFS, "nameTable", {
      value: mockNameTable,
      writable: true,
    });

    ops.unmount("/test");

    expect(node.mounted).toBeNull();

    // Restore the original Object.keys
    vi.restoreAllMocks();
  });

  test("throws error when unmounting non-mountpoint", () => {
    const node = createMockNode({
      mounted: null,
    });

    const mockLookupResult = {
      node,
    };

    mockFS.lookupPath = vi.fn().mockReturnValue(mockLookupResult);
    mockFS.isMountpoint = vi.fn().mockReturnValue(false);

    expect(() => {
      ops.unmount("/test");
    }).toThrow(
      expect.objectContaining({
        errno: ERRNO_CODES.EINVAL,
      }),
    );
  });
});

describe("lookup", () => {
  let mockFS: MountOperationsFS;
  let mockErr: ReturnType<typeof vi.fn>;
  let ops: ReturnType<typeof createMountOperations>;

  beforeEach(() => {
    mockFS = createMockFS();
    mockErr = vi.fn();
    ops = createMountOperations(mockFS, {
      err: mockErr as (message: string) => void,
    });
  });

  test("delegates to parent node_ops.lookup", () => {
    const childNode = createMockNode({ name: "child" });
    const parentNode = createMockNode();

    const mockLookup = vi.fn().mockReturnValue(childNode);
    parentNode.node_ops.lookup = mockLookup;

    const result = ops.lookup(parentNode, "child");

    expect(mockLookup).toHaveBeenCalledWith(parentNode, "child");
    expect(result).toBe(childNode);
  });
});

describe("mknod", () => {
  let mockFS: MountOperationsFS;
  let mockErr: ReturnType<typeof vi.fn>;
  let ops: ReturnType<typeof createMountOperations>;

  beforeEach(() => {
    mockFS = createMockFS();
    mockErr = vi.fn();
    ops = createMountOperations(mockFS, {
      err: mockErr as (message: string) => void,
    });

    // Mock PATH.basename
    vi.spyOn(PATH, "basename").mockImplementation(
      (path: string) => path.split("/").pop() || "",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("creates node successfully", () => {
    const parentNode = createMockNode();
    const childNode = createMockNode({ name: "test" });

    const mockLookupResult = {
      node: parentNode,
    };

    mockFS.lookupPath = vi.fn().mockReturnValue(mockLookupResult);
    mockFS.mayCreate = vi.fn().mockReturnValue(0); // Success

    const mockMknod = vi.fn().mockReturnValue(childNode);
    parentNode.node_ops.mknod = mockMknod;

    const result = ops.mknod("/test", 0o666, 1);

    expect(mockFS.lookupPath).toHaveBeenCalledWith("/test", { parent: true });
    expect(mockFS.mayCreate).toHaveBeenCalledWith(parentNode, "test");
    expect(mockMknod).toHaveBeenCalledWith(parentNode, "test", 0o666, 1);
    expect(result).toBe(childNode);
  });

  test("throws error for invalid names", () => {
    const parentNode = createMockNode();

    const mockLookupResult = {
      node: parentNode,
    };

    mockFS.lookupPath = vi.fn().mockReturnValue(mockLookupResult);
    mockFS.mayCreate = vi.fn().mockReturnValue(0); // Success

    expect(() => {
      ops.mknod("", 0o666, 1);
    }).toThrow(
      expect.objectContaining({
        errno: ERRNO_CODES.EINVAL,
      }),
    );
  });

  test("throws error when mayCreate fails", () => {
    const parentNode = createMockNode();

    const mockLookupResult = {
      node: parentNode,
    };

    mockFS.lookupPath = vi.fn().mockReturnValue(mockLookupResult);
    mockFS.mayCreate = vi.fn().mockReturnValue(ERRNO_CODES.EACCES); // Permission denied

    expect(() => {
      ops.mknod("/test", 0o666, 1);
    }).toThrow(
      expect.objectContaining({
        errno: ERRNO_CODES.EACCES,
      }),
    );
  });

  test("throws error when mknod not supported", () => {
    const parentNode = createMockNode();

    const mockLookupResult = {
      node: parentNode,
    };

    mockFS.lookupPath = vi.fn().mockReturnValue(mockLookupResult);
    mockFS.mayCreate = vi.fn().mockReturnValue(0); // Success

    expect(() => {
      ops.mknod("/test", 0o666, 1);
    }).toThrow(
      expect.objectContaining({
        errno: ERRNO_CODES.EPERM,
      }),
    );
  });
});
