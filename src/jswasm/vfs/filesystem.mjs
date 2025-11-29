import { createPathFS } from "../utils/path/path";
import { createBaseState } from "./filesystem/base-state/base-state";
import { createPathOperations } from "./filesystem/path-operations.mjs";
import { createModeOperations } from "./filesystem/mode-operations/mode-operations";
import { createStreamOperations } from "./filesystem/stream-operations.mjs";
import { createMountOperations } from "./filesystem/mount-operations/mount-operations";
import { createNodeActions } from "./filesystem/node-actions.mjs";
import { createStreamHelpers } from "./filesystem/stream-helpers.mjs";
import { createInitializationHelpers } from "./filesystem/initialization/initialization";
import { createLegacyHelpers } from "./filesystem/legacy-helpers/legacy-helpers";

/**
 * Assembles the filesystem facade used by the SQLite WebAssembly bundle by
 * composing the individual helper modules together.
 *
 * @param {import("./filesystem.d.ts").FilesystemOptions} options
 *        Configuration for the assembled filesystem facade.
 * @returns {import("./filesystem.d.ts").FilesystemBundle}
 */
export function createFS({
    FS_createPreloadedFile,
    FS_createDataFile: _FS_createDataFile,
    FS_modeStringToFlags,
    FS_getMode,
    Module = {},
    out: _out,
    err = console.error,
}) {
    const FS = createBaseState();
    const pathRef = { current: null };
    const getPathFS = () => {
        if (!pathRef.current) {
            throw new Error("PATH_FS requested before initialization");
        }
        return pathRef.current;
    };

    Object.assign(
        FS,
        createPathOperations(FS, { getPathFS }),
        createModeOperations(FS),
        createStreamOperations(FS),
        createMountOperations(FS, { err }),
        createNodeActions(FS, { FS_modeStringToFlags, getPathFS, Module }),
        createStreamHelpers(FS),
        createInitializationHelpers(FS, { Module }),
        createLegacyHelpers(FS, { FS_getMode }),
    );

    FS.createPreloadedFile = FS_createPreloadedFile;

    const PATH_FS = createPathFS(FS);
    pathRef.current = PATH_FS;

    return { FS, PATH_FS };
}
