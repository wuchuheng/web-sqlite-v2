import type { SQLite3API } from "@wuchuheng/web-sqlite";
import type { DBConstructorOptions } from "../../shared/opfs-vfs-installer.d.ts";
import type { Oo1Context } from "./context.d.ts";
import type { DB } from "@wuchuheng/web-sqlite";

/**
 * Normalised constructor options produced by the helper.
 */
export interface NormalizedDbConstructorOptions extends DBConstructorOptions {
  filename: string | number;
  flags: string;
  vfs: string | number | null;
}

/**
 * Helper invoked by the Database constructor to open sqlite3 connections.
 */
export interface DbCtorHelper {
  (
    this: DB,
    options?: string | number | DBConstructorOptions,
    flags?: string,
    vfs?: string | number | null,
  ): void;
  /** Normalises the constructor arguments into an options structure. */
  normalizeArgs(
    options?: string | number | DBConstructorOptions,
    flags?: string,
    vfs?: string | number | null,
  ): NormalizedDbConstructorOptions;
  /** Registers a callback invoked after a VFS-backed connection opens. */
  setVfsPostOpenCallback(
    vfsPointer: number,
    callback: (db: DB, sqlite3: SQLite3API) => void,
  ): void;
}

/**
 * Builds the Database constructor helper shared by the OO1 API.
 */
export function createDbCtorHelper(context: Oo1Context): DbCtorHelper;
