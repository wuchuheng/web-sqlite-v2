import { afterEach, beforeEach, describe, expect, test } from "vitest";

export interface OpfsProxyOptions {
  verbose?: number;
  opIds: Record<string, number>;
  sq3Codes: Record<string, number>;
  opfsFlags: Record<string, number>;
  asyncIdleWaitTime: number;
  sabOP: SharedArrayBuffer;
  sabIO: SharedArrayBuffer;
  fileBufferSize: number;
  sabS11nOffset: number;
  sabS11nSize: number;
  littleEndian: boolean;
  asyncS11nExceptions: number;
}

type ProxyResponse = { rc: number; results: unknown[] };

class OpfsProxyClient {
  private readonly worker: Worker;
  private readonly sabIO: SharedArrayBuffer;
  private readonly sabOP: SharedArrayBuffer;
  private readonly sabOPView: Int32Array;
  private readonly sabS11nView: Uint8Array;
  private readonly sabFileBufView: Uint8Array;
  private readonly sabS11nOffset: number;
  private readonly sabS11nSize: number;
  private readonly opIds: Record<string, number>;
  private readonly textEncoder = new TextEncoder();
  private readonly textDecoder = new TextDecoder();
  private readonly pendingRc = -999999999;
  private readonly operationTimeoutMs = 5_000;

  public static readonly SQLITE_OPEN_CREATE = 0x00000004;
  public static readonly SQLITE_OPEN_READWRITE = 0x00000002;
  public static readonly SQLITE_OPEN_READONLY = 0x00000001;
  public static readonly SQLITE_OPEN_DELETEONCLOSE = 0x00000008;

  public static readonly SQLITE_LOCK_NONE = 0;
  public static readonly SQLITE_LOCK_SHARED = 1;
  public static readonly SQLITE_LOCK_RESERVED = 2;
  public static readonly SQLITE_LOCK_PENDING = 3;
  public static readonly SQLITE_LOCK_EXCLUSIVE = 4;

  public static readonly SQLITE_OK = 0;
  public static readonly SQLITE_NOTFOUND = 12;
  public static readonly SQLITE_IOERR = 10;
  public static readonly SQLITE_IOERR_DELETE = 10 | (10 << 8);
  public static readonly SQLITE_IOERR_LOCK = 10 | (15 << 8);
  public static readonly SQLITE_IOERR_READ = 10 | (1 << 8);
  public static readonly SQLITE_IOERR_SHORT_READ = 10 | (2 << 8);
  public static readonly SQLITE_IOERR_WRITE = 10 | (3 << 8);
  public static readonly SQLITE_IOERR_FSYNC = 10 | (4 << 8);
  public static readonly SQLITE_IOERR_TRUNCATE = 10 | (6 << 8);
  public static readonly SQLITE_IOERR_UNLOCK = 10 | (8 << 8);

  constructor(workerUrl: string) {
    this.worker = new Worker(workerUrl, { type: "module" });

    this.sabOP = new SharedArrayBuffer(16);
    this.sabOPView = new Int32Array(this.sabOP);

    const ioSize = 1024 * 128;
    this.sabIO = new SharedArrayBuffer(ioSize);

    const fileBufferSize = 1024 * 64;
    this.sabS11nOffset = fileBufferSize;
    this.sabS11nSize = ioSize - fileBufferSize;

    this.sabFileBufView = new Uint8Array(this.sabIO, 0, fileBufferSize);
    this.sabS11nView = new Uint8Array(
      this.sabIO,
      this.sabS11nOffset,
      this.sabS11nSize,
    );

    this.opIds = {
      xAccess: 1,
      xClose: 2,
      xDelete: 3,
      xDeleteNoWait: 4,
      xFileSize: 5,
      xLock: 6,
      xOpen: 7,
      xRead: 8,
      xSync: 9,
      xTruncate: 10,
      xUnlock: 11,
      xWrite: 12,
      mkdir: 13,
      "opfs-async-shutdown": 14,
      whichOp: 0,
      rc: 1,
      retry: 2,
    };
  }

  async init(): Promise<void> {
    const workerInitTimeoutMs = 5_000;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.worker.removeEventListener("message", handler);
        reject(new Error("Timed out waiting for OPFS async proxy to initialize"));
      }, workerInitTimeoutMs);

      const handler = (event: MessageEvent) => {
        if (event.data.type === "opfs-async-loaded") {
          this.worker.postMessage({
            type: "opfs-async-init",
            args: this.buildOptions(),
          });
          return;
        }

        if (event.data.type === "opfs-async-inited") {
          cleanup();
          resolve();
          return;
        }

        if (event.data.type === "opfs-unavailable") {
          cleanup();
          reject(new Error("OPFS unavailable: " + (event.data.payload || "").toString()));
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.worker.removeEventListener("message", handler);
      };

      this.worker.addEventListener("message", handler);
    });
  }

  async send(op: string, args: unknown[] = []): Promise<ProxyResponse> {
    const opId = this.opIds[op];
    if (typeof opId !== "number") {
      throw new Error(`Unknown operation: ${op}`);
    }

    this.serialize(args);
    Atomics.store(this.sabOPView, this.opIds.rc, this.pendingRc);
    Atomics.store(this.sabOPView, this.opIds.whichOp, opId);
    Atomics.notify(this.sabOPView, this.opIds.whichOp);

    const deadline = performance.now() + this.operationTimeoutMs;
    while (Atomics.load(this.sabOPView, this.opIds.rc) === this.pendingRc) {
      if (performance.now() > deadline) {
        throw new Error(`Timeout waiting for operation ${op}`);
      }
      await this.waitForTurnaround();
    }

    const rc = Atomics.load(this.sabOPView, this.opIds.rc);
    const results = this.deserialize();
    return { rc, results };
  }

  setFileBuffer(data: Uint8Array): void {
    this.sabFileBufView.fill(0, 0, data.byteLength);
    this.sabFileBufView.set(data);
  }

  seedFileBuffer(length: number, value = 0): void {
    const cappedLength = Math.min(length, this.sabFileBufView.length);
    this.sabFileBufView.fill(value, 0, cappedLength);
  }

  getFileBuffer(length: number): Uint8Array {
    return this.sabFileBufView.slice(0, length);
  }

  async closeFile(fid: number): Promise<void> {
    await this.send("xClose", [fid]);
  }

  async deletePath(path: string, recursive = false): Promise<void> {
    await this.send("xDelete", [path, 0, recursive]);
  }

  async shutdown(): Promise<void> {
    try {
      await this.send("opfs-async-shutdown");
    } catch (error) {
      console.warn("Failed to shut down OPFS async proxy cleanly", error);
    } finally {
      this.worker.terminate();
    }
  }

  private buildOptions(): OpfsProxyOptions {
    return {
      verbose: 1,
      opIds: this.opIds,
      sq3Codes: {
        SQLITE_OK: OpfsProxyClient.SQLITE_OK,
        SQLITE_CANTOPEN: 14,
        SQLITE_NOTFOUND: OpfsProxyClient.SQLITE_NOTFOUND,
        SQLITE_IOERR: OpfsProxyClient.SQLITE_IOERR,
        SQLITE_IOERR_DELETE: OpfsProxyClient.SQLITE_IOERR_DELETE,
        SQLITE_IOERR_LOCK: OpfsProxyClient.SQLITE_IOERR_LOCK,
        SQLITE_IOERR_READ: OpfsProxyClient.SQLITE_IOERR_READ,
        SQLITE_IOERR_SHORT_READ: OpfsProxyClient.SQLITE_IOERR_SHORT_READ,
        SQLITE_IOERR_WRITE: OpfsProxyClient.SQLITE_IOERR_WRITE,
        SQLITE_IOERR_FSYNC: OpfsProxyClient.SQLITE_IOERR_FSYNC,
        SQLITE_IOERR_TRUNCATE: OpfsProxyClient.SQLITE_IOERR_TRUNCATE,
        SQLITE_IOERR_UNLOCK: OpfsProxyClient.SQLITE_IOERR_UNLOCK,
        SQLITE_OPEN_CREATE: OpfsProxyClient.SQLITE_OPEN_CREATE,
        SQLITE_OPEN_READWRITE: OpfsProxyClient.SQLITE_OPEN_READWRITE,
        SQLITE_OPEN_READONLY: OpfsProxyClient.SQLITE_OPEN_READONLY,
        SQLITE_OPEN_DELETEONCLOSE: OpfsProxyClient.SQLITE_OPEN_DELETEONCLOSE,
        SQLITE_LOCK_NONE: OpfsProxyClient.SQLITE_LOCK_NONE,
        SQLITE_LOCK_SHARED: OpfsProxyClient.SQLITE_LOCK_SHARED,
        SQLITE_LOCK_RESERVED: OpfsProxyClient.SQLITE_LOCK_RESERVED,
        SQLITE_LOCK_PENDING: OpfsProxyClient.SQLITE_LOCK_PENDING,
        SQLITE_LOCK_EXCLUSIVE: OpfsProxyClient.SQLITE_LOCK_EXCLUSIVE,
      },
      opfsFlags: {
        OPFS_UNLOCK_ASAP: 1,
        OPFS_UNLINK_BEFORE_OPEN: 2,
        defaultUnlockAsap: 0,
      },
      asyncIdleWaitTime: 50,
      sabOP: this.sabOP,
      sabIO: this.sabIO,
      fileBufferSize: this.sabS11nOffset,
      sabS11nOffset: this.sabS11nOffset,
      sabS11nSize: this.sabS11nSize,
      littleEndian: true,
      asyncS11nExceptions: 2,
    };
  }

  private serialize(args: unknown[]): void {
    const viewDV = new DataView(
      this.sabIO,
      this.sabS11nOffset,
      this.sabS11nSize,
    );
    const viewU8 = this.sabS11nView;

    if (!args.length) {
      viewU8[0] = 0;
      return;
    }

    viewU8[0] = args.length;
    let offset = 1;

    for (const arg of args) {
      let typeId = 0;
      if (typeof arg === "number") typeId = 1;
      else if (typeof arg === "bigint") typeId = 2;
      else if (typeof arg === "boolean") typeId = 3;
      else if (typeof arg === "string") typeId = 4;
      else throw new Error(`Unsupported type: ${typeof arg}`);

      viewU8[offset++] = typeId;
    }

    for (const arg of args) {
      if (typeof arg === "number") {
        viewDV.setFloat64(offset, arg, true);
        offset += 8;
      } else if (typeof arg === "bigint") {
        viewDV.setBigInt64(offset, arg, true);
        offset += 8;
      } else if (typeof arg === "boolean") {
        viewDV.setInt32(offset, arg ? 1 : 0, true);
        offset += 4;
      } else if (typeof arg === "string") {
        const encoded = this.textEncoder.encode(arg);
        viewDV.setInt32(offset, encoded.byteLength, true);
        offset += 4;
        viewU8.set(encoded, offset);
        offset += encoded.byteLength;
      }
    }
  }

  private deserialize(): unknown[] {
    const viewDV = new DataView(
      this.sabIO,
      this.sabS11nOffset,
      this.sabS11nSize,
    );
    const viewU8 = this.sabS11nView;
    const argc = viewU8[0];

    if (!argc) {
      return [];
    }

    const result = [];
    let offset = 1;
    const typeIds = [];

    for (let i = 0; i < argc; i++) {
      typeIds.push(viewU8[offset++]);
    }

    for (let i = 0; i < argc; i++) {
      const typeId = typeIds[i];
      if (typeId === 1) {
        result.push(viewDV.getFloat64(offset, true));
        offset += 8;
      } else if (typeId === 2) {
        result.push(viewDV.getBigInt64(offset, true));
        offset += 8;
      } else if (typeId === 3) {
        result.push(viewDV.getInt32(offset, true) !== 0);
        offset += 4;
      } else if (typeId === 4) {
        const len = viewDV.getInt32(offset, true);
        offset += 4;
        const strBytes = viewU8.slice(offset, offset + len);
        result.push(this.textDecoder.decode(strBytes));
        offset += len;
      }
    }

    viewU8[0] = 0;
    return result;
  }

  private async waitForTurnaround(): Promise<void> {
    if (typeof Atomics.waitAsync === "function") {
      await Atomics.waitAsync(
        this.sabOPView,
        this.opIds.rc,
        this.pendingRc,
        10,
      ).value;
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const workerUrl = new URL("./sqlite3-opfs-async-proxy.js", import.meta.url).href;

describe("OPFS Async Proxy E2E Tests", () => {
  let client: OpfsProxyClient;
  const createdPaths = new Set<string>();
  let fidCounter = 1;

  const nextFid = () => fidCounter++;
  const tempPath = (label: string) =>
    `/test-${label}-${Date.now()}-${nextFid()}`;

  beforeEach(async () => {
    client = new OpfsProxyClient(workerUrl);
    await client.init();
  });

  afterEach(async () => {
    for (const path of Array.from(createdPaths)) {
      try {
        await client.deletePath(path, true);
      } catch {
        // Best-effort cleanup; leftover files are acceptable for isolation
      }
    }
    createdPaths.clear();
    await client.shutdown();
  });

  test("xAccess reports missing files and recognizes newly created files", async () => {
    const filename = tempPath("xaccess");
    createdPaths.add(filename);

    const missing = await client.send("xAccess", [filename]);
    expect(missing.rc).toBe(OpfsProxyClient.SQLITE_IOERR);

    const fid = nextFid();
    const opened = await client.send("xOpen", [
      fid,
      filename,
      OpfsProxyClient.SQLITE_OPEN_CREATE |
        OpfsProxyClient.SQLITE_OPEN_READWRITE,
      0,
    ]);
    expect(opened.rc).toBe(OpfsProxyClient.SQLITE_OK);
    await client.closeFile(fid);

    const exists = await client.send("xAccess", [filename]);
    expect(exists.rc).toBe(OpfsProxyClient.SQLITE_OK);

    await client.deletePath(filename);
    createdPaths.delete(filename);

    const deleted = await client.send("xAccess", [filename]);
    expect(deleted.rc).toBe(OpfsProxyClient.SQLITE_IOERR);
  });

  test("writes, reads, and short reads return expected rc codes", async () => {
    const filename = tempPath("read-write");
    createdPaths.add(filename);
    const fid = nextFid();

    const openRc = await client.send("xOpen", [
      fid,
      filename,
      OpfsProxyClient.SQLITE_OPEN_CREATE |
        OpfsProxyClient.SQLITE_OPEN_READWRITE,
      0,
    ]);
    expect(openRc.rc).toBe(OpfsProxyClient.SQLITE_OK);

    const data = new TextEncoder().encode("Hello, SQLite Proxy!");
    client.setFileBuffer(data);
    const writeRc = await client.send("xWrite", [fid, data.length, 0]);
    expect(writeRc.rc).toBe(OpfsProxyClient.SQLITE_OK);

    client.seedFileBuffer(data.length, 0xaa);
    const readRc = await client.send("xRead", [fid, data.length, 0]);
    expect(readRc.rc).toBe(OpfsProxyClient.SQLITE_OK);
    expect(new TextDecoder().decode(client.getFileBuffer(data.length))).toBe(
      "Hello, SQLite Proxy!",
    );

    const paddedLength = data.length + 5;
    client.seedFileBuffer(paddedLength, 0xbb);
    const shortReadRc = await client.send("xRead", [fid, paddedLength, 0]);
    expect(shortReadRc.rc).toBe(OpfsProxyClient.SQLITE_IOERR_SHORT_READ);
    const paddedBuffer = client.getFileBuffer(paddedLength);
    expect(Array.from(paddedBuffer.slice(data.length))).toEqual([0, 0, 0, 0, 0]);

    const partialRc = await client.send("xRead", [fid, 6, 7]);
    expect(partialRc.rc).toBe(OpfsProxyClient.SQLITE_OK);
    expect(new TextDecoder().decode(client.getFileBuffer(6))).toBe("SQLite");

    await client.closeFile(fid);
  });

  test("xFileSize, xTruncate, and xSync keep file sizes consistent", async () => {
    const filename = tempPath("truncate");
    createdPaths.add(filename);
    const fid = nextFid();

    const openRc = await client.send("xOpen", [
      fid,
      filename,
      OpfsProxyClient.SQLITE_OPEN_CREATE |
        OpfsProxyClient.SQLITE_OPEN_READWRITE,
      0,
    ]);
    expect(openRc.rc).toBe(OpfsProxyClient.SQLITE_OK);

    const data = new Uint8Array(12).fill(65);
    client.setFileBuffer(data);
    expect((await client.send("xWrite", [fid, data.length, 0])).rc).toBe(
      OpfsProxyClient.SQLITE_OK,
    );

    const initialSize = await client.send("xFileSize", [fid]);
    expect(initialSize.rc).toBe(OpfsProxyClient.SQLITE_OK);
    expect(initialSize.results[0]).toBe(12);

    const truncateSmall = await client.send("xTruncate", [fid, 5]);
    expect(truncateSmall.rc).toBe(OpfsProxyClient.SQLITE_OK);
    const smallSize = await client.send("xFileSize", [fid]);
    expect(smallSize.results[0]).toBe(5);

    const growRc = await client.send("xTruncate", [fid, 24]);
    expect(growRc.rc).toBe(OpfsProxyClient.SQLITE_OK);
    const grownSize = await client.send("xFileSize", [fid]);
    expect(grownSize.results[0]).toBe(24);

    const syncRc = await client.send("xSync", [fid, 0]);
    expect(syncRc.rc).toBe(OpfsProxyClient.SQLITE_OK);

    await client.closeFile(fid);
  });

  test("lock transitions succeed and unlock releases the handle", async () => {
    const filename = tempPath("lock");
    createdPaths.add(filename);
    const fid = nextFid();

    expect(
      (await client.send("xOpen", [
        fid,
        filename,
        OpfsProxyClient.SQLITE_OPEN_CREATE |
          OpfsProxyClient.SQLITE_OPEN_READWRITE,
        0,
      ])).rc,
    ).toBe(OpfsProxyClient.SQLITE_OK);

    expect(
      (await client.send("xLock", [fid, OpfsProxyClient.SQLITE_LOCK_SHARED]))
        .rc,
    ).toBe(OpfsProxyClient.SQLITE_OK);

    expect(
      (await client.send("xLock", [fid, OpfsProxyClient.SQLITE_LOCK_RESERVED]))
        .rc,
    ).toBe(OpfsProxyClient.SQLITE_OK);

    expect(
      (await client.send("xUnlock", [fid, OpfsProxyClient.SQLITE_LOCK_NONE]))
        .rc,
    ).toBe(OpfsProxyClient.SQLITE_OK);

    await client.closeFile(fid);
  });

  test("read-only handles reject writes and preserve content", async () => {
    const filename = tempPath("readonly");
    createdPaths.add(filename);
    const readwriteFid = nextFid();

    expect(
      (await client.send("xOpen", [
        readwriteFid,
        filename,
        OpfsProxyClient.SQLITE_OPEN_CREATE |
          OpfsProxyClient.SQLITE_OPEN_READWRITE,
        0,
      ])).rc,
    ).toBe(OpfsProxyClient.SQLITE_OK);

    const message = new TextEncoder().encode("immutable");
    client.setFileBuffer(message);
    expect(
      (await client.send("xWrite", [readwriteFid, message.length, 0])).rc,
    ).toBe(OpfsProxyClient.SQLITE_OK);
    await client.closeFile(readwriteFid);

    const readonlyFid = nextFid();
    expect(
      (await client.send("xOpen", [
        readonlyFid,
        filename,
        OpfsProxyClient.SQLITE_OPEN_READONLY,
        0,
      ])).rc,
    ).toBe(OpfsProxyClient.SQLITE_OK);

    client.setFileBuffer(new Uint8Array(message.length));
    const writeAttempt = await client.send("xWrite", [
      readonlyFid,
      message.length,
      0,
    ]);
    expect(writeAttempt.rc).toBe(OpfsProxyClient.SQLITE_IOERR_WRITE);

    client.seedFileBuffer(message.length);
    expect(
      (await client.send("xRead", [readonlyFid, message.length, 0])).rc,
    ).toBe(OpfsProxyClient.SQLITE_OK);
    expect(new TextDecoder().decode(client.getFileBuffer(message.length))).toBe(
      "immutable",
    );

    await client.closeFile(readonlyFid);
  });

  test("delete-on-close flag removes the file automatically", async () => {
    const filename = tempPath("deleteonclose");
    const fid = nextFid();

    const openRc = await client.send("xOpen", [
      fid,
      filename,
      OpfsProxyClient.SQLITE_OPEN_CREATE |
        OpfsProxyClient.SQLITE_OPEN_READWRITE |
        OpfsProxyClient.SQLITE_OPEN_DELETEONCLOSE,
      0,
    ]);
    expect(openRc.rc).toBe(OpfsProxyClient.SQLITE_OK);

    const payload = new Uint8Array([1, 2, 3, 4]);
    client.setFileBuffer(payload);
    expect(
      (await client.send("xWrite", [fid, payload.length, 0])).rc,
    ).toBe(OpfsProxyClient.SQLITE_OK);

    await client.closeFile(fid);

    const accessAfterClose = await client.send("xAccess", [filename]);
    expect(accessAfterClose.rc).toBe(OpfsProxyClient.SQLITE_IOERR);
  });

  test("mkdir creates nested directories that xOpen can target", async () => {
    const dirPath = tempPath("nested-dir");
    createdPaths.add(dirPath);
    const mkdirRc = await client.send("mkdir", [dirPath]);
    expect(mkdirRc.rc).toBe(OpfsProxyClient.SQLITE_OK);

    const nestedFile = `${dirPath}/file.db`;
    createdPaths.add(nestedFile);
    const fid = nextFid();

    const openRc = await client.send("xOpen", [
      fid,
      nestedFile,
      OpfsProxyClient.SQLITE_OPEN_CREATE |
        OpfsProxyClient.SQLITE_OPEN_READWRITE,
      0,
    ]);
    expect(openRc.rc).toBe(OpfsProxyClient.SQLITE_OK);

    client.setFileBuffer(new Uint8Array([9, 9, 9]));
    expect((await client.send("xWrite", [fid, 3, 0])).rc).toBe(
      OpfsProxyClient.SQLITE_OK,
    );
    await client.closeFile(fid);

    await client.deletePath(dirPath, true);
    createdPaths.delete(dirPath);
    createdPaths.delete(nestedFile);
  });
});
