# SerializationBuffer Migration – Test Plan

This plan covers baseline and post-migration unit tests for `src/jswasm/vfs/opfs/async-proxy/serialization-buffer.mjs`.

## Scope

- Validate serialization and deserialization across supported types: `number`, `bigint`, `boolean`, `string`.
- Validate header encoding (argc and type ids) and clear behavior.
- Validate `storeException` respects `exceptionVerbosity` and stringifies errors consistently.

## Test Cases

- Serialize/deserialize a single `number` value.
- Serialize/deserialize a single `bigint` value.
- Serialize/deserialize a single `boolean` value (baseline implementation uses `Int32`; deserialized value is numeric `0|1`).
- Serialize/deserialize a single `string` value.
- Mixed payload of all four kinds and order preservation.
- Empty payload handling (writes `0` to header and returns `[]`).
- `storeException`:
    - When `priority` ≤ `exceptionVerbosity`, stores `${name}: ${message}`.
    - When `priority` > `exceptionVerbosity` or `exceptionVerbosity` ≤ 0, stores nothing.
    - Non-object payloads are stringified.

## Scaffolding

- Tests import the baseline `.mjs` for side effects and access `globalThis.SerializationBuffer`.
- Use a `SharedArrayBuffer` sized sufficiently (e.g., 1024 bytes) and `DataView` semantics with `littleEndian: true`.
- Avoid unsupported types to prevent `toss()` calls in baseline.

## Post-migration

- Move the test alongside the new TS source in `serialization-buffer/` and update imports to extension-less `./serialization-buffer`.
- Ensure behavior parity with baseline.
