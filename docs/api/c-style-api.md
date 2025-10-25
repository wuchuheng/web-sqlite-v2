---
id: DOC-API-C-STYLE
title: C-Style API Reference
summary: Detail the low-level SQLite3 bindings exposed through the wasm package, including verification status and usage notes.
audience: ["engineering"]
status: in-progress
owner: API Documentation Maintainer
updated: 2025-02-14
---

# C-Style API Documentation

The C-Style API provides low-level bindings that mirror the native SQLite C API, enabling direct access to SQLite functionality from JavaScript/TypeScript with WASM.

## Verification Status Legend

Each API item in this document has a verification status indicator:

- ⚫ **Not Verified** - Type definitions and JSDoc have not been verified against source code
- 🟡 **Partially Verified** - Type definitions verified, but JSDoc incomplete or inconsistent
- 🟢 **Verified** - Type definitions and JSDoc fully verified and consistent with source code

Last updated: 2025-10-18

## Overview

SQLite WASM offers two flavors of the C-Style API:

1. **Low-level WASM exports** (`sqlite3.wasm.exports`) - Direct WASM bindings with native types
2. **High-level C API** (`sqlite3.capi`) - JavaScript-friendly wrappers with automatic type conversions

**Recommendation**: Use `sqlite3.capi` for most applications unless you need maximum performance and understand WASM memory management.

## Type Definitions

### Core Types 🟢

```typescript
/**
 * SQLite database handle (pointer type)
 */
type sqlite3 = number | bigint;

/**
 * SQLite prepared statement handle (pointer type)
 */
type sqlite3_stmt = number | bigint;

/**
 * SQLite value object (pointer type)
 */
type sqlite3_value = number | bigint;

/**
 * SQLite context object (pointer type)
 */
type sqlite3_context = number | bigint;

/**
 * SQLite blob handle (pointer type)
 */
type sqlite3_blob = number | bigint;

/**
 * WASM pointer type (32-bit numbers or 64-bit bigints)
 */
type WasmPointer = number | bigint;

/**
 * SQLite result codes
 */
enum SqliteResultCode {
    SQLITE_OK = 0,
    SQLITE_ERROR = 1,
    SQLITE_INTERNAL = 2,
    SQLITE_PERM = 3,
    SQLITE_ABORT = 4,
    SQLITE_BUSY = 5,
    SQLITE_LOCKED = 6,
    SQLITE_NOMEM = 7,
    SQLITE_READONLY = 8,
    SQLITE_INTERRUPT = 9,
    SQLITE_IOERR = 10,
    SQLITE_CORRUPT = 11,
    SQLITE_NOTFOUND = 12,
    SQLITE_FULL = 13,
    SQLITE_CANTOPEN = 14,
    SQLITE_PROTOCOL = 15,
    SQLITE_EMPTY = 16,
    SQLITE_SCHEMA = 17,
    SQLITE_TOOBIG = 18,
    SQLITE_CONSTRAINT = 19,
    SQLITE_MISMATCH = 20,
    SQLITE_MISUSE = 21,
    SQLITE_NOLFS = 22,
    SQLITE_AUTH = 23,
    SQLITE_FORMAT = 24,
    SQLITE_RANGE = 25,
    SQLITE_NOTADB = 26,
    SQLITE_NOTICE = 27,
    SQLITE_WARNING = 28,
    SQLITE_ROW = 100,
    SQLITE_DONE = 101,
}

/**
 * SQLite data types
 */
enum SqliteDataType {
    SQLITE_INTEGER = 1,
    SQLITE_FLOAT = 2,
    SQLITE_TEXT = 3,
    SQLITE_BLOB = 4,
    SQLITE_NULL = 5,
}

/**
 * Open flags for sqlite3_open_v2
 */
enum SqliteOpenFlags {
    SQLITE_OPEN_READONLY = 0x00000001,
    SQLITE_OPEN_READWRITE = 0x00000002,
    SQLITE_OPEN_CREATE = 0x00000004,
    SQLITE_OPEN_URI = 0x00000040,
    SQLITE_OPEN_MEMORY = 0x00000080,
    SQLITE_OPEN_NOMUTEX = 0x00008000,
    SQLITE_OPEN_FULLMUTEX = 0x00010000,
    SQLITE_OPEN_SHAREDCACHE = 0x00020000,
    SQLITE_OPEN_PRIVATECACHE = 0x00040000,
}
```

## Database Connection Functions

### sqlite3_open_v2() 🟢

Opens a database connection with specified flags.

```typescript
/**
 * Open a database connection with options
 * @param filename - Database file path or ":memory:" for in-memory database
 * @param ppDb - Output pointer to receive database handle
 * @param flags - Combination of SQLITE_OPEN_* flags
 * @param vfsName - Name of VFS to use (null for default)
 * @returns Result code (SQLITE_OK on success)
 */
function sqlite3_open_v2(
    filename: string,
    ppDb: WasmPointer,
    flags: number,
    vfsName: string | null,
): SqliteResultCode;
```

**Usage Example**:

```typescript
const pDb = sqlite3.wasm.alloc(sqlite3.wasm.ptrSizeof); // Allocate space for db pointer
const rc = sqlite3.capi.sqlite3_open_v2(
    ":memory:",
    pDb,
    sqlite3.capi.SQLITE_OPEN_READWRITE | sqlite3.capi.SQLITE_OPEN_CREATE,
    null,
);

if (rc === sqlite3.capi.SQLITE_OK) {
    const db = sqlite3.wasm.peekPtr(pDb);
    // Use database...
    sqlite3.capi.sqlite3_close_v2(db);
}
sqlite3.wasm.dealloc(pDb);
```

### sqlite3_close_v2() 🟢

Closes a database connection.

```typescript
/**
 * Close database connection
 * @param db - Database handle
 * @returns Result code (SQLITE_OK on success)
 */
function sqlite3_close_v2(db: sqlite3): SqliteResultCode;
```

### sqlite3_db_filename() 🟢

Returns the filename of a database.

```typescript
/**
 * Get the filename of an attached database
 * @param db - Database handle
 * @param dbName - Database name ("main", "temp", or attached name)
 * @returns Database filename or null
 */
function sqlite3_db_filename(db: sqlite3, dbName: string): string | null;
```

## SQL Execution Functions

### sqlite3_exec() 🟢

Execute one or more SQL statements with optional callback.

```typescript
/**
 * Callback function for sqlite3_exec
 * @param columnValues - Array of column values as strings
 * @param columnNames - Array of column names
 * @returns `false` to stop stepping, any other value (including undefined) to continue
 */
type ExecCallback = (
    columnValues: (string | null)[],
    columnNames: string[],
) => number | boolean | void;

/**
 * Execute SQL statements
 * @param db - Database handle
 * @param sql - SQL statements to execute
 * @param callback - Optional callback for each result row (JS function or WASM pointer)
 * @param callbackArg - User data pointer (use 0 when passing a JS function)
 * @param errMsg - Output pointer for error message
 * @returns Result code (SQLITE_OK on success)
 */
function sqlite3_exec(
    db: sqlite3,
    sql: string,
    callback?: ExecCallback | WasmPointer | null,
    callbackArg?: WasmPointer,
    errMsg?: WasmPointer,
): SqliteResultCode;
```

**Usage Example**:

```typescript
const db = /* ... get database handle ... */;

// Simple execution without callback
let rc = sqlite3.capi.sqlite3_exec(
    db,
    "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)",
    0,
    0,
    0
);

// Execution with callback
rc = sqlite3.capi.sqlite3_exec(
    db,
    "SELECT * FROM users",
    (values, names) => {
        console.log("Row:", Object.fromEntries(
            names.map((name, i) => [name, values[i]])
        ));
        // Return false to stop iteration early, any other value continues
    },
    0,
    0
);

// sqlite3_exec always expects five arguments; pass 0 when you do not need
// the user-data pointer or error-message pointer.
```

## Prepared Statement Functions

### sqlite3_prepare_v3() 🟢

Compile an SQL statement into a prepared statement object.

```typescript
/**
 * Prepare an SQL statement
 * @param db - Database handle
 * @param sql - SQL statement to compile
 * @param nByte - Maximum length of sql in bytes (-1 for null-terminated)
 * @param prepFlags - Preparation flags (SQLITE_PREPARE_*)
 * @param ppStmt - Output pointer for statement handle
 * @param pzTail - Output pointer for remaining SQL text
 * @returns Result code (SQLITE_OK on success)
 */
function sqlite3_prepare_v3(
    db: sqlite3,
    sql: string,
    nByte: number,
    prepFlags: number,
    ppStmt: WasmPointer,
    pzTail?: WasmPointer,
): SqliteResultCode;
```

When `sql` is a JS string, array, or typed array the binding performs its own UTF‑8 conversion: pass `-1` for `nByte` and omit `pzTail` because the native tail pointer would refer to transient memory. Supply `nByte`/`pzTail` only when `sql` is an explicit WASM pointer to a NUL-terminated buffer.

**Usage Example**:

```typescript
const pStmt = sqlite3.wasm.alloc(sqlite3.wasm.ptrSizeof);
const rc = sqlite3.capi.sqlite3_prepare_v3(
    db,
    "INSERT INTO users (name) VALUES (?)",
    -1,
    0,
    pStmt,
    null,
);

if (rc === sqlite3.capi.SQLITE_OK) {
    const stmt = sqlite3.wasm.peekPtr(pStmt);
    // Use statement...
    sqlite3.capi.sqlite3_finalize(stmt);
}
sqlite3.wasm.dealloc(pStmt);
```

### sqlite3*bind*\*() 🟢

Bind values to prepared statement parameters.

```typescript
/**
 * Bind null value to parameter
 */
function sqlite3_bind_null(stmt: sqlite3_stmt, index: number): SqliteResultCode;

/**
 * Bind integer value to parameter
 */
function sqlite3_bind_int(
    stmt: sqlite3_stmt,
    index: number,
    value: number,
): SqliteResultCode;

/**
 * Bind 64-bit integer value to parameter
 */
function sqlite3_bind_int64(
    stmt: sqlite3_stmt,
    index: number,
    value: number | bigint,
): SqliteResultCode;

/**
 * Bind double value to parameter
 */
function sqlite3_bind_double(
    stmt: sqlite3_stmt,
    index: number,
    value: number,
): SqliteResultCode;

/**
 * Bind text value to parameter
 */
function sqlite3_bind_text(
    stmt: sqlite3_stmt,
    index: number,
    text: string,
    nByte: number,
    destructor?: number | ((ptr: WasmPointer) => void),
): SqliteResultCode;

/**
 * Bind blob value to parameter
 * Accepts JS strings, Arrays, TypedArrays (Uint8Array, Int8Array)
 */
function sqlite3_bind_blob(
    stmt: sqlite3_stmt,
    index: number,
    blob: string | number[] | Uint8Array | Int8Array,
    nByte: number,
    destructor?: number | ((ptr: WasmPointer) => void),
): SqliteResultCode;
```

**Destructor Constants**:

- `SQLITE_STATIC` (0) - Data is static, no need to free
- `SQLITE_TRANSIENT` (-1) - SQLite makes a copy of the data

> **Note**  
> When you supply JS strings, arrays, or typed arrays, the WASM wrapper copies the data and ignores both `nByte` and the `destructor` argument, internally using `SQLITE_WASM_DEALLOC`. Provide explicit lengths/destructors only when you pass a WASM pointer yourself.

**Usage Example**:

```typescript
const stmt = /* ... prepared statement ... */;

// Bind by index (1-based)
sqlite3.capi.sqlite3_bind_int(stmt, 1, 42);
sqlite3.capi.sqlite3_bind_text(stmt, 2, "Alice", -1, sqlite3.capi.SQLITE_TRANSIENT);
sqlite3.capi.sqlite3_bind_double(stmt, 3, 3.14);
sqlite3.capi.sqlite3_bind_blob(stmt, 4, new Uint8Array([1, 2, 3]), 3, sqlite3.capi.SQLITE_TRANSIENT);
sqlite3.capi.sqlite3_bind_null(stmt, 5);
```

### sqlite3_bind_parameter_index() 🟢

Get the index of a named parameter.

```typescript
/**
 * Get parameter index by name
 * @param stmt - Statement handle
 * @param name - Parameter name (with : or $ prefix)
 * @returns Parameter index (1-based) or 0 if not found
 */
function sqlite3_bind_parameter_index(stmt: sqlite3_stmt, name: string): number;
```

### sqlite3_step() 🟢

Execute a prepared statement.

```typescript
/**
 * Execute one step of a prepared statement
 * @param stmt - Statement handle
 * @returns SQLITE_ROW if row available, SQLITE_DONE if complete, or error code
 */
function sqlite3_step(stmt: sqlite3_stmt): SqliteResultCode;
```

**Usage Example**:

```typescript
const stmt = /* ... prepared statement ... */;

while (sqlite3.capi.sqlite3_step(stmt) === sqlite3.capi.SQLITE_ROW) {
    const id = sqlite3.capi.sqlite3_column_int(stmt, 0);
    const name = sqlite3.capi.sqlite3_column_text(stmt, 1);
    console.log({ id, name });
}
```

### sqlite3_reset() 🟢

Reset a prepared statement for re-execution.

```typescript
/**
 * Reset statement to initial state
 * @param stmt - Statement handle
 * @returns Result code
 */
function sqlite3_reset(stmt: sqlite3_stmt): SqliteResultCode;
```

### sqlite3_finalize() 🟢

Destroy a prepared statement.

```typescript
/**
 * Destroy prepared statement and free resources
 * @param stmt - Statement handle
 * @returns Result code
 */
function sqlite3_finalize(stmt: sqlite3_stmt): SqliteResultCode;
```

## Column Access Functions

### sqlite3*column*\*() 🟢

Retrieve column values from the current result row.

```typescript
/**
 * Get column count
 */
function sqlite3_column_count(stmt: sqlite3_stmt): number;

/**
 * Get column name
 */
function sqlite3_column_name(stmt: sqlite3_stmt, index: number): string;

/**
 * Get column data type
 */
function sqlite3_column_type(stmt: sqlite3_stmt, index: number): SqliteDataType;

/**
 * Get integer value
 */
function sqlite3_column_int(stmt: sqlite3_stmt, index: number): number;

/**
 * Get 64-bit integer value
 */
function sqlite3_column_int64(
    stmt: sqlite3_stmt,
    index: number,
): number | bigint;

/**
 * Get double value
 */
function sqlite3_column_double(stmt: sqlite3_stmt, index: number): number;

/**
 * Get text value
 */
function sqlite3_column_text(stmt: sqlite3_stmt, index: number): string;

/**
 * Get blob value pointer
 */
function sqlite3_column_blob(stmt: sqlite3_stmt, index: number): WasmPointer;

/**
 * Get byte length of column data
 */
function sqlite3_column_bytes(stmt: sqlite3_stmt, index: number): number;
```

**Usage Example**:

```typescript
const stmt = /* ... prepared statement with results ... */;

if (sqlite3.capi.sqlite3_step(stmt) === sqlite3.capi.SQLITE_ROW) {
    const colCount = sqlite3.capi.sqlite3_column_count(stmt);

    for (let i = 0; i < colCount; i++) {
        const name = sqlite3.capi.sqlite3_column_name(stmt, i);
        const type = sqlite3.capi.sqlite3_column_type(stmt, i);

        let value;
        switch (type) {
            case sqlite3.capi.SQLITE_INTEGER:
                value = sqlite3.capi.sqlite3_column_int64(stmt, i);
                break;
            case sqlite3.capi.SQLITE_FLOAT:
                value = sqlite3.capi.sqlite3_column_double(stmt, i);
                break;
            case sqlite3.capi.SQLITE_TEXT:
                value = sqlite3.capi.sqlite3_column_text(stmt, i);
                break;
            case sqlite3.capi.SQLITE_BLOB:
                value = sqlite3.capi.sqlite3_column_blob(stmt, i);
                break;
            case sqlite3.capi.SQLITE_NULL:
                value = null;
                break;
        }

        console.log(`${name}: ${value}`);
    }
}
```

> **Note:** Blob accessors return WASM pointers. Use `sqlite3.wasm.heap8u()` with
> `sqlite3.capi.sqlite3_column_bytes()` to copy the data into a typed array.

## User-Defined Functions

### sqlite3_create_function_v2() 🟢

Register a custom SQL function.

```typescript
/**
 * Scalar function implementation
 */
type ScalarFunction = (
    context: sqlite3_context,
    argc: number,
    argv: sqlite3_value[],
) => void;

/**
 * Aggregate step function
 */
type AggregateStepFunction = (
    context: sqlite3_context,
    argc: number,
    argv: sqlite3_value[],
) => void;

/**
 * Aggregate finalize function
 */
type AggregateFinalFunction = (context: sqlite3_context) => void;

/**
 * Function destructor
 */
type FunctionDestructor = (userData: unknown) => void;

/**
 * Create a user-defined function
 * @param db - Database handle
 * @param functionName - Function name
 * @param nArg - Number of arguments (-1 for variable)
 * @param eTextRep - Text encoding (SQLITE_UTF8, etc.)
 * @param pApp - User data
 * @param xFunc - Scalar function implementation
 * @param xStep - Aggregate step function
 * @param xFinal - Aggregate final function
 * @param xDestroy - Destructor for user data
 * @returns Result code
 */
function sqlite3_create_function_v2(
    db: sqlite3,
    functionName: string,
    nArg: number,
    eTextRep: number,
    pApp: any,
    xFunc?: ScalarFunction,
    xStep?: AggregateStepFunction,
    xFinal?: AggregateFinalFunction,
    xDestroy?: FunctionDestructor,
): SqliteResultCode;
```

**Text Encoding Constants**:

```typescript
const SQLITE_UTF8 = 1;
const SQLITE_UTF16LE = 2;
const SQLITE_UTF16BE = 3;
const SQLITE_UTF16 = 4;
```

**Usage Example - Scalar Function**:

```typescript
// Register a custom UPPER function
sqlite3.capi.sqlite3_create_function_v2(
    db,
    "my_upper",
    1, // One argument
    sqlite3.capi.SQLITE_UTF8,
    null,
    (ctx, argc, argv) => {
        const text = sqlite3.capi.sqlite3_value_text(argv[0]);
        const result = text?.toUpperCase() ?? null;

        if (result === null) {
            sqlite3.capi.sqlite3_result_null(ctx);
        } else {
            sqlite3.capi.sqlite3_result_text(ctx, result, -1, sqlite3.capi.SQLITE_TRANSIENT);
        }
    }
);

// Use the function
sqlite3.capi.sqlite3_exec(db, "SELECT my_upper('hello')", ...);
```

**Usage Example - Aggregate Function**:

```typescript
// Register a custom SUM function
sqlite3.capi.sqlite3_create_function_v2(
    db,
    "my_sum",
    1,
    sqlite3.capi.SQLITE_UTF8,
    null,
    null,
    // xStep
    (ctx, argc, argv) => {
        const current = sqlite3.capi.sqlite3_aggregate_context(ctx, 8);
        const value = sqlite3.capi.sqlite3_value_double(argv[0]);
        const sum = sqlite3.wasm.peek(current, "double") + value;
        sqlite3.wasm.poke(current, sum, "double");
    },
    // xFinal
    (ctx) => {
        const current = sqlite3.capi.sqlite3_aggregate_context(ctx, 8);
        const sum = sqlite3.wasm.peek(current, "double");
        sqlite3.capi.sqlite3_result_double(ctx, sum);
    },
);
```

### sqlite3*value*\*() 🟢

Extract values from function arguments.

```typescript
/**
 * Get argument type
 */
function sqlite3_value_type(value: sqlite3_value): SqliteDataType;

/**
 * Get integer value
 */
function sqlite3_value_int(value: sqlite3_value): number;

/**
 * Get 64-bit integer value
 */
function sqlite3_value_int64(value: sqlite3_value): number | bigint;

/**
 * Get double value
 */
function sqlite3_value_double(value: sqlite3_value): number;

/**
 * Get text value
 */
function sqlite3_value_text(value: sqlite3_value): string;

/**
 * Get blob value pointer
 */
function sqlite3_value_blob(value: sqlite3_value): WasmPointer;

/**
 * Convert SQLite value to JavaScript value
 */
function sqlite3_value_to_js(value: sqlite3_value): any;
```

### sqlite3*result*\*() 🟢

Set function return values.

```typescript
/**
 * Return null
 */
function sqlite3_result_null(ctx: sqlite3_context): void;

/**
 * Return integer
 */
function sqlite3_result_int(ctx: sqlite3_context, value: number): void;

/**
 * Return 64-bit integer
 */
function sqlite3_result_int64(
    ctx: sqlite3_context,
    value: number | bigint,
): void;

/**
 * Return double
 */
function sqlite3_result_double(ctx: sqlite3_context, value: number): void;

/**
 * Return text
 */
function sqlite3_result_text(
    ctx: sqlite3_context,
    text: string,
    nByte: number,
    destructor?: number | ((ptr: WasmPointer) => void),
): void;

/**
 * Return blob
 */
function sqlite3_result_blob(
    ctx: sqlite3_context,
    blob: Uint8Array | number[],
    nByte: number,
    destructor?: number | ((ptr: WasmPointer) => void),
): void;

/**
 * Return error
 */
function sqlite3_result_error(
    ctx: sqlite3_context,
    msg: string,
    nByte: number,
): void;
```

## Utility Functions

### sqlite3_changes() 🟢

Get number of rows modified by the last statement.

```typescript
/**
 * Get number of database rows modified
 * @param db - Database handle
 * @returns Number of rows changed by last INSERT, UPDATE, or DELETE
 */
function sqlite3_changes(db: sqlite3): number;
```

### sqlite3_last_insert_rowid() 🟢

Get the ROWID of the most recent INSERT.

```typescript
/**
 * Get last insert ROWID
 * @param db - Database handle
 * @returns ROWID of last INSERT
 */
function sqlite3_last_insert_rowid(db: sqlite3): number | bigint;
```

### sqlite3_errmsg() 🟢

Get the error message for the most recent error.

```typescript
/**
 * Get error message
 * @param db - Database handle
 * @returns Error message string
 */
function sqlite3_errmsg(db: sqlite3): string;
```

### sqlite3_errstr() 🟢

Convert a result code to an error message.

```typescript
/**
 * Get error string for result code
 * @param resultCode - SQLite result code
 * @returns Error description
 */
function sqlite3_errstr(resultCode: SqliteResultCode): string;
```

### sqlite3_js_rc_str() 🟢

**WASM-specific**: Convert result code to string representation.

```typescript
/**
 * Convert result code to string name
 * @param resultCode - SQLite result code
 * @returns String name (e.g., "SQLITE_OK", "SQLITE_ERROR")
 */
function sqlite3_js_rc_str(resultCode: SqliteResultCode): string;
```

### sqlite3_randomness() 🟢

Generate random data.

```typescript
/**
 * Fill buffer with random bytes (form 1)
 * @param n - Number of bytes
 * @param outputPtr - Pointer to output buffer
 */
function sqlite3_randomness(n: number, outputPtr: WasmPointer): void;

/**
 * Fill typed array with random bytes (form 2)
 * @param typedArray - Output buffer
 * @returns The same typed array (for chaining)
 */
function sqlite3_randomness<T extends Uint8Array | Int8Array>(typedArray: T): T;
```

**Usage Example**:

```typescript
// Method 1: Using pointer
const buffer = sqlite3.wasm.alloc(16);
sqlite3.capi.sqlite3_randomness(16, buffer);
const bytes = sqlite3.wasm.heap8u().slice(buffer, buffer + 16);
sqlite3.wasm.dealloc(buffer);

// Method 2: Using TypedArray (recommended)
const randomBytes = new Uint8Array(16);
sqlite3.capi.sqlite3_randomness(randomBytes);
console.log(randomBytes);
```

### sqlite3_js_db_export() 🟢

**WASM-specific**: Export database to Uint8Array.

```typescript
/**
 * Serialize database to byte array
 * @param db - Database handle
 * @param schema - Schema name ("main", "temp", etc.)
 * @returns Database as Uint8Array
 */
function sqlite3_js_db_export(db: sqlite3, schema?: string): Uint8Array;
```

**Usage Example**:

```typescript
const db = /* ... database handle ... */;

// Export main database
const dbBytes = sqlite3.capi.sqlite3_js_db_export(db);

// Save to file or send over network
const blob = new Blob([dbBytes], { type: 'application/x-sqlite3' });
```

## Transaction Functions

### sqlite3_get_autocommit() 🟢

Check if database is in autocommit mode.

```typescript
/**
 * Check autocommit status
 * @param db - Database handle
 * @returns Non-zero if in autocommit mode, 0 if in transaction
 */
function sqlite3_get_autocommit(db: sqlite3): number;
```

## Error Handling

### Best Practices

1. **Always check result codes**:

```typescript
const rc = sqlite3.capi.sqlite3_exec(db, sql, null, null, null);
if (rc !== sqlite3.capi.SQLITE_OK) {
    const errMsg = sqlite3.capi.sqlite3_errmsg(db);
    throw new Error(`SQL error: ${errMsg}`);
}
```

2. **Use sqlite3_js_rc_str() for debugging**:

```typescript
const rc = sqlite3.capi.sqlite3_prepare_v3(db, sql, -1, 0, pStmt, null);
console.log(`Result: ${sqlite3.capi.sqlite3_js_rc_str(rc)}`);
```

3. **Clean up resources in finally blocks**:

```typescript
const pStmt = sqlite3.wasm.alloc(sqlite3.wasm.ptrSizeof);
try {
    const rc = sqlite3.capi.sqlite3_prepare_v3(db, sql, -1, 0, pStmt, null);
    if (rc === sqlite3.capi.SQLITE_OK) {
        const stmt = sqlite3.wasm.peekPtr(pStmt);
        // Use statement...
        sqlite3.capi.sqlite3_finalize(stmt);
    }
} finally {
    sqlite3.wasm.dealloc(pStmt);
}
```

## Memory Management Considerations

### Allocation Rules

1. **Match allocation/deallocation methods**:
    - Use `sqlite3_malloc()` with `sqlite3_free()`
    - Use `sqlite3.wasm.alloc()` with `sqlite3.wasm.dealloc()`

2. **SQLITE_TRANSIENT for temporary data**:

```typescript
// SQLite will make a copy
sqlite3.capi.sqlite3_bind_text(
    stmt,
    1,
    text,
    -1,
    sqlite3.capi.SQLITE_TRANSIENT,
);
```

3. **SQLITE_STATIC for persistent data**:

```typescript
// Data must remain valid until statement is finalized
sqlite3.capi.sqlite3_bind_text(
    stmt,
    1,
    staticText,
    -1,
    sqlite3.capi.SQLITE_STATIC,
);
```

### TypeScript Migration Tips

When converting C-Style API code to TypeScript:

1. **Use proper pointer types**:

```typescript
let db: sqlite3 = 0;
let stmt: sqlite3_stmt = 0;
```

2. **Type guard for result codes**:

```typescript
function isError(rc: SqliteResultCode): boolean {
    return (
        rc !== SqliteResultCode.SQLITE_OK &&
        rc !== SqliteResultCode.SQLITE_ROW &&
        rc !== SqliteResultCode.SQLITE_DONE
    );
}
```

3. **Wrap C API in type-safe functions**:

```typescript
function executeSQL(db: sqlite3, sql: string): void {
    const rc = sqlite3.capi.sqlite3_exec(db, sql, null, null, null);
    if (rc !== sqlite3.capi.SQLITE_OK) {
        throw new Error(sqlite3.capi.sqlite3_errmsg(db));
    }
}
```

## See Also

- [OO1 API Documentation](./oo1-api.md) - Higher-level object-oriented interface
- [WASM Utilities Documentation](./wasm-utilities.md) - Memory management and helpers
- [Worker API Documentation](./worker-api.md) - Web Worker integration
- [Official SQLite C API Documentation](https://www.sqlite.org/c3ref/intro.html)
