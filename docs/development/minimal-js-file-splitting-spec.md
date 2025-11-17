# Minimal JS File Splitting Spec

This checklist defines the **minimal refactoring unit** for splitting a large JS/WASM bridge module (a `.mjs` file) into smaller `.mjs` modules under `src/jswasm` (or similar directories).

The goal is to **reduce file size and improve readability** while keeping runtime behavior unchanged.
A requester should fill out the template below before asking for AI implementation; the AI should then proceed through each step **strictly in order**, with **human confirmation between steps**.

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

The numbered items under **Refactoring Workflow** are the ordered TODO list.

When an AI assistant is driving the split, it **must obey all of the following rules**:

1. **Strict ordering**
    - Work on **one numbered step at a time** (`1.`, then `2.`, then `3.`, …).
    - Do not start any work that belongs to step `N+1` before step `N` is fully completed and approved.
    - Sub-bullets inside a step are part of that step and must be done before moving on.

2. **Explicit confirmation gate**
    - At the end of each step, the AI must:
        - Summarize **what was done** (files changed, logic moved, commands to run).
        - Emit the **checklist block** (see "Standard Checklist Block & Gating Question").
        - Ask the human explicitly:

            > Do you want me to proceed to step N+1: <step title>?

    - The AI **must not** start any work from the next step until the human clearly agrees
      (e.g., "Yes", "Proceed", "Go ahead").

3. **No step-skipping or batching**
    - Do not combine multiple steps in a single response.
    - If the human asks to skip ahead, the AI must:
        - State which steps are being skipped.
        - Ask for explicit confirmation that skipping is intentional.
        - Only then work on the requested later step.

4. **Rollback / correction loop**
    - If the human is not satisfied with a step, they can request changes.
    - The AI must stay in that step, update code or plan, and only ask to proceed again after summarizing the updated work.

5. **Command echoing**
    - When a step involves commands (tests, format, lint), the AI must:
        - Print the exact commands to run.
        - Explain what success or failure looks like.

    - The AI must wait for confirmation or logs before declaring a command-gated step "done".

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
    - Purpose: run browser/integration flows (e.g., SQLite demos) and manual checks.
    - Requirements:
        - The AI must only mark Step 7 as done after the user confirms:
            - `pnpm test` succeeds.
            - No blocking errors appear in the browser console for flows depending on the refactored module.

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

## Standard Checklist Block & Gating Question

At the end of **every step** in the Refactoring Workflow, the AI must:

1. Emit a machine-readable checklist block.
2. Ask explicitly whether to proceed to the **next step**.

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

### Mandatory gating question

After the checklist block, the AI must always ask:

> Do you want me to proceed to step <N+1>: <step title>?

Examples:

- After Step 1:
  `Do you want me to proceed to step 2: Add or update test coverage?`
- After Step 5:
  `Do you want me to proceed to step 6: Update runtime references?`

The AI **must not** begin any work from step `N+1` until the user explicitly says yes.

---

## Refactoring Workflow

The workflow below is the ordered TODO list.
**The AI must obey the Interactive Execution Model while executing these steps.**

### 1. Analyze the original module.

- Open `originalPath` (the large `.mjs` file).
- Record:
    - All **exports**: functions, constants, classes, default exports.
    - Important **internal helpers**.
    - Dependencies

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

### 2. Add or update test coverage (Step 2)

Before splitting, Step 2 should ensure there are unit tests that exercise:

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

- Run `npm run test:unit` and keep iterating until tests pass. Only then proceed to Step 3.

---

### 3. Create the new module file and directory (Step 3)

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

---

### 4. Extract logic and rewire the original file (Step 4)

For `struct-binder-factory.mjs`, Step 3 and Step 4 often blend together:

- **Move** helper definitions from the original file into `struct-binder-internals.mjs`.
- **Replace** their old definitions in the original file with `import` statements.
- Keep `StructBinderFactory` and any very small glue helpers close to the export so the original file becomes a thin orchestration layer.

Once rewiring is done:

- Run `npm run test:unit`.
- Fix any regressions until tests pass.

The original file should now be much shorter and focus on:

- Validating struct definitions.
- Building `StructCtor` classes.
- Exporting `StructBinderFactory`.

Most of the pointer math, DataView access, and signature logic lives in `struct-binder-internals.mjs`.

---

### 5. Format and lint (Step 5)

After moving the helpers:

- Run:

    ```bash
    npm run format && npm run lint
    ```

- Fix style and ESLint issues in **both** files:
    - `struct-binder-factory.mjs`
    - `struct-binder-internals.mjs`

Only after this passes should Step 5 be marked as complete.

---

### 6. Update runtime references (Step 6)

In this example, the new module `struct-binder-internals.mjs` is **internal only**:

- Other files continue to import only `StructBinderFactory` from `struct-binder-factory.mjs`.
- No external imports need to change.

So Step 6 mainly confirms:

- There are **no direct imports** of helpers like `createContext`, `defineMemberAccessors`, etc. from the old file.
- All internal references inside `struct-binder-factory.mjs` now go through imports from `struct-binder-internals.mjs`.

Then run `npm run test:unit` again to confirm everything still passes.

---

### 7. Final verification (Step 7)

Run the full higher‑level tests:

```bash
pnpm test
```

Follow the repo’s browser‑based flow (e.g., open the SQLite demo page) and ensure:

- Structs still allocate, read, and write correctly.
- No new errors appear in the console related to `StructBinderFactory`.

---

### 8. Document and hand over (Step 8)

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
