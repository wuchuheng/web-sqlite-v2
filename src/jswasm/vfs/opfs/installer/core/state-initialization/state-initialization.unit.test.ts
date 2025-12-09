import { describe, it, expect, vi } from "vitest";
import { initializeOpfsState, initializeMetrics } from "./state-initialization";
import type {
  SQLite3VFSInstance,
  SQLite3CAPI,
  SQLiteConstants,
} from "../../../../../shared/opfs-vfs-installer";

describe("state-initialization", () => {
  const mockOpfsVfs: Partial<SQLite3VFSInstance> & { $mxPathname: number } = {
    $mxPathname: 1024,
  };

  const mockCapi: Partial<SQLite3CAPI> & Record<keyof SQLiteConstants, number> =
    {
      SQLITE_ACCESS_EXISTS: 1,
      SQLITE_ACCESS_READWRITE: 2,
      SQLITE_BUSY: 3,
      SQLITE_CANTOPEN: 4,
      SQLITE_ERROR: 5,
      SQLITE_IOERR: 6,
      SQLITE_IOERR_ACCESS: 7,
      SQLITE_IOERR_CLOSE: 8,
      SQLITE_IOERR_DELETE: 9,
      SQLITE_IOERR_FSYNC: 10,
      SQLITE_IOERR_LOCK: 11,
      SQLITE_IOERR_READ: 12,
      SQLITE_IOERR_SHORT_READ: 13,
      SQLITE_IOERR_TRUNCATE: 14,
      SQLITE_IOERR_UNLOCK: 15,
      SQLITE_IOERR_WRITE: 16,
      SQLITE_LOCK_EXCLUSIVE: 17,
      SQLITE_LOCK_NONE: 18,
      SQLITE_LOCK_PENDING: 19,
      SQLITE_LOCK_RESERVED: 20,
      SQLITE_LOCK_SHARED: 21,
      SQLITE_LOCKED: 22,
      SQLITE_MISUSE: 23,
      SQLITE_NOTFOUND: 24,
      SQLITE_OPEN_CREATE: 25,
      SQLITE_OPEN_DELETEONCLOSE: 26,
      SQLITE_OPEN_MAIN_DB: 27,
      SQLITE_OPEN_READONLY: 28,
    };

  const mockToss = vi.fn();

  it("initializeOpfsState should return a valid OpfsState", () => {
    const state = initializeOpfsState(
      mockOpfsVfs as SQLite3VFSInstance,
      mockCapi as SQLite3CAPI,
      mockToss as never,
    );

    expect(state).toBeDefined();
    expect(state.littleEndian).toBeTypeOf("boolean");
    expect(state.asyncIdleWaitTime).toBe(150);
    expect(state.asyncS11nExceptions).toBe(1);
    expect(state.fileBufferSize).toBe(1024 * 64);
    expect(state.sabS11nOffset).toBe(state.fileBufferSize);
    expect(state.sabS11nSize).toBe(mockOpfsVfs.$mxPathname * 2);
    expect(state.sabIO).toBeInstanceOf(SharedArrayBuffer);
    expect(state.sabOP).toBeInstanceOf(SharedArrayBuffer);

    expect(state.opIds).toBeDefined();
    expect(state.opIds.whichOp).toBeDefined();
    expect(state.opIds.xRead).toBeDefined();
    expect(state.opIds["opfs-async-metrics"]).toBeDefined();

    expect(state.sq3Codes).toBeDefined();
    expect(state.sq3Codes.SQLITE_OK).toBeUndefined(); // Not in the list
    expect(state.sq3Codes.SQLITE_ACCESS_EXISTS).toBe(1);

    expect(state.opfsFlags).toBeDefined();
    expect(state.opfsFlags.OPFS_UNLOCK_ASAP).toBe(1);
  });

  it("initializeOpfsState should toss error if constant missing", () => {
    const incompleteCapi = { ...mockCapi };
    delete incompleteCapi.SQLITE_ACCESS_EXISTS;

    initializeOpfsState(
      mockOpfsVfs as SQLite3VFSInstance,
      incompleteCapi as unknown as SQLite3CAPI,
      mockToss as never,
    );
    expect(mockToss).toHaveBeenCalledWith(
      "Maintenance required: not found:",
      "SQLITE_ACCESS_EXISTS",
    );
  });

  it("initializeMetrics should return initialized metrics", () => {
    const state = initializeOpfsState(
      mockOpfsVfs as SQLite3VFSInstance,
      mockCapi as SQLite3CAPI,
      mockToss as never,
    );
    const metrics = initializeMetrics(state);

    expect(metrics).toBeDefined();
    expect(metrics.whichOp).toBeDefined();
    // @ts-expect-error -- testOp is not in the OpfsOperationIds interface
    expect(metrics.whichOp.count).toBe(0);
    expect(metrics.xRead).toBeDefined();
    expect(metrics.s11n).toBeDefined();
    expect(metrics.s11n.serialize.count).toBe(0);
  });
});
