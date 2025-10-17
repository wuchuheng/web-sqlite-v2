/** Information about the detected execution environment. */
export interface EnvironmentInfo {
    ENVIRONMENT_IS_WEB: boolean;
    ENVIRONMENT_IS_WORKER: boolean;
    scriptDirectory: string;
}

/** Utility methods for loading resources in the current environment. */
export interface FileReaders {
    readAsync: (url: string) => Promise<ArrayBuffer>;
    readBinary?: (url: string) => Uint8Array;
}

/** Detects whether the module is executing in a browser, worker, or other host. */
export function detectEnvironment(): EnvironmentInfo;

/** Creates synchronous and asynchronous file readers for the active environment. */
export function createFileReaders(ENVIRONMENT_IS_WORKER: boolean): FileReaders;
