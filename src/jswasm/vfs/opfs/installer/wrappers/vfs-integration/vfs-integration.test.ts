import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupOptionalVfsMethods, integrateWithOo1 } from "./vfs-integration";

describe("vfs-integration", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  describe("setupOptionalVfsMethods", () => {
    let deps: any;
    let heap: Uint8Array;

    beforeEach(() => {
      heap = new Uint8Array(1000);
      deps = {
        opfsVfs: {},
        dVfs: null,
        wasm: {
          heap8u: () => heap,
        },
        state: {
          sabOPView: new Int32Array(new SharedArrayBuffer(1024)),
          opIds: { xSleep: 1 },
        },
      };
    });

    it("should use default VFS methods if available", () => {
      deps.dVfs = {
        $xRandomness: vi.fn(),
        $xSleep: vi.fn(),
      };

      setupOptionalVfsMethods(deps);

      expect(deps.opfsVfs.$xRandomness).toBe(deps.dVfs.$xRandomness);
      expect(deps.opfsVfs.$xSleep).toBe(deps.dVfs.$xSleep);
    });

    it("should provide fallback xRandomness if default VFS not available", () => {
      const methods = setupOptionalVfsMethods(deps);

      expect(methods.xRandomness).toBeDefined();
      expect(typeof methods.xRandomness).toBe("function");

      const pOut = 100;
      const nOut = 10;
      /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
      // @ts-ignore
      methods.xRandomness(0, nOut, pOut);

      // Verify heap was written to
      let hasData = false;
      for (let i = 0; i < nOut; i++) {
        if (heap[pOut + i] !== 0) hasData = true;
      }
      expect(hasData).toBe(true);
    });

    it("should provide fallback xSleep if default VFS not available", () => {
      const methods = setupOptionalVfsMethods(deps);

      expect(methods.xSleep).toBeDefined();
      expect(typeof methods.xSleep).toBe("function");

      // Mock Atomics.wait
      /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
      // @ts-ignore
      const originalWait = Atomics.wait;
      /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
      // @ts-ignore
      Atomics.wait = vi.fn();

      /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
      // @ts-ignore
      methods.xSleep(0, 100);

      expect(Atomics.wait).toHaveBeenCalledWith(
        deps.state.sabOPView,
        deps.state.opIds.xSleep,
        0,
        100,
      );

      // Restore Atomics.wait
      /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
      // @ts-ignore
      Atomics.wait = originalWait;
    });
  });

  describe("integrateWithOo1", () => {
    let deps: any;
    let dbCtorHelper: any;

    beforeEach(() => {
      dbCtorHelper = {
        normalizeArgs: vi.fn().mockReturnValue({}),
        call: vi.fn(),
        setVfsPostOpenCallback: vi.fn(),
      };

      deps = {
        sqlite3: {
          oo1: {
            DB: {
              prototype: {},
              dbCtorHelper,
            },
          },
          capi: {
            sqlite3_busy_timeout: vi.fn(),
          },
        },
        opfsVfs: {
          $zName: "opfs-vfs",
          pointer: 12345,
        },
        opfsUtil: {
          importDb: vi.fn(),
        },
      };
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    it("should do nothing if sqlite3.oo1 is missing", () => {
      deps.sqlite3.oo1 = undefined;
      integrateWithOo1(deps);
      // No errors should occur
    });

    it("should register OpfsDb", () => {
      integrateWithOo1(deps);

      expect(deps.sqlite3.oo1.OpfsDb).toBeDefined();
      expect(deps.sqlite3.oo1.OpfsDb.importDb).toBe(deps.opfsUtil.importDb);
    });

    it("should set up OpfsDb constructor", () => {
      integrateWithOo1(deps);
      const OpfsDb = deps.sqlite3.oo1.OpfsDb;

      new OpfsDb("test.db");

      expect(dbCtorHelper.normalizeArgs).toHaveBeenCalled();
      expect(dbCtorHelper.call).toHaveBeenCalled();
    });

    it("should set vfs post open callback", () => {
      integrateWithOo1(deps);
      expect(dbCtorHelper.setVfsPostOpenCallback).toHaveBeenCalledWith(
        deps.opfsVfs.pointer,
        expect.any(Function),
      );

      // Test the callback
      const callback = dbCtorHelper.setVfsPostOpenCallback.mock.calls[0][1];
      const oo1Db = {};
      const sqlite3Ref = deps.sqlite3;

      callback(oo1Db, sqlite3Ref);
      expect(deps.sqlite3.capi.sqlite3_busy_timeout).toHaveBeenCalledWith(
        oo1Db,
        10000,
      );
    });
  });
});
