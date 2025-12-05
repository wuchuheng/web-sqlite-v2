# config-setup.ts migration test plan

## Scope

- Migrate `src/jswasm/vfs/opfs/installer/core/config-setup.mjs` to TypeScript without changing runtime behavior.
- Preserve the shape and defaults of the exported `prepareOpfsConfig` helper defined in `config-setup.d.ts`.

## Test types

- Unit tests with Vitest (Node environment) under `src/jswasm/vfs/opfs/installer/core/config-setup.unit.test.ts` before the migration folder move, then relocated beside the new TypeScript source per the workflow.

## Test scaffolding

- Stub `globalThis.location` with `vi.stubGlobal` to control `href` and search params for each scenario; restore with `vi.unstubAllGlobals` in `afterEach`.
- Reuse a small helper to build query strings (e.g., `buildUrl("?opfs-verbose=3")`) so tests stay focused on expectations.
- Use simple strings for `defaultProxyUri` and custom proxy URIs; for function-based `proxyUri`, return a deterministic string to assert resolution.

## Test cases

1. **Defaults with no params**: `prepareOpfsConfig(undefined, defaultProxy)` returns verbose `1`, sanityChecks `false`, proxyUri `defaultProxy`, disabled `false`.
2. **Non-object input**: `null` or primitive options are treated as empty config and normalized to the same defaults as case 1.
3. **Disable flag**: When the query string contains `opfs-disable`, the function returns `{ disabled: true }` and skips other defaults.
4. **Verbose from query**: `opfs-verbose` numeric values override the default; non-numeric values fall back to `2` because of the `+value || 2` logic; absent param keeps default `1`.
5. **Sanity check toggle**: Presence of `opfs-sanity-check` sets `sanityChecks` to `true` only when the caller did not supply a value.
6. **Proxy resolution**: Uses `options.proxyUri` when provided (string), calls it when it is a function, otherwise falls back to `defaultProxyUri`.
7. **Caller-supplied overrides**: When `options.verbose`, `sanityChecks`, or `proxyUri` are provided, they remain unchanged and the returned config forces `disabled: false`.

## Data sets

- Default proxy URI such as `"/opfs-proxy.js"` and an alternate `"./custom-proxy.js"`.
- Query strings for each flag: `?opfs-verbose=3`, `?opfs-verbose=not-a-number`, `?opfs-sanity-check`, `?opfs-disable`.
