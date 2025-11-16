# Minimal JS → TS Migration Spec

This checklist codifies the **minimal migration unit** for the JS/WASM bridge under `src/jswasm`. A requester should fill out the template below before asking for AI implementation; the AI should then proceed through each step without cutting corners. Our goal is to keep the library working at every stage while steadily replacing a `.mjs` + `.d.ts` pair with a typed subdirectory containing the `.ts` source, emitted `.js`, and regenerated `.d.ts`.

## Request Template

Please answer the following before starting a migration:

1. **Target module** (`originalPath`): relative path to the current `.mjs` file (e.g., `src/jswasm/utils/utf8.mjs`).
2. **Declaration file** (`dtsPath`): relative path to the hand-authored `.d.ts` that documents the same module.
3. **Behavioral notes**: any nuance the implementer must preserve (typical inputs, runtime constraints, existing tests).
4. **Dependent imports**: places that currently import the `.mjs` file so we can update them later.

A complete request allows the AI to follow the minimal migration workflow end-to-end.

## Mandatory Pre-flight

- Read `AGENTS.md` and `.clinerules/base_rules.md` before touching the repo.
- Confirm the Three-Phase Processing Pattern and the rule about numeric comments inside functions are observed while editing.
- Keep functions small, lines ≤ 120 characters, and naming consistent with existing code (camelCase for values/functions, PascalCase for classes).

## Migration Workflow

Follow this step-by-step sequence for every minimal unit:

1. **Analyze the originals.**
    - Open `originalPath` and `dtsPath`. Record their exports, signatures, and edge cases.
    - Identify existing behavior that must remain unchanged (e.g., return types, overloads, TextDecoder fallbacks).

2. **Add a test harness.**
    - Create `*.test.ts` next to `originalPath` (same directory, same stem).
    - Cover the behaviors exposed by the `.mjs` file and `.d.ts` types using Vitest (the repo already has `vitest.config.ts`).
    - Point the tests at the existing `.mjs` implementation and run `npm run test:unit`. Tests must pass to establish the baseline.
    - Before the tests target the new `.ts`, add the new migration entry to `tsconfig.migration.json` so the `build:migration` output can emit the paired `.js` and `.d.ts`.

3. **Create the migration subdirectory.**
    - Mirror the original path inside a new folder: if the module was `src/jswasm/utils/utf8.mjs`, create `src/jswasm/utils/utf8/`.
    - Inside that folder add the new `utf8.ts` implementing the same exports, with type annotations guided by the original `.d.ts`.
    - Keep functions small and focused; break repeated/complex logic into helpers. Add comments only where necessary for clarity.

4. **Redirect tests to the new TypeScript source.**
    - Update `*.test.ts` to import from the compiled output (e.g., `../utf8.js` once built) or the `.ts` while the build isn’t ready.
    - Run `npm run test:unit` again until the tests pass against the TS implementation.

5. **Compile the migration.**
- Run `npm run build:migration` to emit `*.js` and `*.d.ts` next to the new `.ts`.
- Confirm the generated `.d.ts` matches the public API surface from the original manual declaration; adjust the TS source until it does.
 - Each migration entry must be reflected inside `tsconfig.migration.json`'s `include` (the current example lives under `src/jswasm/utils/utf8/*.ts`). Keep the include list tightly scoped, and once the migration is complete and the original files removed, delete the migration entry so the config only covers active work.

6. **Update runtime references.**
    - Replace imports that pointed to `originalPath` with the new compiled `.js` (e.g., change `./utf8.mjs` → `./utf8/utf8.js`).
    - Verify the tests still pass; rerun `npm run test:unit` if needed.

7. **Remove now-unused artifacts.**
    - Delete the original `.mjs` and `.d.ts` files once the new JS and declaration outputs are proven equivalent.

8. **Final verification.**
    - Run `pnpm test` to exercise the browser-based SQLite flows. This step often requires human interaction to open `http://127.0.0.1:50001` and check for console errors.
    - Keep notes about any windows or manual steps the human tester must follow.

9. **Document and hand over.**
    - Describe the migration in the PR or follow-up documentation, mentioning updated paths, new tests, and the build command used.
    - Note any deviations from the base rules or workflows in the final message (e.g., if a numeric comment outside a function was necessary).

## Expected Outputs

- A new `*/moduleName/moduleName.ts` file capturing the behavior and types of the original pair.
- A companion `moduleName.test.ts` that proves parity before and after migration.
- Emitted `moduleName.js` and `moduleName.d.ts` ready for downstream imports.
- Updated import paths for consumers and removal of the obsolete `.mjs`/`.d.ts`.
- Tests: `npm run test:unit` (pre- and post-migration) and `pnpm test` (browser).

## Reference

- Existing migration guidance: `docs/development/jswasm-typescript-migration.md`.
- Repository commands: `package.json`, `tsconfig.migration.json`, `vitest.config.ts`.
- Keep in mind: readability → stability → robustness, the Three-Phase Processing Pattern, and numeric comments restrictions from `.clinerules/base_rules.md`.
