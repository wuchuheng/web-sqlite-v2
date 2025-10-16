export type WorkerPostMessage = string;
export type WorkerPostPayload = string | number | boolean | bigint;
export type ErrorPart = string | number | boolean | bigint;
export type EnvironmentIssue = string[];

export declare const wPost: (
    type: WorkerPostMessage,
    ...payload: WorkerPostPayload[]
) => void;
export declare const toss: (...parts: ErrorPart[]) => never;
export declare const detectEnvironmentIssue: () => EnvironmentIssue;
export declare const getResolvedPath: (filename: string) => string[];
export declare const detectLittleEndian: () => boolean;
