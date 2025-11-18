# Test Specification: create-wh-wasm-util-installer.ts Implementation

## Purpose

This document provides detailed implementation guidance for testing the `create-wh-wasm-util-installer.ts` module, complementing the existing test plan with concrete test code examples and setup instructions.

## File Context

**Target File**: `src/jswasm/utils/create-wh-wasm-util-installer/create-wh-wasm-util-installer.ts`

**Dependencies** (updated after migration):

- `applyDefaults` from `../whwasm/defaults/defaults` (migrated from `.mjs`)
- All other helpers from their respective `.mjs` files

## Test Implementation Structure

### 1. Test File Setup

```typescript
// create-wh-wasm-util-installer.test.ts
import type { WhWasmHelperTarget } from "../whwasm/installer-context.d";
import { describe, expect, it, beforeEach, jest } from "vitest";
import { createWhWasmUtilInstaller } from "./create-wh-wasm-util-installer";
```

### 2. Core Test Utilities

```typescript
/**
 * Creates a comprehensive fake target for testing
 */
const createFakeTarget = (): WhWasmHelperTarget & {
    alloc: (size: number) => number;
    dealloc: (ptr: number) => void;
    isPtr: (value: unknown) => boolean;
} => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const table = new WebAssembly.Table({ element: "anyfunc", initial: 1 });
    const exports = {
        memory,
        __indirect_function_table: table,
        malloc: jest.fn(() => 1024),
        free: jest.fn(),
    };
    let nextPtr = 1024;

    const target = {} as any;
    target.pointerIR = "i32";
    target.ptrSizeof = 4;
    target.bigIntEnabled = false;
    target.memory = memory;
    target.instance = { exports };
    target.exports = exports;
    target.alloc = (size: number) => {
        const ptr = nextPtr;
        nextPtr += Math.max(size, 1);
        return ptr;
    };
    target.dealloc = jest.fn();
    target.isPtr = (value: unknown) => typeof value === "number" && value >= 0;
    return target;
};

/**
 * Enhanced target type with installed helpers
 */
type InstalledTarget = ReturnType<typeof createFakeTarget> & {
    sizeofIR: (identifier: string) => number | undefined;
    sizeof: (identifier: string) => number | undefined;
    heap8: () => Int8Array;
    heap8u: () => Uint8Array;
    heap32: () => Int32Array;
    heapForSize: (sizeIndicator: number) => ArrayBufferView;
    cstrlen: (ptr: number) => number | null;
    cstrToJs: (ptr: number) => string | null;
    jstrToPtr: (
        str: string,
        nulTerminated?: boolean,
    ) => number | [number, number];
    scopedAllocPush: () => number;
    scopedAllocPop: (level: number) => void;
    xWrap: (...args: any[]) => any;
};

/**
 * Writes a C string to target memory for testing string helpers
 */
const writeCString = (target: InstalledTarget, text: string): number => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(`${text}\0`);
    const ptr = target.alloc(bytes.length);
    target.heap8u().set(bytes, ptr);
    return ptr;
};
```

### 3. Comprehensive Test Suite

```typescript
describe("createWhWasmUtilInstaller", () => {
    let fakeTarget: ReturnType<typeof createFakeTarget>;

    beforeEach(() => {
        fakeTarget = createFakeTarget();
    });

    describe("Installer Surface", () => {
        it("returns installer function with yawl factory", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();

            // 2. Core processing
            expect(typeof installer).toBe("function");
            expect(typeof installer.yawl).toBe("function");

            // 3. Output handling
            const yawlLoader = installer.yawl();
            expect(typeof yawlLoader).toBe("function");
        });

        it("returns same target reference when installing", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();

            // 2. Core processing
            const result = installer(fakeTarget);

            // 3. Output handling
            expect(result).toBe(fakeTarget); // Same object reference
        });

        it("yawl factory reuses installer reference", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();

            // 2. Core processing
            const yawlLoader = installer.yawl();

            // 3. Output handling
            expect(yawlLoader).toBeDefined();
            expect(typeof yawlLoader).toBe("function");
        });
    });

    describe("Defaults + Heap Helpers", () => {
        it("applies basic defaults to target", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();
            delete (fakeTarget as any).bigIntEnabled;

            // 2. Core processing
            installer(fakeTarget);

            // 3. Output handling
            expect(typeof fakeTarget.bigIntEnabled).toBe("boolean");
            expect(fakeTarget.pointerIR).toBe("i32");
            expect(fakeTarget.ptrSizeof).toBe(4);
        });

        it("installs heap helpers with correct sizes", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();

            // 2. Core processing
            const installedTarget = installer(fakeTarget) as InstalledTarget;

            // 3. Output handling
            expect(installedTarget.sizeofIR("i32")).toBe(4);
            expect(installedTarget.sizeofIR("i64")).toBe(8);
            expect(installedTarget.sizeofIR("f32")).toBe(4);
            expect(installedTarget.sizeofIR("f64")).toBe(8);
        });

        it("creates typed array views for memory access", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();

            // 2. Core processing
            const installedTarget = installer(fakeTarget) as InstalledTarget;

            // 3. Output handling
            const heap8 = installedTarget.heap8();
            const heap32 = installedTarget.heap32();
            const heap8u = installedTarget.heap8u();

            expect(heap8).toBeInstanceOf(Int8Array);
            expect(heap32).toBeInstanceOf(Int32Array);
            expect(heap8u).toBeInstanceOf(Uint8Array);
            expect(heap8.BYTES_PER_ELEMENT).toBe(1);
            expect(heap32.BYTES_PER_ELEMENT).toBe(4);
            expect(heap8u.BYTES_PER_ELEMENT).toBe(1);
        });

        it("heapForSize returns correct typed array for size indicator", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();

            // 2. Core processing
            const installedTarget = installer(fakeTarget) as InstalledTarget;

            // 3. Output handling
            const heap32 = installedTarget.heapForSize(32);
            const heap8 = installedTarget.heapForSize(8);

            expect(heap32).toBeInstanceOf(Uint32Array);
            expect(heap8).toBeInstanceOf(Uint8Array);
            expect(heap32.BYTES_PER_ELEMENT).toBe(4);
            expect(heap8.BYTES_PER_ELEMENT).toBe(1);
        });
    });

    describe("String Helpers", () => {
        it("provides C string length calculation", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();
            const installedTarget = installer(fakeTarget) as InstalledTarget;
            const pointer = writeCString(installedTarget, "hi");

            // 2. Core processing
            const length = installedTarget.cstrlen(pointer);

            // 3. Output handling
            expect(length).toBe(2);
        });

        it("provides C string to JavaScript conversion", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();
            const installedTarget = installer(fakeTarget) as InstalledTarget;
            const pointer = writeCString(installedTarget, "hello");

            // 2. Core processing
            const result = installedTarget.cstrToJs(pointer);

            // 3. Output handling
            expect(result).toBe("hello");
        });

        it("handles null pointers gracefully", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();
            const installedTarget = installer(fakeTarget) as InstalledTarget;

            // 2. Core processing
            const cstrlenResult = installedTarget.cstrlen(0);
            const cstrToJsResult = installedTarget.cstrToJs(0);

            // 3. Output handling
            expect(cstrlenResult).toBeNull();
            expect(cstrToJsResult).toBeNull();
        });
    });

    describe("Advanced Helpers", () => {
        it("installs scoped allocation helpers", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();

            // 2. Core processing
            const installedTarget = installer(fakeTarget) as InstalledTarget;

            // 3. Output handling
            expect(typeof installedTarget.scopedAllocPush).toBe("function");
            expect(typeof installedTarget.scopedAllocPop).toBe("function");

            // Test scoped allocation
            const level = installedTarget.scopedAllocPush();
            expect(typeof level).toBe("number");
            expect(() => installedTarget.scopedAllocPop(level)).not.toThrow();
        });

        it("installs xWrap adapter", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();

            // 2. Core processing
            const installedTarget = installer(fakeTarget) as InstalledTarget;

            // 3. Output handling
            expect(typeof installedTarget.xWrap).toBe("function");
        });

        it("provides memory allocation helpers", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();

            // 2. Core processing
            const installedTarget = installer(fakeTarget) as InstalledTarget;

            // 3. Output handling
            expect(typeof installedTarget.alloc).toBe("function");
            expect(typeof installedTarget.dealloc).toBe("function");
            expect(typeof installedTarget.isPtr).toBe("function");

            const ptr = installedTarget.alloc(16);
            expect(typeof ptr).toBe("number");
            expect(installedTarget.isPtr(ptr)).toBe(true);
        });
    });

    describe("Error Handling", () => {
        it("handles missing target properties gracefully", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();
            const minimalTarget = {} as WhWasmHelperTarget;

            // 2. Core processing & 3. Output handling
            expect(() => installer(minimalTarget)).not.toThrow();
        });

        it("handles null/undefined target", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();

            // 2. Core processing & 3. Output handling
            expect(() => installer(null as any)).not.toThrow();
            expect(() => installer(undefined as any)).not.toThrow();
        });
    });

    describe("Integration", () => {
        it("maintains consistent memory views across helpers", () => {
            // 1. Input handling
            const installer = createWhWasmUtilInstaller();
            const installedTarget = installer(fakeTarget) as InstalledTarget;

            // 2. Core processing
            const heap8 = installedTarget.heap8();
            const heap8u = installedTarget.heap8u();
            const heap32 = installedTarget.heap32();

            // Write test data using one view
            heap8u[0] = 42;
            heap32[1] = 0x12345678;

            // 3. Output handling - verify data consistency
            expect(heap8[0]).toBe(42);
            expect(heap8u[0]).toBe(42);
            expect(heap32[1]).toBe(0x12345678);

            // Verify different size views access same memory
            const byteValue = heap8u[4]; // First byte of the 32-bit value at offset 4
            expect(byteValue).toBe(0x78); // Little-endian: lowest byte first
        });
    });
});
```

### 4. Performance Tests (Optional)

```typescript
describe("Performance", () => {
    it("completes installation within reasonable time", () => {
        // 1. Input handling
        const installer = createWhWasmUtilInstaller();
        const target = createFakeTarget();

        // 2. Core processing
        const startTime = performance.now();
        installer(target);
        const endTime = performance.now();

        // 3. Output handling
        expect(endTime - startTime).toBeLessThan(100); // 100ms threshold
    });

    it("heap access has acceptable performance", () => {
        // 1. Input handling
        const installer = createWhWasmUtilInstaller();
        const installedTarget = installer(
            createFakeTarget(),
        ) as InstalledTarget;

        // 2. Core processing
        const iterations = 10000;
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
            installedTarget.heap32()[i] = i;
        }

        const endTime = performance.now();

        // 3. Output handling
        const avgTime = (endTime - startTime) / iterations;
        expect(avgTime).toBeLessThan(0.01); // 0.01ms per access average
    });
});
```

## Test Execution Commands

```bash
# Run specific test file
npm run test:unit -- src/jswasm/utils/create-wh-wasm-util-installer/create-wh-wasm-util-installer.test.ts

# Run with coverage
npm run test:unit -- --coverage --reporter=text

# Run in watch mode for development
npm run test:unit -- --watch

# Run performance tests only
npm run test:unit -- --grep "Performance"
```

## Test Data Validation

### Expected Installation Results

After running the installer, the target should have:

```typescript
interface FullyInstalledTarget {
    // Basic properties
    bigIntEnabled: boolean;
    pointerIR: "i32" | "i64";
    ptrSizeof: 4 | 8;
    exports: WebAssembly.Exports;
    memory: WebAssembly.Memory;
    instance: { exports: WebAssembly.Exports };

    // Size helpers
    sizeofIR: (identifier: string) => number | undefined;
    sizeof: (identifier: string) => number | undefined;

    // Heap accessors
    heap8: () => Int8Array;
    heap8u: () => Uint8Array;
    heap16: () => Int16Array;
    heap16u: () => Uint16Array;
    heap32: () => Int32Array;
    heap32u: () => Uint32Array;
    heap32f: () => Float32Array;
    heap64f: () => Float64Array;
    heapForSize: (sizeIndicator: number) => ArrayBufferView;

    // String utilities
    cstrlen: (ptr: number) => number | null;
    cstrToJs: (ptr: number) => string | null;
    jstrToPtr: (
        str: string,
        nulTerminated?: boolean,
    ) => number | [number, number];

    // Memory management
    alloc: (size: number) => number;
    dealloc: (ptr: number) => void;
    realloc: (ptr: number, newSize: number) => number;

    // Scoped allocation
    scopedAllocPush: () => number;
    scopedAllocPop: (level: number) => void;

    // Function binding
    xWrap: (...args: any[]) => any;
    installFunction: (...args: any[]) => number;

    // Additional helpers...
}
```

## Migration Validation Checklist

- [ ] All tests from original `.mjs` implementation pass
- [ ] TypeScript compilation succeeds
- [ ] No behavioral differences between old and new implementation
- [ ] Performance characteristics are maintained
- [ ] All helper modules are correctly imported and applied
- [ ] Yawl factory integration works correctly
- [ ] Error handling is preserved

This specification provides concrete implementation guidance for creating comprehensive tests that validate the migrated TypeScript implementation maintains full compatibility with the original JavaScript version.
