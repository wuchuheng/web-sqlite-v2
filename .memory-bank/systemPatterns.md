# System Patterns: Web SQLite V2

## Architectural Overview

Web SQLite V2 follows a layered modular architecture that separates concerns while maintaining clear dependencies between components.

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  (User applications, worker scripts, browser extensions)   │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                             │
│  OO1 API │ C-Style API │ Worker API │ WASM Utilities      │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                    Runtime Layer                            │
│  Environment Detection │ Lifecycle Management │ Memory Mgmt  │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                    System Layer                            │
│  Syscalls │ WASI Functions │ TTY Operations │ File System   │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                   VFS Layer                                │
│  OPFS │ Memory FS │ Async Proxy │ Sector-Aligned Pool     │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                 WebAssembly Layer                          │
│              SQLite3 WASM Module                           │
└─────────────────────────────────────────────────────────────┘
```

## Core Design Patterns

### 1. Module Factory Pattern

**Location**: `src/jswasm/utils/` directory

**Purpose**: Create focused utility modules with consistent initialization patterns.

**Implementation**:

```typescript
// Example from wasm-loader
export function createWasmLoader(config) {
    // 1. Initialize configuration
    const { Module, wasmBinary, locateFile } = config;

    // 2. Setup loading utilities
    const loadWasm = async () => {
        /* ... */
    };

    // 3. Return public interface
    return { createWasm: loadWasm };
}
```

**Benefits**:

- Consistent initialization across all utility modules
- Clear separation of configuration and implementation
- Easy testing through dependency injection
- Reusable patterns across different subsystems

### 2. Lifecycle Management Pattern

**Location**: `src/jswasm/runtime/lifecycle-manager.mjs`

**Purpose**: Coordinate initialization and cleanup across multiple subsystems.

**Implementation**:

```javascript
export function createLifecycleManager(Module, ...subsystems) {
    const dependencies = new Set();

    return {
        addOnInit: (callback) => {
            /* ... */
        },
        addRunDependency: (name) => dependencies.add(name),
        removeRunDependency: (name) => dependencies.delete(name),
        setDependenciesFulfilled: (callback) => {
            /* ... */
        },
    };
}
```

**Benefits**:

- Prevents race conditions during initialization
- Ensures proper cleanup on module unload
- Provides clear visibility into initialization state
- Supports complex dependency graphs

### 3. Memory Management Pattern

**Location**: `src/jswasm/runtime/memory-manager.mjs`

**Purpose**: Centralize WebAssembly memory operations and provide safe access patterns.

**Implementation**:

```javascript
export function createMemoryManager(wasmMemory, Module) {
    const { buffer } = wasmMemory;

    return {
        HEAP8: new Int8Array(buffer),
        HEAPU8: new Uint8Array(buffer),
        HEAP16: new Int16Array(buffer),
        HEAP32: new Int32Array(buffer),
        createResizeHeapFunction: () => {
            /* ... */
        },
    };
}
```

**Benefits**:

- Type-safe memory access
- Centralized heap management
- Automatic bounds checking
- Consistent memory view across the application

### 4. VFS Abstraction Pattern

**Location**: `src/jswasm/vfs/` directory

**Purpose**: Provide consistent filesystem interface across different storage backends.

**Implementation**:

```javascript
export function createFileSystem(config) {
    const {
        FS_createPreloadedFile,
        FS_createDataFile,
        FS_modeStringToFlags,
        FS_getMode,
        Module,
        out,
        err,
    } = config;

    return {
        FS: {
            /* Emscripten FS API */
        },
        PATH_FS: {
            /* Path operations */
        },
    };
}
```

**Benefits**:

- Pluggable storage backends
- Consistent API across different filesystems
- Easy testing through mock implementations
- Support for both synchronous and async operations

### 5. Worker Communication Pattern

**Location**: `src/jswasm/wasm/bootstrap/` and `tests/src/worker.ts`

**Purpose**: Enable safe database operations across different execution contexts.

**Implementation**:

```javascript
// Worker setup
const workerApi = {
    openDatabase: async (config) => {
        /* ... */
    },
    executeSql: async (dbId, sql, params) => {
        /* ... */
    },
    closeDatabase: async (dbId) => {
        /* ... */
    },
};

// Message handling
self.onmessage = async (event) => {
    const { type, payload, requestId } = event.data;
    try {
        const result = await workerApi[type](payload);
        self.postMessage({ type: "success", requestId, result });
    } catch (error) {
        self.postMessage({ type: "error", requestId, error });
    }
};
```

**Benefits**:

- Type-safe cross-context communication
- Proper error handling and propagation
- Request/response correlation
- Support for streaming operations

## Data Flow Patterns

### 1. Initialization Flow

```
sqlite3InitModule()
    ↓
Environment Detection
    ↓
Module Configuration
    ↓
Memory Setup
    ↓
Filesystem Initialization
    ↓
WASM Loading
    ↓
SQLite Export Attachment
    ↓
Post-Load Bootstrap
```

### 2. Query Execution Flow

```
Application Query
    ↓
API Layer (OO1/C-Style)
    ↓
SQLite WASM Interface
    ↓
VFS Layer (OPFS/Memory)
    ↓
WebAssembly Memory Operations
    ↓
Browser Storage APIs
```

### 3. Worker Communication Flow

```
Main Thread Request
    ↓
Message Serialization
    ↓
Worker Thread Reception
    ↓
Database Operation
    ↓
Result Serialization
    ↓
Main Thread Response
```

## Integration Patterns

### 1. OPFS Integration

**Sector-Aligned Heap Pool**:

- Pre-allocated 64KB sectors for optimal performance
- Automatic garbage collection of unused sectors
- Cross-context synchronization support

**Async Proxy Pattern**:

- Synchronous API in main thread
- Asynchronous operations in worker
- Transparent error propagation

### 2. TypeScript Integration

**Gradual Migration**:

- Maintain .mjs files for ESM compatibility
- .ts files provide enhanced developer experience
- Dual compilation strategy for backward compatibility

**Type Safety Patterns**:

- Comprehensive .d.ts files for all public APIs
- Runtime type checking for critical operations
- Generic types for flexible database operations

## Error Handling Patterns

### 1. Hierarchical Error Types

```typescript
class SQLiteError extends Error {
    constructor(
        message: string,
        public code: number,
    ) {
        super(message);
        this.name = "SQLiteError";
    }
}

class OPFSError extends SQLiteError {
    constructor(
        message: string,
        public operation: string,
    ) {
        super(message, OPFS_ERROR_CODE);
        this.name = "OPFSError";
    }
}
```

### 2. Promise-Based Error Propagation

```javascript
async function executeQuery(sql, params) {
    try {
        const statement = await prepareStatement(sql);
        return await statement.execute(params);
    } catch (error) {
        // Add context and rethrow
        error.query = sql;
        error.params = params;
        throw error;
    }
}
```

## Performance Patterns

### 1. Memory Pool Management

- Pre-allocated memory blocks for common operations
- Reference counting for automatic cleanup
- Lazy initialization for expensive resources

### 2. Query Optimization

- Statement caching for repeated queries
- Batch operation support for bulk inserts
- Index-aware query planning hints

### 3. Asynchronous Operations

- Non-blocking file I/O through OPFS
- Parallel query execution in workers
- Streaming result sets for large datasets
