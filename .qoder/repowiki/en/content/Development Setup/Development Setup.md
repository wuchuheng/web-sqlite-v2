# Development Setup

<cite>
**Referenced Files in This Document**   
- [package.json](file://package.json)
- [vite.config.ts](file://vite.config.ts)
- [vitest.unit.config.ts](file://vitest.unit.config.ts)
- [vitest.e2e.config.ts](file://vitest.e2e.config.ts)
- [tsconfig.json](file://tsconfig.json)
- [tsconfig.migration.json](file://tsconfig.migration.json)
- [tsconfig.eslint.json](file://tsconfig.eslint.json)
- [src/index.ts](file://src/index.ts)
- [src/sqliteWorker.ts](file://src/sqliteWorker.ts)
- [src/sqliteWorker.d.ts](file://src/sqliteWorker.d.ts)
- [tests/e2e/test-worker.ts](file://tests/e2e/test-worker.ts)
- [tests/e2e/worker-client.ts](file://tests/e2e/worker-client.ts)
- [scripts/http-server.ts](file://scripts/http-server.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Build Configuration with Vite](#build-configuration-with-vite)
4. [Testing Configuration with Vitest](#testing-configuration-with-vitest)
5. [TypeScript Configuration](#typescript-configuration)
6. [Development Commands](#development-commands)
7. [Common Development Issues](#common-development-issues)
8. [Performance Optimization](#performance-optimization)
9. [Debugging Techniques](#debugging-techniques)

## Introduction
This document provides comprehensive guidance for setting up a development environment for web-sqlite-v2, a SQLite3 WebAssembly implementation with OPFS support. The documentation covers build configuration using Vite, testing setup with Vitest for both unit and end-to-end tests, TypeScript configuration requirements, and practical instructions for running development servers, executing tests, and building production artifacts. It also addresses common development challenges and provides optimization and debugging strategies.

## Project Structure
The web-sqlite-v2 project follows a modular structure organized around core functionality areas. The source code is located in the `src` directory with a clear separation of concerns through dedicated subdirectories for different components.

```mermaid
graph TD
A[Project Root] --> B[scripts]
A --> C[src]
A --> D[tests]
A --> E[Configuration Files]
B --> B1[http-server.ts]
C --> C1[jswasm]
C --> C2[index.ts]
C --> C3[sqliteWorker.ts]
C --> C4[sqliteWorker.d.ts]
C1 --> C1a[api]
C1 --> C1b[runtime]
C1 --> C1c[system]
C1 --> C1d[utils]
C1 --> C1e[vfs]
C1 --> C1f[wasm]
D --> D1[e2e]
E --> E1[package.json]
E --> E2[vite.config.ts]
E --> E3[vitest.unit.config.ts]
E --> E4[vitest.e2e.config.ts]
E --> E5[tsconfig.json]
```

**Diagram sources**
- [package.json](file://package.json)
- [src/index.ts](file://src/index.ts)
- [tests/e2e/test-worker.ts](file://tests/e2e/test-worker.ts)

**Section sources**
- [package.json](file://package.json)
- [src/index.ts](file://src/index.ts)
- [tests/e2e/test-worker.ts](file://tests/e2e/test-worker.ts)

## Build Configuration with Vite
The project uses Vite as its build tool with specific configuration for library compilation and type generation. The Vite configuration is optimized for creating a JavaScript library with proper module formatting and type declaration files.

The build process is configured to:
- Target ESM (ECMAScript Module) output format
- Generate a single entry point at `dist/index.js`
- Create corresponding TypeScript declaration files
- Preserve source maps for debugging
- Avoid minification during development builds

```mermaid
flowchart TD
A[Build Process] --> B[Vite Configuration]
B --> C[Library Mode]
C --> D[Entry: src/index.ts]
C --> E[Format: ES Modules]
C --> F[Output: dist/index.js]
B --> G[Plugins]
G --> H[vite-plugin-dts]
H --> I[Generate .d.ts files]
H --> J[Copy declaration files]
H --> K[Insert types entry]
B --> L[Build Options]
L --> M[Output Directory: dist]
L --> N[Sourcemap: true]
L --> O[Empty Output Directory]
L --> P[No Minification]
```

**Diagram sources**
- [vite.config.ts](file://vite.config.ts)
- [package.json](file://package.json)

**Section sources**
- [vite.config.ts](file://vite.config.ts)
- [package.json](file://package.json)

## Testing Configuration with Vitest
The project implements a comprehensive testing strategy using Vitest for both unit and end-to-end tests. Two separate configuration files handle different testing scenarios with appropriate settings for each environment.

### Unit Testing Configuration
The unit test configuration focuses on testing individual components and utility functions in isolation. It includes specific patterns for unit test files and can be extended to support browser-based testing when needed.

```mermaid
flowchart TD
A[Unit Test Config] --> B[vitest.unit.config.ts]
B --> C[Test Patterns]
C --> D[Include: **/*.unit.test.ts]
C --> E[Exclude: E2E tests]
B --> F[Server Headers]
F --> G[Cross-Origin-Opener-Policy: same-origin]
F --> H[Cross-Origin-Embedder-Policy: require-corp]
B --> I[Test Settings]
I --> J[Global Variables: disabled]
I --> K[Reporters: default]
```

### End-to-End Testing Configuration
The end-to-end test configuration supports comprehensive testing of the complete system, including browser environments and OPFS functionality. It enables browser testing with Playwright and configures necessary headers for SharedArrayBuffer and OPFS support.

```mermaid
flowchart TD
A[E2E Test Config] --> B[vitest.e2e.config.ts]
B --> C[Test Patterns]
C --> D[Include: **/*.e2e.test.ts]
B --> E[Browser Testing]
E --> F[Enabled: true]
E --> G[Provider: Playwright]
E --> H[Browser: Chromium]
E --> I[Headless: false]
B --> J[Server Headers]
J --> K[Cross-Origin-Opener-Policy: same-origin]
J --> L[Cross-Origin-Embedder-Policy: require-corp]
J --> M[Access-Control-Allow-Origin: *]
B --> N[Test Settings]
N --> O[Timeout: 30000ms]
N --> P[Reporters: default]
B --> Q[Worker Configuration]
Q --> R[Format: ES Modules]
```

**Diagram sources**
- [vitest.unit.config.ts](file://vitest.unit.config.ts)
- [vitest.e2e.config.ts](file://vitest.e2e.config.ts)

**Section sources**
- [vitest.unit.config.ts](file://vitest.unit.config.ts)
- [vitest.e2e.config.ts](file://vitest.e2e.config.ts)
- [tests/e2e/test-worker.ts](file://tests/e2e/test-worker.ts)
- [tests/e2e/worker-client.ts](file://tests/e2e/worker-client.ts)

## TypeScript Configuration
The project utilizes multiple TypeScript configuration files to support different development and build scenarios. This approach allows for flexible type checking and compilation settings across various contexts.

### Primary Configuration (tsconfig.json)
The main TypeScript configuration provides strict type checking for development with the following key settings:
- Target: ES2022
- Module: ESNext
- Module Resolution: bundler
- Strict mode enabled
- WebWorker library support
- No emit during development

### Migration Configuration (tsconfig.migration.json)
This configuration is specifically designed for migration scenarios with different settings:
- Emit declaration files
- No emit during compilation
- Different include patterns for specific source files
- Exclusion of test files

### ESLint Configuration (tsconfig.eslint.json)
This configuration extends the base settings and includes additional files needed for linting:
- Extends tsconfig.json
- Includes script files and configuration files
- Supports linting of TypeScript, JavaScript, and MJS files

```mermaid
graph TD
A[TypeScript Configurations] --> B[tsconfig.json]
A --> C[tsconfig.migration.json]
A --> D[tsconfig.eslint.json]
B --> B1[Target: ES2022]
B --> B2[Module: ESNext]
B --> B3[Strict Mode]
B --> B4[WebWorker Lib]
B --> B5[No Emit]
C --> C1[Declaration Files]
C --> C2[Specific Includes]
C --> C3[Exclude Tests]
D --> D1[Extends Base]
D --> D2[Linting Files]
D --> D3[Scripts and Configs]
```

**Diagram sources**
- [tsconfig.json](file://tsconfig.json)
- [tsconfig.migration.json](file://tsconfig.migration.json)
- [tsconfig.eslint.json](file://tsconfig.eslint.json)

**Section sources**
- [tsconfig.json](file://tsconfig.json)
- [tsconfig.migration.json](file://tsconfig.migration.json)
- [tsconfig.eslint.json](file://tsconfig.eslint.json)

## Development Commands
The project provides a comprehensive set of npm scripts for various development tasks, accessible through the package.json file.

### Build Commands
- `build`: Run Vite build in watch mode
- `build:migration`: Compile TypeScript with migration configuration
- `build:migration:watch`: Watch mode for migration compilation

### Testing Commands
- `test`: Run both unit and end-to-end tests
- `test:unit`: Execute unit tests only
- `test:e2e`: Execute end-to-end tests only
- `test:lint`: Run linting on test files

### Development Commands
- `dev`: Start Vite development server
- `preview`: Preview production build
- `typecheck`: Perform type checking without emitting files
- `typecheck:watch`: Watch mode for type checking

### Quality Assurance Commands
- `lint`: Run ESLint with auto-fixing
- `format`: Format code with Prettier
- `docs:dev`: Start VitePress documentation server

```mermaid
flowchart TD
A[Development Commands] --> B[Build]
B --> B1[build: Vite watch]
B --> B2[build:migration]
B --> B3[build:migration:watch]
A --> C[Testing]
C --> C1[test: Run all tests]
C --> C2[test:unit]
C --> C3[test:e2e]
C --> C4[test:lint]
A --> D[Development]
D --> D1[dev: Vite server]
D --> D2[preview: Build preview]
D --> D3[typecheck]
D --> D4[typecheck:watch]
A --> E[Quality]
E --> E1[lint: ESLint]
E --> E2[format: Prettier]
E --> E3[docs:dev: VitePress]
```

**Section sources**
- [package.json](file://package.json)

## Common Development Issues
Developers working with web-sqlite-v2 may encounter several common issues related to type resolution, worker loading, and browser security policies.

### Type Resolution Errors
Type resolution issues typically occur when:
- Declaration files are not properly generated
- TypeScript configuration paths are incorrect
- Module resolution settings conflict with bundler expectations

Solutions include:
- Ensuring `vite-plugin-dts` is properly configured
- Verifying TypeScript include/exclude patterns
- Checking module resolution settings in tsconfig.json

### Worker Loading Problems
Worker-related issues often stem from:
- Incorrect worker import syntax
- Missing or incorrect worker query parameters
- CORS and security policy violations

The project uses inline workers with the syntax `import SqliteWorker from "./sqliteWorker?worker&inline"` which requires proper Vite configuration.

### Browser Security Policies
OPFS and SharedArrayBuffer functionality require specific HTTP headers:
- Cross-Origin-Embedder-Policy: require-corp
- Cross-Origin-Opener-Policy: same-origin

These headers are configured in both Vite and the custom HTTP server to ensure proper functionality.

```mermaid
flowchart TD
A[Common Issues] --> B[Type Resolution]
B --> B1[Missing .d.ts files]
B --> B2[Incorrect paths]
B --> B3[Module resolution]
A --> C[Worker Loading]
C --> C1[Import syntax]
C --> C2[Query parameters]
C --> C3[CORS policies]
A --> D[Browser Security]
D --> D1[COEP: same-origin]
D --> D2[COOP: require-corp]
D --> D3[Local server required]
B --> E[Solutions]
C --> E
D --> E
E --> E1[Check vite-plugin-dts]
E --> E2[Verify worker syntax]
E --> E3[Use http-server.ts]
E --> E4[Validate headers]
```

**Section sources**
- [vite.config.ts](file://vite.config.ts)
- [vitest.e2e.config.ts](file://vitest.e2e.config.ts)
- [scripts/http-server.ts](file://scripts/http-server.ts)
- [src/index.ts](file://src/index.ts)

## Performance Optimization
Several strategies can be employed to optimize the development experience and improve performance.

### Development Server Optimization
The custom HTTP server script (`http-server.ts`) provides optimized serving with:
- Proper security headers for OPFS and SharedArrayBuffer
- Automatic browser opening
- Directory listing and index.html fallback
- MIME type mapping for various file types

### Build Performance
Vite's native ES module serving provides fast development server startup and hot module replacement. The configuration avoids unnecessary minification during development to improve build speed.

### Testing Optimization
Strategies for faster testing include:
- Running unit and end-to-end tests separately
- Using watch mode selectively
- Configuring appropriate test timeouts
- Leveraging Vite's optimization features

```mermaid
flowchart TD
A[Performance Optimization] --> B[Development Server]
B --> B1[Custom http-server.ts]
B --> B2[Security headers]
B --> B3[Auto browser open]
B --> B4[MIME type mapping]
A --> C[Build Performance]
C --> C1[Vite native ESM]
C --> C2[Fast HMR]
C --> C3[No minification]
C --> C4[Source maps]
A --> D[Testing Optimization]
D --> D1[Separate test suites]
D --> D2[Selective watch]
D --> D3[Appropriate timeouts]
D --> D4[Vite optimization]
```

**Section sources**
- [scripts/http-server.ts](file://scripts/http-server.ts)
- [vite.config.ts](file://vite.config.ts)
- [vitest.e2e.config.ts](file://vitest.e2e.config.ts)

## Debugging Techniques
Effective debugging strategies are essential for resolving issues in the web-sqlite-v2 development environment.

### Worker Debugging
Since the SQLite operations run in a Web Worker, debugging requires specific approaches:
- Using console.log statements in worker code
- Monitoring message passing between main thread and worker
- Setting breakpoints in worker scripts
- Using browser developer tools' worker inspection

### End-to-End Test Debugging
The end-to-end tests can be debugged by:
- Running tests in non-headless mode
- Using the worker client pattern to isolate test execution
- Adding detailed logging in test workers
- Verifying environment setup before test execution

### Type System Debugging
When encountering type issues:
- Use `typecheck:watch` to get continuous feedback
- Verify declaration file generation
- Check for conflicts between different tsconfig files
- Use TypeScript's built-in diagnostic tools

```mermaid
flowchart TD
A[Debugging Techniques] --> B[Worker Debugging]
B --> B1[Console logging]
B --> B2[Message monitoring]
B --> B3[Breakpoints]
B --> B4[DevTools inspection]
A --> C[E2E Test Debugging]
C --> C1[Non-headless mode]
C --> C2[Worker client]
C --> C3[Detailed logging]
C --> C4[Environment checks]
A --> D[Type Debugging]
D --> D1[typecheck:watch]
D --> D2[Declaration files]
D --> D3[Config conflicts]
D --> D4[TS diagnostics]
```

**Section sources**
- [src/sqliteWorker.ts](file://src/sqliteWorker.ts)
- [tests/e2e/test-worker.ts](file://tests/e2e/test-worker.ts)
- [tests/e2e/worker-client.ts](file://tests/e2e/worker-client.ts)
- [tsconfig.json](file://tsconfig.json)