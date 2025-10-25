import type {
  FileSystemMountType,
  MutableFS,
  StreamOps,
} from "./base-state.d.ts";
import type { RuntimeModule } from "../../shared/runtime-types.d.ts";

/**
 * Helper collection responsible for configuring the virtual filesystem with
 * default directories, devices, and stream plumbing.
 */
export interface InitializationHelpers {
  /** Creates the standard directory hierarchy expected by libc consumers. */
  createDefaultDirectories(): void;
  /** Installs pseudo device nodes such as /dev/null and configures the TTYs. */
  createDefaultDevices(
    TTY: {
      register(dev: number, ops: StreamOps): void;
      default_tty_ops: StreamOps;
      default_tty1_ops: StreamOps;
    },
    randomFill: (buffer: Uint8Array) => Uint8Array,
  ): void;
  /** Creates synthetic directories exposed under /proc. */
  createSpecialDirectories(): void;
  /**
   * Wires up the default stdin/stdout/stderr devices or the caller supplied
   * implementations.
   */
  createStandardStreams(
    input?: (() => number) | null,
    output?: ((value: number) => void) | null,
    error?: ((value: number) => void) | null,
  ): void;
  /** Performs one-time initialisation of the filesystem backing store. */
  staticInit(MEMFS: FileSystemMountType): void;
  /**
   * Configures the runtime streams using optional overrides for stdio
   * callbacks.
   */
  init(
    input?: (() => number) | null,
    output?: ((value: number) => void) | null,
    error?: ((value: number) => void) | null,
  ): void;
  /** Tears down open streams and resets initialization flags. */
  quit(): void;
}

/**
 * Options supplied to the initialization helpers describing the runtime module
 * instance that should be wired up.
 */
export interface InitializationOptions {
  /** Optional runtime module reference supplying stdio overrides. */
  Module?: RuntimeModule;
}

/**
 * Creates the initialization helper set for the provided filesystem state.
 */
export function createInitializationHelpers(
  FS: MutableFS,
  options: InitializationOptions,
): InitializationHelpers;
