# System Patterns: Web SQLite V2

## Architecture Overview

Web SQLite V2 follows a **layered modular architecture** that separates concerns while maintaining clear interfaces between components. The design prioritizes maintainability, testability, and incremental development.

### Core Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                       │
│              (User Code / Libraries)                       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     API Layer                             │
│         (OO1 API / C-Style API / Worker API)              │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Runtime Layer                            │
│       (Lifecycle / Memory / Environment Detection)        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                System Interface Layer                     │
│         (System Calls / WASI Functions / TTY)            │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                File System Layer                          │
│           (MEMFS / OPFS / VFS Installers)                │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│              WebAssembly Integration Layer                  │
│          (SQLite WASM / Emscripten Glue)                │
└─────────────────────────────────────────────────────────────┘
```

## Module Organization Patterns

### High Cohesion Principles

Each module has a single, well-defined responsibility:

**Core Modules (`src/jswasm/`)**

- `sqlite3.mjs` - Main entry point and Emscripten integration
- `sqlite3Apibootstrap.mjs` - API initialization and bootstrap
- `wasm/` - WebAssembly-specific integrations
- `runtime/` - Runtime lifecycle and management
- `system/` - System call implementations
- `vfs/` - Virtual File System implementations
- `utils/` - Reusable utilities and helpers
- `api/` - High-level API implementations

**Utility Modules (`utils/`)**

- `path.mjs` - Path manipulation and normalization
- `utf8/` - UTF-8 string encoding/decoding
- `memory-utils.mjs` - WebAssembly memory management
- `wasm-loader/` - **NEWLY MIGRATED** - WebAssembly loading utilities with comprehensive TypeScript interfaces
- `async-utils.mjs` - Async operation helpers

**System Modules (`system/`)**

- `syscalls.mjs` - POSIX system call implementations
- `wasi-functions.mjs` - WASI function implementations
- `file-syscalls.mjs` - File-specific system calls
- `stat-syscalls.mjs` - File status operations
- `ioctl-syscalls.mjs` - I/O control operations
- `tty-operations.mjs` - Terminal operations

### Low Coupling Strategies

**Clear Interface Boundaries**

- Well-defined import/export contracts
- Minimal dependencies between modules
- Dependency injection for complex interactions
- Event-driven communication between layers

**Modular Dependencies**

```typescript
// Leaf utilities have no dependencies
import { UTF8ArrayToString } from "../utils/utf8.js";

// System modules depend only on utilities
import { handleError } from "../utils/error-handling.js";
import { validatePath } from "../utils/path.js";

// High-level modules depend on system and utilities
import { initializeFileSystem } from "../vfs/filesystem.js";
import { configureRuntime } from "../runtime/module-configurator.js";
```

## Key Design Patterns

### 1. Three-Phase Processing Pattern

**Purpose**: Standardize function structure for readability and maintainability

**Implementation**:

```typescript
export function processDatabaseOperation(config: Config): Result {
    // 1. Input validation and preparation
    if (!config || !config.database) {
        throw new Error("Database configuration required");
    }
    const validatedConfig = validateConfig(config);

    // 2. Core processing logic
    const connection = establishConnection(validatedConfig);
    const result = executeOperation(connection, validatedConfig.operation);

    // 3. Output handling
    cleanupConnection(connection);
    return formatResult(result);
}
```

**Benefits**:

- Predictable function structure
- Clear separation of concerns
- Easier debugging and testing
- Consistent error handling

### 2. Module Factory Pattern

**Purpose**: Create and configure module instances with proper initialization

**Implementation**:

```typescript
// Runtime Module Factory
export function createRuntimeManager(config: RuntimeConfig): RuntimeManager {
    // 1. Environment detection
    const environment = detectEnvironment();

    // 2. Module configuration
    const moduleConfig = configureModule(config, environment);

    // 3. Runtime creation
    return new RuntimeManager(moduleConfig, environment);
}

// VFS Installer Factory
export function createVFSInstaller(type: VfsType): VFSInstaller {
    switch (type) {
        case "opfs":
            return new OPFSInstaller();
        case "memfs":
            return new MemFSInstaller();
        default:
            throw new Error(`Unsupported VFS type: ${type}`);
    }
}
```

### 3. Async Proxy Pattern

**Purpose**: Bridge synchronous WebAssembly operations with asynchronous browser APIs

**Implementation**:

```typescript
// OPFS Async Proxy for File Operations
export class OPFSAsyncProxy {
    async readFile(path: string): Promise<Uint8Array> {
        // 1. Input validation
        if (!path) throw new Error("Path required");

        // 2. Async file access
        const fileHandle = await this.getFileHandle(path);
        const file = await fileHandle.getFile();
        return await file.arrayBuffer();
    }

    async writeFile(path: string, data: Uint8Array): Promise<void> {
        // 1. Input validation
        if (!path || !data) throw new Error("Path and data required");

        // 2. Async file writing
        const fileHandle = await this.getFileHandle(path, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();
    }
}
```

### 4. Memory Management Pattern

**Purpose**: Safely manage WebAssembly memory allocation and deallocation

**Implementation**:

```typescript
export class MemoryManager {
    private allocations = new Map<number, AllocationInfo>();

    allocate(size: number): number {
        // 1. Input validation
        if (size <= 0) throw new Error("Invalid allocation size");

        // 2. Memory allocation
        const ptr = this.wasmInstance.exports.malloc(size);
        if (ptr === 0) throw new Error("Memory allocation failed");

        // 3. Tracking
        this.allocations.set(ptr, { size, timestamp: Date.now() });
        return ptr;
    }

    deallocate(ptr: number): void {
        // 1. Validation
        if (!this.allocations.has(ptr)) {
            console.warn(`Attempting to free untracked pointer: ${ptr}`);
            return;
        }

        // 2. Deallocation
        this.wasmInstance.exports.free(ptr);
        this.allocations.delete(ptr);
    }
}
```

### 5. WASM Loader Pattern

**Purpose**: Type-safe WebAssembly module loading with comprehensive error handling and lifecycle management

**Implementation**:

```typescript
export function createWasmLoader(config: WasmLoaderConfig): WasmLoader {
    const {
        Module,
        wasmBinary,
        locateFile,
        readAsync,
        readBinary,
        addRunDependency,
        removeRunDependency,
        readyPromiseReject,
        addOnInit,
        abort,
        err,
        getWasmImports,
        setWasmExports,
    } = config;

    function createWasm(): WebAssembly.Exports | Record<string, never> {
        // 1. Prepare imports and dependency tracking
        const info = getWasmImports();

        // 2. Core instantiation logic
        const receiveInstance = (
            instance: WebAssembly.Instance,
        ): WebAssembly.Exports => {
            const exports = instance.exports;
            addOnInit(exports["__wasm_call_ctors"] as () => void);
            removeRunDependency("wasm-instantiate");
            setWasmExports?.(exports);
            return exports;
        };

        addRunDependency("wasm-instantiate");

        // 3. Handle Module.instantiateWasm hook or fallback
        const wasmHook = Module.instantiateWasm;
        if (wasmHook) {
            try {
                const wasmHookResult = wasmHook(info, receiveInstance);
                if (wasmHookResult) {
                    return wasmHookResult;
                }
                return {};
            } catch (error) {
                err?.(
                    `Module.instantiateWasm callback failed with error: ${error}`,
                );
                readyPromiseReject?.(
                    (error ?? "Module.instantiateWasm failed") as LoaderError,
                );
                return {};
            }
        }

        // Fallback to streaming or ArrayBuffer instantiation
        instantiateAsync(
            wasmBinary,
            wasmBinaryFile,
            info,
            receiveInstantiationResult,
        ).catch((reason) => readyPromiseReject?.(reason as LoaderError));

        return {};
    }

    return { createWasm };
}
```

### 6. Error Handling Pattern

**Purpose**: Consistent error handling across WebAssembly and JavaScript boundaries

**Implementation**:

```typescript
// Error Translation Layer
export class SQLiteErrorTranslator {
    translateWasmError(errno: number): SQLiteError {
        // 1. Error lookup
        const errorInfo = this.getErrorInfo(errno);

        // 2. Context enrichment
        const context = this.getCurrentOperationContext();

        // 3. Error creation
        return new SQLiteError(errorInfo.message, {
            code: errno,
            operation: context.operation,
            sql: context.sql,
            context: context.additional,
        });
    }
}

// System Call Error Pattern
export function handleSystemCall<T>(operation: () => T, context: string): T {
    try {
        return operation();
    } catch (error) {
        if (error instanceof ErrnoError) {
            // Translate system call errors
            throw new SystemError(error.message, {
                errno: error.errno,
                operation: context,
            });
        }
        throw error;
    }
}
```

## WebAssembly Integration Patterns

### 1. Module Loading Pattern

**Purpose**: Safely load and initialize WebAssembly modules

**Implementation**:

```typescript
export class WebAssemblyLoader {
    async loadModule(config: ModuleConfig): Promise<WebAssemblyModule> {
        // 1. Pre-loading validation
        this.validateEnvironment();
        this.configureHeaders();

        // 2. WebAssembly instantiation
        const response = await fetch(config.wasmUrl);
        const wasmBytes = await response.arrayBuffer();
        const module = await WebAssembly.instantiate(wasmBytes, config.imports);

        // 3. Post-initialization setup
        return this.setupModule(module, config);
    }
}
```

### 2. Emscripten Integration Pattern

**Purpose**: Bridge Emscripten-generated code with modern JavaScript

**Implementation**:

```typescript
// Emscripten Module Configuration
export function configureEmscriptenModule(
    customConfig: Partial<EmscriptenModuleConfig>,
): EmscriptenModuleConfig {
    return {
        // 1. Default configuration
        wasmBinary: null, // Will be set by loader
        wasmJSMethod: "native-wasm",
        memory: new WebAssembly.Memory({ initial: 256 }),

        // 2. Custom overrides
        ...customConfig,

        // 3. Post-initialization hooks
        onRuntimeInitialized: () => {
            customConfig.onRuntimeInitialized?.();
            this.setupPostInitialization();
        },
    };
}
```

### 3. Typed Array Access Pattern

**Purpose**: Efficiently access WebAssembly memory from JavaScript

**Implementation**:

```typescript
export class TypedArrayAccess {
    constructor(private wasmInstance: WebAssemblyModule) {
        this.setupTypedArrays();
    }

    private HEAP8: Int8Array;
    private HEAP16: Int16Array;
    private HEAP32: Int32Array;
    private HEAPU8: Uint8Array;
    private HEAPU16: Uint16Array;
    private HEAPU32: Uint32Array;
    private HEAPF32: Float32Array;
    private HEAPF64: Float64Array;

    private setupTypedArrays(): void {
        const buffer = this.wasmInstance.exports.memory.buffer;

        // 1. Create typed array views
        this.HEAP8 = new Int8Array(buffer);
        this.HEAP16 = new Int16Array(buffer);
        this.HEAP32 = new Int32Array(buffer);
        this.HEAPU8 = new Uint8Array(buffer);
        this.HEAPU16 = new Uint16Array(buffer);
        this.HEAPU32 = new Uint32Array(buffer);
        this.HEAPF32 = new Float32Array(buffer);
        this.HEAPF64 = new Float64Array(buffer);
    }

    readString(ptr: number, maxBytes?: number): string {
        // 1. Input validation
        if (ptr === 0) return "";

        // 2. Find string length
        let end = ptr;
        const max = maxBytes ?? Number.MAX_SAFE_INTEGER;
        while (end - ptr < max && this.HEAPU8[end] !== 0) end++;

        // 3. Extract and decode
        const bytes = this.HEAPU8.subarray(ptr, end);
        return this.utf8Decoder.decode(bytes);
    }
}
```

## File System Patterns

### 1. Virtual File System (VFS) Pattern

**Purpose**: Provide consistent file system interface across different storage backends

**Implementation**:

```typescript
export interface VFSInterface {
    open(path: string, flags: number): Promise<FileHandle>;
    read(
        handle: FileHandle,
        buffer: ArrayBuffer,
        offset: number,
        length: number,
    ): Promise<number>;
    write(
        handle: FileHandle,
        buffer: ArrayBuffer,
        offset: number,
        length: number,
    ): Promise<number>;
    close(handle: FileHandle): Promise<void>;
    unlink(path: string): Promise<void>;
}

// OPFS VFS Implementation
export class OPFSVFS implements VFSInterface {
    async open(path: string, flags: number): Promise<OPFSFileHandle> {
        // 1. Path resolution
        const resolvedPath = this.resolvePath(path);

        // 2. Flag interpretation
        const mode = this.parseFlags(flags);

        // 3. File handle creation
        return new OPFSFileHandle(resolvedPath, mode);
    }
}

// Memory VFS Implementation
export class MemFSVFS implements VFSInterface {
    private files = new Map<string, MemFile>();

    async open(path: string, flags: number): Promise<MemFileHandle> {
        // 1. File existence check
        const exists = this.files.has(path);

        // 2. Flag validation
        if ((flags & O_CREAT) === 0 && !exists) {
            throw new Error(`File not found: ${path}`);
        }

        // 3. File creation/retrieval
        if (!exists) {
            this.files.set(path, new MemFile());
        }

        return new MemFileHandle(this.files.get(path)!, flags);
    }
}
```

### 2. File Handle Pattern

**Purpose**: Provide consistent file operations across different storage backends

**Implementation**:

```typescript
export abstract class BaseFileHandle {
    protected position = 0;

    abstract read(
        buffer: ArrayBuffer,
        offset: number,
        length: number,
    ): Promise<number>;
    abstract write(
        buffer: ArrayBuffer,
        offset: number,
        length: number,
    ): Promise<number>;
    abstract close(): Promise<void>;

    // Common utility methods
    seek(offset: number, whence: number): number {
        switch (whence) {
            case SEEK_SET:
                this.position = offset;
                break;
            case SEEK_CUR:
                this.position += offset;
                break;
            case SEEK_END:
                this.position = this.getSize() + offset;
                break;
        }
        return this.position;
    }

    tell(): number {
        return this.position;
    }

    protected abstract getSize(): number;
}
```

## API Design Patterns

### 1. Object-Oriented API (OO1) Pattern

**Purpose**: Provide intuitive, database-like interface for web developers

**Implementation**:

```typescript
export class Database {
    private wasmInstance: WebAssemblyModule;
    private vfs: VFSInterface;

    constructor(config: DatabaseConfig) {
        // 1. Configuration validation
        this.validateConfig(config);

        // 2. WebAssembly initialization
        this.wasmInstance = await this.loadWebAssembly(config.wasmConfig);

        // 3. VFS setup
        this.vfs = this.createVFS(config.vfsType);
    }

    // Fluent query interface
    prepare(sql: string): Statement {
        return new Statement(this.wasmInstance, sql, this.vfs);
    }

    exec(sql: string, options?: ExecOptions): ExecResult {
        // 1. SQL validation
        this.validateSQL(sql);

        // 2. Execution
        const stmt = this.prepare(sql);

        // 3. Result processing
        if (options?.returnValue === "resultRows") {
            return stmt.selectObjects(options);
        }

        return stmt.run();
    }

    transaction<T>(fn: () => T): T {
        // 1. Begin transaction
        this.exec("BEGIN TRANSACTION");

        try {
            // 2. Execute operations
            const result = fn();

            // 3. Commit transaction
            this.exec("COMMIT");
            return result;
        } catch (error) {
            // 4. Rollback on error
            this.exec("ROLLBACK");
            throw error;
        }
    }
}
```

### 2. Statement Pattern

**Purpose**: Manage prepared statement lifecycle and parameter binding

**Implementation**:

```typescript
export class Statement {
    private stmtPtr: number;
    private boundParams = new Map<number, any>();

    constructor(
        private wasmInstance: WebAssemblyModule,
        private sql: string,
        private vfs: VFSInterface,
    ) {
        // 1. Statement preparation
        this.stmtPtr = this.wasmInstance.exports.sqlite3_prepare_v2(
            this.getDatabasePtr(),
            sql,
            -1,
            0,
            0,
        );

        if (this.stmtPtr === 0) {
            throw new Error(`Failed to prepare statement: ${sql}`);
        }
    }

    bind(paramIndex: number, value: any): this {
        // 1. Parameter validation
        if (paramIndex < 1) {
            throw new Error("Parameter indices start at 1");
        }

        // 2. Type-based binding
        switch (typeof value) {
            case "string":
                this.bindString(paramIndex, value);
                break;
            case "number":
                this.bindNumber(paramIndex, value);
                break;
            case "boolean":
                this.bindNumber(paramIndex, value ? 1 : 0);
                break;
            default:
                if (value === null || value === undefined) {
                    this.bindNull(paramIndex);
                } else {
                    throw new Error(
                        `Unsupported parameter type: ${typeof value}`,
                    );
                }
        }

        // 3. Tracking
        this.boundParams.set(paramIndex, value);
        return this;
    }

    step(): StepResult {
        // 1. Execute step
        const result = this.wasmInstance.exports.sqlite3_step(this.stmtPtr);

        // 2. Result interpretation
        switch (result) {
            case SQLITE_ROW:
                return this.getRowData();
            case SQLITE_DONE:
                return null;
            default:
                throw new SQLiteError(this.wasmInstance, result);
        }
    }

    selectObjects(options?: SelectOptions): Record<string, any>[] {
        const rows: Record<string, any>[] = [];

        // 1. Execute and collect
        let row = this.step();
        while (row) {
            rows.push(row);
            row = this.step();
        }

        // 2. Post-processing
        if (options?.transform) {
            return rows.map(options.transform);
        }

        return rows;
    }

    finalize(): void {
        if (this.stmtPtr) {
            this.wasmInstance.exports.sqlite3_finalize(this.stmtPtr);
            this.stmtPtr = 0;
            this.boundParams.clear();
        }
    }
}
```

## Testing Patterns

### 1. Browser Integration Testing Pattern

**Purpose**: Verify end-to-end functionality in real browser environments

**Implementation**:

```typescript
// Test Suite Structure
export class BrowserTestSuite {
    private tests: TestCase[] = [];

    addTest(name: string, fn: () => Promise<void>): void {
        this.tests.push({ name, fn });
    }

    async run(): Promise<TestResults> {
        const results: TestResults = {
            passed: 0,
            failed: 0,
            errors: [],
        };

        // 1. Environment setup
        await this.setupEnvironment();

        // 2. Test execution
        for (const test of this.tests) {
            try {
                await this.runSingleTest(test);
                results.passed++;
            } catch (error) {
                results.failed++;
                results.errors.push({ test: test.name, error });
            }
        }

        // 3. Cleanup
        await this.cleanup();

        return results;
    }

    private async runSingleTest(test: TestCase): Promise<void> {
        // 1. Test isolation
        const testDB = await this.createTestDatabase();

        try {
            // 2. Test execution
            await test.fn();
        } finally {
            // 3. Cleanup
            await testDB.close();
        }
    }
}
```

### 2. Migration Testing Pattern

**Purpose**: Ensure behavior parity between JavaScript and TypeScript implementations

**Implementation**:

```typescript
export class MigrationTestSuite {
    async compareImplementations(
        modulePath: string,
        testCases: TestCase[],
    ): Promise<ComparisonResult> {
        const results: ComparisonResult = {
            module: modulePath,
            totalTests: testCases.length,
            passed: 0,
            failed: 0,
            differences: [],
        };

        // 1. Load both implementations
        const jsImpl = await import(`${modulePath}.mjs`);
        const tsImpl = await import(`${modulePath}.js`);

        // 2. Run comparison tests
        for (const testCase of testCases) {
            try {
                const jsResult = await this.runTest(jsImpl, testCase);
                const tsResult = await this.runTest(tsImpl, testCase);

                if (this.deepEqual(jsResult, tsResult)) {
                    results.passed++;
                } else {
                    results.failed++;
                    results.differences.push({
                        test: testCase.name,
                        jsResult,
                        tsResult,
                    });
                }
            } catch (error) {
                results.failed++;
                results.differences.push({
                    test: testCase.name,
                    error: error.message,
                });
            }
        }

        return results;
    }
}
```

## Performance Patterns

### 1. Memory Pool Pattern

**Purpose**: Efficiently manage frequent memory allocations/deallocations

**Implementation**:

```typescript
export class MemoryPool<T> {
    private available: T[] = [];
    private inUse = new Set<T>();
    private factory: () => T;
    private resetFn?: (obj: T) => void;

    constructor(factory: () => T, resetFn?: (obj: T) => void) {
        this.factory = factory;
        this.resetFn = resetFn;
    }

    acquire(): T {
        // 1. Pool availability check
        let obj = this.available.pop();

        // 2. Create new if needed
        if (!obj) {
            obj = this.factory();
        }

        // 3. Reset and track
        if (this.resetFn) {
            this.resetFn(obj);
        }

        this.inUse.add(obj);
        return obj;
    }

    release(obj: T): void {
        // 1. Validation
        if (!this.inUse.has(obj)) {
            console.warn("Attempting to release object not in use");
            return;
        }

        // 2. Cleanup and return to pool
        this.inUse.delete(obj);
        this.available.push(obj);
    }
}
```

### 2. Batch Operation Pattern

**Purpose**: Group multiple operations for better performance

**Implementation**:

```typescript
export class BatchProcessor<T> {
    private batch: T[] = [];
    private processor: (items: T[]) => Promise<void>;
    private batchSize: number;
    private flushTimeout?: number;

    constructor(
        processor: (items: T[]) => Promise<void>,
        batchSize: number = 100,
        flushTimeout: number = 1000,
    ) {
        this.processor = processor;
        this.batchSize = batchSize;
        this.flushTimeout = flushTimeout;
        this.scheduleFlush();
    }

    add(item: T): void {
        // 1. Add to batch
        this.batch.push(item);

        // 2. Check batch size
        if (this.batch.length >= this.batchSize) {
            this.flush();
        }
    }

    private async flush(): Promise<void> {
        // 1. Extract batch
        const items = this.batch.splice(0);

        if (items.length === 0) return;

        try {
            // 2. Process batch
            await this.processor(items);
        } catch (error) {
            // 3. Error handling
            console.error("Batch processing failed:", error);
            // Could implement retry logic here
        }
    }
}
```

These patterns provide the foundation for maintainable, performant, and reliable WebAssembly-based SQLite integration in web browsers. They evolved from practical experience with the challenges of bridging native database functionality with browser platform constraints.
