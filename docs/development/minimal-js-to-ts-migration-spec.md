# Minimal JS → TS Migration Spec

This checklist codifies the **minimal migration unit** for the JS/WASM bridge under `src/jswasm`.
A requester should fill out the template below before asking for AI implementation; the AI should then proceed through each step **strictly in order**, with **human confirmation at two critical approval gates** (test plan approval and deletion approval).

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
- Treat documentation as part of the public API: preserve or improve any existing JSDoc/TSDoc comments and plan how they will
  be carried over into the new TypeScript source.
- **Claude Code requirement**: Claude must also read and honor `CLAUDE.md` plus any repo-level AI guidelines in AGENTS/Clinerules before executing the workflow below.

---

## Interactive, Step-by-step Execution Model

The numbered items under **Migration Workflow** are treated as an ordered TODO list.
When an AI assistant is driving the migration, it **must obey all of the following rules**:

1. **Strict ordering**
    - Work on **one numbered step at a time**.
    - Do not start any work that belongs to step _N+1_ before step _N_ is fully completed.

2. **Approval Gates & Autonomous Zones**
   To streamline the process, we define specific "Autonomous Zones" where the AI proceeds without asking for permission between steps, and "Approval Gates" where human confirmation is mandatory.
    - **Gate 1: Spec/Test Plan Approval (Start of Step 2)**
        - The AI must analyze the code and generate a **Spec File** (Test Plan) in `docs/development`.
        - The AI **stops** and asks the developer to inspect and approve this spec.
        - **Once the spec is approved**, the AI enters **Autonomous Zone A**.

    - **Autonomous Zone A (Steps 2 Implementation -> End of Step 7)**
        - The AI automatically executes Steps 2, 3, 4, 5, 6, and 7 in sequence.
        - **Test Loop:** In Step 2 (and others), the AI operates in a loop: `Generate Code/Test` -> `Run npm run test` -> `If Fail, Fix & Retry` -> `If Pass, Next Step`.
        - The AI does **not** ask "Do you want me to proceed?" between these steps. It simply reports progress, updates the checklist, and moves to the next step immediately upon success.

    - **Gate 2: Deletion Approval (End of Step 7 / Start of Step 8)**
        - At the end of Step 7 (before executing Step 8), the AI **stops**.
        - It must **summarize** exactly which files will be removed (e.g., `.mjs`, `.d.ts`) and updated.
        - It asks: `Do you want me to proceed to step 8: Remove now-unused artifacts?`

    - **Autonomous Zone B (Step 8 -> Step 10)**
        - Once Step 8 is approved, the AI proceeds through Step 8, Step 9, and Step 10 automatically.
        - It runs final verifications and documents the handover without further stopping, assuming tests pass.

3. **No step-skipping or batching**
    - Even in Autonomous Zones, the AI must complete the logic of each step fully before starting the next.
    - Checklist updates should be emitted at the completion of each step (or batched if the AI completes multiple in one turn, though granular reporting is preferred).

4. **Rollback / correction loop**
    - If `npm run test` fails at any point, the AI stays in the current step, diagnoses, fixes, and re-runs tests until they pass.

5. **Command echoing**
    - Always show the commands being run (`npm run test`, etc.) and their output (or ask the user to run them if the environment restricts execution).

---

## Standard Checklist Block

At the end of **every step** (or every response in an autonomous zone), the AI must emit the machine-readable checklist block.

```migration-checklist
currentStep: <N>
steps:
- [ ] 1. Analyze the originals
- [ ] 2. Add a test harness (Spec & Implementation)
- [ ] 3. Create the migration subdirectory
- [ ] 4. Redirect tests to the new TypeScript source
- [ ] 5. Compile the migration
- [ ] 6. Build, format, and lint
- [ ] 7. Update runtime references
- [ ] 8. Remove now-unused artifacts
- [ ] 9. Final verification
- [ ] 10. Document and hand over
```

---

## Migration Workflow

### 1. Analyze the originals.

- Open `originalPath` and `dtsPath`. Record their exports, signatures, and edge cases.
- **Wiki Analysis:** Specifically check the repository wiki in `.qoder/` for any relevant documentation, architectural notes, or known issues related to the module being migrated.
- Identify existing behavior that must remain unchanged (e.g., return types, overloads, TextDecoder fallbacks).
- Note any runtime assumptions (e.g., running in a browser, availability of `TextDecoder`, polyfills, etc.).
- Review any existing JSDoc or inline documentation on the `.mjs` and `.d.ts` pair so it can be reflected or refined in the
  new TypeScript doc comments.
- **Output:** Summary of analysis. Proceed immediately to generating the Spec (Step 2).

---

### 2. Add a test harness.

**Phase 1: Spec Generation (Gate 1)**

- **Action:** Create a Test Plan/Spec file in `docs/development` describing:
    - Selected test type(s): Unit (`*.unit.test.ts`) or E2E (`*.e2e.test.ts`).
    - Intended test cases and coverage.
    - Test data.
    - Scaffolding (e.g., helpers, fixtures).

- **Stop:** Ask developer to inspect and approve this spec.

**Phase 2: Implementation (Autonomous Start)**

- **Action:** Create `*.test.ts` next to `originalPath` (same directory, same stem).
- Cover the behaviors exposed by the `.mjs` file and `.d.ts` types using Vitest (the repo already has `vitest.config.ts`).
- Point the tests at the existing `.mjs` implementation and run `npm run test`. Tests must pass to establish the baseline.
- Before the tests target the new `.ts`, add the new migration entry to `tsconfig.migration.json` so the `build:migration` output can emit the paired `.js` and `.d.ts`.
- **Test Loop:**
    1. Write/Update test file.
    2. Run `npm run test`.
    3. **If Fail:** Analyze error, fix test or code, repeat loop.
    4. **If Pass:** Mark Step 2 done, **automatically proceed to Step 3**.

---

### 3. Create the migration subdirectory.

- Mirror the original path inside a new folder:
  If the module was `src/jswasm/utils/utf8.mjs`, create `src/jswasm/utils/utf8/`.
- Before writing the new `.ts`, re-open the original `.d.ts` and any related type helpers to lift precise signatures and
  reduce reliance on fallback types such as `any`, `unknown`, or `null`.
- Inside that folder add the new `utf8.ts` implementing the same exports, with type annotations guided by the original `.d.ts`.
- Keep functions small and focused; break repeated/complex logic into helpers.
- Add standard doc comments (for example, JSDoc/TSDoc-style `/** ... */`) on each exported function, class, and class method
  to explain its intention and usage.
    - At minimum, document parameters and return values (via tags such as `@param` and `@returns`) and call out important
      invariants, side effects, and error conditions (for example, with `@throws` or a short description in the main text).
    - Prefer updating or lifting any existing JSDoc from the original `.mjs`/`.d.ts` so behavior, types, and documentation stay
      aligned.

- Keep other inline comments minimal and only where they significantly improve clarity.
- **Status:** Report creation. **Automatically proceed to Step 4.**

---

### 4. Redirect tests to the new TypeScript source.

- **Move the test file into the new migration subdirectory** so implementation and tests live together.
    - Example for `src/jswasm/utils/utf8.mjs`:
        - **Before (Step 2 location):** `src/jswasm/utils/utf8.unit.test.ts` (or `utf8.e2e.test.ts`)
        - **After (Step 4 location):** `src/jswasm/utils/utf8/utf8.unit.test.ts`

- Inside the moved `*.test.ts`, update imports so they no longer point at the `.mjs` file.
    - **Before (Step 2 baseline):**

        ```ts
        import { something } from "./utf8.mjs";
        ```

    - **After (Step 4 migration, inside `src/jswasm/utils/utf8/utf8.unit.test.ts`):**

        ```ts
        import { something } from "./utf8";
        ```

    - In other words:
        - Move the test next to the new TS module, and
        - **Remove the `.mjs` suffix** so the tests import the module by its extension-less root path. This allows the same test file to exercise the compiled JS/TS implementation depending on the build and runner configuration.

- Ensure Vitest resolves the extension-less path correctly for both the TS source (during migration) and the emitted JS (after `build:migration`).

- **Test Loop:**
    1. Update imports.
    2. Run `npm run test`.
    3. **If Fail:** Fix, repeat.
    4. **If Pass:** Mark Step 4 done, **automatically proceed to Step 5.**

---

### 5. Compile the migration.

- Run `npm run build:migration` to emit `*.js` and `*.d.ts` next to the new `.ts`.
- Confirm the generated `.d.ts` matches the public API surface from the original manual declaration; adjust the TS source until it does.
- Each migration entry must be reflected inside `tsconfig.migration.json`'s `include` (the current example lives under `src/jswasm/utils/utf8/*.ts`).
- Keep the include list tightly scoped, and once the migration is complete and the original files removed, delete the migration entry so the config only covers active work.
- **Verify:** Check `.d.ts` output.
- **Status:** Report result. **Automatically proceed to Step 6.**

---

### 6. Build, format, and lint.

- Run the combined command to build the migration outputs, format the codebase, and lint for rule violations:

    ```bash
    npm run build:migration && npm run format && npm run lint
    ```

- Ensure:
    - `npm run build:migration` succeeds without errors.
    - `npm run format` completes (and you commit the formatting changes if this is a PR).
    - `npm run lint` passes with no errors; address any reported issues in the new TS module and tests, or clearly justify any remaining warnings.
- **Loop:** If fails, fix and retry.
- **Status:** Once clean, **automatically proceed to Step 7.**

---

### 7. Update runtime references.

- Replace imports that pointed to `originalPath` with the new compiled module
  (e.g., change `./utf8.mjs` → `./utf8/utf8`) and remove any `.js` suffix so downstream imports stay extension-less even
  though the compiled output is JavaScript.
- **Test Loop:**
    1. Update imports.
    2. Run `npm run test`.
    3. **If Fail:** Fix, repeat.
    4. **If Pass:** Mark Step 7 done.
- **Stop (Gate 2):**
    - **Summarize:** List files to be removed (Step 8) and updated.
    - **Ask:** "Do you want me to proceed to step 8: Remove now-unused artifacts?"

---

### 8. Remove now-unused artifacts.

- Delete the original `.mjs` and `.d.ts` files once the new JS and declaration outputs are proven equivalent.
- Before deletion, re-read the new migration files and the original `.mjs`/`.d.ts` side by side to confirm every exported item
  and behavior has been migrated.
- **Status:** Report deletion. **Automatically proceed to Step 9.**

---

### 9. Final verification.

- Run `npm run test` to exercise the browser-based SQLite flows.
  The e2e tests use Vitest + Playwright, which automatically opens the browser and prints logs to the terminal.
- Review the terminal output for any test failures or console errors captured by Playwright.
- **Status:** If pass, **automatically proceed to Step 10**.

---

### 10. Document and hand over.

- Describe the migration in the PR or follow-up documentation, mentioning:
    - Updated paths.
    - New tests.
    - The build commands used.

- Note any deviations from the base rules or workflows in the final message
  (e.g., if a numeric comment outside a function was necessary).
- **Status:** Mark all done.

---

## Expected Outputs

For each minimal migration unit:

- A new `*/moduleName/moduleName.ts` file capturing the behavior and types of the original pair.
- A companion `moduleName.test.ts` that proves parity before and after migration.
- Emitted `moduleName.js` and `moduleName.d.ts` ready for downstream imports.
- Updated import paths for consumers and removal of the obsolete `.mjs`/`.d.ts`.
- Well-structured JSDoc/TSDoc comments on the exported TypeScript API surface, reflecting (and, where useful, improving on)
  the documentation that existed in the original `.mjs` and `.d.ts`.
- Tests:
    - All tests passing at each verification step (unit and e2e).
    - Final browser-based e2e verification via Vitest + Playwright.

---

## Reference

- Existing migration guidance: `docs/development/jswasm-typescript-migration.md`.
- Repository commands: `package.json`, `tsconfig.migration.json`, `vitest.config.ts`.
- Keep in mind:
    - Readability → stability → robustness.
    - The Three-Phase Processing Pattern.
    - Numeric comments restrictions from `.clinerules/base_rules.md`.
