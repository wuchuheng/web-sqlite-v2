import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  createOperationRunner,
  createOperationTimer,
} from "./operation-runner";
import type {
  OpfsState,
  OpfsMetrics,
  OpfsOpIds,
  SerializerInterface,
  SQLiteConstants,
  OpfsFlags,
} from "../../../../../shared/opfs-vfs-installer";

describe("operation-runner", () => {
  describe("createOperationRunner", () => {
    let state: OpfsState;
    let metrics: OpfsMetrics;
    let error: (...args: unknown[]) => void;
    let toss: (...args: unknown[]) => never;
    let sab: SharedArrayBuffer;
    let opIds: OpfsOpIds;
    let s11n: {
      serialize: Mock;
      deserialize: Mock;
    };

    beforeEach(() => {
      // Mock dependencies
      sab = new SharedArrayBuffer(1024);
      opIds = {
        rc: 0,
        whichOp: 1,
        "opfs-async-metrics": 3,
        "opfs-async-shutdown": 4,
        retry: 5,
        xAccess: 6,
        xClose: 7,
        xDelete: 8,
        xDeleteNoWait: 9,
        xFileSize: 10,
        xLock: 11,
        xOpen: 12,
        xRead: 13,
        xSleep: 14,
        xSync: 15,
        xTruncate: 16,
        xUnlock: 17,
        xWrite: 18,
        mkdir: 19,

        testOp: 2,
      };

      // Setup mock s11n
      s11n = {
        serialize: vi.fn(),
        deserialize: vi.fn(),
      };

      state = {
        opIds,
        s11n: s11n as unknown as SerializerInterface,
        sabOPView: new Int32Array(sab),
        asyncS11nExceptions: 0, // Should be number based on interface, but used as boolean in tests/code sometimes? Interface says number.
        // Let's check usage. The code uses `if (rc && state.asyncS11nExceptions)`.
        // If interface says number, we should use 0/1.
        verbose: 0,
        littleEndian: true,
        asyncIdleWaitTime: 0,
        fileBufferSize: 4096,
        sabS11nOffset: 0,
        sabS11nSize: 1024,
        sabIO: new SharedArrayBuffer(1024),
        sabOP: sab,
        sq3Codes: {} as unknown as SQLiteConstants,
        opfsFlags: {} as unknown as OpfsFlags,
      };

      metrics = {
        testOp: { wait: 0, time: 0, count: 0 },
        s11n: {
          serialize: { count: 0, time: 0, wait: 0 },
          deserialize: { count: 0, time: 0, wait: 0 },
        },
      } as unknown as OpfsMetrics;

      error = vi.fn();
      toss = vi.fn((...args) => {
        throw new Error(args.join(" "));
      });

      // Reset Atomics
      // @ts-expect-error -- Atomics.store might complain about shared array buffer types depending on TS version
      Atomics.store(state.sabOPView, state.opIds.rc, 0);
      // @ts-expect-error -- Atomics.store might complain about shared array buffer types depending on TS version
      Atomics.store(state.sabOPView, state.opIds.whichOp, 0);
    });

    it("should successfully run an operation", () => {
      const runner = createOperationRunner(state, metrics, error, toss);

      // Simulate worker completion
      // We need to simulate the worker setting the return code
      // Since Atomics.wait blocks, we can't easily do this in the same thread without a real worker
      // However, for unit testing, we can mock Atomics.wait or use a small timeout if the impl wasn't blocking
      // The implementation IS blocking: while ("not-equal" !== Atomics.wait(...)) {}

      // To test this without hanging, we need to mock Atomics.wait
      // or ensure the condition is met immediately.

      // Mock Atomics.wait to return 'ok' immediately so the loop terminates
      // But we also need to ensure Atomics.load returns the expected result

      // Let's spy on Atomics.wait
      const waitSpy = vi
        .spyOn(Atomics, "wait")
        .mockImplementation((typedArray, index, value) => {
          // Check current value first - this mimics real Atomics.wait behavior
          const currentValue = Atomics.load(typedArray, index);
          if (currentValue !== value) {
            return "not-equal";
          }

          // When the runner waits for rc to change from -1
          if (
            // @ts-expect-error -- typedArray type mismatch with mocked implementation
            typedArray === state.sabOPView &&
            index === state.opIds.rc &&
            // @ts-expect-error -- value type check
            value === -1
          ) {
            // Simulate worker setting the result
            Atomics.store(state.sabOPView, state.opIds.rc, 0); // Success
            return "ok";
          }
          return "ok";
        });

      const notifySpy = vi.spyOn(Atomics, "notify");
      const storeSpy = vi.spyOn(Atomics, "store");

      const result = runner("testOp", "arg1", 123);

      expect(s11n.serialize).toHaveBeenCalledWith("arg1", 123);
      expect(storeSpy).toHaveBeenCalledWith(
        state.sabOPView,
        state.opIds.rc,
        -1,
      );
      expect(storeSpy).toHaveBeenCalledWith(
        state.sabOPView,
        state.opIds.whichOp,
        2,
      ); // testOp index
      expect(notifySpy).toHaveBeenCalledWith(
        state.sabOPView,
        state.opIds.whichOp,
      );

      expect(result).toBe(0);
      // @ts-expect-error -- testOp is not in metrics interface
      expect(metrics.testOp.wait).toBeGreaterThanOrEqual(0);

      waitSpy.mockRestore();
    });

    it("should toss on invalid op ID", () => {
      const runner = createOperationRunner(state, metrics, error, toss);
      expect(() => runner("invalidOp")).toThrow("Invalid op ID: invalidOp");
    });

    it("should handle async exceptions when enabled", () => {
      state.asyncS11nExceptions = 1;
      const runner = createOperationRunner(state, metrics, error, toss);

      // Mock Atomics.wait to return 'ok'
      const waitSpy = vi
        .spyOn(Atomics, "wait")
        .mockImplementation((typedArray, index, value) => {
          // Check current value first
          const currentValue = Atomics.load(typedArray, index);
          if (currentValue !== value) {
            return "not-equal";
          }

          if (
            // @ts-expect-error -- typedArray type mismatch
            typedArray === state.sabOPView &&
            index === state.opIds.rc &&
            // @ts-expect-error -- value type check
            value === -1
          ) {
            Atomics.store(state.sabOPView, state.opIds.rc, 1); // Error code
            return "ok";
          }
          return "ok";
        });

      // Mock deserialization to return an error
      s11n.deserialize.mockReturnValue(["Something went wrong"]);

      runner("testOp");

      expect(error).toHaveBeenCalledWith(
        "testOp() async error:",
        "Something went wrong",
      );

      waitSpy.mockRestore();
    });

    it("should NOT handle async exceptions when disabled", () => {
      state.asyncS11nExceptions = 0;
      const runner = createOperationRunner(state, metrics, error, toss);

      // Mock Atomics.wait to return 'ok'
      const waitSpy = vi
        .spyOn(Atomics, "wait")
        .mockImplementation((typedArray, index, value) => {
          // Check current value first
          const currentValue = Atomics.load(typedArray, index);
          if (currentValue !== value) {
            return "not-equal";
          }

          if (
            // @ts-expect-error -- typedArray type mismatch
            typedArray === state.sabOPView &&
            index === state.opIds.rc &&
            // @ts-expect-error -- value type check
            value === -1
          ) {
            Atomics.store(state.sabOPView, state.opIds.rc, 1); // Error code
            return "ok";
          }
          return "ok";
        });

      // Mock deserialization just in case
      s11n.deserialize.mockReturnValue(["Something went wrong"]);

      runner("testOp");

      expect(error).not.toHaveBeenCalled();

      waitSpy.mockRestore();
    });

    it("should track time and count", () => {
      const timer = createOperationTimer(metrics);

      // Mock performance.now
      const nowSpy = vi.spyOn(performance, "now");
      nowSpy.mockReturnValueOnce(1000); // Start

      timer.mTimeStart("testOp");

      // @ts-expect-error -- testOp is not in metrics interface
      expect(metrics.testOp.count).toBe(1);

      nowSpy.mockReturnValueOnce(1100); // End

      timer.mTimeEnd();

      // @ts-expect-error -- testOp is not in metrics interface
      expect(metrics.testOp.time).toBe(100);

      nowSpy.mockRestore();
    });
  });
});
