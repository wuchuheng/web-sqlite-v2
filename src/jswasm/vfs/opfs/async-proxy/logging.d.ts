export type WorkerLogLevel = 0 | 1 | 2;

export type WorkerLogArgument =
    | string
    | number
    | bigint
    | boolean
    | symbol
    | object;

export declare class WorkerLogger {
    constructor(levelProvider: () => number);
    logAt(level: WorkerLogLevel, ...args: ReadonlyArray<WorkerLogArgument>): void;
    log(...args: ReadonlyArray<WorkerLogArgument>): void;
    warn(...args: ReadonlyArray<WorkerLogArgument>): void;
    error(...args: ReadonlyArray<WorkerLogArgument>): void;
}
