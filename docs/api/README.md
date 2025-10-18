# SQLite WASM API Documentation

This comprehensive API documentation provides detailed information about SQLite WASM APIs, organized for TypeScript development. The documentation is based on the official SQLite WASM documentation and provides type definitions, usage patterns, and examples for each API.

## Overview

SQLite WASM provides multiple API layers:

1. **[C-Style API](./c-style-api.md)** - Low-level bindings that mirror the native SQLite C API
2. **[Object-Oriented API (OO1)](./oo1-api.md)** - High-level JavaScript-friendly interface
3. **[Worker API](./worker-api.md)** - For running SQLite in dedicated web workers
4. **[WASM Utilities](./wasm-utilities.md)** - Memory management and JS/WASM bridging utilities

## API Hierarchy

```
sqlite3
├── capi (C-Style API)
│   ├── sqlite3_open()
│   ├── sqlite3_exec()
│   ├── sqlite3_prepare_v3()
│   └── ... (hundreds of C functions)
├── oo1 (Object-Oriented API)
│   ├── DB class
│   ├── Stmt class
│   ├── JsStorageDb class
│   └── OpfsDb class
├── wasm (WASM Utilities)
│   ├── alloc()
│   ├── dealloc()
│   ├── peek() / poke()
│   └── ... (memory and type conversion utilities)
└── worker1 (Worker API)
    ├── open
    ├── exec
    ├── close
    └── ... (message-based operations)
```

## Quick Start

### Basic Database Operations

```typescript
// Object-Oriented API (Recommended)
import { sqlite3 } from "./sqlite3.js";

const db = new sqlite3.oo1.DB(":memory:");

// Create table and insert data
db.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
  INSERT INTO users (name) VALUES ('Alice'), ('Bob');
`);

// Query data
const users = db.selectArrays("SELECT * FROM users");
console.log(users); // [[1, 'Alice'], [2, 'Bob']]

db.close();
```

### Using Prepared Statements

```typescript
const db = new sqlite3.oo1.DB(":memory:");
const stmt = db.prepare("INSERT INTO users (name) VALUES (?)");

try {
    stmt.bind("Charlie").stepFinalize();
    // stmt is automatically finalized
} catch (error) {
    stmt.finalize(); // Clean up on error
}

db.close();
```

## Type Safety Considerations

When converting to TypeScript, pay special attention to:

1. **Pointer Types** - WASM pointers are numbers (or BigInt in 64-bit builds)
2. **Memory Management** - Manual allocation/deallocation required
3. **Type Conversions** - Between JS types and SQLite types
4. **Error Handling** - Exceptions vs return codes depending on API level

## API Stability

-   **C-Style API**: Has the same strong stability guarantees as SQLite C API
-   **OO1 API**: Stable interface with potential extensions
-   **Worker API**: Stable message format
-   **WASM Utilities**: Internal APIs may change; use documented interfaces only

## Documentation Structure

Each API documentation includes:

-   **Interface Definitions** - TypeScript interfaces and type definitions
-   **Method Signatures** - Complete function signatures with parameter types
-   **Usage Examples** - Practical code examples
-   **Type Conversions** - How data flows between JS and SQLite
-   **Error Handling** - Exception types and error patterns
-   **Memory Management** - Allocation and cleanup requirements

## Resources

-   [Official SQLite WASM Documentation](https://sqlite.org/wasm/doc/trunk/api-index.md)
-   [Building SQLite WASM](https://sqlite.org/wasm/doc/trunk/building.md)
-   [Performance Tips](./performance.md)
-   [Migration Guide JS to TS](./migration-guide.md)

## Contributing

When updating this documentation:

1. Follow the established format and structure
2. Include TypeScript type definitions
3. Provide practical examples
4. Document breaking changes clearly
5. Update cross-references between documents
