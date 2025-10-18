import type { SQLite3CAPI } from "@wuchuheng/web-sqlite";
import type {
    Sqlite3BindingSignature,
    Sqlite3BindingSignatureCollection,
    Sqlite3WasmNamespace,
} from "../../wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts";

/**
 * Optional binding collections exposed when specific wasm exports are present.
 */
export interface OptionalBindingGroups {
    /** Progress handler callback binding. */
    progressHandler?: Sqlite3BindingSignature;
    /** Statement explanation helpers. */
    stmtExplain?: Sqlite3BindingSignature[];
    /** Authorizer callback binding. */
    authorizer?: Sqlite3BindingSignature;
    /**
     * Catch-all bag for future optional binding collections.
     */
    [category: string]:
        | Sqlite3BindingSignature
        | Sqlite3BindingSignature[]
        | undefined;
}

/**
 * Generates the core wasm.xWrap binding signatures required by the OO1 layer.
 */
export function createCoreBindings(
    wasm: Pick<Sqlite3WasmNamespace, "xWrap" | "cArgvToJs" | "exports">,
    capi: SQLite3CAPI
): Sqlite3BindingSignatureCollection;

/**
 * Builds optional binding signatures that rely on feature-specific wasm exports.
 */
export function createOptionalBindings(
    wasm: Pick<Sqlite3WasmNamespace, "xWrap" | "cArgvToJs" | "exports">,
    capi: SQLite3CAPI
): OptionalBindingGroups;

/**
 * Describes wasm-internal helper bindings exposed to higher level utilities.
 */
export function createWasmInternalBindings(): Sqlite3BindingSignatureCollection;
