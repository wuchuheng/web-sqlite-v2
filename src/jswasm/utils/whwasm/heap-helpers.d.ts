import type { WhWasmInstallerContext } from "./installer-context.d.ts";

/**
 * Installs the sizeof helpers on the target.
 */
export declare function attachSizeHelpers(context: WhWasmInstallerContext): void;

/**
 * Adds memoised heap accessor helpers to the target.
 */
export declare function attachHeapAccessors(context: WhWasmInstallerContext): void;
