import type {
  SQLite3Module,
  SQLite3VFSInstance,
  SQLite3IOMethodsInstance,
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
  promiseWasRejected: { value: boolean };
  /** SQLite3 module instance */
  sqlite3: SQLite3Module;
  /** OPFS VFS instance */
  opfsVfs: SQLite3VFSInstance;
  /** OPFS I/O methods instance */
  opfsIoMethods: SQLite3IOMethodsInstance;
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
    onerror: ((this: Worker, ev: ErrorEvent) => void) | null;
    _originalOnError?: ((this: Worker, ev: ErrorEvent) => void) | null;
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
): (event: WorkerMessageEvent) => void;
