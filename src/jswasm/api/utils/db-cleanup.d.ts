import type {
  DbCleanupMetadata,
  PointerLike,
  SQLite3CapiWithHelpers,
} from "../oo1-db/context.d.ts";
import type { Sqlite3WasmNamespace } from "../../wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts";

/**
 * Function signature returned by {@link createDbCleanup} for managing DB resources.
 */
export interface DbCleanupMap {
  (db: PointerLike, mode?: number): DbCleanupMetadata | undefined;
  /** Records a collation for later cleanup. */
  addCollation(db: PointerLike, name: string | number): void;
  /** Records a scalar or aggregate UDF for later removal. */
  addFunction(db: PointerLike, name: string | number, arity: number): void;
  /** Records a window UDF for later removal. */
  addWindowFunc?(db: PointerLike, name: string | number, arity: number): void;
  /** Clears all tracked resources for the supplied database handle. */
  cleanup(db: PointerLike): void;
}

/**
 * Creates the database cleanup tracker used by the OO1 helpers.
 */
export function createDbCleanup(
  wasm: Sqlite3WasmNamespace,
  capi: SQLite3CapiWithHelpers,
): DbCleanupMap;
