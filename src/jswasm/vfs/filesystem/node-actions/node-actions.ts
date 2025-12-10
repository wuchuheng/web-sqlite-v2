import {
  createCoreOperations,
  type CoreOperationsFS,
} from "../node-core-operations/node-core-operations";
import {
  createMetadataOperations,
  type MetadataOperationsFS,
} from "../node-metadata-operations/node-metadata-operations";
import type { MutableFS } from "../base-state/base-state";
import type { PathFsUtilities } from "../../../utils/path/types.d.ts";
import type { CoreOperations } from "../node-core-operations/node-core-operations";
import type { MetadataOperations } from "../node-metadata-operations/node-metadata-operations";
import type { EmscriptenModule } from "../../../wasm/emscripten-module";

export interface NodeActionsOptions {
  getPathFS: () => PathFsUtilities;
  FS_modeStringToFlags: (mode: string) => number;
  Module: Partial<EmscriptenModule>;
}

export interface NodeActions extends CoreOperations, MetadataOperations {}

/**
 * Generates high-level node manipulation helpers (create, rename, open, etc.)
 * that mirror POSIX semantics on top of the in-memory filesystem state.
 *
 * @param FS - The mutable filesystem instance to operate on
 * @param options - Configuration options containing utilities and runtime references
 * @returns A combined interface of core and metadata operations for node manipulation
 */
export function createNodeActions(
  FS: MutableFS,
  options: NodeActionsOptions,
): NodeActions {
  // 1. Initialize operation modules
  // Cast FS to the extended interfaces expected by the operation modules
  // This is safe because the runtime FS object implements these methods
  const coreOps = createCoreOperations(FS as CoreOperationsFS, options);
  const metadataOps = createMetadataOperations(
    FS as MetadataOperationsFS,
    options,
  );

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
