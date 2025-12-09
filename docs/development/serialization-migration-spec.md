# Migration Spec: `src/jswasm/vfs/opfs/installer/core/serialization.mjs`

## 1. Analysis

- **Target**: `src/jswasm/vfs/opfs/installer/core/serialization.mjs`
- **Declaration**: `src/jswasm/vfs/opfs/installer/core/serialization.d.ts`
- **Functionality**:
    - Implements a custom binary serialization protocol over `SharedArrayBuffer` for communication between the main thread and the OPFS worker.
    - Handles `number` (Float64), `bigint` (BigInt64), `boolean` (Int32), and `string` (UTF-8 encoded).
    - Uses a `Uint8Array` view for metadata (arg count, type IDs) and a `DataView` for values.
    - `serialize(...args)` writes to the buffer.
    - `deserialize(clear)` reads from the buffer.
- **Dependencies**:
    - `TextDecoder` / `TextEncoder` (standard web APIs).
    - `SharedArrayBuffer` (environment requirement).
    - `OpfsState` (shared configuration object).
- **Existing Tests**:
    - No direct unit test file found for `serialization.mjs` in the immediate directory, but `operation-runner.unit.test.ts` mocks it. We need to create a dedicated unit test `serialization.unit.test.ts` to cover the logic comprehensively.

## 2. Test Plan

### Unit Tests (`src/jswasm/vfs/opfs/installer/core/serialization.unit.test.ts`)

We will create a new test file to verify the serialization logic in isolation.

**Test Cases:**

1.  **Initialization**:
    - Verify `createSerializer` returns an object with `serialize` and `deserialize` methods.
    - Verify it correctly initializes views on the provided `OpfsState`.

2.  **Serialization (Type Handling)**:
    - **Numbers**: Serialize and deserialize various numbers (integers, floats, negative values).
    - **BigInts**: Serialize and deserialize `bigint` values.
    - **Booleans**: Serialize and deserialize `true` and `false`.
    - **Strings**: Serialize and deserialize strings (ASCII, Unicode/Emoji).
    - **Mixed Types**: Serialize a sequence of mixed types (e.g., `[1, "text", true, 123n]`).

3.  **Edge Cases**:
    - **Empty Args**: `serialize()` with no arguments should set argument count to 0. `deserialize()` should return `null` or empty array.
    - **Buffer Clearing**: Verify `deserialize(true)` clears the argument count byte.
    - **Unsupported Types**: Ensure `serialize` throws (via `toss`) when passed an unsupported type (e.g., object, undefined, symbol).

4.  **Buffer Layout (White-box testing)**:
    - Inspect the underlying `SharedArrayBuffer` after serialization to ensure the binary format is correct:
        - Byte 0: Argument count.
        - Bytes 1..N: Type IDs.
        - Bytes N+1..: Values (aligned/packed as per implementation).

### Scaffolding

- **Mock `OpfsState`**: Create a minimal mock state object with a real `SharedArrayBuffer` to pass to `createSerializer`.
- **Mock `toss`**: A simple function that throws an error to verify error handling.

## 3. Migration Steps

1.  **Create Test Harness**: Implement `src/jswasm/vfs/opfs/installer/core/serialization.unit.test.ts` targeting the `.mjs` file.
2.  **Run Tests**: Ensure >80% coverage.
3.  **Create Migration Directory**: `src/jswasm/vfs/opfs/installer/core/serialization/`.
4.  **Create TypeScript Source**: `src/jswasm/vfs/opfs/installer/core/serialization/serialization.ts`.
5.  **Move Tests**: Move test file to the new directory and update imports.
6.  **Build & Verify**: Compile, lint, and run tests.
7.  **Update References**: Update consumers (if any found via search, though mostly likely internal usage) and delete original files.
