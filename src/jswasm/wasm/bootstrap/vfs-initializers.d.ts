import type { Sqlite3Initializer } from "./types/sqlite3-bootstrap";

export function createVfsInitializer(): Sqlite3Initializer;

export function createVtabInitializer(): Sqlite3Initializer;
