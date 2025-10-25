export type WorkerMessageValue =
  | string
  | number
  | bigint
  | boolean
  | symbol
  | object;

export type WorkerMessagePayload = ReadonlyArray<WorkerMessageValue>;

export type WorkerMessageType = string;

export type WorkerPostFn = (
  type: WorkerMessageType,
  ...payload: WorkerMessagePayload
) => void;

export type ErrorPart = string | number | bigint | boolean | symbol;

export declare const wPost: WorkerPostFn;

export declare function toss(...parts: ReadonlyArray<ErrorPart>): never;

export declare function detectEnvironmentIssue(): string[];

export declare function getResolvedPath(filename: string): string[];

export declare function detectLittleEndian(): boolean;
