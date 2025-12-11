import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createInstallOpfsVfsContext } from "./index";

// Mock dependencies
vi.mock("../core/environment-validation/environment-validation", () => ({
  validateOpfsEnvironment: vi.fn(),
  thisThreadHasOPFS: vi.fn(() => true),
}));

vi.mock("../core/config-setup/config-setup", () => ({
  prepareOpfsConfig: vi.fn(),
}));

vi.mock("../core/serialization/serialization", () => ({
  createSerializer: vi.fn(() => ({
    serialize: vi.fn(),
    deserialize: vi.fn(),
  })),
}));

vi.mock("../core/state-initialization/state-initialization", () => ({
  initializeOpfsState: vi.fn(() => ({
    opIds: {},
    sq3Codes: {},
    opfsFlags: {},
    sabIO: new SharedArrayBuffer(1024),
    sabOP: new SharedArrayBuffer(1024),
  })),
  initializeMetrics: vi.fn(() => ({})),
}));

vi.mock("../core/operation-runner/operation-runner", () => ({
  createOperationRunner: vi.fn(() => vi.fn()),
  createOperationTimer: vi.fn(() => ({
    mTimeStart: vi.fn(),
    mTimeEnd: vi.fn(),
  })),
}));

vi.mock("../wrappers/io-sync-wrappers/io-sync-wrappers", () => ({
  createIoSyncWrappers: vi.fn(() => ({})),
}));

vi.mock("../wrappers/vfs-sync-wrappers/vfs-sync-wrappers", () => ({
  createVfsSyncWrappers: vi.fn(() => ({})),
}));

vi.mock("../utils/opfs-util/opfs-util", () => ({
  createOpfsUtil: vi.fn(() => ({
    metrics: { dump: vi.fn(), reset: vi.fn() },
    debug: { asyncShutdown: vi.fn(), asyncRestart: vi.fn() },
  })),
}));

vi.mock("../utils/sanity-check/sanity-check", () => ({
  runSanityCheck: vi.fn(),
}));

vi.mock("../utils/worker-message-handler/worker-message-handler", () => ({
  createWorkerMessageHandler: vi.fn(() => vi.fn()),
}));

vi.mock("../wrappers/vfs-integration/vfs-integration", () => ({
  setupOptionalVfsMethods: vi.fn(() => ({})),
  integrateWithOo1: vi.fn(),
}));

describe("createInstallOpfsVfsContext", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sqlite3: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWorker: any;

  beforeEach(() => {
    // Mock SQLite3 module
    sqlite3 = {
      capi: {
        sqlite3_vfs: class {
          addOnDispose() {
            return this;
          }
          dispose() {} // Add dispose method
        },
        sqlite3_io_methods: class {
          dispose() {}
        },
        sqlite3_file: { structInfo: { sizeof: 0 } },
        sqlite3_vfs_find: vi.fn(),
      },
      wasm: {
        allocCString: vi.fn(),
      },
      util: {
        toss: vi.fn(),
      },
      config: {
        error: vi.fn(),
        warn: vi.fn(),
        log: vi.fn(),
      },
      scriptInfo: {
        sqlite3Dir: "dir/",
      },
    };

    // Mock Worker
    mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onerror: null,
      onmessage: null,
    };

    globalThis.Worker = vi.fn(function () {
      return mockWorker;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    globalThis.URL = class {
      searchParams: URLSearchParams;
      pathname: string;

      constructor(_url: string) {
        this.searchParams = new URLSearchParams();
        this.pathname = "proxy.js";
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create installer context", () => {
    const context = createInstallOpfsVfsContext(sqlite3);
    expect(context).toHaveProperty("installOpfsVfs");
    expect(context).toHaveProperty("installOpfsVfsInitializer");
  });

  it("should fail if environment validation fails", async () => {
    const { validateOpfsEnvironment } = await import(
      "../core/environment-validation/environment-validation"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (validateOpfsEnvironment as any).mockReturnValue(new Error("Env fail"));

    const { installOpfsVfs } = createInstallOpfsVfsContext(sqlite3);
    await expect(installOpfsVfs()).rejects.toThrow("Env fail");
  });

  it("should resolve immediately if config is disabled", async () => {
    const { validateOpfsEnvironment } = await import(
      "../core/environment-validation/environment-validation"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (validateOpfsEnvironment as any).mockReturnValue(null);

    const { prepareOpfsConfig } = await import(
      "../core/config-setup/config-setup"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prepareOpfsConfig as any).mockReturnValue({ disabled: true });

    const { installOpfsVfs } = createInstallOpfsVfsContext(sqlite3);
    const result = await installOpfsVfs();
    expect(result).toBe(sqlite3);
  });

  it("should initialize correctly on happy path", async () => {
    const { validateOpfsEnvironment } = await import(
      "../core/environment-validation/environment-validation"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (validateOpfsEnvironment as any).mockReturnValue(null);

    const { prepareOpfsConfig } = await import(
      "../core/config-setup/config-setup"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prepareOpfsConfig as any).mockReturnValue({
      disabled: false,
      verbose: 1,
      sanityChecks: false,
      proxyUri: "proxy.js",
    });

    const { installOpfsVfs } = createInstallOpfsVfsContext(sqlite3);

    // Mock worker message handler to resolve promise immediately
    const { createWorkerMessageHandler } = await import(
      "../utils/worker-message-handler/worker-message-handler"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createWorkerMessageHandler as any).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ promiseResolve }: any) => {
        setTimeout(promiseResolve, 0); // Simulate worker ready
        return () => {};
      },
    );

    await expect(installOpfsVfs()).resolves.toBe(sqlite3);
    expect(globalThis.Worker).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: expect.any(String) }),
    );
  });

  it("should handle worker initialization timeout", async () => {
    vi.useFakeTimers();
    const { validateOpfsEnvironment } = await import(
      "../core/environment-validation/environment-validation"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (validateOpfsEnvironment as any).mockReturnValue(null);

    const { prepareOpfsConfig } = await import(
      "../core/config-setup/config-setup"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prepareOpfsConfig as any).mockReturnValue({
      disabled: false,
      proxyUri: "proxy.js",
    });

    const { installOpfsVfs } = createInstallOpfsVfsContext(sqlite3);

    // Mock worker message handler to NOT resolve immediately
    const { createWorkerMessageHandler } = await import(
      "../utils/worker-message-handler/worker-message-handler"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createWorkerMessageHandler as any).mockImplementation(() => {
      return () => {};
    });

    const promise = installOpfsVfs();
    vi.advanceTimersByTime(5000); // Trigger timeout

    await expect(promise).rejects.toThrow(
      "Timeout while waiting for OPFS async proxy worker.",
    );
    vi.useRealTimers();
  });

  it("should handle worker error during initialization", async () => {
    const { validateOpfsEnvironment } = await import(
      "../core/environment-validation/environment-validation"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (validateOpfsEnvironment as any).mockReturnValue(null);

    const { prepareOpfsConfig } = await import(
      "../core/config-setup/config-setup"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prepareOpfsConfig as any).mockReturnValue({
      disabled: false,
      proxyUri: "proxy.js",
    });

    const { installOpfsVfs } = createInstallOpfsVfsContext(sqlite3);

    // Mock worker message handler to NOT resolve immediately
    const { createWorkerMessageHandler } = await import(
      "../utils/worker-message-handler/worker-message-handler"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createWorkerMessageHandler as any).mockImplementation(() => {
      return () => {};
    });

    // Trigger error immediately after worker creation

    globalThis.Worker = vi.fn(function () {
      setTimeout(() => {
        mockWorker.onerror(new Error("Worker error"));
      }, 0);
      return mockWorker;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    await expect(installOpfsVfs()).rejects.toThrow(
      "Loading OPFS async Worker failed for unknown reasons.",
    );
  });

  it("installOpfsVfsInitializer should call installOpfsVfs", async () => {
    const { validateOpfsEnvironment } = await import(
      "../core/environment-validation/environment-validation"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (validateOpfsEnvironment as any).mockReturnValue(null);

    const { prepareOpfsConfig } = await import(
      "../core/config-setup/config-setup"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prepareOpfsConfig as any).mockReturnValue({ disabled: true }); // Simplest path

    const { installOpfsVfsInitializer } = createInstallOpfsVfsContext(sqlite3);
    await installOpfsVfsInitializer(sqlite3);
    // Implicitly verified by not throwing
  });
});
