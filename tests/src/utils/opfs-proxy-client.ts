export class OpfsProxyClient {
  private worker: Worker;
  private sabIO: SharedArrayBuffer | undefined;
  private sabOP: SharedArrayBuffer | undefined;
  private sabOPView: Int32Array | undefined;
  private opIds: Record<string, number> | undefined;

  constructor(workerPath: string) {
    this.worker = new Worker(workerPath);
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.worker.onmessage = ({ data }) => {
        if (data === "opfs-async-loaded") {
          // Worker loaded, send init command
          // Allocate SABs
          const sabIO = new SharedArrayBuffer(4096); // Example size
          const sabOP = new SharedArrayBuffer(1024); // Example size
          this.sabIO = sabIO;
          this.sabOP = sabOP;
          this.sabOPView = new Int32Array(sabOP);
          
          // Mock opIds and sq3Codes for now, as they usually come from the main thread
          this.opIds = {
             xOpen: 1,
             xClose: 2,
             xRead: 3,
             xWrite: 4,
             xTruncate: 5,
             xFileSize: 6,
             xDelete: 7,
             xAccess: 8,
             xLock: 9,
             xUnlock: 10,
             xSync: 11,
             whichOp: 0,
             retry: 12,
             rc: 13
          };

          this.worker.postMessage({
            type: "opfs-async-init",
            args: {
              verbose: 2,
              sabIO,
              sabOP,
              fileBufferSize: 4096,
              sabS11nOffset: 0,
              sabS11nSize: 1024,
              opIds: this.opIds,
              sq3Codes: {
                  SQLITE_OPEN_CREATE: 0x00000040,
                  SQLITE_OPEN_READONLY: 0x00000001,
                  SQLITE_OPEN_DELETEONCLOSE: 0x00000008,
                  SQLITE_LOCK_NONE: 0,
                  SQLITE_NOTFOUND: 12,
                  SQLITE_IOERR: 10,
              },
              opfsFlags: {
                  OPFS_UNLINK_BEFORE_OPEN: 1,
                  OPFS_UNLOCK_ASAP: 2,
                  defaultUnlockAsap: false
              },
              littleEndian: true,
              asyncIdleWaitTime: 50,
            },
          });
        } else if (data === "opfs-async-inited") {
          resolve();
        } else if (data && data.type === 'opfs-unavailable') {
            reject(new Error(`OPFS Unavailable: ${data.payload}`));
        }
      };
      
      this.worker.onerror = (e) => {
          reject(e);
      }
    });
  }

  async send(op: string, args: any[]): Promise<number> {
    if (!this.sabOPView || !this.opIds) {
        throw new Error("Not initialized");
    }

    // 1. Serialize args (Simplified for MVP, real impl needs the serializer logic)
    // For now, we might need to replicate the s11n logic or just pass simple args if supported
    // But the proxy uses s11n.serialize/deserialize.
    // We need to implement a minimal serializer here to talk to the proxy.
    this.serialize(args);

    // 2. Notify worker
    const opId = this.opIds[op];
    if (!opId) throw new Error(`Unknown op: ${op}`);
    
    Atomics.store(this.sabOPView, this.opIds.whichOp, opId);
    Atomics.notify(this.sabOPView, this.opIds.whichOp);

    // 3. Wait for result
    Atomics.wait(this.sabOPView, this.opIds.rc, 0); // Wait for rc to change? No, rc is used for result
    // The proxy stores result in opIds.rc and notifies it.
    // Actually, we need to wait on opIds.rc? 
    // The proxy does: storeAndNotify(opName, rc) -> Atomics.store(sabOPView, opIds.rc, value); Atomics.notify(...)
    
    // Wait logic:
    // We should probably clear the RC or have a dedicated signal.
    // The proxy seems to just notify `rc` index.
    // So we wait on `rc` index.
    
    const result = Atomics.wait(this.sabOPView, this.opIds.rc, 0); 
    // Wait returns "ok", "not-equal", "timed-out"
    
    const rc = Atomics.load(this.sabOPView, this.opIds.rc);
    return rc;
  }
  
  private serialize(args: any[]) {
      // Minimal serializer implementation matching the proxy's expectation
      // viewU8[0] = argc
      // ... types ... values ...
      if (!this.sabIO) return;
      
      const viewU8 = new Uint8Array(this.sabIO);
      const viewDV = new DataView(this.sabIO);
      const textEncoder = new TextEncoder();
      
      viewU8[0] = args.length;
      let offset = 1;
      const typeIds: any[] = [];
      
      // Write Types
      for(const arg of args) {
          let typeId = 0;
          if (typeof arg === 'number') typeId = 1;
          else if (typeof arg === 'bigint') typeId = 2;
          else if (typeof arg === 'boolean') typeId = 3;
          else if (typeof arg === 'string') typeId = 4;
          
          typeIds.push({id: typeId, type: typeof arg});
          viewU8[offset++] = typeId;
      }
      
      // Write Values
      for(let i=0; i<args.length; i++) {
          const arg = args[i];
          const type = typeIds[i];
          
          if (type.id === 1) { // number
              viewDV.setFloat64(offset, arg, true); // littleEndian
              offset += 8;
          } else if (type.id === 4) { // string
              const s = textEncoder.encode(arg);
              viewDV.setInt32(offset, s.byteLength, true);
              offset += 4;
              viewU8.set(s, offset);
              offset += s.byteLength;
          }
           // ... other types ...
      }
  }
}
