import type { WhWasmInstaller, YawlLoaderFactory } from "./whwasm/types.d.ts";

/**
 * Creates the installer responsible for wiring the wh-wasm utility helpers.
 */
export declare function createWhWasmUtilInstaller():
    WhWasmInstaller & { yawl: YawlLoaderFactory };
