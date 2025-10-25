import type {
  RuntimeLifecycleManager,
  RuntimeModule,
  RuntimeTTY,
  RuntimeFS,
} from "../shared/runtime-types.d.ts";

/**
 * Creates a runtime lifecycle manager for coordinating the WebAssembly module
 * startup sequence.
 */
export declare function createLifecycleManager(
  Module: RuntimeModule,
  FS: RuntimeFS,
  TTY: RuntimeTTY,
): RuntimeLifecycleManager;
