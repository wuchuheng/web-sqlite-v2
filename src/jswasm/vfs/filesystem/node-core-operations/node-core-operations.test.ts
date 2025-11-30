/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { createCoreOperations } from "./node-core-operations";
import type { FSNode, ErrnoError } from "../base-state/base-state";
import type { CoreOperationsFS } from "./node-core-operations";

// Mock implementations
const createMockFS = (): CoreOperationsFS => ({
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
  FSStream: class {} as unknown as new () => any,
  FSNode: class {} as unknown as new (
    parent: FSNode,
    name: string,
    mode: number,
    rdev: number,
  ) => FSNode,
  mknod: vi.fn(),
  lookupPath: vi.fn(),
  mayCreate: vi.fn(),
  mayDelete: vi.fn(),
  lookupNode: vi.fn(),
  isDir: vi.fn(),
  isMountpoint: vi.fn(),
  hashRemoveNode: vi.fn(),
  hashAddNode: vi.fn(),
  destroyNode: vi.fn(),
  nodePermissions: vi.fn(),
  getPath: vi.fn(),
  mkdir: vi.fn(),
});

const createMockOptions = () => {
  const mockPathFS = {
    resolve: vi.fn(),
    relative: vi.fn(),
  };

  return {
    getPathFS: () => mockPathFS,
    FS_modeStringToFlags: vi.fn().mockReturnValue(0),
    Module: { wasmMemory: {} as WebAssembly.Memory },
  };
};

describe("createCoreOperations", () => {
  let mockFS: CoreOperationsFS;
  let mockOptions: ReturnType<typeof createMockOptions>;

  beforeEach(() => {
    mockFS = createMockFS();
    mockOptions = createMockOptions();
  });

  test("creates core operations with all required methods", () => {
    const ops = createCoreOperations(mockFS, mockOptions);

    expect(typeof ops.create).toBe("function");
    expect(typeof ops.mkdir).toBe("function");
    expect(typeof ops.mkdirTree).toBe("function");
    expect(typeof ops.mkdev).toBe("function");
    expect(typeof ops.symlink).toBe("function");
    expect(typeof ops.rename).toBe("function");
    expect(typeof ops.rmdir).toBe("function");
    expect(typeof ops.readdir).toBe("function");
    expect(typeof ops.unlink).toBe("function");
    expect(typeof ops.readlink).toBe("function");
  });
});
