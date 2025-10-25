import type { WhWasmInstallerContext } from "./installer-context.d.ts";

/**
 * Adds scoped allocation helpers that mirror the legacy installer behaviour.
 */
export declare function attachScopedAllocators(
  context: WhWasmInstallerContext,
): void;
