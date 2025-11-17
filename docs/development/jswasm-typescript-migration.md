# JSWASM TypeScript Migration Plan (Bottom‑Up, Insurance Method)

This document describes a safe, incremental, and test‑first process to migrate the JS/WASM bridge under `src/jswasm` from `.mjs` to TypeScript. The approach prioritizes correctness and stability by moving leaf utilities first (bottom‑up), validating with unit tests, then switching references and verifying end‑to‑end in the browser test harness.

Goals:

- Preserve runtime behavior while improving types, readability, and maintainability.
- Ensure every migration step is verifiable with unit tests and browser integration tests.
- Minimize integration risk by changing one module at a time and keeping the original file until tests pass.

Scope:

- Modules under `src/jswasm/**`, starting with low‑risk leaf utilities (e.g., `src/jswasm/utils/utf8.mjs`).
- No external API changes to the public package surface unless explicitly planned.
- Target environment: browser‑only. Node.js execution is out of scope.

Principles:

- Bottom‑up: migrate leaf modules first; progress upward to dependents.
- Dual files during migration: keep the original `.mjs` and add a new `.ts` with identical exports.
- Test‑first: create unit tests covering current JS behavior before porting to TS.
- Verify twice: unit tests for the module + browser tests for integrated behavior.
- Remove originals only after both test layers pass and references are switched.

## Primary Safety Workflow (Mandatory)

The migration must be conservative and test‑driven. Follow these exact steps for every module:

1. Baseline tests for the original file

- Write unit tests targeting the ORIGINAL `.mjs` (no changes to code yet).
- Run tests and ensure GREEN baseline. If tests fail, fix tests first or adjust scope.

2. Create the migration file (TypeScript)

- Add a `.ts` file with identical exports and behavior, in a dedicated subdirectory if applicable (e.g., `utils/utf8/utf8.ts`).
- Add types and JSDoc; avoid `any`. If inference is not feasible for a case, leave the smallest possible `any` and document it for later.

3. Test the migration file

- Point the unit tests at the MIGRATION implementation (prefer the emitted `.js` from the `.ts`, not the `.ts` directly), and re‑run tests until GREEN.

4. Compile and replace

- Use `tsconfig.migration.json` to COMPILE ONLY the module under migration, emitting `.js` (and optionally `.d.ts`) next to the `.ts`.
- After tests pass against the emitted `.js`, update internal imports from `.mjs` to `.js` for this module, and remove the old `.mjs`.

5. Verify integration

- Run the browser tests (`pnpm test`) to ensure 0 failures and no console errors.
- Keep changes scoped; do not refactor other modules in the same PR unless explicitly requested.

This process ensures a safe, step‑by‑step refactoring: tests first, migrate, test again, then compile and replace.

## Workflow Summary

The Primary Safety Workflow above is the single source of truth. Use it step‑by‑step for every module; avoid parallel checklists to reduce drift. The example below illustrates the same flow applied to `utils/utf8.mjs`.

## Example: Migrating `utils/utf8.mjs`

Targets to preserve:

- `UTF8ArrayToString(heapOrArray, idx?, maxBytesToRead?) => string`
- `lengthBytesUTF8(str: string) => number`
- `stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) => number`
- `intArrayFromString(stringy, dontAddNull?, length?) => Array<number>`

Suggested unit test coverage:

- ASCII round‑trip: `"Hello" → bytes → string`.
- Multibyte: `"你好", "Привет", emoji (e.g., "😀")`.
- Surrogate pairs and astral plane characters.
- Byte length calculations for the above.
- `stringToUTF8Array` respecting `maxBytesToWrite` and null terminator.
- `intArrayFromString` with and without `dontAddNull`.
- Decoder fallback when `TextDecoder` is unavailable (can be simulated/mocked).

Reference switch:

- Change `import { ... } from './utf8.mjs'` to `./utf8.js` only after unit tests for `utf8.ts` pass.
- Re‑run the browser tests.

Rollback plan:

- If browser tests fail, revert import changes back to `.mjs`, fix the TS impl, and rerun unit tests. Keep `.mjs` as the source of truth until parity is restored.

## Unit Test Setup (Recommended)

Use Vitest for fast, typed unit tests at the repo root:

- Install dev deps: `pnpm add -D vitest @vitest/ui tsx`.
- Add script: `"test:unit": "vitest --run"`, `"dev:unit": "vitest"`.
- Vitest config (example):
    - `test.environment = "node"` for pure utils.
    - `esbuild.tsconfigRaw.compilerOptions.module = "esnext"` for ESM.
- Place tests under `src/jswasm/**/__tests__/*.test.ts` or `src/jswasm/**/*.test.ts`.

Example test skeleton (utf8):

```ts
import { describe, it, expect } from "vitest";
import {
    UTF8ArrayToString,
    stringToUTF8Array,
    lengthBytesUTF8,
    intArrayFromString,
} from "../utf8";

describe("utf8 utils", () => {
    it("round-trips ascii", () => {
        const s = "Hello";
        const buf = new Uint8Array(lengthBytesUTF8(s) + 1);
        const n = stringToUTF8Array(s, buf, 0, buf.length);
        expect(UTF8ArrayToString(buf, 0, n)).toBe(s);
    });

    it("round-trips emoji", () => {
        const s = "😀";
        const buf = new Uint8Array(lengthBytesUTF8(s) + 1);
        const n = stringToUTF8Array(s, buf, 0, buf.length);
        expect(UTF8ArrayToString(buf, 0, n)).toBe(s);
    });
});
```

Notes:

- During migration you may import `../utf8.ts` directly in tests; once compiled output exists, prefer importing the compiled `../utf8.js` to validate the emitted code, matching runtime.

## TS Compile Strategy (In‑Place Emit)

- Create a dedicated `tsconfig.migration.json` to compile only the files being migrated and emit JS next to TS files (in‑place emit).
- Recommended compiler options:
    - `"target": "ES2022"`, `"module": "ESNext"`, `"moduleResolution": "Bundler"`.
    - `"strict": true`, `"skipLibCheck": true`.
    - Omit `outDir` for in‑place emit (TS will generate `.js` next to `.ts`).
    - Set `"declaration": false` by default. Enable `true` temporarily only when replacing a manual `.d.ts` for the module under migration.
- Add scripts:
    - `"build:migration": "tsc -p tsconfig.migration.json"`
    - `"build:migration:watch": "tsc --watch -p tsconfig.migration.json"`
    - Optional type‑only watchers:
        - `"typecheck:watch": "tsc --watch -p tsconfig.json"`
        - `"typecheck:migration:watch": "tsc --watch -p tsconfig.migration.json"`

Why in‑place emit?

- Keeps the migration controlled per‑file without shifting import roots.
- Allows side‑by‑side presence of `*.mjs` and new `*.js` until references are switched.

Caveats:

- ESM extensions: existing imports use `.mjs`. After migration, update imports to `.js` explicitly. This project standardizes on `.ts` sources and emitted `.js` runtime for browser delivery.
- Ensure emitted `.js` preserves `export` names and semantics 1:1 with the original `.mjs`.

Import extensions policy (ESM, explicit .js):

- Use explicit `.js` extensions in all ESM imports after migration.
- Example: change `import { x } from "./utf8.mjs"` to `import { x } from "./utf8.js"` once the module is migrated.

Example – safe union narrowing for DB.exec():

```ts
import type { ExecResult } from "../../src/jswasm/sqlite3";

const r = db.exec(sql, { rowMode: "object", returnValue: "resultRows" });
const rows =
    ("resultRows" in (r as ExecResult) && (r as ExecResult).resultRows) || [];
// Or:
// const rows = (r as ExecResult).resultRows ?? [];
```

## Manual .d.ts Replacement Policy

When a module has a hand‑written declaration file (e.g., `src/jswasm/utils/utf8.d.ts`), the migration should replace it with the compiler‑generated declaration from the new `utf8.ts`.

Steps (on‑demand declarations):

- Temporarily set `"declaration": true` in the migration TS config only when you intend to replace a manual `.d.ts`.
- Compile the new TS module and let `tsc` emit `utf8.d.ts` in the same folder.
- If an original manual `.d.ts` exists, compare the public API surface (names and shapes) with the emitted `.d.ts`:
    - If equivalent: remove the manual `.d.ts` and keep the emitted one.
    - If there are public API gaps: update the TS source types/JSDoc to ensure the emitted `.d.ts` expresses the intended API, then recompile.
- Re‑run type checks and unit tests to catch any drift.

Notes:

- Prefer generated declarations; do not maintain parallel manual `.d.ts` once a module has been migrated.
- If needed for incremental parity, temporarily keep the manual `.d.ts` under a different name (e.g., `utf8.d.ts.bak`) and remove it before finalizing the PR.

## Type Conformance Gate (Required)

- Before switching imports from `.mjs` → emitted `.js` or removing the original `.mjs`, the project must pass strict type checks.
- Commands:
    - Typecheck all: `pnpm exec tsc -p tsconfig.json --noEmit`
    - Module-scoped compile: `pnpm run build:migration`
- Policy:
    - Prefer precise types from existing local `.d.ts` files under `src/jswasm/**`.
    - When the runtime returns a union (e.g., `this | ExecResult`), narrow locally using an `in` check or an explicit type annotation.
    - Keep JSDoc at declaration sites and numeric comments inside function bodies to document assumptions used for narrowing.
    - Scope changes to the migrating module only; do not refactor unrelated code to appease types.

Example – narrowing DB.exec() return:

```ts
import type { ExecResult } from "../../src/jswasm/sqlite3";

const r = db.exec(sql, { returnValue: "resultRows", rowMode: "object" });
const rows =
    "resultRows" in (r as ExecResult)
        ? ((r as ExecResult).resultRows ?? [])
        : [];
```

## External Type Sources (Upstream Fallback)

When local information is insufficient to define precise types, derive them from the upstream SQLite source:

- Upstream repository (secondary source of truth): `sqlite/sqlite`
    - C API: `sqlite3.h`
    - WASM glue and JS bridge: `ext/wasm/**`
- Procedure:
    - Identify the missing or ambiguous type in local code.
    - Cross-check the corresponding symbol in upstream (C declaration and/or wasm glue).
    - Update the minimal local `.d.ts` to reflect the upstream signature and semantics.
    - Record the upstream commit hash used for derivation in the PR description or code comment.
- Networked environments:
    - If local tooling cannot access upstream due to network restrictions, request approval to fetch the necessary upstream files.
- Scope:
    - Keep changes minimal and localized; do not wholesale copy upstream typings.

## Browser Integration Tests (End‑to‑End)

- Continue to use the existing browser tests under `tests/`.
- After switching references for a module, run `pnpm test` at the repo root.
- Assert test UI shows 0 failures; check console for WASM/OPFS errors.
- If introducing behavior changes, update or add suites under `tests/src/suites/` with clear names and source code display support.

Optional automation:

- Add Playwright to assert the test runner DOM: failed=0, passed>0.
- Useful for CI gating after each migration PR.

## Code Conventions

- Follow `eslint.config.mts` and repository naming conventions.
- Keep functions small; extract complex or repeated logic.
- Numeric comments are required for migrated code: use the Three‑Phase Processing Pattern and numeric comments inside function/method bodies to document Input (1.), Processing (2.), and Output (3.). Keep them concise and meaningful.
- Respect 120‑char line length; prefer readability over cleverness.
- JSDoc is required for all exported functions, classes, types, and variables. See docs/development/jsdoc-standards.md for required tags and examples.

### Numeric Comments (Required)

Rules:

- Place numeric comments only inside function or method bodies.
- Use `// 1.` for input validation/prep, `// 2.` for core processing, and `// 3.` for output/return.
- Use sub‑steps like `// 2.1`, `// 2.2` when it clarifies non‑trivial logic.
- Do not place numeric comments at file scope or on property declarations.

Example – small function:

```ts
export function lengthBytesUTF8(str: string): number {
    // 1. Input handling
    let total = 0;

    // 2. Core processing – count code units and surrogate pairs
    for (let i = 0; i < str.length; ++i) {
        const c = str.charCodeAt(i);
        if (c <= 0x7f) total += 1;
        else if (c <= 0x7ff) total += 2;
        else if (c >= 0xd800 && c <= 0xdfff) {
            // surrogate pair
            total += 4;
            ++i; // 2.1 Skip low surrogate
        } else total += 3;
    }

    // 3. Output
    return total;
}
```

Example – multi‑phase function (Uint8Array shown for brevity; if the API also accepts `number[]`, keep the manual path and guard `subarray` usage):

```ts
export function UTF8ArrayToString(
    bytes: Uint8Array,
    idx = 0,
    max = Number.NaN,
): string {
    // 1. Input – compute bounds
    const endIdx = idx + max;
    let endPtr = idx;
    while (bytes[endPtr] && !(endPtr >= endIdx)) ++endPtr;

    // 2. Processing – fast path, then manual decode
    // 2.1 Use TextDecoder when available and long enough
    if (endPtr - idx > 16 && typeof TextDecoder !== "undefined") {
        return new TextDecoder().decode(bytes.subarray(idx, endPtr));
    }
    // 2.2 Manual decode
    let out = "";
    while (idx < endPtr) {
        let b0 = bytes[idx++];
        if ((b0 & 0x80) === 0) {
            out += String.fromCharCode(b0);
            continue;
        }
        const b1 = bytes[idx++] & 0x3f;
        if ((b0 & 0xe0) === 0xc0) {
            out += String.fromCharCode(((b0 & 0x1f) << 6) | b1);
            continue;
        }
        const b2 = bytes[idx++] & 0x3f;
        if ((b0 & 0xf0) === 0xe0) {
            b0 = ((b0 & 0x0f) << 12) | (b1 << 6) | b2;
        } else {
            b0 =
                ((b0 & 0x07) << 18) |
                (b1 << 12) |
                (b2 << 6) |
                (bytes[idx++] & 0x3f);
        }
        if (b0 < 0x10000) out += String.fromCharCode(b0);
        else {
            const cp = b0 - 0x10000;
            out += String.fromCharCode(
                0xd800 | (cp >> 10),
                0xdc00 | (cp & 0x3ff),
            );
        }
    }

    // 3. Output
    return out;
}
```

## Applied Pattern (UTF‑8 Example)

This section documents the concrete rules applied while migrating `src/jswasm/utils/utf8` as a worked example. Apply this exact pattern to all subsequent modules — the utf8 module is illustrative, not special.

- Directory shape for migrated module (optional)
    - Prefer matching the current flat layout to minimize churn:
        - `src/jswasm/utils/utf8.ts` (source)
        - `src/jswasm/utils/utf8.js` (emitted runtime)
        - `src/jswasm/utils/utf8.test.ts` (unit tests)
    - If you choose a subfolder per module, keep naming consistent.
    - Keep the original `src/jswasm/utils/utf8.mjs` until parity is proven; only then switch imports and remove it.

- Avoid `any` (typed read/write helpers)
    - When interoperating with `Uint8Array | number[]`, avoid `any` by using narrow helpers:

```ts
export type UTF8ByteArray = Uint8Array | number[];

const readAt = (a: UTF8ByteArray, i: number): number =>
    a instanceof Uint8Array ? a[i] : a[i];

const writeAt = (a: UTF8ByteArray, i: number, v: number): void => {
    if (a instanceof Uint8Array) a[i] = v;
    else a[i] = v;
};
```

Note: For compile configuration and scripts, see TS Compile Strategy and Commands sections.

- Import switching policy (.mjs → .js)
    - Unit tests should import the emitted `.js` (e.g., `./utf8.js`) to validate the runtime output.
    - Only after tests and browser validation pass should internal imports move from `*.mjs` to `*.js`.
    - If avoiding broad import churn, optionally add a temporary compatibility re‑export:

```js
// src/jswasm/utils/utf8.mjs (optional, temporary)
export * from "./utf8/utf8.js";
```

## Per‑Module Migration Checklist

- [ ] Pick a leaf module and list its consumers.
- [ ] Follow the Primary Safety Workflow steps 1–5 for this module (see “Primary Safety Workflow (Mandatory)” above).
- [ ] Compile using `tsconfig.migration.json` per “TS Compile Strategy (In‑Place Emit)”.
- [ ] Add JSDoc for exports and numeric comments inside functions per base rules.
- [ ] Switch imports to the emitted `.js` only after unit + browser tests pass; then remove the original `.mjs`.
- [ ] Replace any manual `.d.ts` with the emitted declaration; run lint and tests.

## Commands (Suggested)

- Unit tests: `pnpm run test:unit` (Vitest) / `pnpm run test:unit:watch` for watch mode.
- Migration compile: `pnpm run build:migration` / `pnpm run build:migration:watch`.
- Browser tests: `pnpm test` (opens `tests/` runner with COOP/COEP headers).
- Lint: `pnpm lint`.

## FAQ

Q: Why not convert everything at once?

- Incremental migration reduces risk, isolates regressions, and keeps the mainline usable.

Q: Why compile into the same directory?

- It simplifies reference switching and avoids broad path changes. We only alter imports for the migrated module.

Q: What about `.mjs` vs `.js`?

- Keep `.mjs` during transition. After the TS module’s `*.js` is validated, update imports from `*.mjs` → `*.js`. Then remove the `.mjs` file.

Q: How do we ensure TS behavior matches?

- Start with unit tests against the original `.mjs` behavior, then re‑run them against the TS/compiled JS. The browser test suite provides end‑to‑end validation.

---

Compliance notes:

- This plan follows the repo’s AI agent base rules: readability first, small functions, numeric comments only inside functions where helpful, and 120‑char line guidance.
- If a conflict arises between this document and direct instructions in a task/PR, follow the precedence: direct instructions > AGENTS.md > base rules.
