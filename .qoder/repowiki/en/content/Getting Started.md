# Getting Started

<cite>
**Referenced Files in This Document**   
- [package.json](file://package.json)
- [src/index.ts](file://src/index.ts)
- [src/sqliteWorker.ts](file://src/sqliteWorker.ts)
- [src/sqliteWorker.d.ts](file://src/sqliteWorker.d.ts)
- [vite.config.ts](file://vite.config.ts)
- [src/jswasm/vfs/opfs/installer/core/environment-validation.mjs](file://src/jswasm/vfs/opfs/installer/core/environment-validation.mjs)
- [scripts/http-server.ts](file://scripts/http-server.ts)
- [tests/e2e/crud-operations.e2e.test.ts](file://tests/e2e/crud-operations.e2e.test.ts)
- [tests/e2e/error-handling.e2e.test.ts](file://tests/e2e/error-handling.e2e.test.ts)
- [tests/e2e/environment.e2e.test.ts](file://tests/e2e/environment.e2e.test.ts)
- [src/jswasm/sqlite3.mjs](file://src/jswasm/sqlite3.mjs)
- [src/jswasm/runtime/environment-detector.mjs](file://src/jswasm/runtime/environment-detector.mjs)
- [src/jswasm/utils/wasm-loader/wasm-loader.ts](file://src/jswasm/utils/wasm-loader/wasm-loader.ts)
</cite>

## Table of Contents
1. [Installation](#installation)
2. [Browser Environment Requirements](#browser-environment-requirements)
3. [Initialization and Database Opening](#initialization-and-database-opening)
4. [Basic Database Operations](#basic-database-operations)
5. [Configuration in Vite](#configuration-in-vite)
6. [Common Setup Issues](#common-setup-issues)
7. [Event Handling and Monitoring](#event-handling-and-monitoring)
8. [Complete Working Example](#complete-working-example)

## Installation

To install web-sqlite-v2 using npm or pnpm, execute the following command in your project directory:

```bash
npm install @wuchuheng/web-sqlite
```

or

```bash
pnpm add @wuchuheng/web-sqlite
```

The package is configured as an ES module with the entry point defined in package.json under the "main" field pointing to ./src/jswasm/sqlite3.mjs. The package exports are properly defined to support modern JavaScript module resolution.

**Section sources**
- [package.json](file://package.json#L1-L62)

## Browser Environment Requirements

web-sqlite-v2 requires specific browser capabilities to function properly, particularly when using the OPFS (Origin Private File System) backend. The following requirements must be met:

1. **OPFS APIs**: The browser must support FileSystemHandle, FileSystemDirectoryHandle, FileSystemFileHandle, and the createSyncAccessHandle method.
2. **SharedArrayBuffer**: This is required for thread-safe operations and is only available when proper security headers are served.
3. **Worker Environment**: The OPFS VFS cannot run in the main thread as it requires Atomics.wait().

The environment validation is performed in the environment-validation.mjs file, which checks for these capabilities and provides descriptive error messages when requirements are not met.

**Section sources**
- [src/jswasm/vfs/opfs/installer/core/environment-validation.mjs](file://src/jswasm/vfs/opfs/installer/core/environment-validation.mjs#L1-L52)

## Initialization and Database Opening

The main entry point for web-sqlite-v2 is the `open()` function exported from the package. This function initializes a SQLite database connection and returns a Promise that resolves to a SqliteWorkerI instance.

```typescript
import open from '@wuchuheng/web-sqlite';

const db = await open('my-database.db');
```

The `open()` function creates a Web Worker to handle database operations, ensuring that database operations do not block the main thread. The database name is passed as a parameter and is used to create or connect to a database file in the OPFS storage.

Internally, the worker uses a message-passing system to communicate between the main thread and the worker thread. The worker handles three primary actions: Open, Close, and Sql, each identified by numeric codes.

**Section sources**
- [src/index.ts](file://src/index.ts#L1-L92)
- [src/sqliteWorker.ts](file://src/sqliteWorker.ts#L1-L243)

## Basic Database Operations

Once a database connection is established, you can perform various SQL operations using the Promise-based API.

### Creating Tables and Inserting Data

```typescript
// Create a table and insert data
await db.sql(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    email TEXT
  );
  INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com');
  INSERT INTO users (name, email) VALUES ('Jane Smith', 'jane@example.com');
`);
```

### Querying Records

```typescript
// Query data with type safety
const users = await db.sql<{ id: number; name: string; email: string }>(
  'SELECT id, name, email FROM users'
);
console.log(users);
```

The `sql()` method executes SQL statements and returns a Promise that resolves to an array of result rows. For SELECT statements, the rows are returned as objects with properties corresponding to the column names.

### Transaction Management

For operations that need to be executed as a single atomic unit, use the `transaction()` method:

```typescript
await db.transaction(async (tx) => {
  await tx.sql("INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')");
  await tx.sql("INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com')");
  // If an error occurs, the transaction will be automatically rolled back
});
```

**Section sources**
- [src/sqliteWorker.d.ts](file://src/sqliteWorker.d.ts#L1-L115)
- [tests/e2e/crud-operations.e2e.test.ts](file://tests/e2e/crud-operations.e2e.test.ts#L1-L143)

## Configuration in Vite

The project is configured to work with Vite, as shown in the vite.config.ts file. The configuration sets up the library build process with the following key settings:

- Entry point: src/index.ts
- Output format: ES modules
- Output directory: dist
- Sourcemap generation enabled
- Type declaration files generated alongside the bundle using vite-plugin-dts

The configuration ensures that the package is properly bundled as an ES module with type definitions, making it easy to import and use in modern JavaScript applications.

**Section sources**
- [vite.config.ts](file://vite.config.ts#L1-L36)

## Common Setup Issues

### CORS and Security Headers

When using SharedArrayBuffer, browsers require specific security headers to be served by the web server. These headers are:

- Cross-Origin-Embedder-Policy: require-corp
- Cross-Origin-Opener-Policy: same-origin

The project includes an HTTP server script (http-server.ts) that automatically sets these headers, enabling SharedArrayBuffer support for local development.

### Worker Instantiation Errors

Worker instantiation may fail if the server does not properly serve the worker script or if there are CORS issues. Ensure that your development server is configured to serve the necessary files with appropriate headers.

### Environment Detection

The runtime environment detection in environment-detector.mjs identifies whether the code is running in a web browser, web worker, or other environment. This detection is crucial for determining the appropriate file loading strategy and script directory resolution.

**Section sources**
- [scripts/http-server.ts](file://scripts/http-server.ts#L151-L285)
- [src/jswasm/runtime/environment-detector.mjs](file://src/jswasm/runtime/environment-detector.mjs#L1-L81)
- [src/jswasm/utils/wasm-loader/wasm-loader.ts](file://src/jswasm/utils/wasm-loader/wasm-loader.ts#L126-L168)

## Event Handling and Monitoring

The database adapter supports event handling for logging and error monitoring. You can subscribe to various events using the `on()` method:

```typescript
// Log diagnostic messages
db.on("log", (msg) => console.log("[db]", msg));

// Handle errors
db.on("error", (err) => console.error("DB error:", err));

// Listen for lifecycle events
db.on("open", () => console.log("Database opened"));
db.on("close", () => console.log("Database closed"));
db.on("ready", () => console.log("Database adapter ready"));
```

These events provide visibility into the database operations and can be invaluable for debugging and monitoring application behavior.

**Section sources**
- [src/sqliteWorker.d.ts](file://src/sqliteWorker.d.ts#L70-L86)

## Complete Working Example

The following example demonstrates a complete implementation of web-sqlite-v2 in a web application:

```typescript
import open from '@wuchuheng/web-sqlite';

async function initializeDatabase() {
  try {
    // Open database connection
    const db = await open('example.db');
    
    // Set up event handlers
    db.on("log", (msg) => console.log("[db]", msg));
    db.on("error", (err) => console.error("DB error:", err));
    
    // Create table and insert data
    await db.transaction(async (tx) => {
      await tx.sql(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          price REAL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await tx.sql(`
        INSERT INTO products (name, price) VALUES 
        ('Laptop', 999.99),
        ('Mouse', 25.50),
        ('Keyboard', 75.00)
      `);
    });
    
    // Query data
    const products = await db.sql<{ id: number; name: string; price: number }>(
      'SELECT id, name, price FROM products ORDER BY name'
    );
    
    console.log('Products:', products);
    
    // Clean up
    await db.close();
    
  } catch (error) {
    console.error('Database operation failed:', error);
  }
}

// Run the example
initializeDatabase();
```

This example demonstrates the complete workflow: opening a database, setting up event handlers, creating a table within a transaction, inserting data, querying records, and properly closing the connection.

**Section sources**
- [src/index.ts](file://src/index.ts#L64-L87)
- [src/sqliteWorker.ts](file://src/sqliteWorker.ts#L68-L243)
- [tests/e2e/crud-operations.e2e.test.ts](file://tests/e2e/crud-operations.e2e.test.ts#L1-L143)
- [tests/e2e/error-handling.e2e.test.ts](file://tests/e2e/error-handling.e2e.test.ts#L1-L51)
- [tests/e2e/environment.e2e.test.ts](file://tests/e2e/environment.e2e.test.ts#L1-L43)