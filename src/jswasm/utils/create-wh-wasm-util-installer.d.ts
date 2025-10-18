import type { WhWasmInstaller } from "./whwasm/installer-context.d.ts";
import type { YawlLoaderFactory } from "./whwasm/yawl-loader.d.ts";

/**
 * Creates the installer responsible for wiring the wh-wasm utility helpers.
 */
export declare function createWhWasmUtilInstaller():
    WhWasmInstaller & { yawl: YawlLoaderFactory };
