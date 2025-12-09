# Migration Spec: vfs-integration

**Target Module**: `src/jswasm/vfs/opfs/installer/wrappers/vfs-integration.mjs`
**Target Declaration**: `src/jswasm/vfs/opfs/installer/wrappers/vfs-integration.d.ts`

## 1. Analysis

The module `vfs-integration.mjs` exports two functions:

1. `setupOptionalVfsMethods(deps)`: Sets up `xRandomness` and `xSleep` for the OPFS VFS. It falls back to default VFS methods if available, or provides implementations using `Math.random` and `Atomics.wait`.
2. `integrateWithOo1(deps)`: Integrates OPFS VFS with the SQLite OO1 (Object-Oriented 1) API. It creates a `OpfsDb` class inheriting from `sqlite3.oo1.DB`, registers it, and sets up a busy timeout callback.

**Dependencies**:

- `setupOptionalVfsMethods`: `opfsVfs`, `dVfs`, `wasm`, `state`.
- `integrateWithOo1`: `sqlite3`, `opfsVfs`, `opfsUtil`.

**Consumers**:

- `src/jswasm/vfs/opfs/installer/index.mjs` imports both functions.

## 2. Test Plan

We need to verify:

1. `setupOptionalVfsMethods` correctly assigns `xRandomness` and `xSleep`.
    - Case 1: `dVfs` is provided (use dVfs methods).
    - Case 2: `dVfs` is NOT provided (use fallback methods).
    - Case 3: Verify fallback `xRandomness` behavior (writes to heap).
    - Case 4: Verify fallback `xSleep` behavior (calls `Atomics.wait`).
2. `integrateWithOo1` correctly registers `OpfsDb`.
    - Case 1: `sqlite3.oo1` is present.
    - Case 2: `sqlite3.oo1` is missing (should do nothing).
    - Case 3: `OpfsDb` is created with correct prototype.
    - Case 4: `OpfsDb` constructor normalizes args and sets vfs name.
    - Case 5: Post-open callback is set.

**Test File**: `src/jswasm/vfs/opfs/installer/wrappers/vfs-integration.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    setupOptionalVfsMethods,
    integrateWithOo1,
} from "./vfs-integration.mjs";

describe("vfs-integration", () => {
    describe("setupOptionalVfsMethods", () => {
        let deps;
        let heap;

        beforeEach(() => {
            heap = new Uint8Array(1000);
            deps = {
                opfsVfs: {},
                dVfs: null,
                wasm: {
                    heap8u: () => heap,
                },
                state: {
                    sabOPView: new Int32Array(new SharedArrayBuffer(1024)),
                    opIds: { xSleep: 1 },
                },
            };
        });

        it("should use default VFS methods if available", () => {
            deps.dVfs = {
                $xRandomness: vi.fn(),
                $xSleep: vi.fn(),
            };

            const methods = setupOptionalVfsMethods(deps);

            expect(deps.opfsVfs.$xRandomness).toBe(deps.dVfs.$xRandomness);
            expect(deps.opfsVfs.$xSleep).toBe(deps.dVfs.$xSleep);
        });

        it("should provide fallback xRandomness if default VFS not available", () => {
            const methods = setupOptionalVfsMethods(deps);
            expect(methods.xRandomness).toBeDefined();

            const pOut = 100;
            const nOut = 10;
            const result = methods.xRandomness(null, nOut, pOut);

            expect(result).toBe(nOut);
            // Check if data was written
            let hasData = false;
            for (let i = 0; i < nOut; i++) {
                if (heap[pOut + i] !== 0) hasData = true;
            }
            // Note: Randomness *could* produce all zeros but unlikely.
            // For deterministic test we might mock Math.random but this is a unit test.
        });

        it("should provide fallback xSleep if default VFS not available", () => {
            const methods = setupOptionalVfsMethods(deps);
            expect(methods.xSleep).toBeDefined();

            // We can't easily test Atomics.wait in this env without blocking,
            // but we can check it returns 0.
            // Mocking Atomics.wait might be needed if not supported in test env.
            const originalWait = Atomics.wait;
            const waitMock = vi.fn();
            globalThis.Atomics.wait = waitMock;

            try {
                methods.xSleep(null, 100);
                expect(waitMock).toHaveBeenCalledWith(
                    deps.state.sabOPView,
                    deps.state.opIds.xSleep,
                    0,
                    100,
                );
            } finally {
                globalThis.Atomics.wait = originalWait;
            }
        });
    });

    describe("integrateWithOo1", () => {
        let deps;
        let dbCtorHelper;

        beforeEach(() => {
            dbCtorHelper = {
                normalizeArgs: vi.fn().mockReturnValue({}),
                call: vi.fn(),
                setVfsPostOpenCallback: vi.fn(),
            };

            deps = {
                sqlite3: {
                    oo1: {
                        DB: {
                            prototype: {},
                            dbCtorHelper,
                        },
                    },
                    capi: {
                        sqlite3_busy_timeout: vi.fn(),
                    },
                },
                opfsVfs: {
                    $zName: "opfs",
                    pointer: 12345,
                },
                opfsUtil: {
                    importDb: vi.fn(),
                },
            };
        });

        it("should do nothing if sqlite3.oo1 is missing", () => {
            deps.sqlite3.oo1 = undefined;
            integrateWithOo1(deps);
            // No errors should occur
        });

        it("should register OpfsDb", () => {
            integrateWithOo1(deps);

            expect(deps.sqlite3.oo1.OpfsDb).toBeDefined();
            expect(deps.sqlite3.oo1.OpfsDb.importDb).toBe(
                deps.opfsUtil.importDb,
            );
        });

        it("should set up OpfsDb constructor", () => {
            integrateWithOo1(deps);
            const OpfsDb = deps.sqlite3.oo1.OpfsDb;

            const instance = new OpfsDb("test.db");

            expect(dbCtorHelper.normalizeArgs).toHaveBeenCalled();
            expect(dbCtorHelper.call).toHaveBeenCalled();
        });

        it("should set vfs post open callback", () => {
            integrateWithOo1(deps);
            expect(dbCtorHelper.setVfsPostOpenCallback).toHaveBeenCalledWith(
                deps.opfsVfs.pointer,
                expect.any(Function),
            );

            // Test the callback
            const callback =
                dbCtorHelper.setVfsPostOpenCallback.mock.calls[0][1];
            const oo1Db = {};
            const sqlite3Ref = deps.sqlite3;

            callback(oo1Db, sqlite3Ref);
            expect(deps.sqlite3.capi.sqlite3_busy_timeout).toHaveBeenCalledWith(
                oo1Db,
                10000,
            );
        });
    });
});
```

## 3. Migration Steps

1. **Create Test Harness**: Create `src/jswasm/vfs/opfs/installer/wrappers/vfs-integration.test.ts` testing the current `.mjs` file.
2. **Run Tests**: Ensure tests pass for `.mjs`.
3. **Create TS File**: Create `src/jswasm/vfs/opfs/installer/wrappers/vfs-integration.ts` (initially a copy or simple port).
4. **Update Tests**: Point tests to `.ts` file.
5. **Implement TS**: Fully type the `.ts` file using `vfs-integration.d.ts` as a guide.
6. **Compile**: Verify `tsc` output.
7. **Lint**: Run linter.
8. **Replace**: Update consumers to import from the new build location (if necessary) or simply rely on the fact that we will replace the artifacts.
    - Note: Since we are in `wrappers`, we will eventually delete `.mjs` and compile `.ts` to `.js` (or `.mjs` if configured) in place or dist. For this migration, we are moving to `.ts` source.

## 4. Approval

Please review the Test Plan above.
