import type { PathFsUtilities } from "../utils/path.d.ts";
import type {
    MutableFS,
    FSNode,
} from "./filesystem/types.d.ts";
import type { PathOperations, PathOperationsOptions } from "./filesystem/path-operations.d.ts";
import type { ModeOperations } from "./filesystem/mode-operations.d.ts";
import type { StreamOperations } from "./filesystem/stream-operations.d.ts";
import type { MountOperations, MountOperationsOptions } from "./filesystem/mount-operations.d.ts";
import type { NodeActions, NodeActionsOptions } from "./filesystem/node-actions.d.ts";
import type { StreamHelpers } from "./filesystem/stream-helpers.d.ts";
import type { InitializationHelpers, InitializationOptions } from "./filesystem/initialization.d.ts";
import type { LegacyHelpers, LegacyHelpersOptions } from "./filesystem/legacy-helpers.d.ts";

export interface FilesystemOptions
    extends PathOperationsOptions,
        NodeActionsOptions,
        MountOperationsOptions,
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
        canOwn?: boolean
    ): void;
    FS_createDataFile?(
        parent: string | FSNode,
        name: string,
        data: string | ArrayLike<number> | null,
        canRead: boolean,
        canWrite: boolean,
        canOwn?: boolean
    ): void;
    FS_modeStringToFlags(mode: string): number;
    FS_getMode(canRead: boolean, canWrite: boolean): number;
    Module?: Record<string, unknown>;
    out?: (message: string) => void;
    err?: (message: string) => void;
}

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

export interface FilesystemBundle {
    FS: AssembledFilesystem;
    PATH_FS: PathFsUtilities;
}

export function createFS(options: FilesystemOptions): FilesystemBundle;
