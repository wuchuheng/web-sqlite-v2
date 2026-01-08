# 02 Requirements

## 1) MVP (P0) requirements

### Core database functionality
- **R1**: Open a SQLite database stored in OPFS with a given filename
- **R2**: Execute SQL statements (INSERT, UPDATE, DELETE, CREATE, etc.) that don't return rows
- **R3**: Execute SQL queries (SELECT) and return results as arrays of objects
- **R4**: Support parameterized queries with both positional (?) and named ($name) parameters
- **R5**: Support SQL data types: NULL, INTEGER, TEXT, BLOB (Uint8Array/ArrayBuffer), REAL, FLOAT
- **R6**: Close database connection and release resources

### Transaction support
- **R7**: Execute multiple operations within a transaction
- **R8**: Automatically COMMIT on success
- **R9**: Automatically ROLLBACK on error
- **R10**: Ensure transaction operations are mutex-queued

### Release versioning system
- **R11**: Accept an immutable `releases` configuration array defining schema history
- **R12**: Each release config includes: version (semver), migrationSQL, optional seedSQL
- **R13**: Compute SHA-256 hashes for migration and seed SQL
- **R14**: Create OPFS directory structure with versioned subdirectories
- **R15**: Store migration.sql and seed.sql files alongside each version's database
- **R16**: Maintain metadata database (release.sqlite3) tracking all versions
- **R17**: Automatically apply new releases on database open
- **R18**: Validate release configs match archived versions (hash check)
- **R19**: Ensure releases are applied atomically with rollback on failure
- **R20**: Support both "release" (immutable) and "dev" (mutable) version modes

### Dev tooling
- **R21**: Provide `devTool.release()` to create new dev versions
- **R22**: Provide `devTool.rollback(version)` to remove dev versions above target
- **R23**: Prevent rollback below latest release version
- **R24**: Acquire metadata lock before release/rollback operations

### Concurrency and safety
- **R25**: Use mutex to queue all database operations sequentially
- **R26**: Ensure worker processes one command at a time
- **R27**: Handle worker errors and propagate to main thread
- **R28**: Validate SharedArrayBuffer availability on initialization

### Worker communication
- **R29**: Run SQLite WASM in dedicated Web Worker
- **R30**: Implement message-passing protocol with request/response pattern
- **R31**: Support OPEN, EXECUTE, QUERY, CLOSE events
- **R32**: Manage message IDs for promise resolution
- **R33**: Handle worker termination and cleanup

### OPFS integration
- **R34**: Create database directories in OPFS root
- **R35**: Ensure default.sqlite3 exists (empty database)
- **R36**: Copy database files for versioned releases
- **R37**: Read/write SQL files alongside databases
- **R38**: Handle OPFS errors gracefully

### TypeScript support
- **R39**: Provide full TypeScript type definitions
- **R40**: Export DBInterface, ReleaseConfig, and related types
- **R41**: Support generic query results: `query<T>(sql, params)`

### Debug capabilities
- **R42**: Support `debug` option to enable SQL execution logging
- **R43**: Log query timing, SQL, and bind parameters in worker
- **R44**: Stream debug logs to main thread console.debug

### Error handling
- **R45**: Throw descriptive errors for invalid inputs
- **R46**: Throw errors for SQL execution failures
- **R47**: Throw errors for release/rollback validation failures
- **R48**: Preserve error stack traces across worker boundary

## 2) Success criteria

### Functional tests
- **S1**: E2E tests pass for all core operations (open, exec, query, close, transaction)
- **S2**: E2E tests pass for release versioning (apply, hash validation, ordering)
- **S3**: E2E tests pass for dev tooling (devTool.release, devTool.rollback)
- **S4**: Unit tests pass for mutex implementation
- **S5**: All tests run successfully in browser environment (Playwright)

### Persistence tests
- **S6**: Database persists across page reloads
- **S7**: Multiple releases apply correctly on subsequent opens
- **S8**: Versioned database files exist in correct OPFS structure
- **S9**: Metadata database contains correct version history

### Migration tests
- **S10**: New releases auto-apply when version is greater than latest
- **S11**: Hash mismatch throws error for existing releases
- **S12**: Migration and seed SQL execute in transaction
- **S13**: Failed migrations roll back database and metadata

### Dev tooling tests
- **S14**: Dev versions create correctly and are marked as "dev" mode
- **S15**: Rollback removes dev version directories and metadata
- **S16**: Rollback below latest release throws error
- **S17**: Multiple dev versions can be created and rolled back

### Concurrency tests
- **S18**: Mutex ensures sequential execution of concurrent operations
- **S19**: Worker processes one command at a time
- **S20**: Transaction operations complete atomically

### Type safety tests
- **S21**: TypeScript compilation succeeds with no type errors
- **S22**: Generic query results infer correct types
- **S23**: Type definitions match implementation

### Browser compatibility
- **S24**: Library initializes in Chrome with COOP/COEP headers
- **S25**: Library initializes in Firefox with COOP/COEP headers
- **S26**: SharedArrayBuffer availability check works correctly
- **S27**: Graceful error when SharedArrayBuffer unavailable

### Build and bundle
- **S28**: Production build completes without errors
- **S29**: Bundle size is reasonable (< 1MB minified)
- **S30**: WASM module optimizes successfully
- **S31**: TypeScript declarations generate correctly

## 3) Non-goals (explicitly out of scope)

### Database features
- **NG1**: Multiple database connections in a single worker
- **NG2**: Shared database connections across multiple workers
- **NG3**: SQL query planning or optimization analysis tools
- **NG4**: Custom SQLite builds or extensions
- **NG5**: Full-text search (FTS) extensions
- **NG6**: JSON extensions (though SQLite JSON functions may work)
- **NG7**: Backup/restore functionality beyond OPFS file access
- **NG8**: Database encryption (though possible with SQLite extensions)
- **NG9**: Replication or synchronization with server databases
- **NG10**: Query result streaming (always returns full arrays)

### Release system features
- **NG11**: Automatic SQL migration generation
- **NG12**: SQL normalization or formatting
- **NG13**: Automatic pruning of old versions
- **NG14**: Parallel query routing across multiple versioned databases
- **NG15**: Release branching or multiple release streams
- **NG16**: Downgrades (only rollback within release versions supported)
- **NG17**: Migration reversal or "down" migrations
- **NG18**: Release dependencies or constraints

### API features
- **NG19**: Prepared statements with cursor-based fetching
- **NG20**: Batch operations or bulk insert APIs
- **NG21**: Change tracking or data observability
- **NG22**: Query builder or ORM functionality
- **NG23**: Reactive queries or live updates
- **NG24**: Schema introspection APIs beyond raw SQL
- **NG25**: Direct file handle access to database files

### Tooling features
- **NG26**: Built-in database explorer UI (separate documentation site provides this)
- **NG27**: Migration CLI tools
- **NG28**: Database seeding from external files
- **NG29**: Query logging or analytics dashboard
- **NG30**: Performance profiling tools beyond debug mode

### Browser support
- **NG31**: Support for browsers without OPFS
- **NG32**: Support for browsers without SharedArrayBuffer
- **NG33**: Support for very old browser versions (focus on modern browsers)
- **NG34**: Server-side rendering (SSR) or Node.js environments
- **NG35**: React Native or mobile web views

### Developer experience
- **NG36**: Integration with specific frameworks (React, Vue, etc.)
- **NG37**: State management library integrations
- **NG38**: Automatic TypeScript type generation from schema
- **NG39**: GraphQL or REST API generation from schema
- **NG40**: Documentation site as part of library bundle

## 4) Backlog (future ideas)

### P1 (High priority future work)
- **B1**: Prepared statement API with reusable statements
- **B2**: Query result streaming for large datasets
- **B3**: Built-in backup/restore to downloadable files
- **B4**: Schema migration helper utilities
- **B5**: Better error messages for common SQL mistakes
- **B6**: Performance metrics API (query times, memory usage)

### P2 (Medium priority)
- **B7**: Batch insert optimization API
- **B8**: Database export to SQL dump
- **B9**: Import from SQL dump
- **B10**: Database file compression for storage
- **B11**: Query result caching
- **B12**: Connection pooling for multiple databases
- **B13**: Observable/query subscription pattern

### P3 (Low priority / exploratory)
- **B14**: Web SQL Database backward compatibility layer
- **B15**: IndexedDB-to-SQLite migration tool
- **B16**: SQLite extension loading mechanism
- **B17**: Custom SQLite build configuration
- **B18**: Database encryption support
- **B19**: Multi-tab synchronization via BroadcastChannel
- **B20**: ORM-like query builder
- **B21**: GraphQL schema generation from SQLite

### Documentation and examples
- **B22**: React integration example
- **B23**: Vue integration example
- **B24**: Svelte integration example
- **B25**: PWA offline-first tutorial
- **B26**: Large dataset handling guide
- **B27**: Performance optimization guide
- **B28**: Migration patterns and best practices

### Testing and tooling
- **B29**: Visual query inspector for debugging
- **B30**: Migration test fixture generator
- **B31**: Performance benchmark suite
- **B32**: Load testing tools
- **B33**: Database comparison/diff tool
