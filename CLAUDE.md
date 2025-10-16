# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **web-sqlite-v2**, a SQLite3 WebAssembly implementation optimized for browser environments with OPFS (Origin Private File System) support. The project provides a modular, well-documented JavaScript/TypeScript wrapper around the SQLite WASM binary, enabling persistent database storage in modern web browsers.

**Key Technology**: SQLite 3.50.4 compiled to WebAssembly using Emscripten SDK 3.1.70

## Development Commands

### Testing
```bash
pnpm test
```
Starts an HTTP server with required COOP/COEP headers and opens the test page at `/tests/index.html`. The server automatically opens your browser.

### Linting
```bash
pnpm run lint
```
Runs ESLint with auto-fix enabled across `.ts`, `.js`, and `.mjs` files.

### Development Server
```bash
tsx ./scripts/http-server.ts --base-path ./ --url-path-name /path/to/page
```
Custom HTTP server that includes required SharedArrayBuffer headers:
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

These headers are **mandatory** for OPFS and SharedArrayBuffer functionality.

## Code Architecture

### Module Organization

The codebase follows a modular architecture where the monolithic SQLite3 WASM code has been split into focused, maintainable modules:

```
src/jswasm/
├── sqlite3.mjs                  # Main entry point and Emscripten glue code
├── sqlite3Apibootstrap.mjs      # SQLite3 API initialization and bootstrap
├── vfs/opfs/sqlite3-opfs-async-proxy.js  # Worker entry delegating to async-proxy/
├── vfs/opfs/async-proxy/        # OPFS async proxy implementation modules
├── memfs.mjs                    # In-memory file system implementation
├── syscalls.mjs                 # System call implementations
├── wasi-functions.mjs           # WASI functions (time, env, fd operations)
├── tty-operations.mjs           # TTY/terminal operations
└── utils/
    ├── path.mjs                 # Path manipulation utilities
    └── utf8.mjs                 # UTF-8 string conversion utilities
```

### Architecture Layers

**1. WebAssembly Integration Layer** (`sqlite3.mjs`)
- Emscripten module initialization and configuration
- WebAssembly binary loading and instantiation
- Memory management (HEAP8, HEAP16, HEAP32, HEAP64, etc.)
- Module exports and import coordination

**2. File System Layer** (`memfs.mjs`)
- Complete in-memory file system (MEMFS) implementation
- Node operations: create, read, write, lookup, rename, unlink
- Stream operations: read, write, seek (llseek), mmap, msync
- File storage management with dynamic expansion

**3. System Interface Layer** (`syscalls.mjs`, `wasi-functions.mjs`)
- System call implementations (chmod, stat, open, close, etc.)
- WASI-compliant file descriptor operations
- Time/date functions with timezone handling
- Environment variable management
- Memory mapping operations (mmap/munmap)

**4. API Bootstrap Layer** (`sqlite3Apibootstrap.mjs`)
- SQLite3 high-level API initialization
- Error handling (SQLite3Error class)
- Configuration management
- Memory allocation utilities (malloc/free wrappers)

**5. OPFS Integration** (`vfs/opfs/sqlite3-opfs-async-proxy.js`, `async-proxy/index.mjs`)
- Asynchronous OPFS (Origin Private File System) proxy
- Worker thread coordination for persistent storage
- File handle management for browser storage APIs

### Key Architectural Decisions

**Modular Refactoring**: Recent commits show active refactoring to split `sqlite3.mjs` into smaller modules (`wasi-functions.mjs`, `syscalls.mjs`). When making changes:
- Keep related functionality grouped in single modules
- Maintain clear import/export boundaries
- Preserve the numbered comment convention (1/2/3 phases)

**Memory Management**: The code extensively uses typed arrays (HEAP8, HEAP16, HEAP32, HEAP64) to interface with WebAssembly memory. All memory operations must respect:
- Proper alignment (>> 2 for 32-bit, >> 3 for 64-bit)
- Bounds checking to prevent buffer overruns
- Cleanup via finalize() methods

**File System Abstraction**: MEMFS provides a complete POSIX-like file system in memory:
- Supports directories, files, symlinks, and character devices
- Implements standard operations (read, write, seek, stat, etc.)
- Used as the foundation for both in-memory and OPFS-backed databases

## Code Style Guidelines

**CRITICAL**: This project follows strict GitHub Copilot rules defined in `.github/copilot-instructions.md`:

### Comment Convention (Three-Phase Pattern)
Use numbered inline comments **only inside function/method bodies**:
- **1.x** Input Handling: validation, parsing, type checks, defaults
- **2.x** Core Processing: transformations, calculations, I/O
- **3.x** Output Handling: return values, cleanup

**Example**:
```javascript
function processData(input) {
    // 1. Input handling
    if (!input) throw new Error('Invalid input');

    // 2. Core processing
    const result = transform(input);

    // 3. Output handling
    return result;
}
```

### Documentation Requirements
- **JSDoc comments** above all classes, functions, and properties
- Describe purpose, parameters, return values, and notable side effects
- Keep doc comments concise and relevant
- NO numbered comments outside function bodies (not on classes, properties, decorators)

### Code Formatting
- Maximum line length: **120 characters**
- Break long argument lists across lines with trailing commas
- Split long template literals or extract variables
- Use explicit types; avoid implicit `any`
- Prefix unused parameters with underscore: `_param`

### ESLint Configuration
The project uses TypeScript ESLint with custom rules:
- Unused variables must be prefixed with `_` (argsIgnorePattern, varsIgnorePattern)
- Empty catch blocks are allowed (allowEmptyCatch: true)
- Both browser and Node.js globals are available
- ES2024 syntax is enabled

## Browser Requirements

**Supported Browsers**:
- Chrome/Chromium 86+
- Firefox 111+
- Safari 15.4+ (limited OPFS support)
- Edge 86+ (Chromium-based)

**Required Features**:
- SharedArrayBuffer support
- OPFS API support
- HTTPS or localhost context (required for security headers)

**Unsupported**:
- Internet Explorer (any version)
- `file://` protocol
- Older browsers without OPFS APIs

## Testing Strategy

Tests are browser-based and located in `/tests/`:
- `index.html` - Main test runner page
- `worker.js` - Web Worker test cases
- `README.md` - Comprehensive testing documentation

The HTTP server (`scripts/http-server.ts`) provides:
- Automatic header injection for SharedArrayBuffer
- CORS support with wildcard origin
- MIME type detection for `.wasm`, `.mjs`, etc.
- Directory listing fallback
- Automatic browser launching with target URL

## Important Implementation Notes

### UTF-8 String Handling
All string operations between JavaScript and WebAssembly go through UTF-8 conversion utilities in `utils/utf8.mjs`:
- `UTF8ArrayToString()` - Convert WASM memory to JS string
- `stringToUTF8Array()` - Convert JS string to WASM memory
- `lengthBytesUTF8()` - Calculate UTF-8 byte length
- `intArrayFromString()` - String to integer array conversion

### Path Operations
Path manipulation is handled by `utils/path.mjs` (PATH module):
- `join2()` - Join two path components
- `normalize()` - Normalize path (resolve `.` and `..`)
- `isAbs()` - Check if path is absolute
- `dirname()` - Get directory name
- `basename()` - Get file name

### Error Handling Pattern
System calls and file operations use errno-style error handling:
```javascript
function operation() {
    try {
        // operation logic
        return 0; // success
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return -e.errno; // return negative errno
    }
}
```

### Memory Allocation
The bootstrap layer provides allocation wrappers:
- `allocExportName`: Either `sqlite3_malloc` or `malloc` (based on config.useStdAlloc)
- `deallocExportName`: Either `sqlite3_free` or `free`
- `reallocExportName`: Either `sqlite3_realloc` or `realloc`

Always use these wrappers instead of direct memory operations.

## Recent Refactoring Work

Recent commits indicate active code organization improvements:
- **Commit 200ac29**: Split code from `sqlite3.mjs` to `wasi-functions.mjs`
- **Commit 5008f3f**: Split code from `sqlite3.mjs` to `syscalls.mjs`
- **Commit 5e41048**: Fixed lint issues

When continuing this refactoring:
1. Keep the main `sqlite3.mjs` focused on Emscripten glue code
2. Extract related functionality into focused modules
3. Maintain proper import/export chains
4. Update tests after each extraction
5. Run `pnpm run lint` to catch issues early

## SQLite3 API Usage

The project exposes SQLite3 through an object-oriented API (OO1):
- `sqlite3.oo1.DB` - In-memory database class
- `sqlite3.oo1.OpfsDb` - OPFS persistent database class
- Prepared statements with `.prepare()`, `.bind()`, `.step()`, `.finalize()`
- Transaction support with `.transaction(() => { ... })`
- Query helpers: `.selectObjects()`, `.selectArrays()`, `.exec()`

Refer to `/tests/README.md` for comprehensive usage examples including table creation, data insertion, queries, and transaction handling.
