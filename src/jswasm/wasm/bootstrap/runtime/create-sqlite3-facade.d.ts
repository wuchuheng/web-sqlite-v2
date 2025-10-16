import type { BootstrapConfig } from "../configuration.d.ts";
import type {
    Sqlite3ErrorConstructor,
    WasmAllocErrorConstructor,
} from "../error-utils.d.ts";

export interface Sqlite3Facade {
    WasmAllocError: WasmAllocErrorConstructor;
    SQLite3Error: Sqlite3ErrorConstructor;
    capi: object;
    util: object | undefined;
    wasm: object;
    config: BootstrapConfig;
    version: Record<string, string | number>;
    client: object | undefined;
    asyncPostInit(): Promise<Sqlite3Facade>;
    scriptInfo?: Record<string, string | number>;
    __isUnderTest?: boolean;
    StructBinder?: object;
}

export type Sqlite3Initializer = (sqlite3: Sqlite3Facade) => void;

export type Sqlite3AsyncInitializer = (
    sqlite3: Sqlite3Facade
) => Promise<Sqlite3Facade> | Sqlite3Facade;

export interface Sqlite3BootstrapFunction {
    initializers: Sqlite3Initializer[];
    initializersAsync: Sqlite3AsyncInitializer[];
    sqlite3?: Sqlite3Facade;
}

export interface CreateSqlite3FacadeOptions {
    sqlite3ApiBootstrap: Sqlite3BootstrapFunction;
    WasmAllocError: WasmAllocErrorConstructor;
    SQLite3Error: Sqlite3ErrorConstructor;
    capi: object;
    util: object;
    wasm: object;
    config: BootstrapConfig;
}

export function createSqlite3Facade(
    options: CreateSqlite3FacadeOptions
): Sqlite3Facade;
