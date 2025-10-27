Title: sqliteWorker.ts Implementation Plan

Goals

- Provide a minimal, readable Worker-side RPC that complements src/index.ts.
- Support opening a SQLite database, running queries, and closing it.
- Initialize the bundled WASM module in the Worker and prefer OPFS when available.

Scope

- Worker-only implementation in src/sqliteWorker.ts.
- Actions implemented: Open, Sql, Close.
- Single database instance per Worker (simple, stable baseline).
- Response contract: ResponseMessage<T> with success flag and action echo.

Message Protocol

- Request
  - shape: { action: 0|1|2 | 'open'|'sql'|'close', messageId: number, payload: any }
  - Actions
    - Open: payload = string (db name). Returns DB metadata.
    - Sql: payload = string (SQL). Returns rows in object rowMode.
    - Close: payload = { unlink?: boolean }. Returns filename info.

- Response
  - shape: {
      action: same-as-request,
      messageId: same,
      success: boolean,
      payload: any,
      error?: string,
      errorStack?: string
    }

Behavior Details

- Initialization
  - Lazily load sqlite3 via src/jswasm/sqlite3.mjs on first Open.
  - Default bootstrappers install OPFS and Worker APIs; our messages are distinct
    (they don’t use { type: 'sqlite3' }), so no handler conflicts.

- Open
  - Prefer sqlite3.oo1.OpfsDb if available; fallback to sqlite3.oo1.DB.
  - Compute a stable dbId using pointer and a local sequence for replies.
  - Return { id, filename, vfs } in payload.

- Sql
  - Execute with rowMode: 'object' and returnValue: 'resultRows'.
  - payload: { rows: Array<Record<string, unknown>> }.

- Close
  - Close active DB; if payload.unlink is true and VFS supports it, best-effort unlink
    is left to default wrappers (not implemented explicitly in this pass).
  - payload: { filename?: string }.

Error Handling

- Wrap every action in try/catch and return { success: false, error, errorStack }.
- Validate required payload fields and return clear errors.

Limitations (intentional for v1)

- Single-DB per Worker; no multiplexing.
- No transactions/prepare API exposed (can be added later atop Sql).
- No streaming rows; results are materialized in memory.

Notes / Observations

- src/index.ts currently imports non-runtime enums from a .d.ts file
  (./sqliteWorkder). That enum does not exist at runtime. I will not change
  index.ts here, but the Worker is implemented to accept both numeric and
  string action values to ease future alignment.

Validation

- After implementing, run lint and build locally. The Worker code is self-contained
  and does not require network access.

