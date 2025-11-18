/**
 * @fileoverview Applies baseline defaults to the wh-wasm installer target.
 */

import type { WhWasmInstallerContext } from "../installer-context/installer-context";

/**
 * Ensures the target exposes core metadata before additional helpers are attached.
 *
 * @param context - Shared installer context.
 */
export function applyDefaults(context: WhWasmInstallerContext): void {
  const { target, ptrIR, ptrSizeof } = context;

  // 1. Input handling
  // The context object is expected to be properly initialized before calling this function

  // 2. Core processing
  if (typeof target.bigIntEnabled === "undefined") {
    target.bigIntEnabled = !!globalThis.BigInt64Array;
  }

  if (!target.exports) {
    Object.defineProperty(target, "exports", {
      enumerable: true,
      configurable: true,
      get: () => target.instance && target.instance.exports,
    });
  }

  // 3. Output handling
  target.pointerIR = ptrIR;
  target.ptrSizeof = ptrSizeof;
}
