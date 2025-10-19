# Object-Oriented API (OO1) Documentation

The Object-Oriented API (OO1) provides a high-level, JavaScript-friendly interface to SQLite WASM. It wraps the low-level C-style API with exception-based error handling, automatic resource management, and convenient methods for common database operations.

## Verification Status Legend

Each API item in this document has a verification status indicator:

-   ⚫ **Not Verified** - Type definitions and JSDoc have not been verified against source code
-   🟡 **Partially Verified** - Type definitions verified, but JSDoc incomplete or inconsistent
-   🟢 **Verified** - Type definitions and JSDoc fully verified and consistent with source code

Last updated: 2025-10-18

## Overview

The OO1 API is accessed via `sqlite3.oo1` and includes:

-   **DB class** - Main database connection class
-   **Stmt class** - Prepared statement wrapper
-   **JsStorageDb class** - localStorage/sessionStorage database integration
-   **OpfsDb class** - Origin Private File System persistent databases

## DB Class 🟢

The DB class represents a database connection and provides methods for executing SQL, managing transactions, and creating prepared statements.

### Constructor 🟢

```typescript
/**
 * Create a new database connection
 * @param filename - Database file path, ":memory:" for in-memory, or empty for temp
 * @param flags - Open flags (default: "c" = create+readwrite)
 * @param vfs - VFS name to use (default: platform default)
 */
constructor(filename?: string, flags?: string, vfs?: string);

/**
 * Alternative constructor with configuration object
 */
constructor(config: {
    filename?: string;
    flags?: string;
    vfs?: string;
});
```

**Flags**: String containing one or more:

-   `"c"` - Create if doesn't exist (SQLITE_OPEN_CREATE)
-   `"r"` - Read-only (SQLITE_OPEN_READONLY)
-   `"w"` - Read-write (SQLITE_OPEN_READWRITE)
-   `"t"` - Trace mode (outputs SQL to console)

**Default**: `"c"` (equivalent to `SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE`)

**Usage Examples**:

```typescript
// In-memory database
const db1 = new sqlite3.oo1.DB();
const db2 = new sqlite3.oo1.DB(":memory:");

// Persistent database (OPFS)
const db3 = new sqlite3.oo1.DB("mydb.sqlite3");

// Read-only database
const db4 = new sqlite3.oo1.DB("readonly.db", "r");

// With configuration object
const db5 = new sqlite3.oo1.DB({
    filename: "app.db",
    flags: "cw",
    vfs: "opfs",
});
```

### Core Properties 🟢

```typescript
/**
 * Database filename (read-only)
 */
readonly filename: string;

/**
 * Low-level database pointer (read-only)
 * For advanced use with C-style API
 */
readonly pointer: sqlite3;

/**
 * Check if database is open
 */
readonly isOpen: boolean;
```

### SQL Execution Methods 🟢

#### exec() 🟢

Execute one or more SQL statements with optional result handling.

```typescript
/**
 * Execute SQL with various result handling options
 * @param sql - SQL statement(s) to execute
 * @param options - Execution options
 * @returns this for chaining, or result based on options
 */
exec(sql: string, options?: ExecOptions): this | ExecResult;

interface ExecOptions {
    /**
     * Bind values (array for ? placeholders, object for named parameters)
     */
    bind?: any[] | Record<string, any>;

    /**
     * Callback for each result row.
     * Return literal false to stop iteration; all other values continue.
     */
    callback?: (row: any, stmt: Stmt) => any;

    /**
     * Row mode for the first callback argument.
     * Accepts "array" (default), "object", "stmt", a zero-based column index, or "$columnName".
     */
    rowMode?: "array" | "object" | "stmt" | number | `$${string}`;

    /**
     * Column names for object mode
     */
    columnNames?: string[];

    /**
     * Controls the value returned from exec().
     */
    returnValue?: "this" | "resultRows" | "saveSql";

    /**
     * Array used to collect result rows when returnValue is "resultRows".
     */
    resultRows?: any[]; // Not valid when rowMode is "stmt"

    /**
     * Array used to collect the SQL text of each executed statement.
     */
    saveSql?: string[];
}

interface ExecResult {
    /**
     * Array of result rows (if returnValue: "resultRows")
     */
    resultRows?: any[];

    /**
     * Captured SQL text (if returnValue: "saveSql")
     */
    saveSql?: string[];
}
```

By default `exec()` returns the database instance (`"this"`). If you specify a `rowMode` without a callback or explicit `returnValue`, the helper promotes `returnValue` to `"resultRows"` so you receive the fetched rows.

**Usage Examples**:

```typescript
const db = new sqlite3.oo1.DB();

// Simple execution
db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);
    INSERT INTO users (name, age) VALUES ('Alice', 30), ('Bob', 25);
`);

// With bind parameters
db.exec("INSERT INTO users (name, age) VALUES (?, ?)", {
    bind: ["Charlie", 35],
});

// Named parameters
db.exec("INSERT INTO users (name, age) VALUES (:name, :age)", {
    bind: { ":name": "Diana", ":age": 28 },
});

// With callback (array mode)
db.exec("SELECT * FROM users", {
    callback: (row, stmt) => {
        console.log(row); // [1, 'Alice', 30]
        console.log(stmt.getColumnNames()); // access metadata from stmt
    },
});

// With callback (object mode)
db.exec("SELECT * FROM users", {
    rowMode: "object",
    callback: (row) => {
        if (row.id === 2) {
            return false; // stop iteration after this row
        }
        console.log(row); // { id: 1, name: 'Alice', age: 30 }
    },
});

// Extract a single column by index
db.exec("SELECT id, name FROM users", {
    rowMode: 1, // pass the second column only
    callback: (name) => console.log(name),
});

// Extract a single column by name
db.exec("SELECT id, name AS displayName FROM users", {
    rowMode: "$displayName",
    callback: (name) => console.log(name),
});

// Return all rows
const result = db.exec("SELECT * FROM users WHERE age > ?", {
    bind: [25],
    rowMode: "object",
    returnValue: "resultRows",
});
console.log(result.resultRows);

// Capture the SQL text evaluated by exec()
const statements = db.exec(`
    CREATE TABLE log (msg TEXT);
    INSERT INTO log VALUES ('hi');
`, { returnValue: "saveSql" });
console.log(statements.saveSql); // ["CREATE TABLE log (msg TEXT)", "INSERT INTO log VALUES ('hi')"]
```

#### selectArray() 🟢

Execute a query and return first row as an array.

```typescript
/**
 * Get first result row as array
 * @param sql - SELECT statement
 * @param bind - Bind parameters
 * @returns Array of column values or undefined if no results
 */
selectArray(sql: string, bind?: any[] | Record<string, any>): any[] | undefined;
```

**Usage Example**:

```typescript
const user = db.selectArray("SELECT * FROM users WHERE id = ?", [1]);
// user = [1, 'Alice', 30]

if (!user) {
    console.log("User not found");
}
```

#### selectArrays() 🟢

Execute a query and return all rows as arrays.

```typescript
/**
 * Get all result rows as arrays
 * @param sql - SELECT statement
 * @param bind - Bind parameters
 * @returns Array of row arrays
 */
selectArrays(sql: string, bind?: any[] | Record<string, any>): any[][];
```

**Usage Example**:

```typescript
const users = db.selectArrays("SELECT * FROM users WHERE age > ?", [25]);
// users = [[1, 'Alice', 30], [3, 'Charlie', 35]]
```

#### selectObject() 🟢

Execute a query and return first row as an object.

```typescript
/**
 * Get first result row as object
 * @param sql - SELECT statement
 * @param bind - Bind parameters
 * @returns Object with column names as keys, or undefined if no results
 */
selectObject(sql: string, bind?: any[] | Record<string, any>): Record<string, any> | undefined;
```

**Usage Example**:

```typescript
const user = db.selectObject("SELECT * FROM users WHERE id = ?", [1]);
// user = { id: 1, name: 'Alice', age: 30 }
```

#### selectObjects() 🟢

Execute a query and return all rows as objects.

```typescript
/**
 * Get all result rows as objects
 * @param sql - SELECT statement
 * @param bind - Bind parameters
 * @returns Array of row objects
 */
selectObjects(sql: string, bind?: any[] | Record<string, any>): Record<string, any>[];
```

**Usage Example**:

```typescript
const users = db.selectObjects("SELECT * FROM users WHERE age > ?", [25]);
// users = [
//   { id: 1, name: 'Alice', age: 30 },
//   { id: 3, name: 'Charlie', age: 35 }
// ]
```

#### selectValue() 🟢

Execute a query and return a single value.

```typescript
/**
 * Get single value from first row, first column
 * @param sql - SELECT statement
 * @param bind - Bind parameters
 * @returns Single value or undefined if no results
 */
selectValue(sql: string, bind?: any[] | Record<string, any>): any;
```

**Usage Example**:

```typescript
const count = db.selectValue("SELECT COUNT(*) FROM users");
// count = 4

const name = db.selectValue("SELECT name FROM users WHERE id = ?", [1]);
// name = 'Alice'
```

### Prepared Statement Methods 🟢

#### prepare() 🟢

Create a prepared statement for reuse.

```typescript
/**
 * Compile SQL into a prepared statement
 * @param sql - SQL statement (single statement only)
 * @returns Stmt object
 */
prepare(sql: string): Stmt;
```

**Usage Example**:

```typescript
const stmt = db.prepare("INSERT INTO users (name, age) VALUES (?, ?)");
try {
    stmt.bind("Eve", 32).step();
    stmt.reset();
    stmt.bind("Frank", 29).step();
} finally {
    stmt.finalize();
}
```

### Transaction Methods 🟢

#### transaction() 🟢

Execute a function within a transaction.

```typescript
/**
 * Run function in a transaction.
 * Automatically commits on success and rolls back on exception.
 * @param beginQualifier - Optional BEGIN keyword such as "IMMEDIATE" or "EXCLUSIVE"
 * @param callback - Function that receives the current DB instance
 * @returns Result of callback function
 */
transaction<T>(callback: (db: DB) => T): T;
transaction<T>(beginQualifier: string, callback: (db: DB) => T): T;
```

**Usage Example**:

```typescript
db.transaction((tx) => {
    tx.exec("INSERT INTO users (name, age) VALUES (?, ?)", {
        bind: ["Grace", 27],
    });
    tx.exec("UPDATE users SET age = age + 1 WHERE name = ?", {
        bind: ["Grace"],
    });
    // If any error occurs, entire transaction is rolled back
});

// With return value
const newId = db.transaction((tx) => {
    tx.exec("INSERT INTO users (name, age) VALUES (?, ?)", {
        bind: ["Henry", 31],
    });
    return tx.selectValue("SELECT last_insert_rowid()");
});
console.log(`New user ID: ${newId}`);

// Explicit BEGIN IMMEDIATE
db.transaction("IMMEDIATE", (tx) => {
    tx.exec("UPDATE users SET age = age + 1");
});
```

### Utility Methods 🟢

#### changes() 🟢

Get number of rows modified by last statement.

```typescript
/**
 * Get number of rows changed by last INSERT, UPDATE, or DELETE
 * @returns Number of modified rows
 */
changes(): number;
```

**Usage Example**:

```typescript
db.exec("UPDATE users SET age = age + 1 WHERE age > 30");
console.log(`Updated ${db.changes()} rows`);
```

#### close() 🟢

Close the database connection.

```typescript
/**
 * Close database and free resources
 * Safe to call multiple times
 */
close(): void;
```

**Usage Example**:

```typescript
const db = new sqlite3.oo1.DB(":memory:");
// ... use database ...
db.close();
```

#### export() 🟢

Export database to a byte array.

```typescript
/**
 * Serialize database to Uint8Array
 * @returns Database as byte array
 */
export(): Uint8Array;
```

**Usage Example**:

```typescript
const dbBytes = db.export();

// Save to file
const blob = new Blob([dbBytes], { type: "application/x-sqlite3" });
const url = URL.createObjectURL(blob);
// ... trigger download ...

// Or send to server
fetch("/api/backup", {
    method: "POST",
    body: dbBytes,
});
```

## Stmt Class 🟢

The Stmt class represents a prepared statement. Statements are created via `DB.prepare()` and must be finalized when done.

### Properties 🟢

```typescript
/**
 * SQL text of the statement (read-only)
 */
readonly sql: string;

/**
 * Low-level statement pointer (read-only)
 */
readonly pointer: sqlite3_stmt;

/**
 * Parent database connection (read-only)
 */
readonly db: DB;

/**
 * Number of columns in result set (read-only)
 */
readonly columnCount: number;

/**
 * Number of bind parameters (read-only)
 */
readonly parameterCount: number;
```

### Binding Methods 🟢

#### bind() 🟢

Bind values to statement parameters.

```typescript
/**
 * Bind parameters to statement
 * @param values - Values to bind (positional or named)
 * @returns this for chaining
 */
bind(...values: any[]): this;
bind(values: any[]): this;
bind(values: Record<string, any>): this;
```

**Usage Examples**:

```typescript
const stmt = db.prepare("INSERT INTO users (name, age) VALUES (?, ?)");

// Positional binding (multiple arguments)
stmt.bind("Alice", 30);

// Positional binding (array)
stmt.bind(["Bob", 25]);

// Named parameters
const stmt2 = db.prepare("INSERT INTO users (name, age) VALUES (:name, :age)");
stmt2.bind({ ":name": "Charlie", ":age": 35 });

// Can also use without colons
stmt2.bind({ name: "Diana", age: 28 });
```

### Execution Methods 🟢

#### step() 🟢

Execute the statement one step.

```typescript
/**
 * Execute one step of the statement
 * @returns true if row available, false if done
 */
step(): boolean;
```

**Usage Example**:

```typescript
const stmt = db.prepare("SELECT * FROM users");
while (stmt.step()) {
    console.log(stmt.get([])); // Get current row
}
stmt.finalize();
```

#### stepReset() 🟢

Execute and automatically reset.

```typescript
/**
 * Execute step() then reset()
 * Useful for INSERT/UPDATE/DELETE statements
 * @returns this for chaining
 */
stepReset(): this;
```

**Usage Example**:

```typescript
const stmt = db.prepare("INSERT INTO users (name, age) VALUES (?, ?)");
stmt.bind("Eve", 32).stepReset();
stmt.bind("Frank", 29).stepReset();
stmt.finalize();
```

#### stepFinalize() 🟢

Execute and automatically finalize.

```typescript
/**
 * Execute step() then finalize()
 * Useful for one-time statements
 * @returns this for chaining
 */
stepFinalize(): boolean;
```

**Usage Example**:

```typescript
db.prepare("INSERT INTO users (name, age) VALUES (?, ?)")
    .bind("Grace", 27)
    .stepFinalize();
```

#### reset() 🟢

Reset statement for re-execution.

```typescript
/**
 * Reset statement to initial state
 * Keeps parameter bindings
 * @returns this for chaining
 */
reset(): this;
```

#### finalize() 🟢

Destroy statement and free resources.

```typescript
/**
 * Finalize statement and free resources
 * Safe to call multiple times
 */
finalize(): void;
```

### Column Access Methods 🟢

#### get() 🟢

Get column value(s) from current row.

```typescript
/**
 * Get single column value
 * @param index - Column index (0-based)
 * @returns Column value
 */
get(index: number): any;

/**
 * Get all columns as array or object
 * @param target - Empty array [] for array mode, empty object {} for object mode
 * @returns Array or object with column values
 */
get(target: [] | {}): any[] | Record<string, any>;
```

**Usage Examples**:

```typescript
const stmt = db.prepare("SELECT id, name, age FROM users WHERE id = ?");
stmt.bind(1);

if (stmt.step()) {
    // Get individual columns
    const id = stmt.get(0);
    const name = stmt.get(1);
    const age = stmt.get(2);

    // Get all as array
    const rowArray = stmt.get([]);
    // rowArray = [1, 'Alice', 30]

    // Get all as object
    const rowObject = stmt.get({});
    // rowObject = { id: 1, name: 'Alice', age: 30 }
}

stmt.finalize();
```

#### getColumnName() 🟢

Get column name by index.

```typescript
/**
 * Get name of column
 * @param index - Column index (0-based)
 * @returns Column name
 */
getColumnName(index: number): string;
```

#### getColumnNames() 🟢

Get all column names.

```typescript
/**
 * Get array of all column names
 * @returns Array of column names
 */
getColumnNames(): string[];
```

**Usage Example**:

```typescript
const stmt = db.prepare("SELECT id, name, age FROM users LIMIT 1");
stmt.step();
const columns = stmt.getColumnNames();
// columns = ['id', 'name', 'age']
stmt.finalize();
```

## JsStorageDb Class 🟢

Extends DB class to integrate with the browser's kvvfs-backed `localStorage` or `sessionStorage` buckets.

```typescript
/**
 * Database backed by localStorage or sessionStorage
 * Changes are automatically persisted to storage
 */
class JsStorageDb extends DB {
    /**
     * Create database backed by localStorage or sessionStorage
     * @param storageType - "local" for localStorage, "session" for sessionStorage (default "local")
     */
    constructor(storageType?: "local" | "session");

    /**
     * Persist current database to storage
     */
    flush(): void;
}
```

**Usage Example**:

```typescript
// Create or load database from localStorage
const db = new sqlite3.oo1.JsStorageDb("local");

// Use normally
db.exec(
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
);
db.exec("INSERT OR REPLACE INTO settings VALUES (?, ?)", {
    bind: ["theme", "dark"],
});

// Manually flush to storage (also happens automatically)
db.flush();

// Later, reopening with same name loads existing database
const db2 = new sqlite3.oo1.JsStorageDb("local");
const theme = db2.selectValue("SELECT value FROM settings WHERE key = ?", [
    "theme",
]);
// theme = "dark"
```

## OpfsDb Class 🟢

Extends DB class to use Origin Private File System for persistent storage.

```typescript
/**
 * Database backed by OPFS (Origin Private File System)
 * Provides true file-based persistence
 * Only available in browsers with OPFS support
 */
class OpfsDb extends DB {
    /**
     * Create database in OPFS
     * @param filename - Database filename in OPFS
     */
    constructor(filename: string);
}
```

**Usage Example**:

```typescript
// Must check for OPFS support first
if (sqlite3.oo1.OpfsDb) {
    const db = new sqlite3.oo1.OpfsDb("myapp.sqlite3");

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        )
    `);

    db.exec("INSERT INTO users (name) VALUES (?)", { bind: ["Alice"] });

    // Database automatically persists to OPFS
    // Closing and reopening preserves data
    db.close();

    // Later...
    const db2 = new sqlite3.oo1.OpfsDb("myapp.sqlite3");
    const users = db2.selectObjects("SELECT * FROM users");
    // Data persisted from previous session
} else {
    console.error("OPFS not supported in this browser");
}
```

## Error Handling 🟢

The OO1 API uses exception-based error handling. All methods throw `sqlite3.SQLite3Error` on errors.

```typescript
/**
 * Exception thrown by OO1 API methods
 */
class SQLite3Error extends Error {
    /**
     * SQLite result code
     */
    resultCode: number;

    /**
     * Error message from SQLite
     */
    message: string;
}
```

**Usage Example**:

```typescript
try {
    db.exec("INSERT INTO users (id, name) VALUES (?, ?)", {
        bind: [1, "Alice"],
    });
} catch (e) {
    if (e instanceof sqlite3.SQLite3Error) {
        console.error(`SQLite error ${e.resultCode}: ${e.message}`);
    } else {
        throw e;
    }
}
```

## Best Practices

### 1. Always Close Resources

```typescript
// Manual cleanup
const db = new sqlite3.oo1.DB(":memory:");
try {
    // ... use database ...
} finally {
    db.close();
}

// For statements
const stmt = db.prepare("SELECT * FROM users");
try {
    while (stmt.step()) {
        console.log(stmt.get([]));
    }
} finally {
    stmt.finalize();
}
```

### 2. Use Transactions for Multiple Writes

```typescript
// Bad: Each INSERT is a separate transaction
for (const user of users) {
    db.exec("INSERT INTO users (name) VALUES (?)", { bind: [user.name] });
}

// Good: Single transaction
db.transaction((tx) => {
    for (const user of users) {
        tx.exec("INSERT INTO users (name) VALUES (?)", { bind: [user.name] });
    }
});
```

### 3. Use Prepared Statements for Repeated Operations

```typescript
// Bad: Prepare on each iteration
for (const user of users) {
    db.exec("INSERT INTO users (name, age) VALUES (?, ?)", {
        bind: [user.name, user.age],
    });
}

// Good: Prepare once, bind many times
const stmt = db.prepare("INSERT INTO users (name, age) VALUES (?, ?)");
try {
    for (const user of users) {
        stmt.bind(user.name, user.age).stepReset();
    }
} finally {
    stmt.finalize();
}
```

### 4. Choose the Right Select Method

```typescript
// For single value
const count = db.selectValue("SELECT COUNT(*) FROM users");

// For single row
const user = db.selectObject("SELECT * FROM users WHERE id = ?", [1]);

// For multiple rows (small result set)
const users = db.selectObjects("SELECT * FROM users");

// For large result sets (use callback to avoid memory)
db.exec("SELECT * FROM large_table", {
    rowMode: "object",
    callback: (row) => {
        processRow(row);
    },
});
```

## TypeScript Type Definitions

```typescript
declare namespace sqlite3 {
    namespace oo1 {
        class DB {
            constructor(filename?: string, flags?: string, vfs?: string);
            constructor(config: {
                filename?: string;
                flags?: string;
                vfs?: string;
            });

            readonly filename: string;
            readonly pointer: number | bigint;
            readonly isOpen: boolean;

            exec(sql: string, options?: ExecOptions): this | ExecResult;
            selectArray(
                sql: string,
                bind?: any[] | Record<string, any>
            ): any[] | undefined;
            selectArrays(
                sql: string,
                bind?: any[] | Record<string, any>
            ): any[][];
            selectObject(
                sql: string,
                bind?: any[] | Record<string, any>
            ): Record<string, any> | undefined;
            selectObjects(
                sql: string,
                bind?: any[] | Record<string, any>
            ): Record<string, any>[];
            selectValue(sql: string, bind?: any[] | Record<string, any>): any;
            prepare(sql: string): Stmt;
            transaction<T>(callback: (db: DB) => T): T;
            transaction<T>(beginQualifier: string, callback: (db: DB) => T): T;
            changes(): number;
            close(): void;
            export(): Uint8Array;
        }

        class Stmt {
            readonly sql: string;
            readonly pointer: number | bigint;
            readonly db: DB;
            readonly columnCount: number;
            readonly parameterCount: number;

            bind(...values: any[]): this;
            bind(values: any[] | Record<string, any>): this;
            step(): boolean;
            stepReset(): this;
            stepFinalize(): this;
            reset(): this;
            finalize(): void;
            get(index: number): any;
            get(target: [] | {}): any[] | Record<string, any>;
            getColumnName(index: number): string;
            getColumnNames(): string[];
        }

        class JsStorageDb extends DB {
            constructor(storageType?: "local" | "session");
            flush(): void;
        }

        class OpfsDb extends DB {
            constructor(filename: string);
        }
    }

    class SQLite3Error extends Error {
        resultCode: number;
    }
}
```

## See Also

-   [C-Style API Documentation](./c-style-api.md) - Low-level C API bindings
-   [WASM Utilities Documentation](./wasm-utilities.md) - Memory management utilities
-   [Worker API Documentation](./worker-api.md) - Web Worker integration
