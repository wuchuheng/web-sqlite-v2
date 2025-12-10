import type { PathFsUtilities } from "../utils/path/types";
import type { MutableFS, FSNode } from "./filesystem/base-state/base-state";
import type {
  PathOperations,
  PathOperationsOptions,
} from "./filesystem/path-operations/path-operations";
import type { ModeOperations } from "./filesystem/mode-operations/mode-operations";
import type { StreamOperations } from "./filesystem/stream-operations/stream-operations";
import type {
  MountOperations,
  MountOperationsOptions,
} from "./filesystem/mount-operations/mount-operations";
import type {
  NodeActions,
  NodeActionsOptions,
} from "./filesystem/node-actions/node-actions";
import type { StreamHelpers } from "./filesystem/stream-helpers/stream-helpers";
import type {
  InitializationHelpers,
  InitializationOptions,
} from "./filesystem/initialization/initialization";
import type {
  LegacyHelpers,
  LegacyHelpersOptions,
} from "./filesystem/legacy-helpers/legacy-helpers";

/**
 * Comprehensive configuration required to assemble the filesystem facade.
 */
export interface FilesystemOptions
  extends PathOperationsOptions,
    Omit<NodeActionsOptions, "Module">,
    Omit<MountOperationsOptions, "err">,
    LegacyHelpersOptions,
    InitializationOptions {
  FS_createPreloadedFile(
    parent: string | FSNode,
    name: string,
    url: string,
    canRead?: boolean,
    canWrite?: boolean,
    onload?: (() => void) | null,
    onerror?: ((error: Error) => void) | null,
    dontCreateFile?: boolean,
    canOwn?: boolean,
  ): void;
  FS_createDataFile?(
    parent: string | FSNode,
    name: string,
    data: string | ArrayLike<number> | null,
    canRead: boolean,
    canWrite: boolean,
    canOwn?: boolean,
  ): void;
  FS_modeStringToFlags(mode: string): number;
  FS_getMode(canRead: boolean, canWrite: boolean): number;
  out?: (message: string) => void;
  err?: (message: string) => void;
}

/**
 * Aggregate type representing the composed filesystem helper modules.
 */
export type AssembledFilesystem = MutableFS &
  PathOperations &
  ModeOperations &
  StreamOperations &
  MountOperations &
  NodeActions &
  StreamHelpers &
  InitializationHelpers &
  LegacyHelpers & {
    createPreloadedFile: FilesystemOptions["FS_createPreloadedFile"];
  };

/** Structured return value containing the filesystem facade. */
export interface FilesystemBundle {
  FS: AssembledFilesystem;
  PATH_FS: PathFsUtilities;
}

/**
 * Instantiates the composed filesystem helpers using the supplied options.
 */
export function createFS(options: FilesystemOptions): FilesystemBundle;
