import type { WhWasmInstaller, YawlLoaderFactory } from "./types.d.ts";

/**
 * Builds the yawl() loader helper that orchestrates WASM instantiation.
 */
export declare function createYawlLoader(
    install: WhWasmInstaller
): YawlLoaderFactory;
