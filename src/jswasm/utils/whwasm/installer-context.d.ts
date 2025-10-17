import type { WhWasmHelperTarget, WhWasmInstallerCache, WhWasmValue } from "./types.d.ts";

/**
 * Shared context passed to each wh-wasm helper installer.
 */
export class WhWasmInstallerContext {
    /**
     * Creates a new installer context bound to the specified target.
     */
    constructor(target: WhWasmHelperTarget);

    /** Mutable target exposing the helper API. */
    target: WhWasmHelperTarget;
    /** Bookkeeping cache reused across helpers. */
    cache: WhWasmInstallerCache;
    /** Pointer intermediate representation (i32 or i64). */
    ptrIR: "i32" | "i64";
    /** Size in bytes for the active pointer representation. */
    ptrSizeof: 4 | 8;
    /** Internal helper for installing functions into the table. */
    installFunctionInternal:
        | ((fn: (...args: WhWasmValue[]) => WhWasmValue, sig: string, scoped: boolean) => number)
        | null;
    /** Internal CString allocator provided by the string helpers. */
    allocCStringInternal:
        | ((
              value: string,
              nulTerminate: boolean,
              stackAlloc: (size: number) => number,
              signature: string
          ) => number | [number, number] | null)
        | null;

    /** Throws an error with the provided message fragments. */
    toss(...args: unknown[]): never;
    /** Resolves the active WebAssembly memory backing the target. */
    resolveMemory(): WebAssembly.Memory;
    /** Returns the cached heap views, refreshing them when needed. */
    getHeapViews(): WhWasmInstallerCache;
}
