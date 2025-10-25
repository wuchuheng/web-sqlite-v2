import type { WorkerPostFn } from "./environment.d.ts";
import type { WorkerLogger } from "./logging.d.ts";
import type { SerializationBuffer } from "./serialization-buffer.d.ts";
import type {
  AsyncProxyState,
  SQLiteErrorCodes,
  AsyncOpfsFlags,
  OperationIds,
} from "./state.d.ts";

/**
 * Enumerates the operation identifiers handled by the async proxy worker.
 */
export type AsyncProxyOperationName =
  | "opfs-async-shutdown"
  | "mkdir"
  | "xAccess"
  | "xClose"
  | "xDelete"
  | "xDeleteNoWait"
  | "xFileSize"
  | "xLock"
  | "xOpen"
  | "xRead"
  | "xSync"
  | "xTruncate"
  | "xUnlock"
  | "xWrite";

/** Possible argument types routed to async operation handlers. */
export type AsyncOperationArgument = number | bigint | string | boolean;

/** Result types produced by async operation handlers. */
export type AsyncOperationResult = void | number;

/** Function signature implemented by async operation handlers. */
export type AsyncOperationImplementation = (
  ...args: ReadonlyArray<AsyncOperationArgument>
) => AsyncOperationResult | Promise<AsyncOperationResult>;

/**
 * Metadata tracked for each open OPFS file within the worker.
 */
export interface AsyncFileRecord {
  readonly fid: number;
  readonly filenameAbs: string;
  readonly filenamePart: string;
  readonly dirHandle: FileSystemDirectoryHandle;
  readonly fileHandle: FileSystemFileHandle;
  readonly sabView: Uint8Array;
  readonly readOnly: boolean;
  readonly deleteOnClose: boolean;
  readonly releaseImplicitLocks: boolean;
  syncHandle?: FileSystemSyncAccessHandle;
  xLock?: number;
}

/**
 * Initialization payload delivered to the worker on startup.
 */
export interface WorkerInitOptions {
  readonly verbose?: number;
  readonly sabOP: SharedArrayBuffer;
  readonly sabIO: SharedArrayBuffer;
  readonly sq3Codes: SQLiteErrorCodes;
  readonly opfsFlags: AsyncOpfsFlags;
  readonly opIds: OperationIds;
  readonly asyncIdleWaitTime: number;
  readonly asyncS11nExceptions: number;
  readonly fileBufferSize: number;
  readonly sabS11nOffset: number;
  readonly sabS11nSize: number;
}

/**
 * Entry describing the mapping between operation ids and handler callbacks.
 */
export interface OperationHandlerEntry {
  readonly name: AsyncProxyOperationName;
  readonly handler: AsyncOperationImplementation;
}

/** Control message dispatched from the controller thread. */
export interface WorkerControlMessage {
  readonly type?: string;
  readonly args?: WorkerInitOptions;
}

/** Event delivered to {@link AsyncProxyWorker.onMessage}. */
export interface WorkerMessageEvent {
  readonly data?: WorkerControlMessage;
}

/**
 * Worker implementation responsible for handling OPFS async proxy requests.
 */
export declare class AsyncProxyWorker {
  constructor(postFn: WorkerPostFn);
  readonly postMessage: WorkerPostFn;
  readonly state: AsyncProxyState;
  readonly logger: WorkerLogger;
  readonly openFiles: Map<number, AsyncFileRecord>;
  readonly implicitLocks: Set<number>;
  serialization: SerializationBuffer;
  readonly operationImplementations: Record<
    AsyncProxyOperationName,
    (...args: ReadonlyArray<number | bigint | string | boolean>) => unknown
  >;
  readonly operationHandlersById: Map<number, OperationHandlerEntry>;
  isShutdownRequested: boolean;
  waitLoopActive: boolean;
  start(): Promise<void>;
  onMessage(event: WorkerMessageEvent): void;
  handleInit(options: WorkerInitOptions | undefined): void;
  handleRestart(): void;
  handleShutdown(): void;
  handleMkdir(dirname: string): Promise<void>;
  handleXAccess(filename: string): Promise<void>;
  handleXClose(fid: number): Promise<void>;
  handleXDelete(
    filename: string,
    syncDir?: number,
    recursive?: boolean,
  ): Promise<void>;
  handleXDeleteNoWait(
    filename: string,
    syncDir?: number,
    recursive?: boolean,
  ): Promise<number>;
  handleXFileSize(fid: number): Promise<void>;
  handleXLock(fid: number, lockType: number): Promise<void>;
  handleXOpen(
    fid: number,
    filename: string,
    flags: number,
    opfsFlags: number,
  ): Promise<void>;
  handleXRead(
    fid: number,
    length: number,
    offset64: number | bigint,
  ): Promise<void>;
  handleXSync(fid: number, flags: number): Promise<void>;
  handleXTruncate(fid: number, size: number | bigint): Promise<void>;
  handleXUnlock(fid: number, lockType: number): Promise<void>;
  handleXWrite(
    fid: number,
    length: number,
    offset64: number | bigint,
  ): Promise<void>;
  getDirectoryForFilename(
    absFilename: string,
    createDirs?: boolean,
  ): Promise<[FileSystemDirectoryHandle, string]>;
  affirmWritable(opName: string, file: AsyncFileRecord | undefined): void;
  storeAndNotify(opName: AsyncProxyOperationName, value: number): void;
  getSyncHandle(
    file: AsyncFileRecord | undefined,
    opName: string,
  ): Promise<FileSystemSyncAccessHandle>;
  releaseImplicitLocks(): Promise<void>;
  releaseImplicitLock(file: AsyncFileRecord | undefined): Promise<void>;
  closeSyncHandle(file: AsyncFileRecord | undefined): Promise<void>;
  closeSyncHandleQuietly(file: AsyncFileRecord | undefined): Promise<void>;
}
