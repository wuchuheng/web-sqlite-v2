import type {
  SQLite3Module,
  SQLite3VFSInstance,
  SQLite3IoMethodsInstance,
  IoSyncWrappers,
  VfsSyncWrappers,
  OpfsState,
  OpfsUtilInterface,
  OpfsConfig,
} from "../../../../../shared/opfs-vfs-installer";

/**
 * Dependencies required for creating worker message handler.
 */
export interface WorkerMessageHandlerDeps {
  /** Promise resolve function */
  promiseResolve: () => void;
  /** Promise reject function */
  promiseReject: (error: Error) => void;
  /** Flag tracking if promise was rejected */
  promiseWasRejected: { value: boolean | undefined };
  /** SQLite3 module instance */
  sqlite3: SQLite3Module;
  /** OPFS VFS instance */
  opfsVfs: SQLite3VFSInstance;
  /** OPFS I/O methods instance */
  opfsIoMethods: SQLite3IoMethodsInstance;
  /** I/O synchronization wrappers */
  ioSyncWrappers: IoSyncWrappers;
  /** VFS synchronization wrappers */
  vfsSyncWrappers: VfsSyncWrappers;
  /** OPFS state object */
  state: OpfsState;
  /** OPFS utility interface */
  opfsUtil: OpfsUtilInterface;
  /** Configuration options */
  options: OpfsConfig;
  /** Warning function */
  warn: (...args: string[]) => void;
  /** Error function */
  error: (...args: (string | Error)[]) => void;
  /** Sanity check function */
  runSanityCheck: () => void;
  /** Function to check if current thread has OPFS */
  thisThreadHasOPFS: () => boolean;
  /** Worker instance */
  W: Worker & {
    onerror: ((this: AbstractWorker, ev: ErrorEvent) => unknown) | null;
    _originalOnError?:
      | ((this: AbstractWorker, ev: ErrorEvent) => unknown)
      | null;
  };
}

/**
 * Message event data structure from worker.
 */
export interface WorkerMessageEvent {
  /** Message event data */
  data:
    | {
        type: "opfs-unavailable";
        payload: string[];
      }
    | {
        type: "opfs-async-loaded";
      }
    | {
        type: "opfs-async-inited";
      }
    | {
        type: string;
        payload?: string[];
        [key: string]: unknown;
      };
}

/**
 * Creates message handler for OPFS async worker communication.
 * Handles worker lifecycle events (loaded, initialized, errors) and
 * coordinates VFS installation and state synchronization between
 * main thread and worker thread.
 * @param deps - Dependencies object with promise handlers, sqlite3, state, and utilities
 * @returns Message handler function for worker message events
 */
export function createWorkerMessageHandler(
  deps: WorkerMessageHandlerDeps,
): (event: WorkerMessageEvent) => void {
  const {
    promiseResolve,
    promiseReject,
    promiseWasRejected,
    sqlite3,
    opfsVfs,
    opfsIoMethods,
    ioSyncWrappers,
    vfsSyncWrappers,
    state,
    opfsUtil,
    options,
    warn,
    error,
    runSanityCheck,
    thisThreadHasOPFS,
    W,
  } = deps;

  return function handleWorkerMessage({ data }: WorkerMessageEvent): void {
    switch (data.type) {
      case "opfs-unavailable":
        // 1. Input handling
        if (data.payload) {
          promiseReject(new Error(data.payload.join(" ")));
        } else {
          promiseReject(new Error("OPFS unavailable"));
        }
        break;

      case "opfs-async-loaded": {
        // 2. Core processing - Send initialization data to worker
        // 2.1 Create state copy without functions (functions can't be cloned for postMessage)
        const stateForWorker = {
          littleEndian: state.littleEndian,
          asyncIdleWaitTime: state.asyncIdleWaitTime,
          asyncS11nExceptions: state.asyncS11nExceptions,
          fileBufferSize: state.fileBufferSize,
          sabS11nOffset: state.sabS11nOffset,
          sabS11nSize: state.sabS11nSize,
          sabIO: state.sabIO,
          sabOP: state.sabOP,
          opIds: state.opIds,
          sq3Codes: state.sq3Codes,
          opfsFlags: state.opfsFlags,
          verbose: state.verbose,
        };
        W.postMessage({
          type: "opfs-async-init",
          args: stateForWorker,
        });
        break;
      }

      case "opfs-async-inited": {
        // 1. Input handling
        if (true === promiseWasRejected.value) {
          break;
        }

        try {
          // 2. Core processing
          // 2.1 Install VFS
          sqlite3.vfs.installVfs({
            io: { struct: opfsIoMethods, methods: ioSyncWrappers },
            vfs: { struct: opfsVfs, methods: vfsSyncWrappers },
          });

          // 2.2 Set up shared array buffer views
          state.sabOPView = new Int32Array(state.sabOP);
          state.sabFileBufView = new Uint8Array(
            state.sabIO,
            0,
            state.fileBufferSize,
          );
          state.sabS11nView = new Uint8Array(
            state.sabIO,
            state.sabS11nOffset,
            state.sabS11nSize,
          );

          // 2.3 Run sanity checks if requested
          if (options.sanityChecks) {
            warn(
              "Running sanity checks because of opfs-sanity-check URL arg...",
            );
            runSanityCheck();
          }

          // 2.4 Get OPFS root directory
          if (thisThreadHasOPFS()) {
            navigator.storage
              .getDirectory()
              .then((d) => {
                if (W._originalOnError !== undefined) {
                  W.onerror = W._originalOnError;
                  delete W._originalOnError;
                }
                sqlite3.opfs = opfsUtil;
                opfsUtil.rootDirectory = d;
                promiseResolve();
              })
              .catch(promiseReject);
          } else {
            promiseResolve();
          }
        } catch (e) {
          error(e as Error);
          promiseReject(e as Error);
        }
        break;
      }

      default: {
        // 3. Output handling
        const errMsg =
          "Unexpected message from the OPFS async worker: " +
          JSON.stringify(data);
        error(errMsg);
        promiseReject(new Error(errMsg));
        break;
      }
    }
  };
}
