import type { BindValue, Stmt } from "@wuchuheng/web-sqlite";
import type { Oo1Context } from "../../context";
import type { StatementValidators } from "../validation";

/** Numerical identifiers describing supported bind value categories. */
export interface BindTypeMap {
  readonly null: number;
  readonly number: number;
  readonly string: number;
  readonly boolean: number;
  readonly blob: number;
  readonly undefined: number;
  readonly bigint?: number;
}

/** Value container accepted by statement binding helpers. */
export type BindSpecification =
  | BindValue
  | BindValue[]
  | Record<string, BindValue>;

/** Binding helper collection returned by {@link createBindingHelpers}. */
export interface BindHelpers {
  /** Enumeration of supported bind kinds. */
  readonly BindTypes: BindTypeMap;
  /** Classifies a value into a bind category or returns undefined. */
  determineBindType(value: BindValue): number | undefined;
  /** Validates a value can be bound and returns the bind category. */
  ensureSupportedBindType(value: BindValue): number;
  /** Binds a UTF-8 string or blob to a prepared statement parameter. */
  bindString(
    statementPointer: number,
    index: number,
    value: string,
    asBlob: boolean,
  ): number;
  /** Binds a single value to the supplied statement. */
  bindSingleValue(
    statement: Stmt,
    index: number | string,
    bindType: number,
    value: BindValue,
  ): Stmt;
}

/**
 * Creates binding helper functions for statement parameter binding.
 *
 * @param context Shared runtime context.
 * @param validators Validation helper functions.
 * @returns Binding helper functions.
 */
export function createBindingHelpers(
  context: Oo1Context,
  validators: StatementValidators,
): BindHelpers {
  const { sqlite3, capi, wasm, util, toss } = context;
  const {
    pointerOf,
    ensureStmtOpen,
    ensureNotLockedByExec,
    resolveParameterIndex,
  } = validators;

  /** Enumeration of supported bind types. */
  const BindTypes: BindTypeMap = {
    null: 1,
    number: 2,
    string: 3,
    boolean: 4,
    blob: 5,
    undefined: 1, // Alias for null
  };

  if (wasm.bigIntEnabled) {
    (
      BindTypes as { -readonly [K in keyof BindTypeMap]: BindTypeMap[K] }
    ).bigint = BindTypes.number;
  }

  /**
   * Determines the bind type for a given value.
   *
   * @param value - Value to classify.
   * @returns BindTypes constant or undefined.
   */
  const determineBindType = (value: BindValue): number | undefined => {
    const typeName =
      value === null || value === undefined ? "null" : typeof value;

    const kind = (BindTypes as unknown as Record<string, number>)[typeName];

    switch (kind) {
      case BindTypes.boolean:
      case BindTypes.null:
      case BindTypes.number:
      case BindTypes.string:
        return kind;
      case BindTypes.bigint:
        if (wasm.bigIntEnabled) return kind;
        break;
      default:
        return util.isBindableTypedArray(value) ? BindTypes.blob : undefined;
    }
    return undefined;
  };

  /**
   * Ensures a value can be bound, throwing if unsupported.
   *
   * @param value - Value to check.
   * @returns BindTypes constant.
   */
  const ensureSupportedBindType = (value: BindValue): number => {
    const kind = determineBindType(value);
    if (kind === undefined) {
      toss("Unsupported bind() argument type:", typeof value);
    }
    return kind as number;
  };

  /**
   * Binds a string or blob to a statement parameter.
   *
   * @param stmtPointer - Native statement pointer.
   * @param index - 1-based parameter index.
   * @param value - String to bind.
   * @param asBlob - Whether to bind as BLOB.
   * @returns SQLite result code.
   */
  const bindString = (
    stmtPointer: number,
    index: number,
    value: string,
    asBlob: boolean,
  ): number => {
    const [strPtr, length] = wasm.allocCString(value, true);
    const binder = asBlob ? capi.sqlite3_bind_blob : capi.sqlite3_bind_text;
    return binder(
      stmtPointer,
      index,
      Number(strPtr),
      length,
      capi.SQLITE_WASM_DEALLOC,
    );
  };

  /**
   * Binds a single value to a statement parameter.
   *
   * @param stmt - Statement instance.
   * @param index - Parameter index or name.
   * @param bindType - BindTypes constant.
   * @param value - Value to bind.
   * @returns The statement for chaining.
   */
  const bindSingleValue = (
    stmt: Stmt,
    index: number | string,
    bindType: number,
    value: BindValue,
  ): Stmt => {
    // 1. Input handling
    ensureNotLockedByExec(ensureStmtOpen(stmt), "bind()");
    const stmtPointer = pointerOf(stmt);
    if (typeof stmtPointer !== "number") {
      toss("Unable to resolve statement pointer");
    }

    const resolvedIndex = resolveParameterIndex(stmt, index);
    let rc = 0;

    // 2. Core processing
    const effectiveBindType =
      value === null || value === undefined ? BindTypes.null : bindType;

    switch (effectiveBindType) {
      case BindTypes.null:
        rc = capi.sqlite3_bind_null(stmtPointer!, resolvedIndex);
        break;
      case BindTypes.string:
        rc = bindString(stmtPointer!, resolvedIndex, value as string, false);
        break;
      case BindTypes.number: {
        if (util.isInt32(value)) {
          rc = capi.sqlite3_bind_int(
            stmtPointer!,
            resolvedIndex,
            value as number,
          );
        } else if (typeof value === "bigint") {
          if (!util.bigIntFits64(value)) {
            toss(
              "BigInt value is too big to store without precision loss:",
              value,
            );
          } else if (wasm.bigIntEnabled) {
            rc = capi.sqlite3_bind_int64(stmtPointer!, resolvedIndex, value);
          } else if (util.bigIntFitsDouble(value)) {
            rc = capi.sqlite3_bind_double(
              stmtPointer!,
              resolvedIndex,
              Number(value),
            );
          } else {
            toss(
              "BigInt value is too big to store without precision loss:",
              value,
            );
          }
        } else {
          const numVal = Number(value);
          if (wasm.bigIntEnabled && Number.isInteger(numVal)) {
            rc = capi.sqlite3_bind_int64(
              stmtPointer!,
              resolvedIndex,
              BigInt(numVal),
            );
          } else {
            rc = capi.sqlite3_bind_double(stmtPointer!, resolvedIndex, numVal);
          }
        }
        break;
      }
      case BindTypes.boolean:
        rc = capi.sqlite3_bind_int(stmtPointer!, resolvedIndex, value ? 1 : 0);
        break;
      case BindTypes.blob: {
        if (typeof value === "string") {
          rc = bindString(stmtPointer!, resolvedIndex, value, true);
          break;
        }
        let blob: Uint8Array;
        if (value instanceof ArrayBuffer) {
          blob = new Uint8Array(value);
        } else if (util.isBindableTypedArray(value)) {
          blob = value as Uint8Array;
        } else {
          toss(
            "Binding a value as a blob requires that it be a string,",
            "Uint8Array, Int8Array, or ArrayBuffer.",
          );
          // throw to satisfy TS flow analysis (toss returns never but explicit throw is clearer locally)
          throw new Error("Unreachable");
        }

        const blobPtr = wasm.alloc(blob.byteLength || 1);
        const wasmWithHeap = wasm as typeof wasm & { heap8(): Uint8Array };
        wasmWithHeap.heap8().set(blob.byteLength ? blob : [0], Number(blobPtr));
        rc = capi.sqlite3_bind_blob(
          stmtPointer!,
          resolvedIndex,
          Number(blobPtr),
          blob.byteLength,
          capi.SQLITE_WASM_DEALLOC,
        );
        break;
      }
      default:
        sqlite3.config.warn("Unsupported bind() argument type:", value);
        toss("Unsupported bind() argument type:", typeof value);
    }

    if (rc) context.checkRc(stmt.db, rc);

    // 3. Output handling
    (stmt as Stmt & { _mayGet: boolean })._mayGet = false;
    return stmt;
  };

  return {
    BindTypes,
    determineBindType,
    ensureSupportedBindType,
    bindString,
    bindSingleValue,
  };
}
