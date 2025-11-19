/**
 * Shared installer assertions.
 */

import type { WhWasmInstallerContext } from "../installer-context/installer-context";

/**
 * Asserts that the installer target exposes allocator helpers.
 *
 * @param context Installer context whose target should expose alloc/dealloc helpers.
 * @param funcName Method name used for contextualizing the error message.
 */
export function assertAllocator(
  context: WhWasmInstallerContext,
  funcName: string,
): void {
  const { target } = context;
  const hasAlloc = typeof target.alloc === "function";
  const hasDealloc = typeof target.dealloc === "function";
  if (!hasAlloc || !hasDealloc) {
    context.toss(
      "Object is missing alloc() and/or dealloc() function(s) required by",
      funcName,
    );
  }
}
