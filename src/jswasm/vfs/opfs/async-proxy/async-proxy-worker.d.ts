import type { SerializableValue } from "./serialization-buffer";
import type {
    OperationIdMap,
    OperationName,
    WorkerOpfsFlags,
    WorkerSqliteErrorCodes,
    WorkerState,
} from "./state";
import type { WorkerPostMessage, WorkerPostPayload } from "./environment";

export interface WorkerInitOptions {
    verbose?: number;
    sabOP: SharedArrayBuffer;
    sabIO: SharedArrayBuffer;
    sq3Codes: WorkerSqliteErrorCodes;
    opfsFlags: WorkerOpfsFlags;
    opIds: OperationIdMap;
    asyncIdleWaitTime: number;
    asyncS11nExceptions: number;
    fileBufferSize: number;
    sabS11nOffset: number;
    sabS11nSize: number;
}

export type PostFn = (
    type: WorkerPostMessage,
    ...payload: WorkerPostPayload[]
) => void;

export interface OperationHandlerEntry {
    name: OperationName;
    handler: (...args: SerializableValue[]) => void | Promise<void>;
}

export interface FileRecord {
    fid: number;
    filenameAbs: string;
    filenamePart: string;
    dirHandle: FileSystemDirectoryHandle;
    fileHandle: FileSystemFileHandle;
    sabView: Uint8Array;
    readOnly: boolean;
    deleteOnClose: boolean;
    releaseImplicitLocks?: boolean;
    syncHandle?: FileSystemSyncAccessHandle;
    xLock?: number;
}

export declare class AsyncProxyWorker {
    constructor(postFn: PostFn);
    readonly state: WorkerState;
    readonly logger: import("./worker-logger").WorkerLogger;
    start(): Promise<void>;
    createOperationImplementations(): Record<
        OperationName,
        OperationHandlerEntry['handler']
    >;
    onMessage(event: { data?: { type?: string; args?: WorkerInitOptions } }): void;
    handleInit(options: WorkerInitOptions): void;
}
