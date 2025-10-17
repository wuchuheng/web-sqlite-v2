import type { MemoryManager, RuntimeModule } from "../shared/runtime-types.d.ts";

/**
 * Creates a memory manager wrapper around the WebAssembly.Memory instance.
 */
export declare function createMemoryManager(
    wasmMemory: WebAssembly.Memory,
    Module: RuntimeModule
): MemoryManager;

/**
 * Initializes the WebAssembly memory used by the SQLite runtime.
 */
export declare function initializeWasmMemory(
    Module: RuntimeModule,
    initialMemory?: number
): WebAssembly.Memory;
