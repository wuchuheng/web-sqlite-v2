export type VerbosityProvider = () => number;

export type ConsoleArgument = string | number | boolean | bigint | symbol | object;

export declare class WorkerLogger {
    constructor(levelProvider: VerbosityProvider);
    logAt(level: 0 | 1 | 2, ...args: ConsoleArgument[]): void;
    log(...args: ConsoleArgument[]): void;
    warn(...args: ConsoleArgument[]): void;
    error(...args: ConsoleArgument[]): void;
}
