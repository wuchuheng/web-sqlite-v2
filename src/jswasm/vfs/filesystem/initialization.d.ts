import type { FileSystemMountType, MutableFS, StreamOps } from "./base-state.d.ts";

export interface InitializationHelpers {
    createDefaultDirectories(): void;
    createDefaultDevices(
        TTY: {
            register(dev: number, ops: StreamOps): void;
            default_tty_ops: StreamOps;
            default_tty1_ops: StreamOps;
        },
        randomFill: (buffer: Uint8Array) => Uint8Array
    ): void;
    createSpecialDirectories(): void;
    createStandardStreams(
        input?: (() => number) | null,
        output?: ((value: number) => void) | null,
        error?: ((value: number) => void) | null
    ): void;
    staticInit(MEMFS: FileSystemMountType): void;
    init(
        input?: (() => number) | null,
        output?: ((value: number) => void) | null,
        error?: ((value: number) => void) | null
    ): void;
    quit(): void;
}

export interface InitializationOptions {
    Module: Record<string, unknown>;
}

export function createInitializationHelpers(
    FS: MutableFS,
    options: InitializationOptions
): InitializationHelpers;
