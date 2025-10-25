import type { RuntimeFS, RuntimeTTY } from "../shared/runtime-types.d.ts";

/**
 * Constructs the runtime TTY helpers backed by the virtual filesystem streams.
 */
export declare function createTTY(
  out: (message: string) => void,
  err: (message: string) => void,
  FS: RuntimeFS,
): RuntimeTTY;

/**
 * Retrieves the next buffered stdin character for legacy consumers.
 */
export declare function FS_stdin_getChar(): number | null;
