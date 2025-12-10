# [Module Name] Migration Spec & Test Plan

**Target Module:** `src/jswasm/.../module.mjs`
**Related Issues/PRs:** #...

---

## 1. Deep Analysis

_Instructions: Analyze the target JS file and its dependencies. Identify key behaviors, exports, and potential pitfalls._

### 1.1 Exports & API Surface

- List all exported functions, classes, and constants.
- Note input/output types inferred from usage.

### 1.2 Dependencies & External References

- List imports.
- Identify browser-specific globals (e.g., `window`, `document`, `TextEncoder`).

### 1.3 Logic & Complexity

- Highlight complex logic, side effects, or "magic" numbers.
- Note any specific error handling patterns.

---

## 2. Test Strategy

_Instructions: Select the testing approach based on the analysis above._

### 2.1 Strategy Selection

- **Selected Type:** [Unit | E2E]
- **Rationale:**
    - _Unit:_ Chosen if logic is pure or mocks are sufficient.
    - _E2E:_ Chosen if heavy browser dependency exists (e.g., OPFS, Workers, DOM).

### 2.2 Test Scenarios

- List specific test cases to cover >80% of the code.
- **Happy Path:** ...
- **Edge Cases:** ...
- **Error States:** ...

---

## 3. Type Strategy (Crucial for Step 6)

_Instructions: Detail how to strictly avoid `any` and ensure the migration passes Step 6 (Lint/Build)._

### 3.1 Existing Types

- List available types from `.d.ts` or other modules that can be reused.

### 3.2 New Type Definitions

- **Interfaces:** Define structures for objects that are currently untyped.
    ```typescript
    // Example
    interface MyOptions {
        flag: boolean;
        timeout?: number;
    }
    ```
- **Signatures:** Propose signatures for key functions.
    ```typescript
    function doSomething(input: string): Promise<number>;
    ```

### 3.3 Handling Ambiguity

- **Plan:** If a type is unclear, how will it be resolved? (e.g., "Investigate usage in `otherModule.js`" or "Use a generic `T` with constraints").
- **Constraint:** `any` is strictly forbidden. Use `unknown` with narrowing if absolutely necessary, but prefer specific types.

---

## 4. Verification Plan

- **Pre-migration:** Run existing tests (if any) or new harness against `.mjs`.
- **Post-migration:** Run tests against new `.ts`.
- **Lint Check:** Confirm `npm run lint` passes without suppressions.
