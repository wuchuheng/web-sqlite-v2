import type {
    AbortFunction,
    ConsoleOutputHandlers,
    LocateFileFunction,
    ModuleOverrides,
    RuntimeModule
} from "../shared/runtime-types.d.ts";

/**
 * Builds a locateFile helper bound to the given module URL.
 */
export declare function createLocateFile(importMetaUrl: string): LocateFileFunction;

/**
 * Installs a locateFile implementation onto the provided module instance.
 */
export declare function setupModuleLocateFile(
    Module: RuntimeModule,
    importMetaUrl: string
): void;

/**
 * Creates a locateFile wrapper that respects user overrides when available.
 */
export declare function createModuleLocateFile(
    Module: RuntimeModule,
    scriptDirectory: string
): LocateFileFunction;

/**
 * Derives console output handlers from the module configuration.
 */
export declare function setupConsoleOutput(Module: RuntimeModule): ConsoleOutputHandlers;

/**
 * Produces the abort helper used to reject the ready promise and flag Module.ABORT.
 */
export declare function createAbortFunction(
    Module: RuntimeModule,
    err: (...args: string[]) => void,
    readyPromiseReject: (reason: Error) => void
): AbortFunction;

/**
 * Applies user-provided module overrides and returns a snapshot for restoration.
 */
export declare function initializeModule(
    Module: RuntimeModule,
    moduleArg: Partial<RuntimeModule>
): ModuleOverrides;

/**
 * Restores the module instance to its pre-initialization state.
 */
export declare function applyModuleOverrides(
    Module: RuntimeModule,
    moduleOverrides: ModuleOverrides
): void;

/**
 * Executes any registered preInit callbacks on the module instance.
 */
export declare function runPreInitCallbacks(Module: RuntimeModule): void;
