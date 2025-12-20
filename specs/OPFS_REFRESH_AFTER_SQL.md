# Specification: OPFS Explorer Refresh On SQL Completion

## Overview

Keep the OPFS explorer's displayed SQLite filename and size in sync with the actual database file by refreshing its metadata immediately after each SQL execution completes.

## Event Flow

1. `SqlConsole.vue` emits a new `execution-complete` event when its `isProcessing` prop transitions from `true` to `false`, capturing both manual runs and the auto-demo loop.
2. `HomePage.vue` listens for `@execution-complete` and triggers an OPFS metadata refresh so the sibling `OpfsExplorer` reflects the latest file size right after execution finishes.
3. Optionally include a payload `{ mutated: boolean }` based on the last statement type so we can skip refresh for read-only `SELECT`s if desired; default behavior can refresh on every completion since the cost is minimal.

## Component Updates

- `SqlConsole.vue`: Extend `defineEmits` with `execution-complete`; add a watcher on `isProcessing` that emits once per execution cycle (ignoring the initial `false` on mount) to signal completion.
- `HomePage.vue`: Add a handler `handleExecutionComplete(context)` wired to the new event; set a `lastRunMutated` flag inside `runQuery` (true for non-`SELECT` statements) and call the OPFS refresher when the event fires, optionally skipping when `mutated` is false.
- `OpfsExplorer.vue`: Expose a `refresh` (or `reloadMeta`) method via `defineExpose` that reuses `loadMeta` to re-read the first `.sqlite3` file's metadata; keep download logic unchanged and optionally show a short "Refreshing..." status while in-flight to avoid overlapping reads.

## Edge Cases

- OPFS unavailable: the refresh no-ops and preserves the existing "OPFS not available" status message.
- No SQLite file yet: refresh restores the current empty-state messaging instead of throwing.
- Concurrent executes: debounce/serialize refresh calls so repeated completions do not interleave reads; the last completion wins.
- Auto-demo loop: event still fires per completion so the explorer stays accurate during scripted runs.

## Testing

- Run `INSERT`/`UPDATE`/`DELETE` in the console and confirm the OPFS explorer filename/size updates immediately after the spinner stops.
- Run a `SELECT` and confirm no errors; if skipping refresh on reads, verify the explorer remains unchanged.
- Simulate OPFS absence (or block access) to ensure the new wiring fails gracefully without breaking the page.
