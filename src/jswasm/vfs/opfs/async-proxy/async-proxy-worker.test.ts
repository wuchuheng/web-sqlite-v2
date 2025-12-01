import { describe, it, expect } from "vitest";

import "./environment/environment.js";
import "./logging/logging.js";
import "./serialization-buffer/serialization-buffer.js";
import "./state/state.js";
import "./async-proxy-worker.mjs";

describe("async-proxy-worker.mjs baseline", () => {
  it("constructs worker and exposes operations without starting", () => {
    const Ctor = (
      globalThis as unknown as {
        AsyncProxyWorker: new (
          postFn: (type: string, ...p: unknown[]) => void,
        ) => unknown;
      }
    ).AsyncProxyWorker;
    expect(typeof Ctor).toBe("function");

    const postFn = () => {};
    const worker = new Ctor(postFn) as unknown as {
      state: {
        opIds: Record<string, number>;
        sabOPView: Int32Array;
        sq3Codes: Record<string, number>;
        asyncIdleWaitTime: number;
      };
      createOperationImplementations: () => Record<string, unknown>;
      buildOperationRouting: () => void;
      storeAndNotify: (name: string, value: number) => void;
    };

    expect(typeof worker.state).toBe("object");
    expect(worker.state.asyncIdleWaitTime).toBeGreaterThanOrEqual(0);

    const ops = worker.createOperationImplementations();
    const requiredOps = [
      "opfs-async-shutdown",
      "mkdir",
      "xAccess",
      "xClose",
      "xDelete",
      "xDeleteNoWait",
      "xFileSize",
      "xLock",
      "xOpen",
      "xRead",
      "xSync",
      "xTruncate",
      "xUnlock",
      "xWrite",
    ];
    for (const k of requiredOps) expect(k in ops).toBe(true);

    worker.buildOperationRouting();
    const sab = new SharedArrayBuffer(4);
    worker.state.sabOPView = new Int32Array(sab);
    worker.storeAndNotify("xSync", 0);
  });
});
