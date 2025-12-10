import { createPathFS } from "../../utils/path/path";
import { createBaseState } from "./base-state/base-state";
import { createPathOperations } from "./path-operations/path-operations";
import { createModeOperations } from "./mode-operations/mode-operations";
import { createStreamOperations } from "./stream-operations/stream-operations";
import { createMountOperations } from "./mount-operations/mount-operations";
import { createNodeActions } from "./node-actions/node-actions";
import { createStreamHelpers } from "./stream-helpers/stream-helpers";
import {
  createInitializationHelpers,
  type MutableFS as InitMutableFS,
} from "./initialization/initialization";
import {
  createLegacyHelpers,
  type ExtendedMutableFS,
} from "./legacy-helpers/legacy-helpers";
import type { PathFsUtilities } from "../../utils/path/types";
import type { EmscriptenModule } from "../../wasm/emscripten-module";
import type { RuntimeModule } from "../../shared/runtime-types";

import type { MutableFS, FSNode } from "./base-state/base-state";
import type {
  PathOperations,
  PathOperationsOptions,
} from "./path-operations/path-operations";
import type { ModeOperations } from "./mode-operations/mode-operations";
import type { StreamOperations } from "./stream-operations/stream-operations";
import type {
  MountOperations,
  MountOperationsOptions,
} from "./mount-operations/mount-operations";
import type {
  NodeActions,
  NodeActionsOptions,
} from "./node-actions/node-actions";
import type { StreamHelpers } from "./stream-helpers/stream-helpers";
import type {
  InitializationHelpers,
  InitializationOptions,
} from "./initialization/initialization";
import type {
  LegacyHelpers,
  LegacyHelpersOptions,
} from "./legacy-helpers/legacy-helpers";

/**
 * Comprehensive configuration required to assemble the filesystem facade.
 */
interface FilesystemOptions
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
type AssembledFilesystem = MutableFS &
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
interface FilesystemBundle {
  FS: AssembledFilesystem;
  PATH_FS: PathFsUtilities;
}

/**
 * Assembles the filesystem facade used by the SQLite WebAssembly bundle by
 * composing the individual helper modules together.
 *
 * @param options Configuration for the assembled filesystem facade.
 * @returns The filesystem bundle containing FS and PATH_FS instances.
 */
export function createFS(options: FilesystemOptions): FilesystemBundle {
  const {
    FS_createPreloadedFile,
    FS_createDataFile: _FS_createDataFile,
    FS_modeStringToFlags,
    FS_getMode,
    Module,
    out: _out,
    err = console.error,
  } = options as FilesystemOptions & { Module?: Partial<EmscriptenModule> };

  const FS = createBaseState() as AssembledFilesystem;
  const pathRef = { current: null as PathFsUtilities | null };
  const getPathFS = (): PathFsUtilities => {
    if (!pathRef.current) {
      throw new Error("PATH_FS requested before initialization");
    }
    return pathRef.current;
  };

  // Use Object.assign to merge all helper modules into the base FS object
  // This approach allows the TypeScript compiler to handle the dynamic composition
  const runtimeModule = Module || {};

  Object.assign(
    FS,
    createPathOperations(FS, { getPathFS }),
    createModeOperations(FS),
    createStreamOperations(FS),
    createMountOperations(FS, { err }),
    createNodeActions(FS, {
      FS_modeStringToFlags,
      getPathFS,
      Module: runtimeModule as unknown as Partial<EmscriptenModule>,
    }),
    createStreamHelpers(FS),
    createInitializationHelpers(FS as unknown as InitMutableFS, {
      Module: runtimeModule as unknown as RuntimeModule,
    }),
    createLegacyHelpers(FS as unknown as ExtendedMutableFS, { FS_getMode }),
  );

  // Add the createPreloadedFile property after Object.assign
  FS.createPreloadedFile = FS_createPreloadedFile;

  const PATH_FS = createPathFS(FS);
  pathRef.current = PATH_FS;

  return { FS, PATH_FS };
}
