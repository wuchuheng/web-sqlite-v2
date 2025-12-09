import { describe, it, expect, vi, beforeEach } from "vitest";
import { runSanityCheck, type SanityCheckDeps } from "./sanity-check";

describe("runSanityCheck", () => {
  let deps: SanityCheckDeps;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wasm: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let capi: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let state: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vfsSyncWrappers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ioSyncWrappers: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let opfsVfs: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sq3File: any;

  beforeEach(() => {
    // Mock basic dependencies
    wasm = {
      scopedAllocPush: vi.fn().mockReturnValue(1),
      scopedAllocPop: vi.fn(),
      scopedAllocCString: vi.fn().mockReturnValue(100),
      scopedAlloc: vi.fn().mockReturnValue(200),
      peek: vi.fn(),
      poke: vi.fn(),
      cstrToJs: vi.fn().mockReturnValue("sanity"),
    };

    sq3File = {
      pointer: 123,
      dispose: vi.fn(),
    };

    // Mock class constructor properly
    // The mjs code calls `new sqlite3_file()` so we need a class or a function that behaves like a constructor
    const MockSqlite3File = class {
      constructor() {
        return sq3File;
      }
    };

    capi = {
      sqlite3_file: MockSqlite3File,
      SQLITE_OPEN_CREATE: 0x00000004,
      SQLITE_OPEN_READWRITE: 0x00000002,
      SQLITE_OPEN_MAIN_DB: 0x00000100,
    };

    state = {
      sabOPView: new Int32Array(100),
      opIds: { xOpen: 1 },
      s11n: {
        serialize: vi.fn(),
        deserialize: vi.fn().mockReturnValue(["This is ä string."]),
      },
    };

    vfsSyncWrappers = {
      xAccess: vi.fn(),
      xOpen: vi.fn().mockReturnValue(0),
      xDelete: vi.fn(),
      xSleep: vi.fn(),
    };

    ioSyncWrappers = {
      xSync: vi.fn().mockReturnValue(0),
      xTruncate: vi.fn().mockReturnValue(0),
      xFileSize: vi.fn().mockReturnValue(0),
      xWrite: vi.fn().mockReturnValue(0),
      xRead: vi.fn().mockReturnValue(0),
      xClose: vi.fn().mockReturnValue(0),
    };

    opfsVfs = {
      pointer: 456,
      $iVersion: 1,
      $zName: 2,
      $mxPathname: 3,
    };

    deps = {
      wasm,
      capi,
      state,
      vfsSyncWrappers,
      ioSyncWrappers,
      opfsVfs,
      randomFilename: vi.fn().mockReturnValue("12345678"),
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      toss: vi.fn().mockImplementation((...args) => {
        throw new Error(args.join(" "));
      }) as unknown as (...args: unknown[]) => never,
    };
  });

  it("should run through the happy path successfully", () => {
    // Setup specific return values for happy path
    wasm.peek.mockImplementation((_ptr: number, _type: string) => {
      // xAccess check (does not exist) -> 0
      // xAccess check (exists) -> 1
      // xFileSize -> return value
      // xAccess check (after delete) -> 0
      return 0; // Default
    });

    // We need to carefully mock peek to return different values based on call order or context
    // 1. xAccess (pre-open): peek -> 0 (doesn't exist)
    // 2. xAccess (post-open): peek -> 1 (exists)
    // 3. xFileSize: peek -> 1234 (size)
    // 4. xAccess (post-delete): peek -> 0 (gone)

    let peekCallCount = 0;
    wasm.peek.mockImplementation(() => {
      peekCallCount++;
      if (peekCallCount === 1) return 0; // xAccess pre-open
      if (peekCallCount === 2) return 1; // xAccess post-open
      if (peekCallCount === 3) return 1024; // xFileSize
      if (peekCallCount === 4) return 0; // xAccess post-delete
      return 0;
    });

    runSanityCheck(deps);

    // Verifications
    expect(state.s11n.serialize).toHaveBeenCalledWith("This is ä string.");
    expect(state.s11n.deserialize).toHaveBeenCalled();
    expect(vfsSyncWrappers.xOpen).toHaveBeenCalled();
    expect(ioSyncWrappers.xWrite).toHaveBeenCalled();
    expect(ioSyncWrappers.xRead).toHaveBeenCalled();
    expect(vfsSyncWrappers.xDelete).toHaveBeenCalled();
    expect(sq3File.dispose).toHaveBeenCalled();
    expect(wasm.scopedAllocPop).toHaveBeenCalled();
  });

  it("should toss if deserialization fails", () => {
    state.s11n.deserialize.mockReturnValue(["Wrong string"]);
    expect(() => runSanityCheck(deps)).toThrow("String d13n error.");
  });

  it("should error if xOpen fails", () => {
    vfsSyncWrappers.xOpen.mockReturnValue(10); // Error code
    runSanityCheck(deps);
    expect(deps.error).toHaveBeenCalledWith("open failed with code", 10);
    // Should return early, so subsequent checks shouldn't happen
    expect(vfsSyncWrappers.xAccess).toHaveBeenCalledTimes(1); // Only the first check
  });

  it("should toss if file not detected after open", () => {
    // 1. xAccess (pre-open): peek -> 0
    // 2. xAccess (post-open): peek -> 0 (FAIL)
    let peekCallCount = 0;
    wasm.peek.mockImplementation(() => {
      peekCallCount++;
      if (peekCallCount === 1) return 0;
      if (peekCallCount === 2) return 0;
      return 0;
    });

    expect(() => runSanityCheck(deps)).toThrow(
      "xAccess() failed to detect file.",
    );
  });

  it("should toss if xSync fails", () => {
    // Setup pass up to xSync
    let peekCallCount = 0;
    wasm.peek.mockImplementation(() => {
      peekCallCount++;
      if (peekCallCount === 1) return 0;
      if (peekCallCount === 2) return 1;
      return 0;
    });

    ioSyncWrappers.xSync.mockReturnValue(5);
    expect(() => runSanityCheck(deps)).toThrow("sync failed w/ rc 5");
  });

  it("should toss if xRead returns unexpected value", () => {
    // Setup pass up to xRead
    let peekCallCount = 0;
    wasm.peek.mockImplementation(() => {
      peekCallCount++;
      if (peekCallCount === 1) return 0;
      if (peekCallCount === 2) return 1;
      if (peekCallCount === 3) return 1024;
      return 0;
    });

    wasm.cstrToJs.mockReturnValue("wrong content");
    expect(() => runSanityCheck(deps)).toThrow("Unexpected xRead() value.");
  });

  it("should verify xSleep execution if available", () => {
    let peekCallCount = 0;
    wasm.peek.mockImplementation(() => {
      peekCallCount++;
      if (peekCallCount === 1) return 0; // xAccess pre-open
      if (peekCallCount === 2) return 1; // xAccess post-open
      if (peekCallCount === 3) return 1024; // xFileSize
      if (peekCallCount === 4) return 0; // xAccess post-delete
      return 0;
    });

    runSanityCheck(deps);
    expect(vfsSyncWrappers.xSleep).toHaveBeenCalledWith(opfsVfs.pointer, 2000);
  });
});
