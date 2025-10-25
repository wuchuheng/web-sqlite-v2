---
id: DOC-API-WORKER
title: Worker API Reference
summary: Capture the message-based and promise-based worker interfaces for executing SQLite queries off the main thread.
audience: ["engineering", "ops"]
status: in-progress
owner: API Documentation Maintainer
updated: 2025-02-14
---

# Worker API Documentation

The Worker API enables running SQLite operations in a dedicated Web Worker thread, keeping database operations off the main thread to maintain UI responsiveness. This is particularly useful for computationally intensive queries or when working with large datasets.

## Verification Status Legend

Each API item in this document has a verification status indicator:

- ⚫ **Not Verified** - Type definitions and JSDoc have not been verified against source code
- 🟡 **Partially Verified** - Type definitions verified, but JSDoc incomplete or inconsistent
- 🟢 **Verified** - Type definitions and JSDoc fully verified and consistent with source code

Last updated: 2025-10-18

## Overview ⚫

SQLite WASM provides two Worker API variants:

1. **Worker1 API** - Low-level message-based interface
2. **Promiser API** - Promise-based wrapper around Worker1 for easier use

The Worker API is accessed via `sqlite3.initWorker1API()` and operates through message passing between the main thread and worker thread.

## Architecture ⚫

```
Main Thread                Worker Thread
┌──────────┐              ┌──────────────┐
│          │   message    │   SQLite     │
│  App     │─────────────>│   Worker     │
│          │              │              │
│          │<─────────────│   Database   │
│          │   response   │   Operations │
└──────────┘              └──────────────┘
```

## Worker1 API (Message-Based) ⚫

### Initialization ⚫

```typescript
/**
 * Initialize Worker1 API
 * Must be called once in the worker thread
 */
function initWorker1API(): void;
```

**Worker Script Example** (`sqlite-worker.js`):

```javascript
importScripts("sqlite3.js");

sqlite3InitModule().then((sqlite3) => {
    sqlite3.initWorker1API();
    // Worker is now ready to receive messages
});
```

**Main Thread Setup**:

```javascript
const worker = new Worker("sqlite-worker.js");

worker.onmessage = function (event) {
    const message = event.data;
    console.log("Received from worker:", message);
};

worker.postMessage({
    type: "open",
    args: { filename: ":memory:" },
});
```

### Message Types ⚫

All messages follow this structure:

```typescript
interface WorkerMessage {
    /**
     * Message type/operation
     */
    type: string;

    /**
     * Optional message identifier for tracking responses
     */
    messageId?: string | number;

    /**
     * Database identifier (for multi-database scenarios)
     */
    dbId?: string;

    /**
     * Operation-specific arguments
     */
    args?: any;
}

interface WorkerResponse {
    /**
     * Response type (usually matches request type)
     */
    type: string;

    /**
     * Message ID from original request
     */
    messageId?: string | number;

    /**
     * Database identifier
     */
    dbId?: string;

    /**
     * Response result
     */
    result?: any;
}

interface WorkerError {
    /**
     * Always "error" for error responses
     */
    type: "error";

    /**
     * Original operation that failed
     */
    operation?: string;

    /**
     * Message ID from original request
     */
    messageId?: string | number;

    /**
     * Error message
     */
    message: string;

    /**
     * Error class name
     */
    errorClass?: string;
}
```

### Supported Operations ⚫

#### open ⚫

Open a database connection.

```typescript
interface OpenMessage {
    type: "open";
    messageId?: string | number;
    args?: {
        /**
         * Database filename (":memory:" for in-memory)
         */
        filename?: string;

        /**
         * VFS to use (e.g., "opfs")
         */
        vfs?: string;
    };
}

interface OpenResponse {
    type: "open";
    messageId?: string | number;
    dbId: string;
    result: {
        filename: string;
        dbId: string;
        persistent: boolean;
        vfs: string;
    };
}
```

**Usage Example**:

```javascript
worker.postMessage({
    type: "open",
    messageId: "open-1",
    args: {
        filename: "mydb.sqlite3",
        vfs: "opfs",
    },
});

// Response:
// {
//   type: 'open',
//   messageId: 'open-1',
//   dbId: 'db-1',
//   result: {
//     filename: 'mydb.sqlite3',
//     dbId: 'db-1',
//     persistent: true,
//     vfs: 'opfs'
//   }
// }

// The worker repeats the database identifier both in the envelope and the result.
// `persistent` indicates whether the VFS stores data across sessions (e.g. OPFS).
```

#### close ⚫

Close a database connection.

```typescript
interface CloseMessage {
    type: "close";
    messageId?: string | number;
    dbId?: string;
    args?: {
        /**
         * Unlink (delete) database file after closing
         */
        unlink?: boolean;
    };
}

interface CloseResponse {
    type: "close";
    messageId?: string | number;
    result?: {
        filename?: string;
    };
}
```

**Usage Example**:

```javascript
worker.postMessage({
    type: "close",
    messageId: "close-1",
    dbId: "db-1",
    args: { unlink: false },
});

// Response result.filename echoes the path of the closed database when available.
```

#### exec ⚫

Execute SQL statements.

```typescript
interface ExecMessage {
    type: "exec";
    messageId?: string | number;
    dbId?: string;
    args: WorkerExecArgs;
}

interface WorkerExecArgs {
    /** SQL statement(s) to execute */
    sql: string;
    /** Bind parameters (array or object) */
    bind?: any[] | Record<string, any>;
    /**
     * Row mode for row results. Supports "array", "object", "stmt",
     * zero-based column indices, or "$columnName" lookups.
     */
    rowMode?: "array" | "object" | "stmt" | number | `$${string}`;
    /** Controls what exec() returns. Defaults to "this". */
    returnValue?: "this" | "resultRows" | "saveSql";
    /**
     * Collect result rows (not valid when rowMode is "stmt").
     */
    resultRows?: any[];
    /** Collect column names. */
    columnNames?: string[];
    /** Collect executed SQL statements. */
    saveSql?: string[];
    /**
     * Request change counts (true for 32-bit, 64 for bigint).
     */
    countChanges?: boolean | 64;
    /**
     * When set to a string, rows are streamed back as separate messages
     * using that string as the message type.
     */
    callback?: string;
}

interface ExecResponse {
    type: "exec";
    messageId?: string | number;
    dbId: string;
    result: WorkerExecArgs & {
        changeCount?: number | bigint;
    };
}
```

**Usage Examples**:

```javascript
// Simple execution
worker.postMessage({
    type: "exec",
    messageId: "exec-1",
    dbId: "db-1",
    args: {
        sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)",
    },
});

// Insert with bind parameters
worker.postMessage({
    type: "exec",
    messageId: "exec-2",
    dbId: "db-1",
    args: {
        sql: "INSERT INTO users (name) VALUES (?)",
        bind: ["Alice"],
    },
});

// Query with results
worker.postMessage({
    type: "exec",
    messageId: "exec-3",
    dbId: "db-1",
    args: {
        sql: "SELECT * FROM users",
        rowMode: "object",
        returnValue: "resultRows",
        columnNames: [],
    },
});

// Response:
// {
//   type: 'exec',
//   messageId: 'exec-3',
//   dbId: 'db-1',
//   result: {
//     resultRows: [
//       { id: 1, name: 'Alice' }
//     ],
//     columnNames: ['id', 'name']
//   }
// }

// Change counts
worker.postMessage({
    type: "exec",
    messageId: "exec-5",
    dbId: "db-1",
    args: {
        sql: 'UPDATE users SET name = name || "!"',
        countChanges: true,
    },
});
// Response result.changeCount contains the number of affected rows

// Stream rows via callback messages
worker.postMessage({
    type: "exec",
    messageId: "exec-4",
    dbId: "db-1",
    args: {
        sql: "SELECT name FROM users",
        rowMode: "$name",
        callback: "users-row",
    },
});

// The worker will post messages like:
// { type: 'users-row', rowNumber: 1, row: 'Alice', columnNames: ['name'] }
// ... and finally { type: 'users-row', rowNumber: null, row: undefined, columnNames: ['name'] }

// The exec response echoes the args object. After this call completes,
// the result field contains the same shape plus any derived data (e.g. changeCount).
```

#### export ⚫

Export database to byte array.

```typescript
interface ExportMessage {
    type: "export";
    messageId?: string | number;
    dbId?: string;
    args?: {
        /**
         * Database schema to export (default: "main")
         */
        schema?: string;
    };
}

interface ExportResponse {
    type: "export";
    messageId?: string | number;
    dbId: string;
    result: {
        /**
         * Database as byte array
         */
        byteArray: Uint8Array;

        /**
         * Database filename
         */
        filename: string;
    };
}
```

**Usage Example**:

```javascript
worker.postMessage({
    type: "export",
    messageId: "export-1",
    dbId: "db-1",
});

// Response includes Uint8Array of database
```

#### config-get ⚫

Get worker configuration.

```typescript
interface ConfigGetMessage {
    type: "config-get";
    messageId?: string | number;
}

interface ConfigGetResponse {
    type: "config-get";
    messageId?: string | number;
    result: {
        /**
         * SQLite version
         */
        version: {
            libVersion: string;
            libVersionNumber: number;
            sourceId: string;
        };

        /**
         * Available VFS names
         */
        vfsList: string[];

        /**
         * Configuration options
         */
        [key: string]: any;
    };
}
```

**Usage Example**:

```javascript
worker.postMessage({
    type: "config-get",
    messageId: "config-1",
});
```

### Error Handling ⚫

Errors are returned as special error messages:

```javascript
worker.onmessage = function (event) {
    const msg = event.data;

    if (msg.type === "error") {
        console.error(`Error in ${msg.operation}: ${msg.message}`);
        return;
    }

    // Handle normal responses
    switch (msg.type) {
        case "open":
            console.log("Database opened:", msg.dbId);
            break;
        case "exec":
            console.log("Query result:", msg.result);
            break;
    }
};
```

## Promiser API ⚫

The Promiser helpers wrap the Worker1 message protocol in a convenience function that returns promises for each request.

### Factory Signatures ⚫

```typescript
type Promiser = ((message: WorkerMessage) => Promise<WorkerResponse>) & {
    close(): void;
};

interface PromiserConfig {
    worker?: Worker | string;
    onready?: (promiser: Promiser) => void;
    onunhandled?: (event: MessageEvent) => void;
    onerror?: (error: Error) => void;
    debug?: boolean;
}

function sqlite3Worker1Promiser(
    config?: PromiserConfig | ((promiser: Promiser) => void),
): Promiser;

declare namespace sqlite3Worker1Promiser {
    function v2(config?: PromiserConfig): Promise<Promiser>;
}
```

### Usage Patterns ⚫

**Promiser v1 (callback driven)**

```javascript
const promiser = sqlite3Worker1Promiser({
    worker: new Worker("sqlite-worker.js"),
    onready: async (factory) => {
        const { result } = await factory({
            type: "open",
            args: { filename: ":memory:" },
        });
        const dbId = result.dbId;

        await factory({
            type: "exec",
            dbId,
            args: { sql: "CREATE TABLE users (id INTEGER, name TEXT)" },
        });

        const query = await factory({
            type: "exec",
            dbId,
            args: {
                sql: "SELECT * FROM users",
                rowMode: "object",
                returnValue: "resultRows",
            },
        });
        console.log("Rows:", query.result.resultRows);
    },
});
```

`sqlite3Worker1Promiser()` returns the factory immediately; use the `onready` callback (or pass a function as the only argument) to know when the worker has finished bootstrapping.

**Promiser v2 (Promise based)**

```javascript
const promiser = await sqlite3Worker1Promiser.v2({
    worker: new Worker("sqlite-worker.js"),
});

const { result } = await promiser({
    type: "open",
    args: { filename: ":memory:" },
});

await promiser({
    type: "close",
    dbId: result.dbId,
});
```

> When using the ESM build (`sqlite3-worker1-promiser.mjs`), the default export already exposes the v2 factory.

### Error Handling with Promiser ⚫

```javascript
try {
    await promiser({
        type: "exec",
        dbId: "db-1",
        args: {
            sql: "INVALID SQL",
        },
    });
} catch (error) {
    console.error("SQL Error:", error.message);
}
```

### Complete Example ⚫

```javascript
// main.js
import promiserFactory from "./sqlite3-worker1-promiser.mjs";

async function main() {
    // Initialize worker with promiser
    const promiser = await promiserFactory({
        worker: new Worker("sqlite-worker.js"),
        onready: () => console.log("Worker ready"),
    });

    try {
        // Open OPFS database
        const { dbId } = await promiser({
            type: "open",
            args: {
                filename: "myapp.sqlite3",
                vfs: "opfs",
            },
        });

        // Create schema
        await promiser({
            type: "exec",
            dbId,
            args: {
                sql: `
                    CREATE TABLE IF NOT EXISTS todos (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title TEXT NOT NULL,
                        completed BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `,
            },
        });

        // Insert todo
        await promiser({
            type: "exec",
            dbId,
            args: {
                sql: "INSERT INTO todos (title) VALUES (?)",
                bind: ["Learn SQLite WASM"],
            },
        });

        // Query todos
        const result = await promiser({
            type: "exec",
            dbId,
            args: {
                sql: "SELECT * FROM todos ORDER BY created_at DESC",
                rowMode: "object",
                returnValue: "resultRows",
            },
        });

        console.log("Todos:", result.result.resultRows);

        // Export database
        const exportResult = await promiser({
            type: "export",
            dbId,
        });

        console.log(
            `Exported ${exportResult.result.byteArray.byteLength} bytes`,
        );

        // Close database
        await promiser({
            type: "close",
            dbId,
        });
    } catch (error) {
        console.error("Database error:", error);
    } finally {
        promiser.close(); // Terminate worker
    }
}

main();
```

## Multi-Database Support ⚫

The Worker API supports multiple concurrent database connections using `dbId`:

```javascript
// Open multiple databases
const db1 = await promiser({
    type: "open",
    args: { filename: "users.db" },
});

const db2 = await promiser({
    type: "open",
    args: { filename: "products.db" },
});

// Execute on specific databases
await promiser({
    type: "exec",
    dbId: db1.dbId,
    args: { sql: "SELECT * FROM users" },
});

await promiser({
    type: "exec",
    dbId: db2.dbId,
    args: { sql: "SELECT * FROM products" },
});

// Close both
await promiser({ type: "close", dbId: db1.dbId });
await promiser({ type: "close", dbId: db2.dbId });
```

## Limitations and Considerations ⚫

### 1. Async Nature ⚫

Worker API operations are asynchronous, which complicates:

- **Transactions**: Cannot use traditional BEGIN/COMMIT across messages
- **Nested Queries**: Cannot iterate over one result while executing another query
- **Prepared Statements**: Cannot maintain statement state across messages

**Solution for Transactions**:

```javascript
// Execute entire transaction in single message
await promiser({
    type: "exec",
    dbId,
    args: {
        sql: `
            BEGIN TRANSACTION;
            INSERT INTO users (name) VALUES ('Alice');
            INSERT INTO users (name) VALUES ('Bob');
            COMMIT;
        `,
    },
});
```

### 2. Data Transfer Overhead ⚫

Large result sets incur message passing overhead. Consider:

- Limiting result sizes with `LIMIT`
- Filtering on the worker side
- Using pagination

```javascript
// Bad: Transfer all rows
const all = await promiser({
    type: "exec",
    dbId,
    args: {
        sql: "SELECT * FROM large_table",
        returnValue: "resultRows",
    },
});

// Good: Paginate
const page = await promiser({
    type: "exec",
    dbId,
    args: {
        sql: "SELECT * FROM large_table LIMIT ? OFFSET ?",
        bind: [100, 0],
        returnValue: "resultRows",
    },
});
```

### 3. No Direct Statement Access ⚫

Cannot access `Stmt` objects directly. All operations must be message-based.

### 4. Serialization Constraints ⚫

Message data must be serializable (no functions, circular references, etc.).

## Browser Compatibility ⚫

**Required Features**:

- Web Workers support (all modern browsers)
- Structured cloning for message passing
- OPFS support for persistent storage (Chrome 86+, Firefox 111+, Safari 15.4+)

**Check for Worker Support**:

```javascript
if (typeof Worker === "undefined") {
    console.error("Web Workers not supported");
} else {
    // Initialize worker API
}
```

## Performance Considerations ⚫

### When to Use Worker API ⚫

**Use Worker API when**:

- Running computationally expensive queries
- Working with large datasets
- Building responsive UIs that can't afford main thread blocking
- Implementing real-time applications

**Use OO1 API (main thread) when**:

- Simple, quick queries
- Need synchronous API
- Building Node.js applications
- Working with small databases

### Optimization Tips ⚫

1. **Batch Operations**:

```javascript
// Bad: Multiple messages
for (const user of users) {
    await promiser({
        type: "exec",
        dbId,
        args: {
            sql: "INSERT INTO users (name) VALUES (?)",
            bind: [user.name],
        },
    });
}

// Good: Single message with transaction
await promiser({
    type: "exec",
    dbId,
    args: {
        sql: `
            BEGIN TRANSACTION;
            ${users.map((u) => `INSERT INTO users (name) VALUES ('${u.name}');`).join("\n")}
            COMMIT;
        `,
    },
});
```

2. **Minimize Round Trips**:

```javascript
// Combine multiple operations in one SQL string
await promiser({
    type: "exec",
    dbId,
    args: {
        sql: `
            CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT);
            CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
            INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie');
        `,
    },
});
```

3. **Use Appropriate Row Modes**:

```javascript
// Array mode is faster for large result sets
const arrayResults = await promiser({
    type: "exec",
    dbId,
    args: {
        sql: "SELECT * FROM large_table",
        rowMode: "array", // Faster than 'object'
        returnValue: "resultRows",
    },
});
```

## TypeScript Type Definitions ⚫

```typescript
declare namespace sqlite3 {
    function initWorker1API(): void;

    function sqlite3Worker1Promiser(config: {
        worker?: Worker | string;
        onready?: (promiser: Promiser) => void;
        onunhandled?: (event: MessageEvent) => void;
        onerror?: (error: Error) => void;
        debug?: boolean;
    }): Promise<Promiser>;

    interface Promiser {
        (message: WorkerMessage): Promise<WorkerResponse>;
        close(): void;
    }

    interface WorkerMessage {
        type: string;
        messageId?: string | number;
        dbId?: string;
        args?: any;
    }

    interface WorkerResponse {
        type: string;
        messageId?: string | number;
        dbId?: string;
        result?: any;
    }

    interface WorkerError {
        type: "error";
        operation?: string;
        messageId?: string | number;
        message: string;
        errorClass?: string;
    }
}
```

## See Also ⚫

- [OO1 API Documentation](./oo1-api.md) - Main thread object-oriented API
- [C-Style API Documentation](./c-style-api.md) - Low-level C bindings
- [WASM Utilities Documentation](./wasm-utilities.md) - Memory management utilities
- [Web Workers MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
