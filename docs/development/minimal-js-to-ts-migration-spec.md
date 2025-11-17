# Minimal JS → TS Migration Spec

This checklist codifies the **minimal migration unit** for the JS/WASM bridge under `src/jswasm`.
A requester should fill out the template below before asking for AI implementation; the AI should then proceed through each step **strictly in order**, with **human confirmation between steps**.

Our goal is to keep the library working at every stage while steadily replacing a `.mjs` + `.d.ts` pair with a typed subdirectory containing the `.ts` source, emitted `.js`, and regenerated `.d.ts`.

---

## Request Template

Please answer the following before starting a migration:

1. **Target module** (`originalPath`): relative path to the current `.mjs` file (e.g., `src/jswasm/utils/utf8.mjs`).
2. **Declaration file** (`dtsPath`): relative path to the hand-authored `.d.ts` that documents the same module.
3. **Behavioral notes**: any nuance the implementer must preserve (typical inputs, runtime constraints, existing tests).
4. **Dependent imports**: places that currently import the `.mjs` file so we can update them later.

A complete request allows the AI to follow the minimal migration workflow end-to-end.

---

## Mandatory Pre-flight

- Read `AGENTS.md` and `.clinerules/base_rules.md` before touching the repo.
- Confirm the Three-Phase Processing Pattern and the rule about numeric comments inside functions are observed while editing.
- Keep functions small, lines ≤ 120 characters, and naming consistent with existing code (camelCase for values/functions, PascalCase for classes).

---

## Interactive, Step-by-step Execution Model

The numbered items under **Migration Workflow** are treated as an ordered TODO list.
When an AI assistant is driving the migration, it **must obey all of the following rules**:

1. **Strict ordering**
    - Work on **one numbered step at a time** (`1.`, then `2.`, then `3.`, …).
    - Do not start any work that belongs to step _N+1_ before step _N_ is fully completed and approved.
    - Sub-bullets under a step are part of that step and must also be completed before moving on.

2. **Explicit confirmation gate**
    - At the end of each step, the AI must:
        - Summarize **what was done** in that step (files touched, commands to run, expected results).
        - List the **current TODO status**, for example:
            - `[x] 1. Analyze the originals`
            - `[ ] 2. Add a test harness`
            - …

        - Ask the human explicitly:
          **“Do you want me to proceed to step N+1: <step title>?”**

    - The AI **must not** begin any work from the next step until the human explicitly agrees (any clear “yes / proceed / go ahead” is fine).

3. **No step-skipping or batching**
    - Do not batch multiple steps in one response (e.g., don’t analyze, write tests, and create TS files in a single pass).
    - If the human asks to “jump ahead”, the AI should:
        - Point out which earlier steps are being skipped.
        - Ask for explicit confirmation that skipping is intentional.
        - Only then execute the requested later step.

4. **Rollback / correction loop**
    - If the human is not satisfied with a step, they can request changes **within that step**.
    - The AI must stay on the same step, revising as needed, and only ask to proceed again once the updated version is summarized.

5. **Command echoing (optional but recommended)**
    - When a step involves commands (e.g., `npm run test:unit`, `npm run build:migration`), the AI should:
        - Show the exact commands to run.
        - Explain what success or failure looks like.

    - After the human runs the commands, they can paste logs back, and the AI remains within the same step until everything passes.

---

## Standard Checklist Block & Gating Question

At the end of **every step** in the Migration Workflow, the AI must:

1. Emit a machine-readable checklist block.
2. Ask explicitly whether to proceed to the **next** step.

### Checklist block format

The AI must append the following fenced code block at the end of its message:

```migration-checklist
currentStep: <N>   # integer, the step just completed or currently being worked on
steps:
- [ ] 1. Analyze the originals
- [ ] 2. Add a test harness
- [ ] 3. Create the migration subdirectory
- [ ] 4. Redirect tests to the new TypeScript source
- [ ] 5. Compile the migration
- [ ] 6. Update runtime references
- [ ] 7. Remove now-unused artifacts
- [ ] 8. Final verification
- [ ] 9. Document and hand over
```

Rules:

- The AI must:
    - Set `currentStep` to the step it is **currently finishing**.
    - Update the checkboxes in `steps` so that:
        - Completed steps are marked as `[x]`.
        - The step currently being worked on may be `[x]` (just finished) or `[-]` (in progress), if you want to distinguish.
        - Future steps are `[ ]`.

- The exact text of each step label must match the titles in the **Migration Workflow**, so tools can parse them reliably.
- Tools like Codex/Cline can parse this `migration-checklist` block from the last assistant message to know where the flow is.

**Example after finishing Step 1:**

```migration-checklist
currentStep: 1
steps:
- [x] 1. Analyze the originals
- [ ] 2. Add a test harness
- [ ] 3. Create the migration subdirectory
- [ ] 4. Redirect tests to the new TypeScript source
- [ ] 5. Compile the migration
- [ ] 6. Update runtime references
- [ ] 7. Remove now-unused artifacts
- [ ] 8. Final verification
- [ ] 9. Document and hand over
```

### Mandatory gating question

After the checklist block, the AI must always ask the human whether to proceed to the **next** step.

- The question format must be:

    > Do you want me to proceed to step <N+1>: <step title>?

- Examples:
    - After Step 1 is done:
      `Do you want me to proceed to step 2: Add a test harness?`
    - After Step 4 is done:
      `Do you want me to proceed to step 5: Compile the migration?`

The AI **must not** start any work from step `N+1` until the user replies with clear consent (e.g. “Yes”, “Proceed”, “Go ahead”).

---

## Migration Workflow

The workflow below is the ordered TODO list.
**The AI must obey the Interactive Execution Model above while executing these steps.**

### 1. Analyze the originals.

- Open `originalPath` and `dtsPath`. Record their exports, signatures, and edge cases.
- Identify existing behavior that must remain unchanged (e.g., return types, overloads, TextDecoder fallbacks).
- Note any runtime assumptions (e.g., running in a browser, availability of `TextDecoder`, polyfills, etc.).

**AI/human protocol for Step 1**

- AI:
    - Summarizes the public API and key behaviors.
    - Lists any uncertainties or edge cases found.
    - Shows updated checklist with step 1 marked as done.
    - Asks:
      _“Do you want me to proceed to step 2: Add a test harness?”_

- Only after the human agrees does the AI move to Step 2.

---

### 2. Add a test harness.

- Create `*.test.ts` next to `originalPath` (same directory, same stem).
- Cover the behaviors exposed by the `.mjs` file and `.d.ts` types using Vitest (the repo already has `vitest.config.ts`).
- Point the tests at the existing `.mjs` implementation and run `npm run test:unit`. Tests must pass to establish the baseline.
- Before the tests target the new `.ts`, add the new migration entry to `tsconfig.migration.json` so the `build:migration` output can emit the paired `.js` and `.d.ts`.

**Unit-test gating**

- Before any `*.test.ts` is created:
    - Read all files in `.memory-bank/` (if present).
    - Analyze the target source and declaration.
    - Craft a short plan in `docs/development` describing:
        - Intended test cases.
        - Test data.
        - Scaffolding (e.g., helpers, fixtures).

    - **Pause for developer approval before writing the actual test file.**

**AI/human protocol for Step 2**

- AI:
    - Presents the proposed `docs/development` test plan.
    - Waits for human approval of the plan.
    - After approval, writes the `*.test.ts` file and explains:
        - What cases were covered.
        - How the tests reference the existing `.mjs`.
        - How to run `npm run test:unit` and what passing looks like.

    - Shows updated checklist with step 2 marked as done.
    - Asks:
      _“Do you want me to proceed to step 3: Create the migration subdirectory?”_

- AI stays in Step 2 until:
    - The human confirms the test plan, and
    - The human is satisfied with the test file.

---

### 3. Create the migration subdirectory.

- Mirror the original path inside a new folder:
  If the module was `src/jswasm/utils/utf8.mjs`, create `src/jswasm/utils/utf8/`.
- Inside that folder add the new `utf8.ts` implementing the same exports, with type annotations guided by the original `.d.ts`.
- Keep functions small and focused; break repeated/complex logic into helpers.
- Add comments only where necessary for clarity.

**AI/human protocol for Step 3**

- AI:
    - Describes the new folder layout.
    - Shows the new TypeScript API surface (types and signatures).
    - Explains any internal helper functions introduced.
    - Shows updated checklist with step 3 marked as done.
    - Asks:
      _“Do you want me to proceed to step 4: Redirect tests to the new TypeScript source?”_

---

### 4. Redirect tests to the new TypeScript source.

- Update `*.test.ts` to import from the compiled output (e.g., `../utf8.js` once built) or the `.ts` while the build isn’t ready.
- Run `npm run test:unit` again until the tests pass against the TS implementation.

**AI/human protocol for Step 4**

- AI:
    - Shows the updated imports in the test file.
    - Lists any test failures and the fixes made in the TS implementation.
    - Confirms that `npm run test:unit` passes (based on logs shared by the human).
    - Shows updated checklist with step 4 marked as done.
    - Asks:
      _“Do you want me to proceed to step 5: Compile the migration?”_

---

### 5. Compile the migration.

- Run `npm run build:migration` to emit `*.js` and `*.d.ts` next to the new `.ts`.
- Confirm the generated `.d.ts` matches the public API surface from the original manual declaration; adjust the TS source until it does.
- Each migration entry must be reflected inside `tsconfig.migration.json`'s `include` (the current example lives under `src/jswasm/utils/utf8/*.ts`).
- Keep the include list tightly scoped, and once the migration is complete and the original files removed, delete the migration entry so the config only covers active work.

**AI/human protocol for Step 5**

- AI:
    - Shows the added/updated `include` entries in `tsconfig.migration.json`.
    - Describes differences (if any) between the generated `.d.ts` and the original.
    - Suggests TS source adjustments to align the signatures.
    - Shows updated checklist with step 5 marked as done.
    - Asks:
      _“Do you want me to proceed to step 6: Update runtime references?”_

---

### 6. Update runtime references.

- Replace imports that pointed to `originalPath` with the new compiled `.js`
  (e.g., change `./utf8.mjs` → `./utf8/utf8.js`).
- Verify the tests still pass; rerun `npm run test:unit` if needed.

**AI/human protocol for Step 6**

- AI:
    - Lists all files where imports were changed.
    - Shows an example diff for one or two representative imports.
    - Confirms `npm run test:unit` still passes, based on human logs.
    - Shows updated checklist with step 6 marked as done.
    - Asks:
      _“Do you want me to proceed to step 7: Remove now-unused artifacts?”_

---

### 7. Remove now-unused artifacts.

- Delete the original `.mjs` and `.d.ts` files once the new JS and declaration outputs are proven equivalent.

**AI/human protocol for Step 7**

- AI:
    - Lists the exact files removed.
    - Confirms that no remaining imports point at the old `.mjs` or `.d.ts`.
    - Shows updated checklist with step 7 marked as done.
    - Asks:
      _“Do you want me to proceed to step 8: Final verification?”_

---

### 8. Final verification.

- Run `pnpm test` to exercise the browser-based SQLite flows.
  This step often requires human interaction to open `http://127.0.0.1:50001` and check for console errors.
- Keep notes about any windows or manual steps the human tester must follow.

**AI/human protocol for Step 8**

- AI:
    - Provides clear instructions for running `pnpm test` and manual browser checks.
    - Helps interpret any console or test failures and suggests fixes (which may loop back into earlier steps for this module).
    - Once everything passes, shows updated checklist with step 8 marked as done.
    - Asks:
      _“Do you want me to proceed to step 9: Document and hand over?”_

---

### 9. Document and hand over.

- Describe the migration in the PR or follow-up documentation, mentioning:
    - Updated paths.
    - New tests.
    - The build commands used.

- Note any deviations from the base rules or workflows in the final message
  (e.g., if a numeric comment outside a function was necessary).

**AI/human protocol for Step 9**

- AI:
    - Proposes PR description text and any additional docs snippets.
    - Summarizes the entire migration, including:
        - Original and new module locations.
        - Key behavioral equivalence points.
        - Test commands and their status.

    - Marks all checklist items as `[x]` and indicates the migration unit is complete.

---

## Expected Outputs

For each minimal migration unit:

- A new `*/moduleName/moduleName.ts` file capturing the behavior and types of the original pair.
- A companion `moduleName.test.ts` that proves parity before and after migration.
- Emitted `moduleName.js` and `moduleName.d.ts` ready for downstream imports.
- Updated import paths for consumers and removal of the obsolete `.mjs`/`.d.ts`.
- Tests:
    - `npm run test:unit` (pre- and post-migration).
    - `pnpm test` (browser) during final verification.

---

## Reference

- Existing migration guidance: `docs/development/jswasm-typescript-migration.md`.
- Repository commands: `package.json`, `tsconfig.migration.json`, `vitest.config.ts`.
- Keep in mind:
    - Readability → stability → robustness.
    - The Three-Phase Processing Pattern.
    - Numeric comments restrictions from `.clinerules/base_rules.md`.
