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
import type {
  AssembledFilesystem,
  FilesystemBundle,
  FilesystemOptions,
} from "../filesystem";
import type { PathFsUtilities } from "../../utils/path/types";
import type { EmscriptenModule } from "../../wasm/emscripten-module";
import type { RuntimeModule } from "../../shared/runtime-types";

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
