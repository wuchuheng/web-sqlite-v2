export interface BootstrapUtility {
    affirmBindableTypedArray(value: unknown): Uint8Array | Int8Array | ArrayBuffer;
    flexibleString(value: unknown): unknown;
    bigIntFits32(value: bigint): boolean;
    bigIntFits64(value: bigint): boolean;
    bigIntFitsDouble(value: bigint | number): boolean;
    isBindableTypedArray(value: unknown): boolean;
    isInt32(value: unknown): boolean;
    isSQLableTypedArray(value: unknown): boolean;
    isTypedArray(value: unknown): false | ArrayBufferView;
    typedArrayToString(value: Uint8Array, begin?: number, end?: number): string;
    isUIThread(): boolean;
    isSharedTypedArray(value: unknown): boolean;
    toss(...args: unknown[]): never;
    toss3(...args: unknown[]): never;
    typedArrayPart(array: Uint8Array, begin?: number, end?: number): Uint8Array;
    affirmDbHeader(bytes: ArrayBuffer | Uint8Array): void;
    affirmIsDb(bytes: ArrayBuffer | Uint8Array): void;
}

export interface BootstrapUtilFactoryResult {
    util: BootstrapUtility;
}

export function createBootstrapUtil(
    errorFns: { toss3: (...args: unknown[]) => never },
    wasm: { isPtr?: (value: unknown) => boolean; cstrToJs?: (ptr: number) => string }
): BootstrapUtilFactoryResult;
