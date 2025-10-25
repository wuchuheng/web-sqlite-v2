import type { WhWasmInstallerContext } from "./installer-context.d.ts";

/**
 * Installs UTF-8 conversion and CString helpers on the target.
 */
export declare function attachStringUtilities(
  context: WhWasmInstallerContext,
): void;
