# Path Utilities Migration Test Plan

## Objective
Document the Vitest cases needed to demonstrate parity between the existing `path.mjs` behavior and the upcoming TypeScript implementation in `src/jswasm/utils/path`.

## Test Cases

1. **Core normalization**
   - Inputs: `"/foo/../bar//baz/"`, `"foo/././bar"`, `"./../"`, `""`, `"/"`; expect outputs consistent with POSIX handling (mirror `PATH.normalize` results).
   - Verifies `normalize`, `normalizeArray`, and trailing slash preservation.

2. **dirname/basename expectations**
   - Inputs: `"/foo/bar/baz.txt"`, `"/foo/"`, `"foo"`, `"/"`.
   - Expect directory/backbone splitting matching helper regex and handling of root-only paths.

3. **join/join2 semantics**
   - Inputs: varying segment counts for `join`, including leading/trailing slashes and empty strings; `join2` simple pair.
   - Expect normalized concatenation using `/`.

4. **resolve/relative with FS mock**
   - FS stub exposing `cwd()` returning `"/foo/bar"`.
   - Resolve scenarios: `PATH_FS.resolve("baz", "..", "qux")`, `createPathFS(mockFS).resolve("..", "baz")`.
   - Relative scenarios: from `"/foo/bar/baz"` to `"/foo/qux"` yields `"../qux"`.
   - Ensures rejection of non-string inputs and preservation of `FS` fallback.

## Fixtures / Helpers

- Create a `mockFS` object implementing `cwd(): string`.
- Reuse the existing `PATH` object exported from `path.mjs` to seed expectations for normalization before the migration completes.
- Tests will import directly from the `.mjs` source (as required by Step 2) until the TypeScript output is available.

## Execution Notes

- Run `pnpm test:unit` (alias under `npm` in instructions) after introducing or updating tests to ensure baseline passes.
- Capture outputs verifying each path helper; no manual UI steps required for this unit-level plan.
