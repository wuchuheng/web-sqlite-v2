import type {
    CreateSqlite3FacadeOptions,
    Sqlite3Facade,
} from "./sqlite3-facade-namespace.d.ts";

export type {
    CreateSqlite3FacadeOptions,
    Sqlite3AsyncInitializer,
    Sqlite3BootstrapFunction,
    Sqlite3BootstrapGlobal,
    Sqlite3EmscriptenModule,
    Sqlite3Facade,
    Sqlite3Initializer,
} from "./sqlite3-facade-namespace.d.ts";

/**
 * Builds the sqlite3 facade using the provided bootstrap dependencies.
 */
export function createSqlite3Facade(
    options: CreateSqlite3FacadeOptions
): Sqlite3Facade;
