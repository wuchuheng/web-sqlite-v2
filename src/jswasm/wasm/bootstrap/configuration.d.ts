export interface BootstrapConfig {
    exports?: WebAssembly.Exports;
    memory?: WebAssembly.Memory;
    bigIntEnabled: boolean;
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    log: (...args: unknown[]) => void;
    wasmfsOpfsDir?: string;
    useStdAlloc: boolean;
    allocExportName: string;
    deallocExportName: string;
    reallocExportName: string;
    wasmPtrSizeof?: number;
    wasmPtrIR?: "i32" | "i64";
}

export interface ResolveBootstrapConfigOptions {
    moduleRef?: unknown;
    globalObject?: typeof globalThis;
}

export function resolveBootstrapConfig(
    apiConfig?: Partial<BootstrapConfig>,
    options?: ResolveBootstrapConfigOptions
): BootstrapConfig;
