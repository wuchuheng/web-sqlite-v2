import type { SQLite3CapiWithHelpers } from "../oo1-db/context.d.ts";
import type { Sqlite3WasmNamespace } from "../../wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts";
import type { DbCleanupMap } from "./db-cleanup.d.ts";

/**
 * Augmented UDF registration function enriched with helper utilities.
 */
export interface UdfRegistrationFunction {
  (
    dbPointer: number,
    name: string,
    arity: number,
    textRep: number,
    appPointer: number,
    xFunc: number | ((ctx: number, ...args: unknown[]) => unknown),
    xStep: number | ((ctx: number, ...args: unknown[]) => void),
    xFinal: number | ((ctx: number) => unknown),
    xDestroy: number | ((app: number) => void),
  ): number;
  /** Converts raw sqlite3_value pointers to JavaScript values. */
  udfConvertArgs(
    argc: number,
    argvPointer: number,
    throwIfCannot?: boolean,
  ): unknown[];
  /** Sets a result value on the sqlite3_context. */
  udfSetResult(context: number, value: unknown): void;
  /** Reports an error to the sqlite3 engine. */
  udfSetError(context: number, error: unknown): void;
}

/**
 * Window UDF registration function with additional callbacks.
 */
export interface WindowUdfRegistrationFunction {
  (
    dbPointer: number,
    name: string,
    arity: number,
    textRep: number,
    appPointer: number,
    xStep: number | ((ctx: number, ...args: unknown[]) => void),
    xFinal: number | ((ctx: number) => unknown),
    xValue: number | ((ctx: number) => unknown),
    xInverse: number | ((ctx: number, ...args: unknown[]) => void),
    xDestroy: number | ((app: number) => void),
  ): number;
  udfConvertArgs(
    argc: number,
    argvPointer: number,
    throwIfCannot?: boolean,
  ): unknown[];
  udfSetResult(context: number, value: unknown): void;
  udfSetError(context: number, error: unknown): void;
}

/** Collection of augmented UDF helpers returned by the factory. */
export interface UdfFactoryResult {
  sqlite3_create_function_v2: UdfRegistrationFunction;
  sqlite3_create_function: UdfRegistrationFunction;
  sqlite3_create_window_function?: WindowUdfRegistrationFunction;
}

/**
 * Creates the user-defined function factory used by the OO1 API.
 */
export function createUdfFactory(
  wasm: Sqlite3WasmNamespace,
  capi: SQLite3CapiWithHelpers,
  dbCleanupMap: DbCleanupMap,
): UdfFactoryResult;
