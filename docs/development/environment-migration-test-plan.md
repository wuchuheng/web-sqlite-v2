# Environment Migration Test Plan

## Objective

Migrate `src/jswasm/vfs/opfs/async-proxy/environment.mjs` to TypeScript, preserving its behavior as a global utility script for the OPFS async proxy worker.

## Test Cases

### `wPost`

- **Goal:** Verify message posting to the main thread.
- **Scenario:** Call `wPost("type", "payload")`.
- **Expectation:** `postMessage` global function is called with `{ type: "type", payload: ["payload"] }`.

### `toss`

- **Goal:** Verify error throwing utility.
- **Scenario:** Call `toss("part1", "part2")`.
- **Expectation:** Throws an `Error` with message "part1 part2".

### `detectEnvironmentIssue`

- **Goal:** Verify environment capability checks.
- **Scenarios:**
    1.  **Missing SharedArrayBuffer:** Mock absence of `SharedArrayBuffer`. Expect error message in result.
    2.  **Missing Atomics:** Mock absence of `Atomics`. Expect error message in result.
    3.  **Missing OPFS:** Mock absence of `navigator.storage.getDirectory` or `FileSystemFileHandle`. Expect "Missing required OPFS APIs." in result.
    4.  **All Present:** Mock existence of all required APIs. Expect empty array.

### `getResolvedPath`

- **Goal:** Verify path normalization.
- **Scenarios:**
    1.  `getResolvedPath("/a/b/c")` -> `["a", "b", "c"]`
    2.  `getResolvedPath("/a//b/")` -> `["a", "b"]` (handles empty segments)
    3.  Non-string input -> Throws error (via `toss`).

### `detectLittleEndian`

- **Goal:** Verify endianness detection.
- **Scenario:** Call function.
- **Expectation:** Returns a boolean (true on most test environments).

## Test Scaffolding

- Use `vi.stubGlobal` to mock `postMessage`, `SharedArrayBuffer`, `Atomics`, `navigator`, and `FileSystem*` globals.
- Since the module executes as a script and attaches to `globalThis`, the test setup will need to load the script side-effectfully or rely on the fact that we've already converted it to an IIFE that assigns to globalThis. For the baseline test against `.mjs`, we might need to manually assign globals if the `.mjs` assumes it's in the global scope.
