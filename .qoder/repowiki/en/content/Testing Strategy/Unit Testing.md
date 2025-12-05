# Unit Testing

<cite>
**Referenced Files in This Document**   
- [async-utils.unit.test.ts](file://src/jswasm/utils/async-utils/async-utils.unit.test.ts)
- [path.unit.test.ts](file://src/jswasm/utils/path/path.unit.test.ts)
- [memory-utils.unit.test.ts](file://src/jswasm/utils/memory-utils/memory-utils.unit.test.ts)
- [struct-binder-accessors.unit.test.ts](file://src/jswasm/utils/struct-binder/struct-binder-accessors/struct-binder-accessors.unit.test.ts)
- [string-helpers.unit.test.ts](file://src/jswasm/utils/whwasm/string-helpers/string-helpers.unit.test.ts)
- [heap-helpers.unit.test.ts](file://src/jswasm/utils/whwasm/heap-helpers/heap-helpers.unit.test.ts)
- [installer-context.unit.test.ts](file://src/jswasm/utils/whwasm/installer-context/installer-context.unit.test.ts)
- [function-table-helpers.unit.test.ts](file://src/jswasm/utils/whwasm/function-table-helpers/function-table-helpers.unit.test.ts)
- [scoped-alloc-helpers.unit.test.ts](file://src/jswasm/utils/whwasm/scoped-alloc-helpers/scoped-alloc-helpers.unit.test.ts)
- [vitest.unit.config.ts](file://vitest.unit.config.ts)
</cite>

## Table of Contents

1. [Introduction](#introduction)
2. [Unit Testing Strategy Overview](#unit-testing-strategy-overview)
3. [Core Utility Modules and Their Test Coverage](#core-utility-modules-and-their-test-coverage)
4. [Testing Isolation with Vitest](#testing-isolation-with-vitest)
5. [Mocking and Dependency Simulation](#mocking-and-dependency-simulation)
6. [Type Checking and Edge-Case Validation](#type-checking-and-edge-case-validation)
7. [Assertion Patterns and Error Simulation](#assertion-patterns-and-error-simulation)
8. [State Verification in Asynchronous Functions](#state-verification-in-asynchronous-functions)
9. [Memory Management and WASM Interop Testing](#memory-management-and-wasm-interop-testing)
10. [String Encoding and UTF-8 Handling](#string-encoding-and-utf-8-handling)
11. [Best Practices for Maintainable Unit Tests](#best-practices-for-maintainable-unit-tests)
12. [CI Integration via vitest.unit.config.ts](#ci-integration-via-vitestunitconfigts)
13. [Debugging Common Test Failures](#debugging-common-test-failures)
14. [Conclusion](#conclusion)

## Introduction

This document details the unit testing strategy employed in the web-sqlite-v2 project, focusing on low-level utility modules that support WebAssembly (WASM) integration, memory management, path operations, and asynchronous operations. The testing framework is built on Vitest, enabling isolated, fast, and reliable unit tests that validate correctness at the module level. Each utility is tested independently to ensure robustness in core operations such as memory allocation, string encoding, and function table management. This documentation provides insight into test design patterns, assertion strategies, and best practices followed across the codebase.

## Unit Testing Strategy Overview

The unit testing strategy in web-sqlite-v2 emphasizes isolation, determinism, and comprehensive edge-case coverage. All unit tests are located in files ending with `.unit.test.ts` and are executed using Vitest, a modern testing framework optimized for Vite-based projects. The strategy ensures that each utility module is validated independently, with dependencies mocked or simulated to prevent external interference. This approach enables precise control over test conditions and facilitates debugging by minimizing side effects.

The primary goals of the unit testing strategy include:

- Validating low-level operations such as memory access, pointer arithmetic, and string encoding
- Ensuring correct behavior under error conditions through simulated failures
- Verifying state transitions in asynchronous and scoped allocation contexts
- Confirming type safety and input validation across public interfaces

**Section sources**

- [vitest.unit.config.ts](file://vitest.unit.config.ts#L1-L36)

## Core Utility Modules and Their Test Coverage

The project includes several critical utility modules, each responsible for a specific aspect of WASM interaction and runtime support. These modules are rigorously tested to ensure reliability in production environments.

### async-utils

This module handles asynchronous loading of binary data, including dependency tracking and error propagation. Its unit tests verify successful data loading, proper invocation of dependency tracking functions, and correct handling of rejected promises.

### path

The path module provides POSIX-compliant path normalization, resolution, and manipulation utilities. Tests confirm correct handling of relative paths, parent directory segments (`..`), and edge cases like empty strings or trailing separators.

### memory-utils

Responsible for heap initialization, random filling, zeroing, and alignment, this module's tests validate interactions with the global `crypto` object, proper memory clearing, and alignment logic for mmap-style allocations.

### struct-binder

This complex module enables structured memory access via accessor generation. Unit tests cover struct definition validation, member signature checking, and debug logging integration.

### whwasm helpers

A collection of low-level WASM interoperability utilities, including string handling, heap accessors, function table management, and scoped allocation. Each sub-module is tested independently to ensure correctness in pointer manipulation, memory views, and lifecycle management.

**Section sources**

- [async-utils.unit.test.ts](file://src/jswasm/utils/async-utils/async-utils.unit.test.ts#L1-L127)
- [path.unit.test.ts](file://src/jswasm/utils/path/path.unit.test.ts#L1-L61)
- [memory-utils.unit.test.ts](file://src/jswasm/utils/memory-utils/memory-utils.unit.test.ts#L1-L112)
- [struct-binder-accessors.unit.test.ts](file://src/jswasm/utils/struct-binder/struct-binder-accessors/struct-binder-accessors.unit.test.ts#L1-L223)
- [string-helpers.unit.test.ts](file://src/jswasm/utils/whwasm/string-helpers/string-helpers.unit.test.ts#L1-L147)
- [heap-helpers.unit.test.ts](file://src/jswasm/utils/whwasm/heap-helpers/heap-helpers.unit.test.ts#L1-L154)
- [installer-context.unit.test.ts](file://src/jswasm/utils/whwasm/installer-context/installer-context.unit.test.ts#L1-L108)
- [function-table-helpers.unit.test.ts](file://src/jswasm/utils/whwasm/function-table-helpers/function-table-helpers.unit.test.ts#L1-L161)
- [scoped-alloc-helpers.unit.test.ts](file://src/jswasm/utils/whwasm/scoped-alloc-helpers/scoped-alloc-helpers.unit.test.ts#L1-L202)

## Testing Isolation with Vitest

Vitest is used to execute unit tests in isolation, ensuring that each test runs in a clean environment without side effects from previous executions. The `vi.resetModules()` and `vi.restoreAllMocks()` utilities are employed to reset module state and restore mocked functions between test runs.

For example, in `memory-utils.unit.test.ts`, `vi.resetModules()` is called before importing the module to ensure a fresh instance:

```ts
const loadMemoryUtils = async () => {
    vi.resetModules();
    return await import("./memory-utils");
};
```

Similarly, `afterEach` hooks are used to restore mocks:

```ts
afterEach(() => {
    vi.restoreAllMocks();
});
```

This pattern guarantees that tests do not interfere with one another and can be run in any order.

**Section sources**

- [memory-utils.unit.test.ts](file://src/jswasm/utils/memory-utils/memory-utils.unit.test.ts#L7-L10)
- [string-helpers.unit.test.ts](file://src/jswasm/utils/whwasm/string-helpers/string-helpers.unit.test.ts#L72-L74)

## Mocking and Dependency Simulation

Mocking is extensively used to simulate external dependencies such as `crypto.getRandomValues`, WASM memory, and function tables. Vitest's `vi.fn()` and `vi.spyOn()` utilities allow precise control over function behavior during tests.

In `async-utils.unit.test.ts`, the `readAsync` function is mocked to simulate both success and failure scenarios:

```ts
const readAsync = vi.fn().mockResolvedValue(sourceBuffer);
// ...
const readAsync = vi.fn().mockRejectedValue(new Error("network"));
```

Similarly, in `string-helpers.unit.test.ts`, a mock WASM memory and heap view are created to simulate real-world conditions:

```ts
const memory = new WebAssembly.Memory({ initial: 1 });
const heap8u = () => context.getHeapViews().HEAP8U as Uint8Array;
```

These mocks enable full control over test inputs and expected outputs without requiring actual WASM compilation or network requests.

**Section sources**

- [async-utils.unit.test.ts](file://src/jswasm/utils/async-utils/async-utils.unit.test.ts#L13-L16)
- [string-helpers.unit.test.ts](file://src/jswasm/utils/whwasm/string-helpers/string-helpers.unit.test.ts#L29-L69)

## Type Checking and Edge-Case Validation

Type safety is enforced through TypeScript and validated in tests. Each module includes tests that pass invalid types to functions and assert appropriate error throws.

For example, in `path.unit.test.ts`, passing a non-string value to `fsResolver.resolve()` results in a `TypeError`:

```ts
expect(() => fsResolver.resolve("foo", 123 as never)).toThrow(TypeError);
```

In `struct-binder-accessors.unit.test.ts`, duplicate member keys and malformed signatures are rejected:

```ts
expect(() => validateMemberSignature(ctor, "value", "_value", "z")).toThrow();
```

These tests ensure that the API enforces correct usage and fails fast when misused.

**Section sources**

- [path.unit.test.ts](file://src/jswasm/utils/path/path.unit.test.ts#L52-L53)
- [struct-binder-accessors.unit.test.ts](file://src/jswasm/utils/struct-binder/struct-binder-accessors/struct-binder-accessors.unit.test.ts#L147-L152)

## Assertion Patterns and Error Simulation

Tests use a variety of assertion patterns to validate behavior, including direct equality checks, exception validation, and spy call counts.

In `async-utils.unit.test.ts`, assertions verify that dependency tracking functions are called correctly:

```ts
expect(getUniqueRunDependency).toHaveBeenCalledWith(`al ${url}`);
expect(addRunDependency).toHaveBeenCalledWith("dep-id");
```

Error simulation is achieved by mocking rejected promises and asserting unhandled rejection events:

```ts
process.once("unhandledRejection", handler);
loader(url, () => {
    throw new Error("should not succeed");
});
```

This ensures that errors propagate correctly through the call stack.

**Section sources**

- [async-utils.unit.test.ts](file://src/jswasm/utils/async-utils/async-utils.unit.test.ts#L33-L37)
- [async-utils.unit.test.ts](file://src/jswasm/utils/async-utils/async-utils.unit.test.ts#L78-L95)

## State Verification in Asynchronous Functions

Asynchronous functions are tested using `Promise` wrappers and `await` to ensure proper sequencing of operations. In `async-utils.unit.test.ts`, a `Promise<void>` is used to wait for callback execution:

```ts
await new Promise<void>((resolve, reject) => {
    loader(
        url,
        (data) => {
            expect(data).toEqual(new Uint8Array([1, 2, 3]));
            resolve();
        },
        reject,
    );
});
```

This pattern allows synchronous assertions within asynchronous contexts, ensuring that all side effects are observed before the test completes.

**Section sources**

- [async-utils.unit.test.ts](file://src/jswasm/utils/async-utils/async-utils.unit.test.ts#L24-L35)

## Memory Management and WASM Interop Testing

Memory management is a critical aspect of WASM interop. The `memory-utils` and `heap-helpers` modules are tested to ensure correct alignment, zeroing, and heap view access.

In `memory-utils.unit.test.ts`, `zeroMemory` is verified to clear the correct heap slice:

```ts
expect(slice.every((value) => value === 0)).toBe(true);
```

In `heap-helpers.unit.test.ts`, typed array views are confirmed to match expected heap segments:

```ts
expect(target.heap8()).toBe(heap.HEAP8);
```

Additionally, 64-bit views are only exposed when `bigIntEnabled` is true, ensuring compatibility across environments.

**Section sources**

- [memory-utils.unit.test.ts](file://src/jswasm/utils/memory-utils/memory-utils.unit.test.ts#L78-L85)
- [heap-helpers.unit.test.ts](file://src/jswasm/utils/whwasm/heap-helpers/heap-helpers.unit.test.ts#L127-L139)

## String Encoding and UTF-8 Handling

String operations are tested to ensure correct UTF-8 encoding and decoding. In `string-helpers.unit.test.ts`, various Unicode strings are encoded and their byte lengths validated:

```ts
expect(target.jstrlen("π")).toBe(2);
expect(target.jstrlen("A😂")).toBe(5);
```

CString allocation and copying are also verified:

```ts
expect(Array.from(heap.slice(ptr, ptr + 4))).toEqual([0x61, 0x62, 0x63, 0x00]);
```

These tests ensure that string data is correctly marshaled between JavaScript and WASM.

**Section sources**

- [string-helpers.unit.test.ts](file://src/jswasm/utils/whwasm/string-helpers/string-helpers.unit.test.ts#L85-L90)
- [string-helpers.unit.test.ts](file://src/jswasm/utils/whwasm/string-helpers/string-helpers.unit.test.ts#L133-L140)

## Best Practices for Maintainable Unit Tests

The test suite follows several best practices to ensure long-term maintainability:

- **Isolation**: Each test runs independently with mocked dependencies
- **Clarity**: Test names clearly describe the behavior being validated
- **Comprehensiveness**: Both success and failure paths are tested
- **Reusability**: Helper functions like `createInstallerHarness()` reduce duplication
- **Determinism**: No reliance on external state or timing

For example, `createInstallerHarness()` in `string-helpers.unit.test.ts` encapsulates setup logic for multiple tests:

```ts
function createInstallerHarness() { ... }
```

This reduces boilerplate and improves readability.

**Section sources**

- [string-helpers.unit.test.ts](file://src/jswasm/utils/whwasm/string-helpers/string-helpers.unit.test.ts#L29-L69)

## CI Integration via vitest.unit.config.ts

Unit tests are integrated into the CI pipeline via `vitest.unit.config.ts`, which specifies the test files to include:

```ts
include: ["src/**/*.unit.test.ts"];
```

The configuration also sets up necessary headers for browser testing and disables browser execution by default. This ensures that unit tests run quickly and reliably in CI environments without requiring browser automation.

**Section sources**

- [vitest.unit.config.ts](file://vitest.unit.config.ts#L23-L24)

## Debugging Common Test Failures

Common test failures include:

- **Mock not called**: Ensure mocks are properly assigned and invoked
- **Memory access out of bounds**: Validate pointer arithmetic and heap size
- **Unhandled rejections**: Always provide error callbacks or catch rejections
- **Type errors**: Use `as never` to simulate invalid inputs safely

When debugging, enable `headless: false` in the Vitest config to observe browser behavior, or use `console.log` within tests (though this should be removed before commit).

**Section sources**

- [async-utils.unit.test.ts](file://src/jswasm/utils/async-utils/async-utils.unit.test.ts#L67-L95)
- [vitest.unit.config.ts](file://vitest.unit.config.ts#L32-L33)

## Conclusion

The unit testing strategy in web-sqlite-v2 ensures robustness and correctness of low-level utility modules through isolated, well-structured tests using Vitest. By leveraging mocking, type checking, and comprehensive edge-case validation, the test suite validates critical operations such as memory management, string encoding, and WASM interop. Best practices in test design and CI integration further enhance reliability and maintainability, making the codebase resilient to regressions and easy to extend.
