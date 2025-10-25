import type {
  DeviceDefinition,
  FSStream,
  MutableFS,
  StreamOps,
} from "./base-state.d.ts";

/**
 * Low-level stream bookkeeping helpers exposed by the filesystem facade.
 */
export interface StreamOperations {
  readonly MAX_OPEN_FDS: number;
  nextfd(): number;
  getStreamChecked(fd: number): FSStream;
  getStream(fd: number): FSStream | null;
  createStream(stream: Partial<FSStream>, fd?: number): FSStream;
  closeStream(fd: number): void;
  dupStream(original: FSStream, fd?: number): FSStream;
  chrdev_stream_ops: {
    open(stream: FSStream): void;
    llseek(): never;
  };
  major(dev: number): number;
  minor(dev: number): number;
  makedev(major: number, minor: number): number;
  registerDevice(dev: number, ops: StreamOps): void;
  getDevice(dev: number): DeviceDefinition | undefined;
}

/**
 * Constructs the stream bookkeeping helpers for the given filesystem state.
 */
export function createStreamOperations(FS: MutableFS): StreamOperations;
