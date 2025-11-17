# Technical Context: Web SQLite V2

## Technology Stack

### Core Technologies

**WebAssembly Runtime**

- **SQLite Version**: 3.50.4 (latest stable)
- **Compilation Toolchain**: Emscripten SDK 3.1.70
- **WebAssembly Features**: SIMD, Bulk Memory, Multi-value (where supported)
- **Memory Management**: WebAssembly.Memory with growable heap
- **Performance**: Near-native execution speed for database operations

**JavaScript/TypeScript Runtime**

- **Language**: ECMAScript 2022+ with TypeScript 5.9.3
- **Module System**: ES Modules (.mjs/.js) throughout
- **Target Environments**: Modern browsers with WebAssembly support
- **Type System**: Strict TypeScript with comprehensive type definitions

**Browser APIs**

- **Storage**: Origin Private File System (OPFS) for persistence
- **Concurrency**: Web Workers for background processing
- **Memory**: SharedArrayBuffer for cross-context data sharing
- **Security**: COOP/COEP headers for SharedArrayBuffer support

### Development Toolchain

**Package Management**

```json
{
    "packageManager": "pnpm@10.17.1",
    "workspaces": ["."],
    "engine": {
        "node": ">=18.0.0",
        "pnpm": ">=10.0.0"
    }
}
```

**Build System**

- **Primary Bundler**: Vite 7.1.10 for development and production builds
- **TypeScript Compiler**: tsc for type checking and migration compilation
- **Module Resolution**: Bundler resolution for ESM compatibility
- **Code Generation**: In-place TypeScript compilation for migration

**Development Tools**

- **Linting**: ESLint with TypeScript support and custom rules
- **Formatting**: Prettier for consistent code style
- **Testing**: Vitest for unit tests, browser tests for integration
- **Documentation**: VitePress for static documentation site

## Build Configuration

### TypeScript Configuration

**Main Configuration** (`tsconfig.json`)

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "strict": true,
        "skipLibCheck": true,
        "allowJs": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,
        "outDir": "./dist",
        "rootDir": "./src",
        "esModuleInterop": true,
        "allowSyntheticDefaultImports": true,
        "forceConsistentCasingInFileNames": true,
        "maxNodeModuleJsDepth": 2
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "tests"]
}
```

**Migration Configuration** (`tsconfig.migration.json`)

```json
{
    "extends": "./tsconfig.json",
    "compilerOptions": {
        "outDir": ".",
        "declaration": false,
        "sourceMap": false,
        "noEmitOnError": true
    },
    "include": ["src/jswasm/**/*.ts"],
    "exclude": ["**/*.d.ts", "**/*.mjs"]
}
```

**Migration Build Commands**

```json
{
    "scripts": {
        "build:migration": "tsc -p tsconfig.migration.json",
        "build:migration:watch": "tsc --watch -p tsconfig.migration.json",
        "typecheck:migration:watch": "tsc --watch -p tsconfig.migration.json --noEmit"
    }
}
```

### Vite Configuration

**Development Server** (`vite.config.ts`)

```typescript
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/jswasm/sqlite3.mjs"),
            name: "WebSQLite",
            fileName: "sqlite3",
            formats: ["es"],
        },
        rollupOptions: {
            external: ["fs", "path"],
            output: {
                globals: {
                    fs: "fs",
                    path: "path",
                },
            },
        },
        target: "es2022",
    },
    server: {
        headers: {
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cross-Origin-Opener-Policy": "same-origin",
        },
    },
    optimizeDeps: {
        exclude: ["sqlite3.wasm"],
    },
});
```

**Test Configuration** (`vitest.config.ts`)

```typescript
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    test: {
        environment: "jsdom",
        setupFiles: ["./tests/src/setup.ts"],
        globals: true,
        coverage: {
            reporter: ["text", "json", "html"],
            exclude: ["node_modules/", "tests/", "**/*.d.ts", "**/*.test.ts"],
        },
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
            "@tests": resolve(__dirname, "./tests"),
        },
    },
});
```

### ESLint Configuration

**Main Configuration** (`eslint.config.mts`)

```typescript
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
    js.configs.recommended,
    {
        files: ["**/*.{ts,js,mjs}"],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: "module",
                project: "./tsconfig.json",
            },
            globals: {
                // Browser globals
                window: "readonly",
                document: "readonly",
                console: "readonly",
                // WebAssembly globals
                WebAssembly: "readonly",
                SharedArrayBuffer: "readonly",
                // Node.js globals for tooling
                process: "readonly",
                Buffer: "readonly",
            },
        },
        plugins: {
            "@typescript-eslint": tseslint,
        },
        rules: {
            // TypeScript specific rules
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/prefer-nullish-coalescing": "error",
            "@typescript-eslint/prefer-optional-chain": "error",

            // General JavaScript rules
            "no-console": "off", // Allow console for debugging
            "prefer-const": "error",
            "no-var": "error",

            // Code style rules
            "max-len": [
                "error",
                {
                    code: 120,
                    ignoreUrls: true,
                    ignoreStrings: true,
                    ignoreTemplateLiterals: true,
                },
            ],
            indent: ["error", 2, { SwitchCase: 1 }],
            quotes: ["error", "single", { avoidEscape: true }],

            // Error handling
            "no-empty": "off", // Allow empty catch blocks
            "@typescript-eslint/no-empty-function": "off",
        },
    },
    {
        files: ["tests/**/*"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
        },
    },
];
```

## Development Environment

### Project Structure

**Source Organization** (`src/jswasm/`)

```
src/jswasm/
├── sqlite3.mjs                    # Main entry point
├── sqlite3.d.ts                   # Type definitions
├── wasm/                          # WebAssembly integration
│   ├── sqlite3.wasm               # Compiled WASM binary
│   ├── emscripten-module.d.ts     # Emscripten types
│   ├── sqlite3-wasm-exports.*     # WASM export definitions
│   └── sqlite3Apibootstrap.*     # API bootstrap
├── runtime/                       # Runtime management
│   ├── environment-detector.*     # Browser environment detection
│   ├── lifecycle-manager.*        # Module lifecycle management
│   ├── memory-manager.*           # WebAssembly memory management
│   └── module-configurator.*      # Module configuration
├── system/                        # System interface layer
│   ├── syscalls.*                 # POSIX system calls
│   ├── wasi-functions.*          # WASI function implementations
│   ├── file-syscalls.*           # File system operations
│   ├── stat-syscalls.*            # File status operations
│   ├── ioctl-syscalls.*           # I/O control operations
│   ├── tty-operations.*           # Terminal operations
│   └── errno-constants.*          # Error code definitions
├── vfs/                           # Virtual File System
│   ├── filesystem.*               # Base file system interface
│   ├── memfs.*                   # In-memory file system
│   ├── filesystem/                # File system implementations
│   └── opfs/                     # OPFS-specific implementations
├── utils/                         # Utility functions
│   ├── path.*                     # Path manipulation
│   ├── utf8/                     # UTF-8 string handling
│   ├── memory-utils/              # **NEWLY MIGRATED** - Memory management utilities
│   ├── wasm-loader/               # **NEWLY MIGRATED** - WebAssembly loading utilities
│   ├── async-utils/               # **MIGRATED** - Async operation helpers
│   └── whwasm/                   # WASM helper utilities
├── shared/                        # Shared type definitions
│   ├── runtime-types.*            # Runtime-related types
│   ├── system-types.*             # System-related types
│   └── opfs-vfs-installer.*      # OPFS VFS types
└── api/                          # High-level API implementations
    ├── install-oo1.*             # OO1 API installer
    ├── install-oo1-db-api.*      # Database API installer
    ├── bindings/                  # Low-level bindings
    ├── oo1-db/                   # Object-oriented database API
    └── utils/                    # API utilities
```

**Testing Structure** (`tests/`)

```
tests/
├── src/
│   ├── main.ts                   # Test runner entry point
│   ├── worker.ts                 # Web Worker test implementation
│   ├── core/                     # Test infrastructure
│   │   └── test-runner.ts        # Test runner utilities
│   ├── suites/                   # Test suites
│   │   ├── database-lifecycle.suite.ts
│   │   ├── crud-operations.suite.ts
│   │   ├── query-operations.suite.ts
│   │   ├── transactions.suite.ts
│   │   ├── error-handling.suite.ts
│   │   ├── performance.suite.ts
│   │   └── environment.suite.ts
│   └── utils/                    # Test utilities
│       └── test-utils.ts
├── index.html                    # Browser test interface
├── styles.css                    # Test UI styling
├── package.json                  # Test-specific dependencies
└── vite.config.ts               # Test build configuration
```

### Development Scripts

**Package.json Scripts**

```json
{
    "scripts": {
        "build": "vite build --watch",
        "build:prod": "vite build",
        "test": "pnpm --filter @wuchuheng/web-sqlite-tests exec vite --port 50001 --host 0.0.0.0",
        "test:unit": "vitest run",
        "test:unit:watch": "vitest",
        "test:coverage": "vitest run --coverage",
        "typecheck": "tsc --noEmit",
        "typecheck:watch": "tsc --watch -p tsconfig.json",
        "typecheck:migration:watch": "tsc --watch -p tsconfig.migration.json",
        "build:migration": "tsc -p tsconfig.migration.json",
        "build:migration:watch": "tsc --watch -p tsconfig.migration.json",
        "lint": "eslint . --ext .ts,.js,.mjs --ignore-path .gitignore --fix; pnpm run test:lint",
        "test:lint": "cd tests && pnpm run lint",
        "format": "prettier --ignore-path .gitignore --write .",
        "dev": "vite",
        "preview": "vite preview",
        "docs:dev": "vitepress dev docs",
        "docs:build": "vitepress build docs",
        "clean": "rm -rf dist node_modules/.cache",
        "clean:migration": "find src/jswasm -name '*.js' -delete && find src/jswasm -name '*.d.ts' -delete"
    }
}
```

**Development Workflow Commands**

```bash
# Start development server with hot reload
pnpm dev

# Run unit tests in watch mode
pnpm test:unit:watch

# Run browser integration tests
pnpm test

# TypeScript migration workflow
pnpm build:migration:watch  # Watch TypeScript compilation
pnpm typecheck:migration:watch # Type checking during migration

# Code quality checks
pnpm lint                    # Fix linting issues
pnpm format                   # Format code with Prettier
pnpm typecheck                # Full project type checking
```

## Browser Compatibility

### Supported Browsers

**Chrome/Chromium**

- **Minimum Version**: 86 (released 2020)
- **Required Features**: WebAssembly, SharedArrayBuffer, OPFS
- **Performance**: Excellent full feature support
- **Notes**: Primary development target

**Firefox**

- **Minimum Version**: 111 (released 2023)
- **Required Features**: WebAssembly, SharedArrayBuffer (disabled by default)
- **Performance**: Good with proper configuration
- **Notes**: Requires security headers for SharedArrayBuffer

**Safari**

- **Minimum Version**: 15.4 (released 2022)
- **Required Features**: WebAssembly, SharedArrayBuffer, OPFS (limited)
- **Performance**: Good with some limitations
- **Notes**: OPFS support incomplete, SharedArrayBuffer requires headers

**Edge**

- **Minimum Version**: 86 (Chromium-based)
- **Required Features**: Same as Chrome
- **Performance**: Excellent
- **Notes**: Inherits Chrome compatibility

### Feature Detection

**Environment Detection** (`runtime/environment-detector.mjs`)

```typescript
export interface BrowserCapabilities {
    webAssembly: boolean;
    sharedArrayBuffer: boolean;
    opfs: boolean;
    opfsSync: boolean;
    coepCoop: boolean;
    workerSupport: boolean;
}

export function detectCapabilities(): BrowserCapabilities {
    return {
        webAssembly: typeof WebAssembly !== "undefined",
        sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
        opfs: "storage" in navigator && "getDirectory" in navigator.storage,
        opfsSync:
            "storage" in navigator && "getDirectorySync" in navigator.storage,
        coepCoop: crossOriginIsolated,
        workerSupport: typeof Worker !== "undefined",
    };
}
```

**Feature Fallbacks**

- **WebAssembly Fallback**: Graceful degradation with error messages
- **SharedArrayBuffer Fallback**: Message passing via postMessage
- **OPFS Fallback**: IndexedDB or in-memory storage
- **Worker Fallback**: Main thread execution with warnings

## Security Considerations

### Required Headers

**SharedArrayBuffer Headers**

```http
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

**HTTP Server Configuration** (`scripts/http-server.ts`)

```typescript
const responseHeaders = {
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Content-Security-Policy":
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:;",
    "X-Content-Type-Options": "nosniff",
};
```

### Security Policies

**Content Security Policy**

- **Default**: Restrict to same origin
- **Scripts**: Allow inline scripts for development
- **WebAssembly**: Allow WASM execution
- **Workers**: Allow worker creation

**Origin Restrictions**

- **CORS**: Proper CORS configuration for cross-origin requests
- **OPFS**: Origin-private storage by design
- **SharedArrayBuffer**: Cross-origin isolation required

## Performance Optimizations

### WebAssembly Optimizations

**Compilation Flags**

```bash
# Emscripten optimization flags
emcc -O3 --closure 1 --memory-init-file 0 \
     -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 \
     -s EXPORTED_FUNCTIONS="['_sqlite3_open', '_sqlite3_prepare_v2', ...]" \
     -s EXPORTED_RUNTIME_METHODS="['cwrap', 'UTF8ToString', ...]"
```

**Memory Management**

- **Initial Heap**: 256MB (configurable)
- **Growth Strategy**: Automatic growth with limits
- **Cleanup**: Explicit memory deallocation
- **Pools**: Object pooling for frequent allocations

### Browser Performance

**OPFS Optimizations**

- **Sequential Access**: Optimized for read/write patterns
- **Batch Operations**: Group multiple file operations
- **Caching**: In-memory caching for frequently accessed data
- **Background Processing**: Web Workers for I/O operations

**JavaScript Optimizations**

- **Typed Arrays**: Efficient data transfer between JS and WASM
- **Minimal Overhead**: Direct function calls where possible
- **Async/Await**: Non-blocking operations for UI responsiveness
- **Lazy Loading**: Load WebAssembly on-demand

## Deployment Considerations

### Build Outputs

**Distribution Package**

```json
{
    "main": "./src/jswasm/sqlite3.mjs",
    "types": "./src/jswasm/sqlite3.d.ts",
    "exports": {
        ".": {
            "types": "./src/jswasm/sqlite3.d.ts",
            "default": "./src/jswasm/sqlite3.mjs"
        }
    },
    "files": [
        "src/jswasm/**/*",
        "src/jswasm/wasm/sqlite3.wasm",
        "README.md",
        "LICENSE"
    ]
}
```

**Bundle Optimization**

- **Tree Shaking**: Remove unused code
- **Code Splitting**: Separate WASM and JavaScript
- **Compression**: Gzip/Brotli compression
- **Caching**: Long-term caching for WASM binary

### Server Requirements

**HTTP Server Configuration**

- **HTTPS Required**: For OPFS and SharedArrayBuffer
- **Proper Headers**: COOP/COEP headers configured
- **MIME Types**: Correct WASM MIME type
- **CORS**: Proper cross-origin configuration

**CDN Considerations**

- **WASM Binary**: Serve from CDN with proper headers
- **Versioning**: Cache busting for WASM updates
- **Compression**: Enable compression on CDN
- **Geographic Distribution**: Global CDN for performance

## Monitoring and Debugging

### Development Tools

**Browser DevTools Integration**

- **WebAssembly Debugging**: Source maps for WASM
- **Memory Inspection**: Heap usage monitoring
- **Performance Profiling**: Function execution timing
- **Network Analysis**: Resource loading optimization

**Logging Infrastructure**

```typescript
export class Logger {
    static info(message: string, context?: any): void {
        console.log(`[WebSQLite] ${message}`, context);
    }

    static error(message: string, error?: Error): void {
        console.error(`[WebSQLite] ${message}`, error);

        // Send to error tracking service in production
        if (process.env.NODE_ENV === "production") {
            this.trackError(message, error);
        }
    }

    static warn(message: string, context?: any): void {
        console.warn(`[WebSQLite] ${message}`, context);
    }

    static debug(message: string, context?: any): void {
        if (process.env.NODE_ENV === "development") {
            console.debug(`[WebSQLite] ${message}`, context);
        }
    }
}
```

### Performance Monitoring

**Metrics Collection**

- **Query Execution Time**: Track slow queries
- **Memory Usage**: Monitor heap growth
- **File I/O Performance**: OPFS operation timing
- **Error Rates**: Track failure patterns

**Debug Mode**

- **Verbose Logging**: Detailed operation traces
- **Development Helpers**: Additional validation
- **Source Maps**: Debug mappings for WASM
- **Hot Reload**: Development-time reloading

This technical context provides the foundation for understanding the complete development environment, build processes, and deployment considerations for Web SQLite V2.
