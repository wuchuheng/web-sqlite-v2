import { expect } from "vitest";

// Helper types matching the worker's expectations
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

export class OpfsProxyClient {
  private worker: Worker;
  private sabIO: SharedArrayBuffer;
  private sabOP: SharedArrayBuffer;
  private sabOPView: Int32Array;
  private sabS11nView: Uint8Array;
  private sabFileBufView: Uint8Array;
  private sabS11nOffset: number;
  private sabS11nSize: number;
  private opIds: Record<string, number>;
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();

  // SQLite constants that the worker expects
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

  constructor(workerUrl: string) {
    this.worker = new Worker(workerUrl, { type: "module" });

    // Initialize SharedArrayBuffers
    // OP SAB: [whichOp, rc, retry]
    this.sabOP = new SharedArrayBuffer(16); // 4 * 4 bytes
    this.sabOPView = new Int32Array(this.sabOP);

    // IO SAB: [fileBuffer... | serializationBuffer...]
    const ioSize = 1024 * 128; // 128KB total
    this.sabIO = new SharedArrayBuffer(ioSize);

    const fileBufferSize = 1024 * 64; // 64KB for file I/O
    this.sabS11nOffset = fileBufferSize;
    this.sabS11nSize = ioSize - fileBufferSize;

    this.sabFileBufView = new Uint8Array(this.sabIO, 0, fileBufferSize);
    this.sabS11nView = new Uint8Array(
      this.sabIO,
      this.sabS11nOffset,
      this.sabS11nSize,
    );

    // Define operation IDs (must match what we send to worker)
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
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        if (e.data.type === "opfs-async-loaded") {
          // Worker is loaded, send init
          const options: OpfsProxyOptions = {
            verbose: 2,
            opIds: this.opIds,
            sq3Codes: {
              SQLITE_OK: 0,
              SQLITE_CANTOPEN: 14,
              SQLITE_NOTFOUND: 12,
              SQLITE_IOERR: 10,
              SQLITE_IOERR_DELETE: 10 | (10 << 8),
              SQLITE_IOERR_LOCK: 10 | (15 << 8),
              SQLITE_IOERR_READ: 10 | (1 << 8),
              SQLITE_IOERR_SHORT_READ: 10 | (2 << 8),
              SQLITE_IOERR_WRITE: 10 | (3 << 8),
              SQLITE_IOERR_FSYNC: 10 | (4 << 8),
              SQLITE_IOERR_TRUNCATE: 10 | (6 << 8),
              SQLITE_IOERR_UNLOCK: 10 | (8 << 8),
              SQLITE_OPEN_CREATE: OpfsProxyClient.SQLITE_OPEN_CREATE,
              SQLITE_OPEN_READWRITE: OpfsProxyClient.SQLITE_OPEN_READWRITE,
              SQLITE_OPEN_READONLY: OpfsProxyClient.SQLITE_OPEN_READONLY,
              SQLITE_OPEN_DELETEONCLOSE:
                OpfsProxyClient.SQLITE_OPEN_DELETEONCLOSE,
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
            fileBufferSize: 1024 * 64,
            sabS11nOffset: this.sabS11nOffset,
            sabS11nSize: this.sabS11nSize,
            littleEndian: true,
            asyncS11nExceptions: 2,
          };

          this.worker.postMessage({
            type: "opfs-async-init",
            args: options,
          });
        } else if (e.data.type === "opfs-async-inited") {
          this.worker.removeEventListener("message", handler);
          resolve();
        }
      };

      this.worker.addEventListener("message", handler);
    });
  }

  // Serialize arguments into the shared buffer
  private serialize(args: any[]): void {
    const viewDV = new DataView(
      this.sabIO,
      this.sabS11nOffset,
      this.sabS11nSize,
    );
    const viewU8 = this.sabS11nView;

    if (args.length === 0) {
      viewU8[0] = 0;
      return;
    }

    viewU8[0] = args.length;
    let offset = 1;

    // Write type IDs
    for (const arg of args) {
      let typeId = 0;
      if (typeof arg === "number") typeId = 1;
      else if (typeof arg === "bigint") typeId = 2;
      else if (typeof arg === "boolean") typeId = 3;
      else if (typeof arg === "string") typeId = 4;
      else throw new Error(`Unsupported type: ${typeof arg}`);

      viewU8[offset++] = typeId;
    }

    // Write values
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

  // Deserialize return values (mostly for output parameters)
  private deserialize(): any[] {
    const viewDV = new DataView(
      this.sabIO,
      this.sabS11nOffset,
      this.sabS11nSize,
    );
    const viewU8 = this.sabS11nView;
    const argc = viewU8[0];

    if (argc === 0) return [];

    const result = [];
    let offset = 1;
    const typeIds = [];

    // Read type IDs
    for (let i = 0; i < argc; i++) {
      typeIds.push(viewU8[offset++]);
    }

    // Read values
    for (let i = 0; i < argc; i++) {
      const typeId = typeIds[i];
      if (typeId === 1) {
        // number
        result.push(viewDV.getFloat64(offset, true));
        offset += 8;
      } else if (typeId === 2) {
        // bigint
        result.push(viewDV.getBigInt64(offset, true));
        offset += 8;
      } else if (typeId === 3) {
        // boolean
        result.push(viewDV.getInt32(offset, true) !== 0);
        offset += 4;
      } else if (typeId === 4) {
        // string
        const len = viewDV.getInt32(offset, true);
        offset += 4;
        const strBytes = viewU8.slice(offset, offset + len);
        result.push(this.textDecoder.decode(strBytes));
        offset += len;
      }
    }
    return result;
  }

  async send(op: string, args: any[] = []): Promise<any> {
    const opId = this.opIds[op];
    if (!opId) throw new Error(`Unknown operation: ${op}`);

    // 1. Serialize arguments
    this.serialize(args);

    // 2. Store operation ID to signal worker
    // Index 0 is whichOp
    Atomics.store(this.sabOPView, 0, opId);

    // 3. Notify worker
    Atomics.notify(this.sabOPView, 0);

    // 4. Wait for result
    const MAGIC_PENDING = -999999999;
    Atomics.store(this.sabOPView, 1, MAGIC_PENDING);
    Atomics.store(this.sabOPView, 0, opId);
    Atomics.notify(this.sabOPView, 0);

    // Poll for completion
    let rc = MAGIC_PENDING;
    const timeout = 5000;
    const pollStart = performance.now();

    while ((rc = Atomics.load(this.sabOPView, 1)) === MAGIC_PENDING) {
      if (performance.now() - pollStart > timeout) {
        throw new Error(`Timeout waiting for operation ${op}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Deserialize results (if any output args)
    const results = this.deserialize();

    if (results.length > 0) {
      return { rc, results };
    }

    return rc;
  }

  // Helper to set buffer content for xWrite
  setFileBuffer(data: Uint8Array) {
    this.sabFileBufView.set(data);
  }

  // Helper to get buffer content for xRead
  getFileBuffer(length: number): Uint8Array {
    return this.sabFileBufView.slice(0, length);
  }

  terminate() {
    this.worker.terminate();
  }
}
