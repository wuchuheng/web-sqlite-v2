/**
 * @fileoverview Applies baseline defaults to the wh-wasm installer target.
 */

/**
 * Ensures the target exposes core metadata before additional helpers are attached.
 *
 * @param {import("./installer-context.mjs").WhWasmInstallerContext} context - Shared installer context.
 */
export function applyDefaults(context) {
    const { target, ptrIR, ptrSizeof } = context;

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

    target.pointerIR = ptrIR;
    target.ptrSizeof = ptrSizeof;
}
