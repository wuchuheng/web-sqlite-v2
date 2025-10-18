import type { WhWasmHelperTarget, WhWasmInstaller } from "./installer-context.d.ts";

/**
 * Configuration object accepted by the yawl() loader helper.
 */
export interface YawlLoaderConfig {
    /** WebAssembly URI used when fetching the module. */
    uri: string;
    /** Optional imports object forwarded to instantiate. */
    imports?: WebAssembly.Imports;
    /** Optional loader callback invoked after instantiation. */
    onload?: (
        result: WebAssembly.WebAssemblyInstantiatedSource,
        options: YawlLoaderConfig
    ) => void;
    /** Optional flag or callback disabling instantiateStreaming. */
    noStreaming?: boolean | (() => boolean);
    /** Target object that receives the wh-wasm helpers. */
    wasmUtilTarget?: WhWasmHelperTarget;
}

/**
 * Loader factory produced by the yawl() helper.
 */
export type YawlLoaderFactory = (
    config: Partial<YawlLoaderConfig>
) => () => Promise<WebAssembly.WebAssemblyInstantiatedSource>;

/**
 * Builds the yawl() loader helper that orchestrates WASM instantiation.
 */
export declare function createYawlLoader(
    install: WhWasmInstaller
): YawlLoaderFactory;
