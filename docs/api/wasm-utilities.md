# WASM Utilities Documentation

The WASM utilities provide essential functions for memory management, type conversion, and bridging between JavaScript and WebAssembly. These utilities are accessed via `sqlite3.wasm` and are critical for working with the C-style API and managing WASM memory.

## Verification Status Legend

Each API item in this document has a verification status indicator:

- ⚫ **Not Verified** - Type definitions and JSDoc have not been verified against source code
- 🟡 **Partially Verified** - Type definitions verified, but JSDoc incomplete or inconsistent
- 🟢 **Verified** - Type definitions and JSDoc fully verified and consistent with source code

Last updated: 2025-10-18

## Overview

WASM utilities fall into these categories:

1. **Memory Management** - Allocation and deallocation
2. **Type Conversion** - Reading/writing typed values
3. **Pointer Utilities** - Pointer arithmetic and handling
4. **String Utilities** - JS ↔ C string conversion
5. **Scope Utilities** - Automatic resource cleanup
6. **Export Access** - Direct WASM function access

## Memory Management 🟢

### alloc() 🟢

Allocate memory from the WASM heap.

```typescript
/**
 * Allocate n bytes of memory
 * @param n - Number of bytes to allocate
 * @returns Pointer to allocated memory
 * @throws WasmAllocError if allocation fails
 */
function alloc(n: number): WasmPointer;
```

**Usage Examples**:

```typescript
// Allocate 100 bytes
const ptr = sqlite3.wasm.alloc(100);

// Allocate for a pointer (8 bytes on 64-bit, 4 bytes on 32-bit builds)
const ptrPtr = sqlite3.wasm.alloc(sqlite3.wasm.ptrSizeof);

// Always deallocate when done
sqlite3.wasm.dealloc(ptr);
```

### dealloc() 🟢

Free previously allocated memory.

```typescript
/**
 * Free allocated memory
 * @param ptr - Pointer to free (null/undefined/0 are safe no-ops)
 */
function dealloc(ptr: WasmPointer | null | undefined): void;
```

**Usage Examples**:

```typescript
const ptr = sqlite3.wasm.alloc(100);
// ... use memory ...
sqlite3.wasm.dealloc(ptr);

// Safe to call with null
sqlite3.wasm.dealloc(null); // No-op
sqlite3.wasm.dealloc(undefined); // No-op
sqlite3.wasm.dealloc(0); // No-op
```

### realloc() 🟢

Resize allocated memory.

```typescript
/**
 * Reallocate memory (like C's realloc)
 * @param ptr - Pointer to existing memory (or null to allocate new)
 * @param size - New size in bytes
 * @returns Pointer to reallocated memory (may be different from original)
 * @throws WasmAllocError if allocation fails
 */
function realloc(ptr: WasmPointer | null, size: number): WasmPointer;
```

**Usage Examples**:

```typescript
// Initial allocation
let ptr = sqlite3.wasm.alloc(100);

// Resize to 200 bytes
ptr = sqlite3.wasm.realloc(ptr, 200);

// Resize to 0 is equivalent to free
ptr = sqlite3.wasm.realloc(ptr, 0); // ptr becomes 0/null

// Realloc with null pointer allocates new memory
const newPtr = sqlite3.wasm.realloc(null, 50);
```

### Memory Size Constants 🟢

```typescript
/**
 * Size of a pointer in bytes (4 for 32-bit, 8 for 64-bit)
 */
const ptrSizeof: number;

/**
 * Pointer intermediate representation used by wasm helpers
 */
const ptrIR: "i32" | "i64";

/**
 * Check if build exposes 64-bit heap views
 */
const bigIntEnabled: boolean;
```

**Usage Example**:

```typescript
// Allocate space for a pointer
const ppDb = sqlite3.wasm.alloc(sqlite3.wasm.ptrSizeof);

if (sqlite3.wasm.bigIntEnabled) {
    console.log('Using 64-bit pointers with BigInt support');
}
```

## Type Conversion Utilities 🟢

### peek() - Read from Memory 🟢

Read typed values from WASM memory.

```typescript
/**
 * Read 8-bit signed integer
 */
function peek8(ptr: WasmPointer | WasmPointer[]): number | number[];

/**
 * Read 16-bit signed integer
 */
function peek16(ptr: WasmPointer | WasmPointer[]): number | number[];

/**
 * Read 32-bit signed integer
 */
function peek32(ptr: WasmPointer | WasmPointer[]): number | number[];

/**
 * Read 64-bit signed integer (requires bigInt support)
 */
function peek64(ptr: WasmPointer | WasmPointer[]): bigint | (bigint | number)[];

/**
 * Read 32-bit float
 */
function peek32f(ptr: WasmPointer | WasmPointer[]): number | number[];

/**
 * Read 64-bit float (double)
 */
function peek64f(ptr: WasmPointer | WasmPointer[]): number | number[];

/**
 * Read pointer value
 */
function peekPtr(ptr: WasmPointer | WasmPointer[]): WasmPointer | WasmPointer[];

/**
 * Generic peek with type specifier
 */
function peek(ptr: WasmPointer | WasmPointer[], type?: PeekType): number | bigint | (number | bigint)[];

type PeekType = 'i1' | 'i8' | 'i16' | 'i32' | 'i64' | 'f32' | 'f64' | 'float' | 'double' | 'ptr' | '*';
```

**Usage Examples**:

```typescript
// Read different types
const int8 = sqlite3.wasm.peek8(ptr);
const add = sqlite3.wasm.ptr.add;
const int32 = sqlite3.wasm.peek32(add(ptr, 4));
const float64 = sqlite3.wasm.peek64f(add(ptr, 8));
const pointer = sqlite3.wasm.peekPtr(add(ptr, 16));

// Generic peek
const value = sqlite3.wasm.peek(ptr, 'i32');
const floatValue = sqlite3.wasm.peek(ptr, 'f64');
```

### poke() - Write to Memory 🟢

Write typed values to WASM memory.

```typescript
/**
 * Write 8-bit signed integer
 */
function poke8(ptr: WasmPointer | WasmPointer[], value: number): SQLite3Wasm;

/**
 * Write 16-bit signed integer
 */
function poke16(ptr: WasmPointer | WasmPointer[], value: number): SQLite3Wasm;

/**
 * Write 32-bit signed integer
 */
function poke32(ptr: WasmPointer | WasmPointer[], value: number): SQLite3Wasm;

/**
 * Write 64-bit signed integer
 */
function poke64(ptr: WasmPointer | WasmPointer[], value: number | bigint): SQLite3Wasm;

/**
 * Write 32-bit float
 */
function poke32f(ptr: WasmPointer | WasmPointer[], value: number): SQLite3Wasm;

/**
 * Write 64-bit float (double)
 */
function poke64f(ptr: WasmPointer | WasmPointer[], value: number): SQLite3Wasm;

/**
 * Write pointer value
 */
function pokePtr(ptr: WasmPointer | WasmPointer[], value?: WasmPointer): SQLite3Wasm;

/**
 * Generic poke with type specifier
 */
function poke(ptr: WasmPointer | WasmPointer[], value: number | bigint, type?: PokeType): SQLite3Wasm;

type PokeType = PeekType;
```

**Usage Examples**:

```typescript
const ptr = sqlite3.wasm.alloc(32);
const add = sqlite3.wasm.ptr.add;

// Write different types
sqlite3.wasm.poke8(ptr, 127);
sqlite3.wasm.poke16(add(ptr, 1), 32767);
sqlite3.wasm.poke32(add(ptr, 4), 2147483647);
sqlite3.wasm.poke64f(add(ptr, 8), 3.14159);
sqlite3.wasm.pokePtr(add(ptr, 16), somePointer);

// Generic poke with chaining support
sqlite3.wasm
    .poke(ptr, 42, 'i32')
    .poke(add(ptr, 4), 3.14, 'f64')
    .poke32(add(ptr, 8), 3);
```

`SQLite3Wasm` in the signatures above refers to the `sqlite3.wasm` helper object and indicates that the function returns the bridge for chaining additional calls.

### Heap Access 🟢

Direct access to WASM heap as TypedArrays.

```typescript
/**
 * Get heap as Int8Array
 */
function heap8(): Int8Array;

/**
 * Get heap as Uint8Array
 */
function heap8u(): Uint8Array;

/**
 * Get heap as Int16Array
 */
function heap16(): Int16Array;

/**
 * Get heap as Uint16Array
 */
function heap16u(): Uint16Array;

/**
 * Get heap as Int32Array
 */
function heap32(): Int32Array;

/**
 * Get heap as Uint32Array
 */
function heap32u(): Uint32Array;

/**
 * Resolve heap view by element width or TypedArray constructor
 */
function heapForSize(
    indicator:
        | number
        | typeof Int8Array
        | typeof Uint8Array
        | typeof Int16Array
        | typeof Uint16Array
        | typeof Int32Array
        | typeof Uint32Array
        | typeof Float32Array
        | typeof Float64Array
        | typeof BigInt64Array
        | typeof BigUint64Array,
    unsigned?: boolean
): Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array;
```

**Usage Examples**:

```typescript
// Copy data from WASM memory
const ptr = sqlite3.wasm.alloc(100);
const heap = sqlite3.wasm.heap8u();
const start = Number(ptr);
const data = heap.slice(start, start + 100);

// Direct manipulation
const i32Heap = sqlite3.wasm.heap32();
const index = Number(ptr) >>> 2;
i32Heap[index] = 42; // Write 32-bit int at ptr
```

## String Utilities 🟢

### cstrToJs() 🟢

Convert C-style null-terminated string to JavaScript string.

```typescript
/**
 * Convert C string to JS string
 * @param ptr - Pointer to null-terminated C string
 * @param maxBytes - Maximum bytes to read (optional)
 * @returns JavaScript string
 */
function cstrToJs(ptr: WasmPointer | null): string | null;
```

**Usage Example**:

```typescript
const str = sqlite3.capi.sqlite3_errmsg(db); // Returns pointer
const errorMessage = sqlite3.wasm.cstrToJs(str);
console.log(errorMessage);
```

### allocCString() 🟢

Allocate memory for a JavaScript string and convert to null-terminated C string.

```typescript
/**
 * Allocate and copy JS string to WASM memory as C string
 * @param jsString - JavaScript string to convert
 * @param addNul - Add null terminator (default: true)
 * @returns Pointer to allocated C string
 */
function allocCString(jsString: string, returnWithLength?: boolean): WasmPointer | [WasmPointer, number] | null;
```

**Usage Example**:

```typescript
const jsStr = "Hello, SQLite!";
const cStr = sqlite3.wasm.allocCString(jsStr);

try {
    // Use cStr with C API
    sqlite3.capi.sqlite3_exec(db, cStr, null, null, null);
} finally {
    sqlite3.wasm.dealloc(cStr);
}
```

### jstrcpy() 🟢

Copy JavaScript string to existing WASM buffer.

```typescript
/**
 * Copy JS string to TypedArray as UTF-8
 * @param jsString - JavaScript string
 * @param target - Target Uint8Array or pointer
 * @param offset - Offset in target (default: 0)
 * @param maxBytes - Maximum bytes to write
 * @param addNul - Add null terminator (default: true)
 * @returns Number of bytes written
 */
function jstrcpy(
    jsString: string,
    target: Uint8Array | WasmPointer,
    offset?: number,
    maxBytes?: number,
    addNul?: boolean
): number;
```

**Usage Example**:

```typescript
const buffer = sqlite3.wasm.alloc(100);
const bytesWritten = sqlite3.wasm.jstrcpy("Hello", buffer, 0, 100, true);
console.log(`Wrote ${bytesWritten} bytes`);
```

### String Length Utilities 🟢

```typescript
/**
 * Calculate byte length of JS string when encoded as UTF-8
 * @param jsString - JavaScript string
 * @returns Byte length in UTF-8 encoding (null if input is not a string)
 */
function jstrlen(jsString: string | null): number | null;

/**
 * Get length of C string in memory
 * @param ptr - Pointer to null-terminated C string
 * @returns Length in bytes (excluding null terminator) or null for invalid pointer
 */
function cstrlen(ptr: WasmPointer | null): number | null;
```

**Usage Example**:

```typescript
const str = "Hello, 世界!";
const byteLen = sqlite3.wasm.jstrlen(str);
console.log(`"${str}" requires ${byteLen} bytes in UTF-8`);

// Get length of C string
const cStr = sqlite3.wasm.allocCString("Test");
const len = sqlite3.wasm.cstrlen(cStr);
console.log(`C string length: ${len}`); // 4
sqlite3.wasm.dealloc(cStr);
```

## Pointer Utilities 🟢

### Pointer Helpers 🟢

```typescript
/**
 * Check if value is a valid pointer
 */
function isPtr(value: any): boolean;

/**
 * Check if pointer is null (0)
 */
function isPtr32(ptr: WasmPointer): boolean;

/**
 * Read pointer-sized value
 */
function getPtrValue(ptr: WasmPointer): WasmPointer;

/**
 * Write pointer-sized value
 */
function setPtrValue(ptr: WasmPointer, value: WasmPointer): SQLite3Wasm;

/**
 * Legacy alias for peek()
 */
function getMemValue(ptr: WasmPointer | WasmPointer[], type?: PeekType): number | bigint | (number | bigint)[];

/**
 * Legacy alias for poke()
 */
function setMemValue(ptr: WasmPointer | WasmPointer[], value: number | bigint, type?: PokeType): SQLite3Wasm;
```

**Usage Example**:

```typescript
const ptr = sqlite3.wasm.alloc(100);

if (sqlite3.wasm.isPtr(ptr)) {
    // Safe to use
    sqlite3.wasm.poke32(ptr, 42);
}

sqlite3.wasm.dealloc(ptr);
```

### Pointer Size Handling 🟢

```typescript
/**
 * Size of pointer in current build
 */
const ptrSizeof: 4 | 8;

/**
 * Pointer intermediate representation
 */
const ptrIR: 'i32' | 'i64';

/**
 * Whether 64-bit heap views are available
 */
const bigIntEnabled: boolean;
```

## Scope Utilities 🟢

Automatic resource cleanup using scope-based allocation.

### scopedAlloc() 🟢

Allocate memory that is automatically freed when scope exits.

```typescript
    /**
     * Execute function with scoped allocations
     * All allocations made via scopedAlloc are freed after function returns
     */
    function scopedAllocPush(): unknown;
    function scopedAllocPop(state: unknown): void;

/**
 * Scoped allocation
 * @param size - Bytes to allocate
 * @returns Pointer (automatically freed at scope exit)
 */
function scopedAlloc(size: number): WasmPointer;

/**
 * Call function with automatic scoped allocation cleanup
 */
function scopedAllocCall<T>(callback: () => T): T;

/**
 * Allocate pointer slots tracked by scoped allocator
 */
function scopedAllocPtr(count?: number, safePtrSize?: boolean): WasmPointer | WasmPointer[];

/**
 * Allocate pointer slots using general allocator
 */
function allocPtr(count?: number, safePtrSize?: boolean): WasmPointer | WasmPointer[];

/**
 * Allocate scoped UTF-8 string
 */
function scopedAllocCString(jsString: string, returnWithLength?: boolean): WasmPointer | [WasmPointer, number] | null;

/**
 * Allocate argv-style list using scoped allocator
 */
function scopedAllocMainArgv(values: unknown[]): WasmPointer;

/**
 * Allocate argv-style list using general allocator
 */
function allocMainArgv(values: unknown[]): WasmPointer;

/**
 * Convert C argv list to JavaScript strings
 */
function cArgvToJs(argc: number, argvPtr: WasmPointer): (string | null)[];
```

**Usage Example**:

```typescript
// Manual scope management
const scope = sqlite3.wasm.scopedAllocPush();
try {
    const ptr1 = sqlite3.wasm.scopedAlloc(100);
    const ptr2 = sqlite3.wasm.scopedAlloc(200);
    // Use pointers...
} finally {
    sqlite3.wasm.scopedAllocPop(scope); // Frees ptr1 and ptr2
}

// Automatic scope management (recommended)
const result = sqlite3.wasm.scopedAllocCall(() => {
    const ptr = sqlite3.wasm.scopedAlloc(100);
    const cStr = sqlite3.wasm.allocCString("SELECT 1");
    // Use pointers...
    return someValue;
    // All scoped allocations automatically freed here
});
```

## WASM Exports Access 🟢

Direct access to WASM module exports.

```typescript
/**
 * WASM module instance
 */
const module: WebAssembly.Module;

/**
 * WASM instance
 */
const instance: WebAssembly.Instance;

/**
 * Direct access to exported WASM functions
 * Use sqlite3.capi for wrapped versions with type conversions
 */
const exports: WebAssembly.Exports & Record<string, Function>;

/**
 * Access the indirect function table
 */
function functionTable(): WebAssembly.Table;

/**
 * Lookup an exported function by name
 */
function xGet(funcName: string): (...args: unknown[]) => unknown;

/**
 * Directly invoke an exported function
 */
function xCall(funcName: string | ((...args: unknown[]) => unknown), ...args: unknown[]): unknown;

/**
 * Create wrapper with argument/result conversions
 */
function xWrap(
    funcName: string | ((...args: unknown[]) => unknown),
    resultType?: string,
    ...argTypes: (string | unknown)[]
): (...args: unknown[]) => unknown;
```

**Usage Example**:

```typescript
// Low-level WASM function call (advanced usage)
const sqliteVersion = sqlite3.wasm.exports.sqlite3_libversion_number();
console.log(`SQLite version number: ${sqliteVersion}`);

// Prefer using sqlite3.capi for automatic type conversions
const version = sqlite3.capi.sqlite3_libversion();
console.log(`SQLite version: ${version}`);
```

## Utility Functions 🟢

### xCall() 🟢

Safely call WASM functions with automatic type conversion.

```typescript
/**
 * Call WASM function with type conversions
 * @param funcName - Name of exported WASM function
 * @param resultType - Expected return type
 * @param args - Function arguments
 * @returns Converted result
 */
function xCall(
    funcName: string | ((...args: any[]) => any),
    ...args: any[]
): any;
```

### xWrap() 🟢

Create JavaScript wrapper for WASM function with automatic type conversion.

```typescript
/**
 * Wrap WASM function with type conversions
 * @param funcName - Name of exported WASM function
 * @param resultType - Return type signature
 * @param argTypes - Array of argument type signatures
 * @returns JavaScript wrapper function
 */
function xWrap(
    funcName: string | ((...args: any[]) => any),
    resultType?: string,
    ...argTypes: (string | any)[]
): (...args: any[]) => any;
```

**Type Signatures**:
- `"i32"` - 32-bit integer
- `"i64"` - 64-bit integer
- `"f32"` - 32-bit float
- `"f64"` - 64-bit float
- `"*"` - Pointer
- `"string"` - C string (auto-converts to/from JS string)
- `"void"` - No return value

**Usage Example**:

```typescript
// Wrap sqlite3_libversion (returns string)
const getVersion = sqlite3.wasm.xWrap(
    'sqlite3_libversion',
    'string',
    []
);
const version = getVersion();
console.log(version); // "3.50.4"

// Wrap sqlite3_open_v2
const openDb = sqlite3.wasm.xWrap(
    'sqlite3_open_v2',
    'i32',
    ['string', '*', 'i32', 'string']
);

const ppDb = sqlite3.wasm.alloc(sqlite3.wasm.ptrSizeof);
const rc = openDb(':memory:', ppDb, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE, null);
```

## Memory Management Best Practices 🟢

### 1. Always Free Allocations 🟢

```typescript
// Bad: Memory leak
function badExample() {
    const ptr = sqlite3.wasm.alloc(100);
    // ... use ptr ...
    // Never freed!
}

// Good: Explicit cleanup
function goodExample() {
    const ptr = sqlite3.wasm.alloc(100);
    try {
        // ... use ptr ...
    } finally {
        sqlite3.wasm.dealloc(ptr);
    }
}

// Better: Use scoped allocation
function bestExample() {
    return sqlite3.wasm.scopedAllocCall(() => {
        const ptr = sqlite3.wasm.scopedAlloc(100);
        // ... use ptr ...
        return result;
        // Automatically freed
    });
}
```

### 2. Use Correct Type Sizes 🟢

```typescript
// Bad: Assuming pointer size
const ptr = sqlite3.wasm.alloc(4); // Wrong on 64-bit!

// Good: Use constants
const ptr = sqlite3.wasm.alloc(sqlite3.wasm.ptrSizeof);
```

### 3. Validate Pointers 🟢

```typescript
function safeUse(ptr: WasmPointer) {
    if (!sqlite3.wasm.isValidPtr(ptr)) {
        throw new Error('Invalid pointer');
    }
    // Safe to use ptr
}
```

### 4. Prefer High-Level APIs 🟢

```typescript
// Low-level: Manual memory management
const cStr = sqlite3.wasm.allocCString("SELECT 1");
try {
    const rc = sqlite3.capi.sqlite3_exec(db, cStr, null, null, null);
} finally {
    sqlite3.wasm.dealloc(cStr);
}

// High-level: Automatic memory management
db.exec("SELECT 1");
```

## Common Patterns 🟢

### Pattern 1: Output Parameters 🟢

```typescript
function getPointerOutput() {
    const ppOut = sqlite3.wasm.alloc(sqlite3.wasm.ptrSizeof);
    try {
        const rc = sqlite3.capi.sqlite3_open_v2(':memory:', ppOut, 0, null);
        if (rc === sqlite3.capi.SQLITE_OK) {
            const db = sqlite3.wasm.peekPtr(ppOut);
            return db;
        }
        throw new Error('Failed to open database');
    } finally {
        sqlite3.wasm.dealloc(ppOut);
    }
}
```

### Pattern 2: String Conversion 🟢

```typescript
function callWithString(db: sqlite3, sql: string) {
    const cSql = sqlite3.wasm.allocCString(sql);
    try {
        return sqlite3.capi.sqlite3_exec(db, cSql, null, null, null);
    } finally {
        sqlite3.wasm.dealloc(cSql);
    }
}
```

### Pattern 3: Reading Arrays 🟢

```typescript
function readArray(ptr: WasmPointer, count: number): number[] {
    const heap = sqlite3.wasm.heap32();
    const offset = Number(ptr) >>> 2; // Pointers stay within Number's safe range
    return Array.from(heap.slice(offset, offset + count));
}
```

### Pattern 4: Writing Buffers 🟢

```typescript
function writeBuffer(ptr: WasmPointer, data: Uint8Array): void {
    const heap = sqlite3.wasm.heap8u();
    heap.set(data, Number(ptr));
}
```

## TypeScript Type Definitions 🟢

```typescript
declare namespace sqlite3 {
    namespace wasm {
        type WasmPointer = number | bigint;

        // Memory management
        function alloc(n: number | TypedArray): WasmPointer;
        function dealloc(ptr: WasmPointer | null | undefined): void;
        function realloc(ptr: WasmPointer | null, size: number): WasmPointer;

        // Type conversion
        function peek8(ptr: WasmPointer): number;
        function peek16(ptr: WasmPointer): number;
        function peek32(ptr: WasmPointer): number;
        function peek64(ptr: WasmPointer): number | bigint;
        function peek32f(ptr: WasmPointer): number;
        function peek64f(ptr: WasmPointer): number;
        function peekPtr(ptr: WasmPointer): WasmPointer;

        function poke8(ptr: WasmPointer, value: number): WasmPointer;
        function poke16(ptr: WasmPointer, value: number): WasmPointer;
        function poke32(ptr: WasmPointer, value: number): WasmPointer;
        function poke64(ptr: WasmPointer, value: number | bigint): WasmPointer;
        function poke32f(ptr: WasmPointer, value: number): WasmPointer;
        function poke64f(ptr: WasmPointer, value: number): WasmPointer;
        function pokePtr(ptr: WasmPointer, value: WasmPointer): WasmPointer;

        // Heap access
        function heap8(): Int8Array;
        function heap8u(): Uint8Array;
        function heap16(): Int16Array;
        function heap32(): Int32Array;
        function heap64(): BigInt64Array;
        function heap32f(): Float32Array;
        function heap64f(): Float64Array;

        // String utilities
        function cstrToJs(ptr: WasmPointer, maxBytes?: number): string;
        function allocCString(str: string, addNul?: boolean): WasmPointer;
        function jstrcpy(
            str: string,
            target: Uint8Array | WasmPointer,
            offset?: number,
            maxBytes?: number,
            addNul?: boolean
        ): number;
        function cstrlen(str: string | WasmPointer): number;

        // Scoped allocation
        function scopedAllocPush(): unknown;
        function scopedAllocPop(state?: unknown): void;
        function scopedAlloc(size: number): WasmPointer;
        function scopedAllocCall<T>(callback: () => T): T;

        // Constants
        const ptrSizeof: 4 | 8;
        const intSizeof: 4;
        const int64Sizeof: 8;
        const doubleSizeof: 8;
        const bigIntEnabled: boolean;

        // WASM exports
        const module: WebAssembly.Module;
        const instance: WebAssembly.Instance;
        const exports: WebAssembly.Exports;

        // Utilities
        function isPtr(value: any): boolean;
        function isValidPtr(ptr: WasmPointer): boolean;
        function xCall(funcName: string, resultType?: string, ...args: any[]): any;
        function xWrap(funcName: string, resultType?: string, argTypes?: string[]): Function;
    }
}
```

## See Also 🟢

- [C-Style API Documentation](./c-style-api.md) - Low-level C API that uses these utilities
- [OO1 API Documentation](./oo1-api.md) - High-level API (less need for manual memory management)
- [WebAssembly Memory Model](https://webassembly.org/docs/semantics/#linear-memory)
