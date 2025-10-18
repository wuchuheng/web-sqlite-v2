/**
 * @fileoverview Entry point for installing the wh-wasm utility helpers.
 *
 * The legacy Emscripten glue shipped a monolithic closure that wired dozens
 * of helpers onto the exported `sqlite3.wasm` bridge. This refactor breaks the
 * installation process into small, well-documented modules so each concern
 * (heap helpers, scoped allocators, xWrap adapters, etc.) lives in its own file.
 *
 * Downstream modules still call `createWhWasmUtilInstaller()` and receive the
 * familiar installer function (with the `yawl` helper attached).
 */

import { WhWasmInstallerContext } from "./whwasm/installer-context.mjs";
import { applyDefaults } from "./whwasm/defaults.mjs";
import {
    attachSizeHelpers,
    attachHeapAccessors,
} from "./whwasm/heap-helpers.mjs";
import { attachFunctionTableUtilities } from "./whwasm/function-table-helpers.mjs";
import { attachMemoryAccessors } from "./whwasm/memory-helpers.mjs";
import { attachStringUtilities } from "./whwasm/string-helpers.mjs";
import { attachScopedAllocators } from "./whwasm/scoped-alloc-helpers.mjs";
import { attachXWrapAdapters } from "./whwasm/xwrap-helpers.mjs";
import { createYawlLoader } from "./whwasm/yawl-loader.mjs";

/**
 * Creates the installer used by the SQLite WASM bridge.
 *
 * @returns {import("./whwasm/installer-context.d.ts").WhWasmInstaller & { yawl: import("./whwasm/yawl-loader.d.ts").YawlLoaderFactory }} Function that mutates the provided target
 *   with the expected helpers and returns the augmented target.
 */
export function createWhWasmUtilInstaller() {
    const installWhWasmUtils = (target) => {
        const context = new WhWasmInstallerContext(target);

        applyDefaults(context);
        attachSizeHelpers(context);
        attachHeapAccessors(context);
        attachFunctionTableUtilities(context);
        attachMemoryAccessors(context);
        attachStringUtilities(context);
        attachScopedAllocators(context);
        attachXWrapAdapters(context);

        return target;
    };

    installWhWasmUtils.yawl = createYawlLoader(installWhWasmUtils);

    return installWhWasmUtils;
}
