# Minimal JS File Splitting Spec

This checklist defines the **minimal refactoring unit** for splitting a large JS/WASM bridge module (a `.mjs` file) into smaller `.mjs` modules under `src/jswasm` (or similar directories).

The goal is to **reduce file size and improve readability** while keeping runtime behavior unchanged.
A requester should fill out the template below before asking for AI implementation; the AI should then proceed through each step **strictly in order**, with **human confirmation at two critical approval gates** (test plan approval and final verification approval).

---

## Request Template

Before starting a split, the requester must provide:

1. **Target module** (`originalPath`)
    - Relative path to the current large `.mjs` file
    - Example: `src/jswasm/struct-binder-factory.mjs`.

2. **Extraction intent** (`extractionPlan`)
    - A short description of the logic that should move out of the large file, for example:
        - "All buffer allocation helpers."
        - "Struct member access helpers."

    - Any suggested names for the new module(s), if you have preferences.

3. **Behavioral notes**
    - Any nuance that must not change:
        - Public exports and their signatures.
        - Error behavior and edge cases.
        - Performance assumptions (e.g., no extra allocations in hot loops).

4. **Dependent imports**
    - Known locations that import the large `.mjs` file:
        - Direct imports (`import { x } from "./struct-binder-factory.mjs"`)
        - Indirect or re-export modules.

5. **Existing tests**
    - Where current tests live, if any:
        - Existing `*.test.ts` or `*.test.mts` files.
        - Browser or integration flows that rely on this module.

A complete request allows the AI to perform a safe, incremental split.

---

## Mandatory Pre-flight

Before touching the repo, the AI must:

- Read `AGENTS.md` and `.clinerules/base_rules.md`.
- Confirm the **Three-Phase Processing Pattern** and the rule about **numeric comments inside functions** are followed.
- Keep functions small, lines ≤ 120 characters, and naming consistent with existing code:
    - `camelCase` for values and functions.
    - `PascalCase` for classes.

- Prefer **pure helpers** and narrow interfaces in the new module.

---

## Interactive, Step-by-step Execution Model

The numbered items under **Refactoring Workflow** are treated as an ordered TODO list.
When an AI assistant is driving the split, it **must obey all of the following rules**:

1. **Strict ordering**
    - Work on **one numbered step at a time**.
    - Do not start any work that belongs to step _N+1_ before step _N_ is fully completed.

2. **Approval Gates & Autonomous Zones**
   To streamline the process, we define specific "Autonomous Zones" where the AI proceeds without asking for permission between steps, and "Approval Gates" where human confirmation is mandatory.
    - **Gate 1: Test Plan Approval (Start of Step 2)**
        - The AI must analyze the code and generate a **Test Plan/Spec file** in `docs/development`.
        - The AI **stops** and asks the developer to inspect and approve this test plan.
        - **Once the test plan is approved**, the AI enters **Autonomous Zone A**.

    - **Autonomous Zone A (Steps 2 Implementation -> End of Step 6)**
        - The AI automatically executes Steps 2, 3, 4, 5, and 6 in sequence.
        - **Test Loop:** In Step 2 (and others), the AI operates in a loop: `Generate Code/Test` -> `Run npm run test:unit` -> `If Fail, Fix & Retry` -> `If Pass, Next Step`.
        - The AI does **not** ask "Do you want me to proceed?" between these steps. It simply reports progress, updates the checklist, and moves to the next step immediately upon success.

    - **Gate 2: Final Verification Approval (End of Step 6 / Start of Step 7)**
        - At the end of Step 6 (before executing Step 7), the AI **stops**.
        - It must **summarize** the split outcome: which files were created, which were modified, and test results.
        - It asks: `Do you want me to proceed to step 7: Final verification?`

    - **Autonomous Zone B (Step 7 -> Step 8)**
        - Once Step 7 is approved, the AI proceeds through Step 7 and Step 8 automatically.
        - It runs final verifications and documents the handover without further stopping, assuming tests pass.

3. **No step-skipping or batching**
    - Even in Autonomous Zones, the AI must complete the logic of each step fully before starting the next.
    - Checklist updates should be emitted at the completion of each step (or batched if the AI completes multiple in one turn, though granular reporting is preferred).

4. **Rollback / correction loop**
    - If `npm run test:unit` or other commands fail at any point, the AI stays in the current step, diagnoses, fixes, and re-runs tests until they pass.

5. **Command echoing**
    - Always show the commands being run (`npm run test:unit`, etc.) and their output (or ask the user to run them if the environment restricts execution).

---

## Command & Test Execution Contract

Some steps are **command-gated**: they cannot be marked completed, and the AI must not ask to proceed to the next step, until specific commands have been run and confirmed passing.

### Command-gated steps

- **Step 2 – Add or update test coverage**
    - Command:
      `npm run test:unit`
    - Purpose: establish a **baseline** for the current large `.mjs` implementation.
    - Requirements:
        - The AI must either:
            - Run the tests via tools (if available), **or**
            - Instruct the user to run `npm run test:unit` and wait for the result.

        - If tests fail, the AI must remain in Step 2, help debug, and only mark Step 2 as `[x]` once tests pass.

- **Step 4 – Extract logic and rewire the original file**
    - Command:
      `npm run test:unit`
    - Purpose: ensure that after extraction and imports rewire, unit tests still pass.
    - Requirements:
        - The AI must not:
            - Mark Step 4 as completed, or
            - Ask to proceed to Step 5,
              until `npm run test:unit` is confirmed passing.

- **Step 5 – Format and lint**
    - Command:
      `npm run format && npm run lint`
    - Purpose: enforce code style and ESLint rules after the split.
    - Requirements:
        - The AI must remain in Step 5 until:
            - Formatting completes, and
            - Lint passes or all remaining warnings are explicitly justified.

        - On failure, the AI must adjust the code and repeat the commands.

- **Step 6 – Update runtime references**
    - Command:
      `npm run test:unit`
    - Purpose: validate that **all updated import paths** behave correctly with unit tests.
    - Requirements:
        - The AI must not:
            - Mark Step 6 as `[x]`, or
            - Ask to proceed to Step 7,
              until `npm run test:unit` passes with the new import graph.

- **Step 7 – Final verification**
    - Command:
      `pnpm test`
    - Purpose: run browser/integration flows (e.g., SQLite demos). The e2e tests use Vitest + Playwright, which automatically opens the browser and captures console output.
    - Requirements:
        - The AI must only mark Step 7 as done after confirming:
            - `pnpm test` succeeds.
            - No blocking errors appear in the terminal output (Playwright captures browser console errors automatically).

### General rules for commands

- The AI must always:
    - Print the commands (`npm run test:unit`, `npm run format`, `npm run lint`, `pnpm test`, etc.).
    - Ask the user to run them and share results, unless the AI can run them directly.

- The AI must never:
    - Assume success without explicit confirmation (logs or a clear statement).
    - Mark a command-gated step as `[x]` in the checklist or ask to proceed until commands are confirmed passing.

- If commands fail at any gated step:
    - The AI remains in that step.
    - It iterates on code or tests until commands pass.
    - Only then may the checklist be updated and the next step started.

---

## Standard Checklist Block

At the end of **every step** (or every response in an autonomous zone), the AI must emit the machine-readable checklist block.

### Checklist block format

The AI must append the following fenced code block to the end of its message:

```split-checklist
currentStep: <N>   # integer, the step just completed or currently being worked on
steps:
- [ ] 1. Analyze the original module
- [ ] 2. Add or update test coverage
- [ ] 3. Create the new module file and directory
- [ ] 4. Extract logic and rewire the original file
- [ ] 5. Format and lint
- [ ] 6. Update runtime references
- [ ] 7. Final verification
- [ ] 8. Document and hand over
```

Rules:

- `currentStep` is the step the AI is **finishing** in that message.
- Checkboxes:
    - Completed steps → `[x]`.
    - The step just completed → usually `[x]`.
    - Future steps → `[ ]`.

- Step labels must exactly match the titles in **Refactoring Workflow** so tools can parse reliably.

**Example after finishing Step 1:**

```split-checklist
currentStep: 1
steps:
- [x] 1. Analyze the original module
- [ ] 2. Add or update test coverage
- [ ] 3. Create the new module file and directory
- [ ] 4. Extract logic and rewire the original file
- [ ] 5. Format and lint
- [ ] 6. Update runtime references
- [ ] 7. Final verification
- [ ] 8. Document and hand over
```

---

## Refactoring Workflow

The workflow below is the ordered TODO list.
**The AI must obey the Interactive Execution Model while executing these steps.**

### 1. Analyze the original module.

- Open `originalPath` (the large `.mjs` file).
- **Wiki Analysis:** Specifically check the repository wiki in `.qoder/` for any relevant documentation, architectural notes, or known issues related to the module being split.
- Record:
    - All **exports**: functions, constants, classes, default exports.
    - Important **internal helpers** and how they group functionally.
    - Dependencies (both imports and modules that depend on this file).
    - Existing behavior that must remain unchanged (return types, error handling, performance characteristics).
    - Any existing JSDoc or inline documentation that should be preserved.
- **Output:** Summary of analysis. Proceed immediately to generating the Test Plan (Step 2).

---

## Example: Splitting `struct-binder-factory.mjs`

This section shows how to apply this spec to a real file like the one below:

- File name: `struct-binder-factory.mjs`
- Public API: `export function StructBinderFactory(config)`
- Responsibility: create SQLite struct wrapper types for WASM interop.

```js
// struct-binder-factory.mjs (excerpt)
export function StructBinderFactory(config) {
    const context = createContext(config);
    const StructType = createStructType(context);
    // ...
}
```

### 1. Analyze the original module (Step 1)

For `struct-binder-factory.mjs`, Step 1 should identify:

- **Public API**
    - Only the named export `StructBinderFactory` is used by callers.

- **Internal helper groups**
    - **General utilities**: `toss`, `defineReadonly`, `describeMember`, `isNumericValue`, `detectLittleEndian`.
    - **Config + debug flag helpers**: `DEBUG_FLAG_MASK`, `ensureConfig`, `ensureDebugFlagFactories`.
    - **Signature helpers**: `RX_SIG_SIMPLE`, `RX_SIG_FUNCTION`, `createSignatureHelpers`.
    - **Context + struct runtime**: `createContext`, `createStructType`.
    - **Struct definition helpers**: `validateStructDefinition`, `validateMemberSignature`, `defineMemberAccessors`, `normalizeStructArgs`.

The key insight: callers only depend on `StructBinderFactory`, so we are free to reorganize **internals** as long as this export keeps the same behavior.

A good high‑level extraction goal is:

> Keep `StructBinderFactory` in the original module and move most of the heavy helper logic into a new internal helper module.

You can record this as the `extractionPlan` when filling the Request Template.

---

### 2. Add or update test coverage.

**Phase 1: Test Plan Generation (Gate 1)**

- **Action:** Create a Test Plan/Spec file in `docs/development` describing:
    - Selected test type(s): Unit (`*.unit.test.ts`) or E2E (`*.e2e.test.ts`).
    - Intended test cases and coverage (focus on public API behavior).
    - Test data and scenarios.
    - Scaffolding (e.g., helpers, fixtures, mocks).

- **Stop:** Ask developer to inspect and approve this test plan.

**Phase 2: Implementation (Autonomous Start)**

Before splitting, ensure there are unit tests that exercise:

- That `StructBinderFactory(config)` throws on bad configs (invalid `heap`, missing `alloc` / `dealloc`, etc.).
- That a simple struct definition produces a working constructor:
    - Allocates memory.
    - Reads/writes members correctly via the generated getters/setters.
    - Disposes correctly (deallocates, runs `ondispose` handlers).

Concretely, you might:

- Create or extend `src/jswasm/struct-binder-factory.test.ts`.
- Import from the original `.mjs`:

    ```ts
    import { StructBinderFactory } from "./struct-binder-factory.mjs";
    ```

- Run `npm run test:unit` and keep iterating until tests pass.
- **Test Loop:**
    1. Write/Update test file.
    2. Run `npm run test:unit`.
    3. **If Fail:** Analyze error, fix test or code, repeat loop.
    4. **If Pass:** Mark Step 2 done, **automatically proceed to Step 3**.

---

### 3. Create the new module file and directory.

For this file, a reasonable split is:

- Keep the **public factory** and thin glue in the original file.
- Move most of the shared helpers into a new internal module.

One concrete plan:

- Original file (unchanged path):
    - `src/jswasm/struct-binder-factory.mjs`

- New internal helper module:
    - `src/jswasm/struct-binder-internals.mjs`

The new file `struct-binder-internals.mjs` would export the low‑level pieces:

- General utilities:
    - `toss`, `defineReadonly`, `describeMember`, `isNumericValue`, `detectLittleEndian`.

- Config + debug flags:
    - `DEBUG_FLAG_MASK`, `ensureConfig`, `ensureDebugFlagFactories`.

- Signature and pointer helpers:
    - `RX_SIG_SIMPLE`, `RX_SIG_FUNCTION`, `createSignatureHelpers`.

- Context + struct runtime:
    - `createContext`, `createStructType`.

- Struct definition helpers:
    - `validateStructDefinition`, `validateMemberSignature`, `defineMemberAccessors`, `normalizeStructArgs`.

Then the original file would import them:

```js
// src/jswasm/struct-binder-factory.mjs
import {
    toss,
    defineReadonly,
    ensureConfig,
    ensureDebugFlagFactories,
    createContext,
    createStructType,
    validateStructDefinition,
    defineMemberAccessors,
    normalizeStructArgs,
} from "./struct-binder-internals.mjs";

export function StructBinderFactory(config) {
    const context = createContext(config);
    const StructType = createStructType(context);
    // ... rest of the factory logic ...
}
```

At the end of Step 3, the new module exists and contains the moved helpers, but behavior has not changed yet from the outside: callers still import only `StructBinderFactory` from the original file.

- **Status:** Report creation. **Automatically proceed to Step 4.**

---

### 4. Extract logic and rewire the original file.

For `struct-binder-factory.mjs`, Step 3 and Step 4 often blend together:

- **Move** helper definitions from the original file into `struct-binder-internals.mjs`.
- **Replace** their old definitions in the original file with `import` statements.
- Keep `StructBinderFactory` and any very small glue helpers close to the export so the original file becomes a thin orchestration layer.

Once rewiring is done:

- **Test Loop:**
    1. Complete extraction and import rewiring.
    2. Run `npm run test:unit`.
    3. **If Fail:** Fix, repeat.
    4. **If Pass:** Mark Step 4 done, **automatically proceed to Step 5**.

The original file should now be much shorter and focus on:

- Validating struct definitions.
- Building `StructCtor` classes.
- Exporting `StructBinderFactory`.

Most of the pointer math, DataView access, and signature logic lives in `struct-binder-internals.mjs`.

---

### 5. Format and lint.

After moving the helpers:

- Run:

    ```bash
    npm run format && npm run lint
    ```

- Fix style and ESLint issues in **both** files:
    - `struct-binder-factory.mjs`
    - `struct-binder-internals.mjs`

- **Loop:** If fails, fix and retry.
- **Status:** Once clean, **automatically proceed to Step 6**.

---

### 6. Update runtime references.

In this example, the new module `struct-binder-internals.mjs` is **internal only**:

- Other files continue to import only `StructBinderFactory` from `struct-binder-factory.mjs`.
- No external imports need to change.

So Step 6 mainly confirms:

- There are **no direct imports** of helpers like `createContext`, `defineMemberAccessors`, etc. from the old file.
- All internal references inside `struct-binder-factory.mjs` now go through imports from `struct-binder-internals.mjs`.

Then run `npm run test:unit` again to confirm everything still passes.

- **Test Loop:**
    1. Verify import references.
    2. Run `npm run test:unit`.
    3. **If Fail:** Fix, repeat.
    4. **If Pass:** Mark Step 6 done.
- **Stop (Gate 2):**
    - **Summarize:** Files created, files modified, test results.
    - **Ask:** "Do you want me to proceed to step 7: Final verification?"

---

### 7. Final verification.

Run the full higher‑level tests:

```bash
pnpm test
```

The e2e tests use Vitest + Playwright, which automatically:

- Opens the browser in the background.
- Executes the SQLite flows (e.g., struct allocation, read/write operations).
- Captures browser console errors and prints them to the terminal.

Review the terminal output to ensure:

- All tests pass.
- No errors related to `StructBinderFactory` appear in the captured console logs.

- **Status:** If pass, **automatically proceed to Step 8**.

---

### 8. Document and hand over.

For this specific split, your PR notes might say something like:

- **What changed**
    - Split `struct-binder-factory.mjs` into:
        - `struct-binder-factory.mjs` (public `StructBinderFactory` and glue).
        - `struct-binder-internals.mjs` (debug flags, signature helpers, context/struct runtime, member accessors).

- **What stayed the same**
    - Public API: `StructBinderFactory(config)` remains the only export.
    - Behavior: struct definitions, field access, and disposal logic are unchanged.

- **Commands run**
    - `npm run test:unit`
    - `npm run format && npm run lint`
    - `pnpm test`

This example can be used as a template the next time you split a large `.mjs` file: fill the Request Template with the actual `originalPath` and `extractionPlan`, then follow Steps 1–8 in order.
