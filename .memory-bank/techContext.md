# Technical Context: Web SQLite V2

## Technology Stack

### Core Technologies

**WebAssembly (WASM)**

- SQLite3 C library compiled to WASM using Emscripten
- Provides near-native performance in browser environments
- SharedArrayBuffer support for zero-copy operations
- Current version: SQLite 3.50.4 with Emscripten SDK 3.1.70

**Origin Private File System (OPFS)**

- Modern browser API for efficient file storage
- Synchronous access in workers, asynchronous in main thread
- Sector-aligned allocation for optimal performance
- Cross-context synchronization capabilities

**TypeScript**

- Primary development language for new modules
- Comprehensive type definitions for all public APIs
- Gradual migration strategy from JavaScript (.mjs) files
- Strict type checking and linting configuration

### Build System

**Package Management**

- pnpm workspace configuration for monorepo management
- Separate packages for main library and test suite
- Dependency isolation between development and production

**Build Tools**

- Vite for development server and bundling
- TypeScript compiler for type checking and compilation
- ESLint with TypeScript support for code quality
- Vitest for unit testing framework

**Module System**

- ESM (ES Modules) as primary module format
- Dual compilation strategy for browser compatibility
- Tree-shaking support for optimal bundle sizes

### Development Environment

**Code Quality Tools**

```json
{
    "eslint": "^9.37.0",
    "typescript": "~5.9.3",
    "prettier": "3.6.2",
    "vitest": "^4.0.9"
}
```

**Testing Infrastructure**

- Browser-based test runner with live telemetry
- Unit tests with Vitest for utility modules
- Integration tests for OPFS and worker functionality
- Automated verification harness for regression testing

**Documentation**

- VitePress for API documentation and guides
- JSDoc standards for inline documentation
- Type definition files (.d.ts) for IDE support

## Runtime Environment

### Browser Compatibility

**Supported Browsers**

- Chrome 87+ (OPFS support)
- Firefox 111+ (OPFS support)
- Safari 16.4+ (OPFS support)
- Edge 87+ (OPFS support)

**Required Features**

- WebAssembly with BigInt support
- SharedArrayBuffer (for cross-context operations)
- Origin Private File System API
- ES2020+ JavaScript features

**Performance Considerations**

- COOP/COEP headers required for SharedArrayBuffer
- Memory limits vary by browser (typically 1-4GB)
- WASM module size ~2MB when uncompressed
- Initialization time ~50-100ms on modern hardware

### Security Model

**Sandboxed Execution**

- WASM modules run in strict sandbox
- No direct file system access outside OPFS
- Memory access limited to allocated heap
- No network access capabilities

**Cross-Origin Policies**

```javascript
// Required headers for SharedArrayBuffer support
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**Data Isolation**

- OPFS storage isolated by origin
- No access to user files or system resources
- Same-origin policy enforcement
- Content Security Policy compatibility

## Architecture Implementation

### Module Structure

```
src/jswasm/
├── api/                    # Public API implementations
│   ├── bindings/          # Low-level C-style bindings
│   ├── oo1-db/            # Object-oriented database API
│   └── utils/             # Database utilities and helpers
├── runtime/               # Core runtime infrastructure
│   ├── environment-detector.mjs
│   ├── lifecycle-manager.mjs
│   ├── memory-manager.mjs
│   └── module-configurator.mjs
├── utils/                 # Shared utility modules
│   ├── async-utils/
│   ├── memory-utils/
│   ├── path/
│   ├── sqlite3-init-wrapper/
│   ├── wasm-loader/
│   └── struct-binder/
├── vfs/                   # Virtual File System implementations
│   ├── filesystem.mjs     # Core filesystem abstraction
│   ├── memfs.mjs          # In-memory filesystem
│   └── opfs/              # OPFS-specific implementations
├── system/                # System-level interfaces
│   ├── syscalls.mjs       # System call implementations
│   ├── wasi-functions.mjs # WASI interface compatibility
│   └── tty-operations.mjs # Terminal emulation
├── wasm/                  # WebAssembly integration
│   ├── sqlite3.wasm       # Compiled SQLite module
│   ├── sqlite3Apibootstrap.mjs
│   └── bootstrap/         # Initialization utilities
└── shared/                # Shared constants and types
```

### Data Flow Architecture

**Initialization Pipeline**

1. Environment detection (worker vs main thread)
2. Module configuration and overrides
3. WebAssembly memory setup
4. Filesystem initialization (OPFS/Memory)
5. WASM module loading and instantiation
6. SQLite export attachment and bootstrap

**Query Execution Pipeline**

1. API layer receives request (OO1/C-style)
2. Query validation and preparation
3. VFS layer handles storage operations
4. WebAssembly executes SQLite operations
5. Results flow back through API layer
6. Memory cleanup and resource management

### Memory Management

**Heap Allocation Strategy**

```javascript
// WebAssembly memory with dynamic growth
const wasmMemory = new WebAssembly.Memory({
    initial: 256, // 16MB initial pages
    maximum: 2048, // 128MB maximum pages
    shared: true, // Enable SharedArrayBuffer
});

// Typed array views for efficient access
const HEAP8 = new Int8Array(wasmMemory.buffer);
const HEAPU8 = new Uint8Array(wasmMemory.buffer);
const HEAP32 = new Int32Array(wasmMemory.buffer);
```

**OPFS Sector Management**

- 64KB sector alignment for optimal performance
- Automatic garbage collection of unused sectors
- Cross-context synchronization through SharedArrayBuffer
- Pool-based allocation to reduce fragmentation

## Development Workflow

### Code Organization

**TypeScript Migration Strategy**

1. Maintain .mjs files for ESM compatibility
2. Develop new features in TypeScript
3. Generate corresponding .d.ts files
4. Gradual replacement of JavaScript modules
5. Backward compatibility preservation

**Testing Strategy**

```javascript
// Unit tests for utility modules
describe("memory-utils", () => {
    test("zeroMemory clears buffer correctly", () => {
        // Test implementation
    });
});

// Integration tests for browser features
describe("OPFS integration", () => {
    test("database persistence across page reloads", async () => {
        // Browser-specific test
    });
});
```

**Quality Assurance**

- ESLint configuration for code style enforcement
- TypeScript strict mode for type safety
- Prettier for consistent formatting
- Automated testing on multiple browsers

### Build and Deployment

**Development Workflow**

```bash
# Install dependencies
pnpm install

# Start development server with hot reload
pnpm dev

# Run unit tests
pnpm test:unit

# Run browser tests
pnpm test

# Type checking
pnpm typecheck

# Linting and formatting
pnpm lint
```

**Release Process**

1. Update version in package.json
2. Run full test suite across browsers
3. Build distribution bundles
4. Generate API documentation
5. Publish to npm registry
6. Update GitHub releases

**Bundle Optimization**

- Tree-shaking for minimal bundle sizes
- Code splitting for on-demand loading
- Compression for production builds
- Source maps for debugging

## Performance Characteristics

### Benchmarks

**Initialization Performance**

- Cold start: 80-120ms
- Warm start: 30-50ms
- Memory footprint: ~20-50MB
- WASM download: ~2MB compressed

**Query Performance**

- Simple SELECT: 0.1-1ms
- Complex JOIN: 1-10ms
- Bulk INSERT: 100-1000 rows/sec
- Index creation: Varies by data size

**Storage Performance**

- OPFS write throughput: 10-50MB/s
- OPFS read throughput: 50-200MB/s
- Sector allocation: <1ms
- Cross-context sync: <5ms

### Optimization Techniques

**Memory Optimization**

- Lazy loading of optional features
- Efficient buffer management
- Automatic garbage collection
- SharedArrayBuffer for zero-copy operations

**I/O Optimization**

- Sector-aligned file operations
- Batch processing for bulk operations
- Asynchronous operations where possible
- Caching of frequently accessed data

**Query Optimization**

- Statement preparation and caching
- Index-aware query planning
- Result set streaming for large data
- Connection pooling for concurrent access

## Security Considerations

### Threat Model

**Data Security**

- All data stored in browser sandbox
- No access to user files or system resources
- Origin-based isolation prevents cross-site data leakage
- Encrypted storage possible through application layer

**Code Security**

- WASM modules in strict sandbox
- No direct system call access
- Memory access validation
- Type safety through TypeScript

**Network Security**

- No outbound network capabilities
- CSP-compatible implementation
- Same-origin policy enforcement
- Safe for use in secure contexts

### Best Practices

**Memory Safety**

- Bounds checking on all memory access
- Automatic cleanup of allocated resources
- Prevention of memory leaks through garbage collection
- Safe handling of SharedArrayBuffer operations

**Error Handling**

- Comprehensive error type hierarchy
- Safe fallbacks for unsupported features
- Graceful degradation on older browsers
- Detailed error context for debugging

**Input Validation**

- SQL injection prevention through parameterized queries
- Path traversal protection in filesystem operations
- Type validation for all public APIs
- Sanitization of user inputs
