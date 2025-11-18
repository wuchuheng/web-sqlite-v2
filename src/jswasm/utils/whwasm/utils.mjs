/**
 * @fileoverview Shared small utilities for the wh-wasm installer modules.
 */

/**
 * Ensures the target exposes both `alloc` and `dealloc` helpers.
 *
 * @param {import("./installer-context/installer-context.js").WhWasmInstallerContext} context
 * @param {string} funcName - Name used in the error message for clarity.
 */
export function assertAllocator(context, funcName) {
    const { target } = context;
    if (
        !(target.alloc instanceof Function) ||
        !(target.dealloc instanceof Function)
    ) {
        context.toss(
            "Object is missing alloc() and/or dealloc() function(s) required by",
            funcName,
        );
    }
}
