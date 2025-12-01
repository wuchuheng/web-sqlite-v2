import { describe, it, expect } from "vitest";

import "../environment/environment.js";
import "../serialization-buffer/serialization-buffer.js";

describe("async-proxy state.mjs baseline", () => {
  it("creates default state with expected shape and defaults (TS)", async () => {
    // @ts-expect-error side-effect import of non-module script
    await import("./state.js");
    const createDefaultState = (
      globalThis as unknown as {
        createDefaultState: () => unknown;
      }
    ).createDefaultState;
    expect(typeof createDefaultState).toBe("function");

    const state = createDefaultState() as unknown as {
      verbose: number;
      sabOP: SharedArrayBuffer;
      sabIO: SharedArrayBuffer;
      sabOPView: Int32Array;
      sabFileBufView: Uint8Array;
      sabS11nView: Uint8Array;
      sq3Codes: Record<string, number>;
      opfsFlags: {
        OPFS_UNLINK_BEFORE_OPEN: number;
        OPFS_UNLOCK_ASAP: number;
        defaultUnlockAsap: boolean;
      };
      opIds: Record<string, number>;
      asyncIdleWaitTime: number;
      asyncS11nExceptions: number;
      fileBufferSize: number;
      sabS11nOffset: number;
      sabS11nSize: number;
      littleEndian: boolean;
      serialization: unknown;
    };

    expect(state.verbose).toBe(1);
    expect(state.sabOP).toBeInstanceOf(SharedArrayBuffer);
    expect(state.sabIO).toBeInstanceOf(SharedArrayBuffer);
    expect(state.sabOP.byteLength).toBe(0);
    expect(state.sabIO.byteLength).toBe(0);
    expect(state.sabOPView).toBeInstanceOf(Int32Array);
    expect(state.sabFileBufView).toBeInstanceOf(Uint8Array);
    expect(state.sabS11nView).toBeInstanceOf(Uint8Array);

    const requiredSq3Keys = [
      "SQLITE_IOERR",
      "SQLITE_IOERR_DELETE",
      "SQLITE_IOERR_READ",
      "SQLITE_IOERR_LOCK",
      "SQLITE_IOERR_FSYNC",
      "SQLITE_IOERR_TRUNCATE",
      "SQLITE_IOERR_UNLOCK",
      "SQLITE_IOERR_WRITE",
      "SQLITE_IOERR_SHORT_READ",
      "SQLITE_NOTFOUND",
      "SQLITE_OPEN_CREATE",
      "SQLITE_OPEN_READONLY",
      "SQLITE_OPEN_DELETEONCLOSE",
      "SQLITE_LOCK_NONE",
      "SQLITE_BUSY",
      "SQLITE_CANTOPEN",
    ];
    for (const k of requiredSq3Keys) {
      expect(typeof state.sq3Codes[k]).toBe("number");
      expect(state.sq3Codes[k]).toBe(0);
    }

    expect(state.opfsFlags.OPFS_UNLINK_BEFORE_OPEN).toBe(0);
    expect(state.opfsFlags.OPFS_UNLOCK_ASAP).toBe(0);
    expect(state.opfsFlags.defaultUnlockAsap).toBe(false);

    const requiredOpIds = [
      "whichOp",
      "rc",
      "retry",
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
    for (const k of requiredOpIds) {
      expect(typeof state.opIds[k]).toBe("number");
      expect(state.opIds[k]).toBe(0);
    }

    expect(state.asyncIdleWaitTime).toBe(150);
    expect(state.asyncS11nExceptions).toBe(1);
    expect(state.fileBufferSize).toBe(0);
    expect(state.sabS11nOffset).toBe(0);
    expect(state.sabS11nSize).toBe(0);

    const detectLittleEndian = (
      globalThis as unknown as {
        detectLittleEndian: () => boolean;
      }
    ).detectLittleEndian;
    expect(typeof detectLittleEndian).toBe("function");
    expect(state.littleEndian).toBe(detectLittleEndian());

    const SerializationBuffer = (
      globalThis as unknown as {
        SerializationBuffer: new (o: {
          readonly sharedBuffer: SharedArrayBuffer;
          readonly offset: number;
          readonly size: number;
          readonly littleEndian: boolean;
          readonly exceptionVerbosity: number;
        }) => unknown;
      }
    ).SerializationBuffer;
    expect(typeof SerializationBuffer).toBe("function");
    expect(state.serialization instanceof SerializationBuffer).toBe(true);
  });
});
