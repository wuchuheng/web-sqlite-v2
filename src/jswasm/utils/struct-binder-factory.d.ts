import type {
  Sqlite3DebugFlagController,
  Sqlite3StructBinder,
  Sqlite3StructBinderConfig,
  Sqlite3StructDefinition,
  Sqlite3StructInstance,
  Sqlite3StructConstructor,
} from "../wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts";

export type {
  Sqlite3DebugFlagController,
  Sqlite3StructBinder,
  Sqlite3StructBinderConfig,
  Sqlite3StructDefinition,
  Sqlite3StructInstance,
  Sqlite3StructConstructor,
};

/**
 * Creates a struct binder using the provided wasm heap configuration.
 */
export function StructBinderFactory(
  config: Sqlite3StructBinderConfig,
): Sqlite3StructBinder;
