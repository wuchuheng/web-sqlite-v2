# Logging Module Test Plan

## Target Module

- **Source**: `src/jswasm/vfs/opfs/async-proxy/logging.mjs`
- **Types**: `src/jswasm/vfs/opfs/async-proxy/logging.d.ts`

## Test Cases to Cover

### 1. Constructor Tests

- Test that WorkerLogger can be instantiated with a levelProvider function
- Test that levelProvider is stored correctly
- Test that backends Map is initialized with correct console methods

### 2. Verbosity Level Tests

- Test that levelProvider() returning values affects log filtering correctly
- Test logAt() behavior with different levels (0=error, 1=warn, 2=info)
- Test that logs are suppressed when levelProvider returns higher values
- Test that logs are shown when levelProvider returns lower or equal values

### 3. Console Method Tests

- Test that error() calls logAt with level 0
- Test that warn() calls logAt with level 1
- Test that log() calls logAt with level 2
- Test that all methods forward arguments correctly to console methods
- Test that "OPFS asyncer:" prefix is added to all console output

### 4. Global Assignment Tests

- Test that WorkerLogger is assigned to globalThis.WorkerLogger
- Test that global assignment doesn't overwrite existing properties unnecessarily

### 5. Type Tests

- Test that WorkerLogLevel type (0 | 1 | 2) is enforced
- Test that WorkerLogArgument accepts various valid argument types
- Test that method signatures match the .d.ts declarations

## Test Data and Scaffolding

### Mock Console

- Create mock console methods to capture calls for verification
- Use vitest vi.fn() to spy on console.error, console.warn, console.log

### Test Level Providers

- Static level providers returning specific values
- Dynamic level providers to test runtime behavior changes

### Sample Log Arguments

- Various argument types: strings, numbers, objects, arrays
- Multiple arguments to test variadic forwarding

## Scaffolding Helpers

- Helper to create mock console
- Helper to verify console calls with correct prefix and arguments
- Setup/teardown for globalThis cleanup
