# Worker API Documentation

The Worker API enables running SQLite operations in a dedicated Web Worker thread, keeping database operations off the main thread to maintain UI responsiveness. This is particularly useful for computationally intensive queries or when working with large datasets.

## Overview

SQLite WASM provides two Worker API variants:

1. **Worker1 API** - Low-level message-based interface
2. **Promiser API** - Promise-based wrapper around Worker1 for easier use

The Worker API is accessed via `sqlite3.initWorker1API()` and operates through message passing between the main thread and worker thread.

## Architecture

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

## Worker1 API (Message-Based)

### Initialization

```typescript
/**
 * Initialize Worker1 API
 * Must be called once in the worker thread
 */
function initWorker1API(): void;
```

**Worker Script Example** (`sqlite-worker.js`):

```javascript
importScripts('sqlite3.js');

sqlite3InitModule().then((sqlite3) => {
    sqlite3.initWorker1API();
    // Worker is now ready to receive messages
});
```

**Main Thread Setup**:

```javascript
const worker = new Worker('sqlite-worker.js');

worker.onmessage = function(event) {
    const message = event.data;
    console.log('Received from worker:', message);
};

worker.postMessage({
    type: 'open',
    args: { filename: ':memory:' }
});
```

### Message Types

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

### Supported Operations

#### open

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
    filename: string;
    vfs: string;
}
```

**Usage Example**:

```javascript
worker.postMessage({
    type: 'open',
    messageId: 'open-1',
    args: {
        filename: 'mydb.sqlite3',
        vfs: 'opfs'
    }
});

// Response:
// {
//   type: 'open',
//   messageId: 'open-1',
//   dbId: 'db-1',
//   filename: 'mydb.sqlite3',
//   vfs: 'opfs'
// }
```

#### close

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
    filename: string;
}
```

**Usage Example**:

```javascript
worker.postMessage({
    type: 'close',
    messageId: 'close-1',
    dbId: 'db-1',
    args: { unlink: false }
});
```

#### exec

Execute SQL statements.

```typescript
interface ExecMessage {
    type: "exec";
    messageId?: string | number;
    dbId?: string;
    args: {
        /**
         * SQL statement(s) to execute
         */
        sql: string;

        /**
         * Bind parameters (array or object)
         */
        bind?: any[] | Record<string, any>;

        /**
         * Row mode: "array", "object", or "stmt"
         */
        rowMode?: "array" | "object" | "stmt";

        /**
         * Return result rows
         */
        returnValue?: "resultRows";

        /**
         * Save column names in result
         */
        columnNames?: string[];
    };
}

interface ExecResponse {
    type: "exec";
    messageId?: string | number;
    dbId: string;
    result: {
        /**
         * Array of result rows (if returnValue: "resultRows")
         */
        resultRows?: any[];

        /**
         * Column names (if requested)
         */
        columnNames?: string[];
    };
}
```

**Usage Examples**:

```javascript
// Simple execution
worker.postMessage({
    type: 'exec',
    messageId: 'exec-1',
    dbId: 'db-1',
    args: {
        sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)'
    }
});

// Insert with bind parameters
worker.postMessage({
    type: 'exec',
    messageId: 'exec-2',
    dbId: 'db-1',
    args: {
        sql: 'INSERT INTO users (name) VALUES (?)',
        bind: ['Alice']
    }
});

// Query with results
worker.postMessage({
    type: 'exec',
    messageId: 'exec-3',
    dbId: 'db-1',
    args: {
        sql: 'SELECT * FROM users',
        rowMode: 'object',
        returnValue: 'resultRows'
    }
});

// Response:
// {
//   type: 'exec',
//   messageId: 'exec-3',
//   dbId: 'db-1',
//   result: {
//     resultRows: [
//       { id: 1, name: 'Alice' }
//     ]
//   }
// }
```

#### export

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
    type: 'export',
    messageId: 'export-1',
    dbId: 'db-1'
});

// Response includes Uint8Array of database
```

#### config-get

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
    type: 'config-get',
    messageId: 'config-1'
});
```

### Error Handling

Errors are returned as special error messages:

```javascript
worker.onmessage = function(event) {
    const msg = event.data;

    if (msg.type === 'error') {
        console.error(`Error in ${msg.operation}: ${msg.message}`);
        return;
    }

    // Handle normal responses
    switch (msg.type) {
        case 'open':
            console.log('Database opened:', msg.dbId);
            break;
        case 'exec':
            console.log('Query result:', msg.result);
            break;
    }
};
```

## Promiser API (Promise-Based)

The Promiser API wraps the message-based Worker1 API with Promises for easier asynchronous programming.

### Initialization

```typescript
/**
 * Initialize SQLite Worker with Promiser API
 * @param config - Configuration object
 * @returns Promise that resolves to promiser instance
 */
function sqlite3Worker1Promiser(config: {
    /**
     * Worker instance or path to worker script
     */
    worker?: Worker | string;

    /**
     * Callback when worker is ready
     */
    onready?: (promiser: Promiser) => void;

    /**
     * Callback for unhandled messages
     */
    onunhandled?: (event: MessageEvent) => void;

    /**
     * Callback for errors
     */
    onerror?: (error: Error) => void;

    /**
     * Debug mode
     */
    debug?: boolean;
}): Promise<Promiser>;

interface Promiser {
    /**
     * Send message and wait for response
     */
    (message: WorkerMessage): Promise<WorkerResponse>;

    /**
     * Close worker and cleanup
     */
    close(): void;
}
```

**Usage Example**:

```javascript
// Initialize
const promiser = await sqlite3Worker1Promiser({
    worker: new Worker('sqlite-worker.js'),
    debug: true
});

// Open database
const openResult = await promiser({
    type: 'open',
    args: { filename: ':memory:' }
});
console.log('Opened database:', openResult.dbId);

// Create table
await promiser({
    type: 'exec',
    dbId: openResult.dbId,
    args: {
        sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)'
    }
});

// Insert data
await promiser({
    type: 'exec',
    dbId: openResult.dbId,
    args: {
        sql: 'INSERT INTO users (name) VALUES (?)',
        bind: ['Alice']
    }
});

// Query data
const queryResult = await promiser({
    type: 'exec',
    dbId: openResult.dbId,
    args: {
        sql: 'SELECT * FROM users',
        rowMode: 'object',
        returnValue: 'resultRows'
    }
});
console.log('Users:', queryResult.result.resultRows);

// Close database
await promiser({
    type: 'close',
    dbId: openResult.dbId
});
```

### Error Handling with Promiser

```javascript
try {
    await promiser({
        type: 'exec',
        dbId: 'db-1',
        args: {
            sql: 'INVALID SQL'
        }
    });
} catch (error) {
    console.error('SQL Error:', error.message);
}
```

### Complete Example

```javascript
// main.js
import sqlite3Worker1Promiser from './sqlite3-worker1-promiser.mjs';

async function main() {
    // Initialize worker with promiser
    const promiser = await sqlite3Worker1Promiser({
        worker: new Worker('sqlite-worker.js'),
        onready: () => console.log('Worker ready')
    });

    try {
        // Open OPFS database
        const { dbId } = await promiser({
            type: 'open',
            args: {
                filename: 'myapp.sqlite3',
                vfs: 'opfs'
            }
        });

        // Create schema
        await promiser({
            type: 'exec',
            dbId,
            args: {
                sql: `
                    CREATE TABLE IF NOT EXISTS todos (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title TEXT NOT NULL,
                        completed BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `
            }
        });

        // Insert todo
        await promiser({
            type: 'exec',
            dbId,
            args: {
                sql: 'INSERT INTO todos (title) VALUES (?)',
                bind: ['Learn SQLite WASM']
            }
        });

        // Query todos
        const result = await promiser({
            type: 'exec',
            dbId,
            args: {
                sql: 'SELECT * FROM todos ORDER BY created_at DESC',
                rowMode: 'object',
                returnValue: 'resultRows'
            }
        });

        console.log('Todos:', result.result.resultRows);

        // Export database
        const exportResult = await promiser({
            type: 'export',
            dbId
        });

        console.log(`Exported ${exportResult.result.byteArray.byteLength} bytes`);

        // Close database
        await promiser({
            type: 'close',
            dbId
        });

    } catch (error) {
        console.error('Database error:', error);
    } finally {
        promiser.close(); // Terminate worker
    }
}

main();
```

## Multi-Database Support

The Worker API supports multiple concurrent database connections using `dbId`:

```javascript
// Open multiple databases
const db1 = await promiser({
    type: 'open',
    args: { filename: 'users.db' }
});

const db2 = await promiser({
    type: 'open',
    args: { filename: 'products.db' }
});

// Execute on specific databases
await promiser({
    type: 'exec',
    dbId: db1.dbId,
    args: { sql: 'SELECT * FROM users' }
});

await promiser({
    type: 'exec',
    dbId: db2.dbId,
    args: { sql: 'SELECT * FROM products' }
});

// Close both
await promiser({ type: 'close', dbId: db1.dbId });
await promiser({ type: 'close', dbId: db2.dbId });
```

## Limitations and Considerations

### 1. Async Nature

Worker API operations are asynchronous, which complicates:

- **Transactions**: Cannot use traditional BEGIN/COMMIT across messages
- **Nested Queries**: Cannot iterate over one result while executing another query
- **Prepared Statements**: Cannot maintain statement state across messages

**Solution for Transactions**:

```javascript
// Execute entire transaction in single message
await promiser({
    type: 'exec',
    dbId,
    args: {
        sql: `
            BEGIN TRANSACTION;
            INSERT INTO users (name) VALUES ('Alice');
            INSERT INTO users (name) VALUES ('Bob');
            COMMIT;
        `
    }
});
```

### 2. Data Transfer Overhead

Large result sets incur message passing overhead. Consider:

- Limiting result sizes with `LIMIT`
- Filtering on the worker side
- Using pagination

```javascript
// Bad: Transfer all rows
const all = await promiser({
    type: 'exec',
    dbId,
    args: {
        sql: 'SELECT * FROM large_table',
        returnValue: 'resultRows'
    }
});

// Good: Paginate
const page = await promiser({
    type: 'exec',
    dbId,
    args: {
        sql: 'SELECT * FROM large_table LIMIT ? OFFSET ?',
        bind: [100, 0],
        returnValue: 'resultRows'
    }
});
```

### 3. No Direct Statement Access

Cannot access `Stmt` objects directly. All operations must be message-based.

### 4. Serialization Constraints

Message data must be serializable (no functions, circular references, etc.).

## Browser Compatibility

**Required Features**:
- Web Workers support (all modern browsers)
- Structured cloning for message passing
- OPFS support for persistent storage (Chrome 86+, Firefox 111+, Safari 15.4+)

**Check for Worker Support**:

```javascript
if (typeof Worker === 'undefined') {
    console.error('Web Workers not supported');
} else {
    // Initialize worker API
}
```

## Performance Considerations

### When to Use Worker API

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

### Optimization Tips

1. **Batch Operations**:
```javascript
// Bad: Multiple messages
for (const user of users) {
    await promiser({
        type: 'exec',
        dbId,
        args: {
            sql: 'INSERT INTO users (name) VALUES (?)',
            bind: [user.name]
        }
    });
}

// Good: Single message with transaction
await promiser({
    type: 'exec',
    dbId,
    args: {
        sql: `
            BEGIN TRANSACTION;
            ${users.map(u => `INSERT INTO users (name) VALUES ('${u.name}');`).join('\n')}
            COMMIT;
        `
    }
});
```

2. **Minimize Round Trips**:
```javascript
// Combine multiple operations in one SQL string
await promiser({
    type: 'exec',
    dbId,
    args: {
        sql: `
            CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT);
            CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
            INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie');
        `
    }
});
```

3. **Use Appropriate Row Modes**:
```javascript
// Array mode is faster for large result sets
const arrayResults = await promiser({
    type: 'exec',
    dbId,
    args: {
        sql: 'SELECT * FROM large_table',
        rowMode: 'array', // Faster than 'object'
        returnValue: 'resultRows'
    }
});
```

## TypeScript Type Definitions

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

## See Also

- [OO1 API Documentation](./oo1-api.md) - Main thread object-oriented API
- [C-Style API Documentation](./c-style-api.md) - Low-level C bindings
- [WASM Utilities Documentation](./wasm-utilities.md) - Memory management utilities
- [Web Workers MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
