# Migration Spec: `binding`

## 1. Migration Target

- **Original:** `src/jswasm/api/oo1-db/db-statement/binding.mjs`
- **Declaration:** `src/jswasm/api/oo1-db/db-statement/binding.d.ts`
- **Goal:** Convert to TypeScript with comprehensive unit tests.

## 2. Type Definitions

We will migrate the following types from `binding.d.ts` to the new TypeScript file.

```typescript
// Imports to be used in the new file
import type { BindValue, Stmt } from "@wuchuheng/web-sqlite";
import type { Oo1Context } from "../context.js";
import type { StatementValidators } from "./validation.js";

/** Numerical identifiers describing supported bind value categories. */
export interface BindTypeMap {
    readonly null: number;
    readonly number: number;
    readonly string: number;
    readonly boolean: number;
    readonly blob: number;
    readonly undefined: number;
    readonly bigint?: number;
}

/** Value container accepted by statement binding helpers. */
export type BindSpecification =
    | BindValue
    | BindValue[]
    | Record<string, BindValue>;

/** Binding helper collection returned by {@link createBindingHelpers}. */
export interface BindHelpers {
    /** Enumeration of supported bind kinds. */
    readonly BindTypes: BindTypeMap;
    /** Classifies a value into a bind category or returns undefined. */
    determineBindType(value: BindValue): number | undefined;
    /** Validates a value can be bound and returns the bind category. */
    ensureSupportedBindType(value: BindValue): number;
    /** Binds a UTF-8 string or blob to a prepared statement parameter. */
    bindString(
        statementPointer: number,
        index: number,
        value: string,
        asBlob: boolean,
    ): number;
    /** Binds a single value to the supplied statement. */
    bindSingleValue(
        statement: Stmt,
        index: number | string,
        bindType: number,
        value: BindValue,
    ): Stmt;
}
```

## 3. Test Strategy

- **Type:** Unit Test (`binding.unit.test.ts`)
- **Strategy:** Mock `Oo1Context` and `StatementValidators` to isolate the binding logic.
- **Test Scenarios:**
    - **`determineBindType`**:
        - Correctly identifies `null`, `undefined` -> `null`.
        - Correctly identifies `number`.
        - Correctly identifies `string`.
        - Correctly identifies `boolean`.
        - Correctly identifies `bigint` (if enabled).
        - Correctly identifies `Uint8Array`, `Int8Array`, `ArrayBuffer` -> `blob`.
        - Returns `undefined` for unsupported types (e.g., objects, functions).
    - **`ensureSupportedBindType`**:
        - Returns type constant for supported values.
        - Throws for unsupported values.
    - **`bindString`**:
        - Calls `wasm.allocCString`.
        - Calls `capi.sqlite3_bind_text` (if `asBlob` false).
        - Calls `capi.sqlite3_bind_blob` (if `asBlob` true).
    - **`bindSingleValue`**:
        - **Validations**: Calls `ensureStmtOpen`, `ensureNotLockedByExec`, `pointerOf`, `resolveParameterIndex`.
        - **Null**: Calls `capi.sqlite3_bind_null`.
        - **String**: Calls `bindString`.
        - **Number**:
            - Int32 -> `capi.sqlite3_bind_int`.
            - BigInt -> `capi.sqlite3_bind_int64` (if enabled/fits) or `toss` if too big.
            - Double -> `capi.sqlite3_bind_double`.
        - **Boolean**: Calls `capi.sqlite3_bind_int` (1 or 0).
        - **Blob**:
            - String as blob -> `bindString(..., true)`.
            - Buffer/TypedArray -> `wasm.alloc`, `wasm.heap8().set`, `capi.sqlite3_bind_blob`.
        - **Unsupported**: Throws error.
        - **Error Handling**: Checks `rc`, calls `context.checkRc` if `rc != 0`.

## 4. Verification Plan

1.  **Baseline:** Create `binding.unit.test.ts` testing `binding.mjs`.
2.  **Run Tests:** Ensure coverage ≥ 80%.
3.  **Migrate:** Create `src/jswasm/api/oo1-db/db-statement/binding/binding.ts`.
4.  **Switch Tests:** Update test imports to point to new TS file.
5.  **Verify:** Compile, lint, and run tests.
