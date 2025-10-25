import type { WhWasmInstallerContext } from "./installer-context.d.ts";

/**
 * Asserts that the installer target exposes allocator helpers.
 */
export declare function assertAllocator(
  context: WhWasmInstallerContext,
  funcName: string,
): void;
