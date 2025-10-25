import type {
  FSStream,
  MutableFS,
  StreamOps,
} from "../vfs/filesystem/base-state.d.ts";

/**
 * Recursive value hierarchy representing additional module state stored on the
 * Emscripten module instance.
 */
export type ModuleValue =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | LifecycleCallback
  | LifecycleCallback[]
  | ((...args: ModuleValue[]) => ModuleValue)
  | WebAssembly.Memory
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array
  | ModuleOverrides
  | RuntimeModule
  | ModuleValue[]
  | { [key: string]: ModuleValue | undefined }
  | undefined
  | null;

/**
 * Callback signature invoked during different lifecycle stages of the
 * Emscripten module initialization pipeline.
 */
export type LifecycleCallback = (module: RuntimeModule) => void;

/**
 * Interface describing the subset of the Emscripten module shape relied upon
 * by the runtime helpers implemented in this package.
 */
export interface RuntimeModule {
  /** Flag toggled when the module has aborted execution. */
  ABORT?: boolean;
  /** Optional memory flag to skip filesystem initialization. */
  noFSInit?: boolean;
  /** Lazily-initialized WebAssembly memory instance. */
  wasmMemory?: WebAssembly.Memory;
  /** Desired initial memory allocation in bytes. */
  INITIAL_MEMORY?: number;
  /** Optional lifecycle callbacks executed prior to runtime start. */
  preRun?: LifecycleCallback | LifecycleCallback[];
  /** Optional lifecycle callbacks executed during runtime initialization. */
  preInit?: Array<() => void> | (() => void);
  /** Optional lifecycle callbacks executed after runtime initialization. */
  postRun?: LifecycleCallback | LifecycleCallback[];
  /** Optional lifecycle callback executed when the runtime has fully started. */
  onRuntimeInitialized?: () => void;
  /** Hook executed when the module enters an aborted state. */
  onAbort?: (reason: unknown) => void;
  /** Optional status reporter leveraged by the bootstrap helpers. */
  setStatus?: (message: string) => void;
  /** Optional run dependency monitor used during module loading. */
  monitorRunDependencies?: (totalDependencies: number) => void;
  /** Resolves the ready promise once initialization is complete. */
  readyPromiseResolve?: (module: RuntimeModule) => void;
  /** Rejects the ready promise when initialization fails. */
  readyPromiseReject?: (error: Error) => void;
  /** Optional printing utility used for stdout redirection. */
  print?: (...args: string[]) => void;
  /** Optional printing utility used for stderr redirection. */
  printErr?: (...args: string[]) => void;
  /** Tracks whether the main run loop has been executed. */
  calledRun?: boolean;
  /** Custom locateFile implementation supplied by consumers. */
  locateFile?: (path: string, prefix?: string) => string;
  /** Mutable properties bag retaining arbitrary module state. */
  [key: string]: ModuleValue;
}

/**
 * Structure returned by {@link createLifecycleManager} that exposes the
 * lifecycle hooks consumed during runtime bootstrap.
 */
export interface RuntimeLifecycleManager {
  /** Executes all registered pre-run callbacks. */
  preRun(): void;
  /** Initializes the runtime subsystems (FS, TTY, etc.). */
  initRuntime(): void;
  /** Executes all registered post-run callbacks. */
  postRun(): void;
  /** Registers a callback to be invoked before runtime initialization. */
  addOnPreRun(callback: LifecycleCallback): void;
  /** Registers a callback to be invoked during runtime initialization. */
  addOnInit(callback: LifecycleCallback): void;
  /** Registers a callback to be invoked after runtime initialization. */
  addOnPostRun(callback: LifecycleCallback): void;
  /** Adds a run dependency that must resolve before continuing. */
  addRunDependency(identifier: string): void;
  /** Removes a previously-added run dependency. */
  removeRunDependency(identifier: string): void;
  /** Returns a unique identifier for a dependency token. */
  getUniqueRunDependency(identifier: string): string;
  /** Assigns the callback executed once all dependencies resolve. */
  setDependenciesFulfilled(callback: () => void): void;
  /** Returns the number of outstanding run dependencies. */
  getRunDependencies(): number;
  /** Executes the coordinated module startup routine. */
  run(): void;
}

/**
 * Callback interface supplied by the TTY helpers to process terminal input
 * and output events.
 */
/**
 * Collection of POSIX termios settings tracked for each TTY instance.
 */
export interface TTYTermiosSettings {
  /** Input mode flags controlling canonical processing. */
  c_iflag: number;
  /** Output mode flags configuring post-processing behaviour. */
  c_oflag: number;
  /** Control mode flags toggling character size and parity. */
  c_cflag: number;
  /** Local mode flags managing echo and signal handling. */
  c_lflag: number;
  /** Control character values mirrored from the kernel structure. */
  c_cc: number[];
}

export interface TTYDeviceOperations {
  /** Reads the next available character from the device. */
  get_char?(device: TTYDevice): number | null | undefined;
  /** Writes a character to the device output buffer. */
  put_char(device: TTYDevice, value: number | null): void;
  /** Flushes buffered output to the configured sink. */
  fsync(device: TTYDevice): void;
  /** Retrieves terminal settings for tcgets requests. */
  ioctl_tcgets?(device: TTYDevice | FSStream): TTYTermiosSettings;
  /** Applies terminal settings for tcsets requests. */
  ioctl_tcsets?(
    device: TTYDevice,
    op: number,
    data: TTYTermiosSettings,
  ): number;
  /** Provides the terminal window dimensions. */
  ioctl_tiocgwinsz?(device: TTYDevice): [number, number];
}

/**
 * Representation of a configured TTY device stored by the runtime helpers.
 */
export interface TTYDevice {
  /** Pending input buffer. */
  input: number[];
  /** Pending output buffer. */
  output: number[];
  /** Operations used to interact with the device. */
  ops: TTYDeviceOperations;
}

/**
 * Runtime TTY helper assembled by {@link createTTY} that integrates with the
 * filesystem stream layer.
 */
export interface RuntimeTTY {
  /** Registered TTY devices keyed by file descriptor. */
  ttys: Array<TTYDevice | undefined>;
  /** Initializes terminal handling. */
  init(): void;
  /** Tears down terminal handling. */
  shutdown(): void;
  /** Registers a device with the associated stream operations. */
  register(deviceNumber: number, operations: TTYDeviceOperations): void;
  /** Stream operations exposed to the filesystem layer. */
  stream_ops: StreamOps & {
    read(
      stream: FSStream & { tty?: TTYDevice },
      buffer: Uint8Array,
      offset: number,
      length: number,
      position: number,
    ): number;
    write(
      stream: FSStream & { tty?: TTYDevice },
      buffer: Uint8Array,
      offset: number,
      length: number,
      position: number,
    ): number;
    close(stream: FSStream & { tty?: TTYDevice }): void;
    fsync(stream: FSStream & { tty?: TTYDevice }): void;
    open(stream: FSStream & { tty?: TTYDevice }): void;
  };
  /** Default operations bound to stdout. */
  default_tty_ops: TTYDeviceOperations;
  /** Default operations bound to stderr. */
  default_tty1_ops: Pick<TTYDeviceOperations, "put_char" | "fsync">;
}

/**
 * Extended filesystem contract consumed by the runtime syscall helpers.
 */
export interface RuntimeFS extends MutableFS {
  /** Exception type thrown for POSIX errno propagation. */
  ErrnoError: new (errno: number) => Error & { errno: number };
  /** Registers a device with the filesystem stream subsystem. */
  registerDevice(device: number, ops: StreamOps): void;
  /** Performs ioctl operations against a stream. */
  ioctl(stream: FSStream, op: number, arg: number): number;
}

/**
 * Memory manager helper exposing heap views and a resize routine.
 */
export interface MemoryManager {
  /** Refreshes the typed-array views to the current memory buffer. */
  updateMemoryViews(): void;
  /** Produces an emscripten_resize_heap-compatible implementation. */
  createResizeHeapFunction(): (requestedSize: number) => boolean;
  /** Signed 8-bit heap view. */
  readonly HEAP8: Int8Array;
  /** Unsigned 8-bit heap view. */
  readonly HEAPU8: Uint8Array;
  /** Signed 16-bit heap view. */
  readonly HEAP16: Int16Array;
  /** Signed 32-bit heap view. */
  readonly HEAP32: Int32Array;
  /** Unsigned 32-bit heap view. */
  readonly HEAPU32: Uint32Array;
  /** Signed 64-bit heap view. */
  readonly HEAP64: BigInt64Array;
}

/**
 * Convenience structure returned by {@link setupConsoleOutput} mapping stdout
 * and stderr handlers.
 */
export interface ConsoleOutputHandlers {
  /** Handler emitting stdout lines. */
  out: (...args: string[]) => void;
  /** Handler emitting stderr lines. */
  err: (...args: string[]) => void;
}

/**
 * Module override snapshot produced during bootstrap configuration.
 */
export interface ModuleOverrides {
  /** Restored module properties captured before initialization. */
  [key: string]: ModuleValue;
}

/**
 * Signature for the abort function used to cancel module startup.
 */
export type AbortFunction = (reason: unknown) => never;

/**
 * Shape of the helpers returned from {@link createLocateFile}.
 */
export type LocateFileFunction = (path: string, prefix?: string) => string;

/**
 * Structure returned when creating the filesystem facade.
 */
export interface FilesystemFacade {
  /** Assembled mutable filesystem instance. */
  FS: RuntimeFS;
  /** PATH helper exposing join and resolve utilities. */
  PATH_FS: Record<string, (path: string, ...segments: string[]) => string>;
}
