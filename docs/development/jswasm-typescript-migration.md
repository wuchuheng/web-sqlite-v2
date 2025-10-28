# JSWASM TypeScript Migration Plan (Bottom‑Up, Insurance Method)

This document describes a safe, incremental, and test‑first process to migrate the JS/WASM bridge under `src/jswasm` from `.mjs` to TypeScript. The approach prioritizes correctness and stability by moving leaf utilities first (bottom‑up), validating with unit tests, then switching references and verifying end‑to‑end in the browser test harness.

Goals:
- Preserve runtime behavior while improving types, readability, and maintainability.
- Ensure every migration step is verifiable with unit tests and browser integration tests.
- Minimize integration risk by changing one module at a time and keeping the original file until tests pass.

Scope:
- Modules under `src/jswasm/**`, starting with low‑risk leaf utilities (e.g., `src/jswasm/utils/utf8.mjs`).
- No external API changes to the public package surface unless explicitly planned.

Principles:
- Bottom‑up: migrate leaf modules first; progress upward to dependents.
- Dual files during migration: keep the original `.mjs` and add a new `.ts` with identical exports.
- Test‑first: create unit tests covering current JS behavior before porting to TS.
- Verify twice: unit tests for the module + browser tests for integrated behavior.
- Remove originals only after both test layers pass and references are switched.

## Workflow Overview

1) Pick a leaf module
- Example: `src/jswasm/utils/utf8.mjs`.
- Confirm it has no or minimal internal dependencies.

2) Add unit tests for the current JS behavior
- Add a unit test file (Vitest recommended) that imports the existing `.mjs` and asserts behavior.
- Cover: happy paths, multibyte UTF‑8, surrogate pairs, boundaries (buffer limits, null terminator), and error cases.

3) Create a `.ts` migration file side‑by‑side
- Create `src/jswasm/utils/utf8.ts` with the same named exports and behavior.
- Add types for inputs/outputs; keep function shapes identical.
- Use in‑function numeric comments for the three‑phase pattern only when helpful.

4) Compile the TS file to JS in place
- Use `tsc` to emit `utf8.js` alongside `utf8.ts` in the same directory (in‑place emit).
- Do not remove the original `utf8.mjs` yet.

5) Point unit tests at the new implementation
- Update the unit test import to target the compiled `utf8.js` (or import `utf8.ts` directly via Vitest TS support).
- Ensure unit tests pass identically.

6) Switch internal references gradually
- Replace imports of `./utf8.mjs` with `./utf8.js` in dependents.
- Run browser tests (`pnpm test`) and verify all suites pass with 0 failures.

7) Remove originals (code + manual types)
- After unit + browser tests pass and references are updated, delete the original `.mjs`.
- If a manual `.d.ts` existed for this module, replace it with the newly emitted `.d.ts` from the TS build (see “Manual .d.ts Replacement Policy”).
- Run linting (`pnpm lint`) and browser tests again to confirm no regressions.

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
import { describe, it, expect } from 'vitest'
import { UTF8ArrayToString, stringToUTF8Array, lengthBytesUTF8, intArrayFromString } from '../utf8'

describe('utf8 utils', () => {
  it('round-trips ascii', () => {
    const s = 'Hello'
    const buf = new Uint8Array(lengthBytesUTF8(s) + 1)
    const n = stringToUTF8Array(s, buf, 0, buf.length)
    expect(UTF8ArrayToString(buf, 0, n)).toBe(s)
  })

  it('round-trips emoji', () => {
    const s = '😀'
    const buf = new Uint8Array(lengthBytesUTF8(s) + 1)
    const n = stringToUTF8Array(s, buf, 0, buf.length)
    expect(UTF8ArrayToString(buf, 0, n)).toBe(s)
  })
})
```

Notes:
- During migration you may import `../utf8.ts` directly in tests; once compiled output exists, prefer importing the compiled `../utf8.js` to validate the emitted code, matching runtime.

## TS Compile Strategy (In‑Place Emit)

- Create a dedicated `tsconfig.jswasm.json` to compile only files under `src/jswasm` and emit JS next to TS files.
- Recommended compiler options:
  - `"target": "ES2020"`, `"module": "ESNext"`, `"moduleResolution": "Bundler"`.
  - `"strict": true`, `"skipLibCheck": true`.
  - Omit `outDir` for in‑place emit (TS will generate `.js` next to `.ts`).
  - `"declaration": true` to emit `.d.ts` alongside, if useful for internal typing.
- Add scripts:
  - `"build:jswasm": "tsc -p tsconfig.jswasm.json"`
  - `"dev:jswasm": "tsc -p tsconfig.jswasm.json -w"`

Why in‑place emit?
- Keeps the migration controlled per‑file without shifting import roots.
- Allows side‑by‑side presence of `*.mjs` and new `*.js` until references are switched.

Caveats:
- ESM extensions: existing imports use `.mjs`. After migration, update imports to `.js` explicitly.
- Ensure emitted `.js` preserves `export` names and semantics 1:1 with the original `.mjs`.

## Manual .d.ts Replacement Policy

When a module has a hand‑written declaration file (e.g., `src/jswasm/utils/utf8.d.ts`), the migration should replace it with the compiler‑generated declaration from the new `utf8.ts`.

Steps:
- Ensure `"declaration": true` in the TS config used for jswasm migration.
- Compile the new TS module and let `tsc` emit `utf8.d.ts` in the same folder.
- If an original manual `.d.ts` exists, compare the public API surface (names and shapes) with the emitted `.d.ts`:
  - If equivalent: remove the manual `.d.ts` and keep the emitted one.
  - If there are public API gaps: update the TS source types/JSDoc to ensure the emitted `.d.ts` expresses the intended API, then recompile.
- Re‑run type checks and unit tests to catch any drift.

Notes:
- Prefer generated declarations; do not maintain parallel manual `.d.ts` once a module has been migrated.
- If needed for incremental parity, temporarily keep the manual `.d.ts` under a different name (e.g., `utf8.d.ts.bak`) and remove it before finalizing the PR.

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
  let total = 0

  // 2. Core processing – count code units and surrogate pairs
  for (let i = 0; i < str.length; ++i) {
    const c = str.charCodeAt(i)
    if (c <= 0x7f) total += 1
    else if (c <= 0x7ff) total += 2
    else if (c >= 0xd800 && c <= 0xdfff) { // surrogate pair
      total += 4
      ++i // 2.1 Skip low surrogate
    } else total += 3
  }

  // 3. Output
  return total
}
```

Example – multi‑phase function:
```ts
export function UTF8ArrayToString(bytes: Uint8Array, idx = 0, max = Number.NaN): string {
  // 1. Input – compute bounds
  const endIdx = idx + max
  let endPtr = idx
  while (bytes[endPtr] && !(endPtr >= endIdx)) ++endPtr

  // 2. Processing – fast path, then manual decode
  // 2.1 Use TextDecoder when available and long enough
  if (endPtr - idx > 16 && typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes.subarray(idx, endPtr))
  }
  // 2.2 Manual decode
  let out = ''
  while (idx < endPtr) {
    let b0 = bytes[idx++]
    if ((b0 & 0x80) === 0) { out += String.fromCharCode(b0); continue }
    const b1 = bytes[idx++] & 0x3f
    if ((b0 & 0xe0) === 0xc0) { out += String.fromCharCode(((b0 & 0x1f) << 6) | b1); continue }
    const b2 = bytes[idx++] & 0x3f
    if ((b0 & 0xf0) === 0xe0) {
      b0 = ((b0 & 0x0f) << 12) | (b1 << 6) | b2
    } else {
      b0 = ((b0 & 0x07) << 18) | (b1 << 12) | (b2 << 6) | (bytes[idx++] & 0x3f)
    }
    if (b0 < 0x10000) out += String.fromCharCode(b0)
    else {
      const cp = b0 - 0x10000
      out += String.fromCharCode(0xd800 | (cp >> 10), 0xdc00 | (cp & 0x3ff))
    }
  }

  // 3. Output
  return out
}
```

## Per‑Module Migration Checklist

- [ ] Identify leaf module and consumers.
- [ ] Create unit tests for the current `.mjs` behavior.
- [ ] Port to `.ts` with identical exports and types.
- [ ] Add numeric comments inside function/method bodies following the Three‑Phase pattern (1. Input, 2. Processing, 3. Output).
- [ ] Add JSDoc for all exported symbols (functions, classes, types, variables) per docs/development/jsdoc-standards.md.
- [ ] Compile to `.js` next to the `.ts` (in‑place emit).
- [ ] Point unit tests at TS or compiled JS and pass.
- [ ] Update internal imports from `.mjs` to `.js` for this module.
- [ ] Run browser tests: 0 failures.
- [ ] Remove original `.mjs` file.
- [ ] Replace/remove manual `.d.ts` with the emitted `.d.ts` from the TS build.
- [ ] Lint, type‑check, and re‑run browser tests.

## Commands (Suggested)

- Unit tests: `pnpm test:unit` (Vitest) / `pnpm dev:unit` for watch mode.
- JSWASM TS compile: `pnpm build:jswasm` / `pnpm dev:jswasm`.
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
