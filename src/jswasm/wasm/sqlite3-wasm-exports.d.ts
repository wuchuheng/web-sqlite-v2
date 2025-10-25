import type { WasmExports } from "./bootstrap/runtime/capi-helpers.d.ts";

export interface WasmExportBindings {
  emscriptenBuiltinMemalign?: (...args: number[]) => number;
}

export function attachSqlite3WasmExports(
  Module: Record<string, unknown>,
  wasmExports: WasmExports & WebAssembly.Exports,
): WasmExportBindings;
