import type { WhWasmInstaller } from "../whwasm/installer-context/installer-context";
import type { YawlLoaderFactory } from "../whwasm/yawl-loader.d.ts";

import { WhWasmInstallerContext } from "../whwasm/installer-context/installer-context";
import { applyDefaults } from "../whwasm/defaults/defaults";
import {
  attachSizeHelpers,
  attachHeapAccessors,
} from "../whwasm/heap-helpers/heap-helpers";
import { attachFunctionTableUtilities } from "../whwasm/function-table-helpers/function-table-helpers";
import { attachMemoryAccessors } from "../whwasm/memory-helpers/memory-helpers";
import { attachStringUtilities } from "../whwasm/string-helpers";
import { attachScopedAllocators } from "../whwasm/scoped-alloc-helpers/scoped-alloc-helpers";
import { attachXWrapAdapters } from "../whwasm/xwrap-helpers";
import { createYawlLoader } from "../whwasm/yawl-loader";

type InstallerWithYawl = WhWasmInstaller & { yawl: YawlLoaderFactory };

export function createWhWasmUtilInstaller(): InstallerWithYawl {
  const installWhWasmUtils = ((target) => {
    // 1. Input handling
    const context = new WhWasmInstallerContext(target);

    // 2. Core processing
    applyDefaults(context);
    attachSizeHelpers(context);
    attachHeapAccessors(context);
    attachFunctionTableUtilities(context);
    attachMemoryAccessors(context);
    attachStringUtilities(context);
    attachScopedAllocators(context);
    attachXWrapAdapters(context);

    // 3. Output handling
    return target;
  }) as InstallerWithYawl;

  installWhWasmUtils.yawl = createYawlLoader(installWhWasmUtils);
  return installWhWasmUtils;
}
