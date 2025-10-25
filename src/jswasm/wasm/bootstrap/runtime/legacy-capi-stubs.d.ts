type WasmPointer = number | bigint;

export type SqliteCallback = (...args: WasmPointer[]) => WasmPointer | void;

export interface LegacyCapiStubs {
  sqlite3_bind_blob?: (
    statementPointer: WasmPointer,
    index: number,
    blobPointer: WasmPointer,
    byteLength: number,
    destructor: WasmPointer,
  ) => number | void;
  sqlite3_bind_text?: (
    statementPointer: WasmPointer,
    index: number,
    textPointer: WasmPointer,
    byteLength: number,
    destructor: WasmPointer,
  ) => number | void;
  sqlite3_create_function_v2: (
    databasePointer: WasmPointer,
    functionName: WasmPointer,
    argumentCount: number,
    textRep: number,
    applicationPointer: WasmPointer,
    xFunc: SqliteCallback | WasmPointer,
    xStep: SqliteCallback | WasmPointer,
    xFinal: SqliteCallback | WasmPointer,
    xDestroy: SqliteCallback | WasmPointer,
  ) => number | void;
  sqlite3_create_function: (
    databasePointer: WasmPointer,
    functionName: WasmPointer,
    argumentCount: number,
    textRep: number,
    applicationPointer: WasmPointer,
    xFunc: SqliteCallback | WasmPointer,
    xStep: SqliteCallback | WasmPointer,
    xFinal: SqliteCallback | WasmPointer,
  ) => number | void;
  sqlite3_create_window_function: (
    databasePointer: WasmPointer,
    functionName: WasmPointer,
    argumentCount: number,
    textRep: number,
    applicationPointer: WasmPointer,
    xStep: SqliteCallback | WasmPointer,
    xFinal: SqliteCallback | WasmPointer,
    xValue: SqliteCallback | WasmPointer,
    xInverse: SqliteCallback | WasmPointer,
    xDestroy: SqliteCallback | WasmPointer,
  ) => number;
  sqlite3_prepare_v3: (
    databasePointer: WasmPointer,
    sqlPointer: WasmPointer,
    sqlByteLength: number,
    prepFlags: number,
    statementPointerPointer: WasmPointer,
    tailPointerPointer: WasmPointer,
  ) => number;
  sqlite3_prepare_v2: (
    databasePointer: WasmPointer,
    sqlPointer: WasmPointer,
    sqlByteLength: number,
    statementPointerPointer: WasmPointer,
    tailPointerPointer: WasmPointer,
  ) => number;
  sqlite3_exec: (
    databasePointer: WasmPointer,
    sqlPointer: WasmPointer | string,
    callbackPointer: WasmPointer,
    argumentPointer: WasmPointer,
    errorPointer: WasmPointer,
  ) => number;
  sqlite3_randomness: (byteCount: number, outputPointer: WasmPointer) => void;
}

export function createLegacyCapiStubs(): LegacyCapiStubs;
