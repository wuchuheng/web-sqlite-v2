# Active Context: Web SQLite V2

## Current Focus: TypeScript Migration

The project is currently in the middle of a comprehensive TypeScript migration from JavaScript (.mjs) files to TypeScript (.ts). This is the primary development activity and the main focus of current work.

### Migration Status Overview

**Completed Modules:**

- `src/jswasm/utils/utf8/` - Fully migrated with unit tests
- `src/jswasm/utils/path/` - **NEWLY COMPLETED** - Full TypeScript migration with comprehensive test coverage
    - Migrated from `src/jswasm/utils/path.mjs` to `src/jswasm/utils/path/path.ts`
    - Type definitions moved to `src/jswasm/utils/path/types.d.ts`
    - Comprehensive unit tests in `src/jswasm/utils/path/path.test.ts`
    - Test plan documented in `docs/development/path-migration-test-plan.md`
    - Follows three-phase processing pattern with numeric comments
- `src/jswasm/utils/async-utils/` - **NEWLY COMPLETED** - Full TypeScript migration with comprehensive test coverage
    - Migrated from `src/jswasm/utils/async-utils.mjs` to `src/jswasm/utils/async-utils/async-utils.ts`
    - Moved to dedicated `async-utils/` directory structure
    - Comprehensive unit tests in `src/jswasm/utils/async-utils.test.ts`
    - Test plan documented in `docs/development/async-utils-test-plan.md`
    - Updated import path in main `sqlite3.mjs` to use new TypeScript module
    - Follows three-phase processing pattern with numeric comments
- Various utility modules have TypeScript definitions (.d.ts files)
- Core type infrastructure is in place

**In Progress:**

- Main migration plan documented in `docs/development/jswasm-typescript-migration.md`
- Build configuration ready with `tsconfig.migration.json`
- Test infrastructure established with Vitest

**Remaining Work:**

- Next migration targets: `memory-utils.mjs`, system layer modules
- Import updates from `.mjs` to `.js` after compilation for completed modules
- Manual `.d.ts` replacement with generated declarations
- Bulk of `.mjs` files in `src/jswasm/` still need migration

### Current Migration Strategy

The migration follows a **bottom-up, insurance method** approach:

1. **Leaf First**: Migrate utility modules before their dependents
2. **Dual Files**: Keep original `.mjs` until TypeScript version is verified
3. **Test-Driven**: Create unit tests before migration, verify after
4. **Incremental**: One module at a time with verification at each step
5. **Compile & Replace**: Use `tsconfig.migration.json` for in-place compilation

### Active Development Patterns

**Three-Phase Processing Pattern** (Mandatory for migrated code):

```typescript
export function exampleFunction(input: InputType): OutputType {
    // 1. Input validation and preparation
    if (!input) throw new Error("Invalid input");

    // 2. Core processing logic
    const result = processInput(input);

    // 3. Output handling
    return formatResult(result);
}
```

**Numeric Comments** (Required inside function bodies only):

- `// 1.` for input handling
- `// 2.` for core processing
- `// 3.` for output/return
- `// 2.1`, `// 2.2` for sub-steps when needed

## Recent Changes & Decisions

### Architecture Refactoring (Recent Commits)

- **Modular Extraction**: Split monolithic `sqlite3.mjs` into focused modules
- **System Separation**: Extracted `wasi-functions.mjs` and `syscalls.mjs`
- **Type Infrastructure**: Established comprehensive `.d.ts` coverage
- **Build Pipeline**: Configured TypeScript compilation with in-place emit
- **Async Utils Migration**: Completed migration from `.mjs` to `.ts` with dedicated directory structure

### Development Environment Setup

- **Package Manager**: Standardized on pnpm 10.17.1
- **Build Tools**: Vite for bundling, TypeScript for compilation
- **Testing**: Vitest for unit tests, browser tests for integration
- **Linting**: ESLint with strict TypeScript rules and custom conventions

### Code Quality Standards

- **Line Length**: Maximum 120 characters (strictly enforced)
- **Function Size**: 20-30 lines maximum for functions
- **Parameter Count**: Maximum 4 parameters per function
- **Complexity**: Cyclomatic complexity ≤ 8, nesting depth ≤ 3 levels

## Immediate Next Steps

### High Priority (This Sprint)

1. **Complete Path and Async Utils Migration Cleanup**
    - Update imports from `.mjs` to compiled `.js` for dependent modules
    - Remove original `src/jswasm/utils/path.mjs` file
    - Replace manual `.d.ts` with generated TypeScript declaration
    - Run browser tests to verify no regressions

2. **Select Next Migration Target**
    - Choose `memory-utils.mjs` as next leaf module (async-utils completed)
    - Apply Primary Safety Workflow steps 1-5
    - Document migration patterns discovered from completed modules
    - Update migration guide with new lessons learned

3. **Browser Test Verification**
    - Run `pnpm test` after migration cleanup
    - Ensure 0 failures and no console errors
    - Verify OPFS persistence still works
    - Check memory usage and performance

### Medium Priority (Next Sprint)

1. **Expand Unit Test Coverage**
    - Add tests for remaining utility modules before migration
    - Establish test patterns for complex modules
    - Set up automated test execution in development

2. **Migration Tooling**
    - Automate migration checklist verification
    - Create scripts for common migration steps
    - Set up pre-commit hooks for migration validation

3. **Documentation Updates**
    - Update API docs as modules are migrated
    - Add TypeScript-specific examples
    - Document type patterns and conventions

## Current Technical Context

### Working Directory Structure

```
src/jswasm/
├── sqlite3.mjs              # Main entry point (needs migration)
├── sqlite3.d.ts             # Type definitions (current)
├── utils/                   # Mixed .mjs/.ts files
│   ├── utf8/               # Fully migrated ✓
│   ├── path.mjs            # Migration completed, cleanup pending
│   ├── async-utils/        # Fully migrated ✓
│   ├── memory-utils.mjs    # Next migration candidate
│   └── wasm-loader.mjs    # Complex, later migration
├── system/                 # System call implementations
├── vfs/                    # Virtual File System layer
├── runtime/                # Runtime management
├── wasm/                   # WebAssembly integration
└── api/                    # High-level APIs
```

### Build Configuration

- **Main Build**: `tsconfig.json` for full project compilation
- **Migration Build**: `tsconfig.migration.json` for incremental migration
- **In-Place Emit**: TypeScript compiles `.js` next to `.ts` files
- **Declaration Generation**: Controlled per-module for `.d.ts` replacement

### Testing Infrastructure

- **Unit Tests**: Vitest with fast execution and TypeScript support
- **Integration Tests**: Browser-based test suite at `/tests/`
- **Migration Tests**: Verify behavior parity between `.mjs` and `.ts`
- **Performance Tests**: Ensure no regression in query execution

## Active Challenges & Considerations

### Technical Challenges

**Memory Management**

- WebAssembly memory access patterns need careful typing
- Typed array operations between JavaScript and WASM boundaries
- Cleanup verification for resource management

**Browser Compatibility**

- OPFS API variations across browser versions
- SharedArrayBuffer header requirements (COOP/COEP)
- WebAssembly instantiation differences

**Type Safety**

- Complex union types for SQLite API return values
- Generic constraints for database operations
- Runtime type checking vs compile-time guarantees

### Development Process Challenges

**Incremental Migration Complexity**

- Managing dual files during transition period
- Import path updates across dependent modules
- Build system coordination for mixed source types

**Test Coverage Maintenance**

- Ensuring tests cover both original and migrated behavior
- Browser test automation for continuous integration
- Performance regression detection during migration

## Important Patterns & Preferences

### Code Organization Patterns

- **High Cohesion**: Related functionality grouped in single modules
- **Low Coupling**: Minimal dependencies between modules
- **Clear Boundaries**: Well-defined import/export interfaces
- **Consistent Naming**: camelCase for functions/variables, PascalCase for classes

### API Design Patterns

- **Fluent Interfaces**: Method chaining for database operations
- **Options Objects**: Configuration objects over many parameters
- **Callback/Promise Support**: Both synchronous and asynchronous patterns
- **Error Handling**: Consistent error types and propagation

### Development Workflow Patterns

- **Test-First Development**: Write tests before implementation
- **Incremental Verification**: Test after each small change
- **Documentation同步**: Update docs alongside code changes
- **Peer Review**: All changes reviewed before merge

## Learning & Insights

### Migration Insights Gained

- **Bottom-Up Approach Critical**: Starting with utilities prevents cascade failures
- **Test Coverage Essential**: Unit tests catch subtle behavior differences
- **Type Safety Benefits**: TypeScript catches many runtime errors early
- **Documentation Value**: Clear migration patterns speed up subsequent modules
- **Directory Structure Benefits**: Dedicated directories improve organization and discoverability

### Performance Insights

- **WebAssembly Overhead**: Minimal for most operations, significant for small queries
- **Memory Management**: Proper cleanup crucial for long-running applications
- **OPFS Performance**: Excellent for sequential access, random access needs optimization
- **Browser Differences**: Significant performance variations between browsers

### Architecture Insights

- **Modular Benefits**: Easier testing, migration, and maintenance
- **Type Definitions**: Critical for developer experience and adoption
- **Worker Integration**: Essential for UI responsiveness during operations
- **Error Boundaries**: Important for graceful degradation

## Current Dependencies & Constraints

### External Dependencies

- **SQLite Upstream**: Version 3.50.4 compiled with Emscripten SDK 3.1.70
- **TypeScript**: Version ~5.9.3 for migration and compilation
- **Vite**: Version 7.1.10 for bundling and development server
- **Vitest**: For fast unit testing during migration

### Internal Constraints

- **Browser-Only**: No Node.js support, focuses on modern browsers
- **OPFS Required**: Requires browsers with Origin Private File System support
- **SharedArrayBuffer**: Needs specific security headers for functionality
- **Memory Limits**: Subject to browser WebAssembly memory constraints

### Development Constraints

- **ESM Modules**: All code must be ECMAScript modules
- **Type Safety**: Strict TypeScript configuration enforced
- **Line Length**: 120-character maximum strictly enforced
- **Documentation**: All exports must have JSDoc documentation

## Decision Log

### Recent Technical Decisions

**Migration Strategy**: Bottom-up with test-first approach

- **Reasoning**: Minimizes risk, ensures behavior preservation
- **Impact**: Slower initial progress, but more reliable final result
- **Status**: Proving effective with UTF-8, path, and async-utils modules

**In-Place Compilation**: TypeScript emits `.js` next to `.ts`

- **Reasoning**: Simplifies import path management during migration
- **Impact**: Cleaner migration process, less file system churn
- **Status**: Working well with `tsconfig.migration.json`

**Numeric Comments**: Required inside function bodies only

- **Reasoning**: Improves code readability without cluttering interfaces
- **Impact**: Clearer code structure, better developer onboarding
- **Status**: Being established as standard for all migrated code

**Dedicated Directory Structure**: Organize migrated modules in subdirectories

- **Reasoning**: Better separation of concerns, improved discoverability
- **Impact**: Cleaner project structure, easier maintenance
- **Status**: Successfully implemented for async-utils module

### Pending Decisions

**Automated Testing in CI**: Browser test automation setup

- **Options**: Playwright, Puppeteer, or custom browser automation
- **Considerations**: CI/CD integration, cross-browser testing, cost
- **Timeline**: Decision needed within next 2 sprints

**Module Organization**: Final structure post-migration

- **Options**: Current directory structure vs. reorganization
- **Considerations**: Import paths, discoverability, maintenance
- **Timeline**: Decision can wait until migration progresses further

This active context will evolve as the TypeScript migration progresses and new patterns emerge from the development process.
