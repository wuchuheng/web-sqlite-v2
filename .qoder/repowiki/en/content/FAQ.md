# FAQ

<cite>
**Referenced Files in This Document**   
- [CLAUDE.md](file://CLAUDE.md)
- [GEMINI.md](file://GEMINI.md)
- [AGENTS.md](file://AGENTS.md)
- [package.json](file://package.json)
- [src/index.ts](file://src/index.ts)
- [src/sqliteWorker.ts](file://src/sqliteWorker.ts)
- [src/jswasm/vfs/opfs/installer/core/environment-validation.mjs](file://src/jswasm/vfs/opfs/installer/core/environment-validation.mjs)
- [src/jswasm/runtime/memory-manager.mjs](file://src/jswasm/runtime/memory-manager.mjs)
- [src/jswasm/api/oo1-db/js-storage-db.mjs](file://src/jswasm/api/oo1-db/js-storage-db.mjs)
- [src/jswasm/vfs/opfs/installer/wrappers/io-sync-wrappers.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/io-sync-wrappers.mjs)
- [src/jswasm/vfs/opfs/installer/wrappers/vfs-integration.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/vfs-integration.mjs)
- [src/jswasm/sqlite3.d.ts](file://src/jswasm/sqlite3.d.ts)
</cite>

## Table of Contents
1. [Browser Compatibility and OPFS Support](#browser-compatibility-and-opfs-support)
2. [Differences from Other SQLite WASM Solutions](#differences-from-other-sqlite-wasm-solutions)
3. [Migration from Previous Versions](#migration-from-previous-versions)
4. [Performance Expectations](#performance-expectations)
5. [Memory Usage and Garbage Collection](#memory-usage-and-garbage-collection)
6. [TypeScript Integration and Type Safety](#typescript-integration-and-type-safety)

## Browser Compatibility and OPFS Support

**Q: Which browsers are supported by web-sqlite-v2?**

web-sqlite-v2 supports modern browsers with OPFS (Origin Private File System) and SharedArrayBuffer capabilities. The supported browsers include:
- Chrome/Chromium 86+
- Firefox 111+
- Safari 15.4+ (with limited OPFS support)
- Edge 86+ (Chromium-based)

**Q: What are the requirements for OPFS support?**

OPFS support requires several key features and configurations:
- SharedArrayBuffer and Atomics must be available
- OPFS APIs must be present (FileSystemHandle, FileSystemDirectoryHandle, FileSystemFileHandle)
- The application must run in a secure context (HTTPS or localhost)
- Required HTTP headers must be served: `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin`

**Q: Why does OPFS require a worker environment?**

The OPFS VFS cannot run in the main thread because it requires `Atomics.wait()`, which is only available in worker contexts. The implementation uses a web worker to handle database operations, ensuring the main UI thread remains responsive.

**Q: How is OPFS environment validation performed?**

The environment validation checks for the presence of required APIs and features:
- SharedArrayBuffer and Atomics availability
- WorkerGlobalScope existence
- OPFS API support (FileSystemHandle, createSyncAccessHandle, etc.)
- navigator.storage.getDirectory availability

If any of these requirements are not met, an appropriate error is returned explaining the missing feature.

**Section sources**
- [CLAUDE.md](file://CLAUDE.md#L175-L194)
- [src/jswasm/vfs/opfs/installer/core/environment-validation.mjs](file://src/jswasm/vfs/opfs/installer/core/environment-validation.mjs#L6-L37)

## Differences from Other SQLite WASM Solutions

**Q: How does web-sqlite-v2 differ from other SQLite WASM implementations?**

web-sqlite-v2 offers several key advantages over other SQLite WASM solutions:

**OPFS Integration**: Unlike solutions that rely on in-memory storage or IndexedDB, web-sqlite-v2 leverages OPFS for persistent storage with better performance and larger capacity limits.

**Web Worker Architecture**: The implementation runs SQLite in a dedicated web worker, preventing UI blocking during database operations and enabling true parallelism.

**Modular Architecture**: The codebase is organized into focused, maintainable modules rather than a monolithic structure, making it easier to understand, test, and extend.

**TypeScript Support**: First-class TypeScript integration with comprehensive type definitions provides better developer experience and type safety.

**Q: What are the advantages of using OPFS over IndexedDB for SQLite storage?**

OPFS offers several advantages:
- Better performance for database operations due to synchronous-like access patterns
- Larger storage capacity compared to IndexedDB limits
- More efficient file I/O operations
- Direct byte-level access to stored data
- Better support for concurrent access patterns

**Q: How does the web worker implementation improve performance?**

Running SQLite in a web worker provides:
- Non-blocking UI during database operations
- Ability to perform long-running queries without affecting page responsiveness
- True parallel execution of database operations
- Better memory isolation between the database engine and application code

**Section sources**
- [CLAUDE.md](file://CLAUDE.md#L7-L14)
- [GEMINI.md](file://GEMINI.md#L9-L10)
- [AGENTS.md](file://AGENTS.md#L5-L6)
- [src/sqliteWorker.ts](file://src/sqliteWorker.ts#L1-L243)

## Migration from Previous Versions

**Q: How do I migrate from previous versions of web-sqlite to web-sqlite-v2?**

Migration to web-sqlite-v2 involves several key changes:

**API Changes**: The new version uses a promise-based API with async/await syntax. The main entry point is now the `open()` function which returns a promise that resolves to a database instance.

**Worker Integration**: Database operations now occur in a web worker. You'll need to update your code to work with the message-passing interface between the main thread and worker.

**Configuration**: The initialization process has been simplified. Instead of complex configuration objects, you can now use a straightforward `open(dbName)` pattern.

**Q: Are existing SQLite databases compatible with web-sqlite-v2?**

Yes, existing SQLite databases are fully compatible with web-sqlite-v2. The implementation uses the standard SQLite 3.50.4 engine, ensuring complete compatibility with existing database files. You can open and use your existing SQLite databases without any conversion or migration steps.

**Q: How do I handle the transition from synchronous to asynchronous operations?**

To transition from synchronous to asynchronous operations:
- Wrap database operations in async functions or use .then() chains
- Update error handling to use try/catch with async/await or .catch() with promises
- Consider using the provided convenience methods like `selectObjects()` and `selectArrays()` which handle the async operations internally

**Section sources**
- [src/index.ts](file://src/index.ts#L64-L87)
- [src/sqliteWorker.ts](file://src/sqliteWorker.ts#L68-L206)
- [src/jswasm/sqlite3.d.ts](file://src/jswasm/sqlite3.d.ts#L567-L658)

## Performance Expectations

**Q: What performance can I expect from different operation types?**

Performance varies by operation type and dataset size:

**Small Datasets (< 10,000 rows)**:
- Simple queries: < 10ms
- Inserts/updates: < 5ms
- Transactions: < 15ms

**Medium Datasets (10,000 - 100,000 rows)**:
- Indexed queries: 10-50ms
- Bulk inserts: 50-200ms for 1,000 rows
- Complex joins: 50-200ms

**Large Datasets (> 100,000 rows)**:
- Full table scans: 200ms - 2s
- Aggregations: 100-500ms
- Index creation: 500ms - 5s

**Q: How does OPFS affect performance compared to in-memory operation?**

OPFS provides persistent storage with performance characteristics that are generally slower than pure in-memory operation but offer persistence. The performance difference depends on the operation:

- Read operations: 2-5x slower than in-memory
- Write operations: 3-8x slower than in-memory
- Transaction commits: 5-10x slower due to persistence requirements

However, OPFS provides much better performance than alternatives like IndexedDB for database workloads.

**Q: What factors influence performance in web-sqlite-v2?**

Key performance factors include:
- Dataset size and complexity
- Query optimization and indexing
- Network conditions (for initial WASM loading)
- Browser implementation of OPFS
- Complexity of JavaScript-WASM interop

**Section sources**
- [src/jswasm/vfs/opfs/installer/wrappers/io-sync-wrappers.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/io-sync-wrappers.mjs#L136-L156)
- [src/jswasm/sqlite3.d.ts](file://src/jswasm/sqlite3.d.ts#L500-L522)
- [src/sqliteWorker.ts](file://src/sqliteWorker.ts#L138-L147)

## Memory Usage and Garbage Collection

**Q: How does web-sqlite-v2 manage memory?**

The implementation uses a sophisticated memory management system:

**WebAssembly Memory**: The SQLite engine runs in a WebAssembly memory space with a maximum size of 2GB. The memory manager handles:
- Dynamic memory growth as needed
- Proper alignment of memory operations
- Efficient heap management

**Typed Arrays**: The system uses typed arrays (HEAP8, HEAP16, HEAP32, HEAP64) to interface with WebAssembly memory, ensuring efficient data transfer between JavaScript and WASM.

**Memory Views**: The memory manager maintains updated views of the WebAssembly memory buffer, which are refreshed after any memory growth operations.

**Q: What is the memory footprint of web-sqlite-v2?**

The memory footprint consists of several components:

**WASM Binary**: Approximately 2-3MB for the SQLite WASM binary
**Heap Memory**: Initial 16MB, growing up to 2GB as needed
**JavaScript Overhead**: Additional memory for the wrapper code and object management

The actual memory usage depends on the size of your database and the complexity of operations.

**Q: How does garbage collection work with web-sqlite-v2?**

Garbage collection operates as follows:

**WASM Memory**: Managed internally by SQLite's memory allocator, with periodic cleanup of temporary objects and freed blocks.

**JavaScript Objects**: Standard JavaScript garbage collection applies to wrapper objects like DB and Stmt instances. When these objects are no longer referenced, they become eligible for GC.

**Resource Cleanup**: The implementation includes finalize() methods and proper cleanup in close() operations to ensure resources are released promptly.

**Section sources**
- [src/jswasm/runtime/memory-manager.mjs](file://src/jswasm/runtime/memory-manager.mjs#L17-L150)
- [src/jswasm/sqlite3.d.ts](file://src/jswasm/sqlite3.d.ts#L721-L795)
- [src/sqliteWorker.ts](file://src/sqliteWorker.ts#L177-L183)

## TypeScript Integration and Type Safety

**Q: What TypeScript features are supported?**

web-sqlite-v2 provides comprehensive TypeScript support:

**Type Definitions**: Complete type definitions for all APIs, including interfaces for DB, Stmt, and configuration options.

**Generic Methods**: Methods like `selectObjects<T>()` and `selectArrays<T>()` support generics for type-safe result handling.

**Union Types**: Proper typing for bind values, result types, and configuration options.

**Q: How does type safety work with database operations?**

Type safety is implemented through:

**Parameter Typing**: Bind values are typed with the BindValue union type, supporting null, number, string, boolean, and ArrayBuffer types.

**Result Typing**: Query methods support generics to specify the expected result structure:
```typescript
const users = await db.selectObjects<{ id: number; name: string }>("SELECT id, name FROM users");
```

**Configuration Typing**: Options objects are strongly typed with interfaces like ExecOptions and CreateFunctionOptions.

**Q: Can I use TypeScript with the worker interface?**

Yes, TypeScript integration is fully supported. The worker interface is defined with proper types:
- RequestMessage and ResponseMessage interfaces
- Action codes as a const enum
- Payload typing based on the action type

The type definitions ensure type safety across the main thread and worker boundary.

**Section sources**
- [src/jswasm/sqlite3.d.ts](file://src/jswasm/sqlite3.d.ts#L486-L522)
- [src/index.ts](file://src/index.ts#L1-L92)
- [src/sqliteWorker.ts](file://src/sqliteWorker.ts#L1-L243)