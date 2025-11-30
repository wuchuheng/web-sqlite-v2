import { createCoreOperations } from "./node-core-operations/node-core-operations";
import { createMetadataOperations } from "./node-metadata-operations/node-metadata-operations";

/**
 * Generates high-level node manipulation helpers (create, rename, open, etc.)
 * that mirror POSIX semantics on top of the in-memory filesystem state.
 *
 * @param {import("./base-state.d.ts").MutableFS} FS
 * @param {import("./node-actions.d.ts").NodeActionsOptions} options
 * @returns {import("./node-actions.d.ts").NodeActions}
 */
export function createNodeActions(FS, options) {
    // 1. Initialize operation modules
    const coreOps = createCoreOperations(FS, options);
    const metadataOps = createMetadataOperations(FS, options);

    // 2. Create the combined API by merging operations
    return {
        // Core file/directory operations
        create: coreOps.create,
        mkdir: coreOps.mkdir,
        mkdirTree: coreOps.mkdirTree,
        mkdev: coreOps.mkdev,
        symlink: coreOps.symlink,
        rename: coreOps.rename,
        rmdir: coreOps.rmdir,
        readdir: coreOps.readdir,
        unlink: coreOps.unlink,
        readlink: coreOps.readlink,

        // File status and metadata operations
        stat: metadataOps.stat,
        lstat: metadataOps.lstat,

        // Permission operations
        chmod: metadataOps.chmod,
        lchmod: metadataOps.lchmod,
        fchmod: metadataOps.fchmod,
        chown: metadataOps.chown,
        lchown: metadataOps.lchown,
        fchown: metadataOps.fchown,

        // Content operations
        truncate: metadataOps.truncate,
        ftruncate: metadataOps.ftruncate,
        utime: metadataOps.utime,

        // File access operations
        open: metadataOps.open,
    };
}
