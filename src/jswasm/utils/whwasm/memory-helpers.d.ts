import type { WhWasmInstallerContext } from "./installer-context.d.ts";

/**
 * Adds pointer-aware peek and poke helpers to the target.
 */
export declare function attachMemoryAccessors(
    context: WhWasmInstallerContext
): void;
