/**
 * Type definitions for vfs-integration module
 * @module wrappers/vfs-integration
 */

import type {
  SQLite3Module,
  SQLite3VFSInstance,
  OpfsUtilInterface,
  SQLite3DBInstance,
  SQLite3DBClass,
  OpfsOpIds,
} from "../../../../../shared/opfs-vfs-installer";

/**
 * WebAssembly interface
 */
interface WasmModule {
  heap8u: () => Uint8Array;
  allocCString: (str: string) => number;
}

/**
 * Dependencies for setupOptionalVfsMethods
 */


export interface OptionalVfsMethodsDeps {
  opfsVfs: SQLite3VFSInstance;
  dVfs: SQLite3VFSInstance | null;
  wasm: WasmModule;
  state: { sabOPView?: Int32Array; opIds: OpfsOpIds };
}

/**
 * Dependencies for integrateWithOo1
 */
export interface Oo1IntegrationDeps {
  sqlite3: SQLite3Module;
  opfsVfs: SQLite3VFSInstance;
  opfsUtil: OpfsUtilInterface;
}

/**
 * Sets up optional VFS methods (randomness and sleep).
 * @param deps - Dependencies object
 * @returns Additional VFS methods
 */
export function setupOptionalVfsMethods(
  deps: OptionalVfsMethodsDeps,
): Record<string, (...args: number[]) => number> {
  const { opfsVfs, dVfs, wasm, state } = deps;
  const methods: Record<string, (...args: number[]) => number> =
    Object.create(null);

  // 1. Input handling
  // 1.1 Check if default VFS provides xRandomness
  if (dVfs) {
    opfsVfs.$xRandomness = dVfs.$xRandomness;
    opfsVfs.$xSleep = dVfs.$xSleep;
  }

  // 2. Core processing
  // 2.1 Provide fallback xRandomness if needed
  if (!opfsVfs.$xRandomness) {
    methods.xRandomness = function (_pVfs: number, nOut: number, pOut: number) {
      const heap = wasm.heap8u();
      let i = 0;
      for (; i < nOut; ++i) heap[pOut + i] = (Math.random() * 255000) & 0xff;
      return i;
    };
  }

  // 2.2 Provide fallback xSleep if needed
  if (!opfsVfs.$xSleep) {
    methods.xSleep = function (_pVfs: number, ms: number) {
      Atomics.wait(state.sabOPView!, state.opIds.xSleep, 0, ms);
      return 0;
    };
  }

  // 3. Output handling
  return methods;
}

/**
 * Integrates OPFS VFS with OO1 API if available.
 * @param deps - Dependencies object
 */
export function integrateWithOo1(deps: Oo1IntegrationDeps): void {
  const { sqlite3, opfsVfs, opfsUtil } = deps;

  // 1. Input handling
  if (!sqlite3.oo1) {
    return;
  }

  // 2. Core processing
  // 2.1 Create OpfsDb class
  const OpfsDb = function (this: SQLite3DBInstance, ...args: unknown[]) {
    if (!sqlite3.oo1) return;
    const opt = sqlite3.oo1.DB.dbCtorHelper.normalizeArgs(...args);
    opt.vfs = sqlite3.wasm.cstrToJs(opfsVfs.$zName);
    sqlite3.oo1.DB.dbCtorHelper.call(this, opt);
  } as unknown as SQLite3DBClass & {
    importDb: typeof opfsUtil.importDb;
  };

  if (!sqlite3.oo1) return;
  OpfsDb.prototype = Object.create(sqlite3.oo1.DB.prototype);

  // 2.2 Register OpfsDb and utility methods
  sqlite3.oo1.OpfsDb = OpfsDb;
  OpfsDb.importDb = opfsUtil.importDb;

  // 2.3 Set post-open callback for busy timeout
  sqlite3.oo1.DB.dbCtorHelper.setVfsPostOpenCallback(
    opfsVfs.pointer,
    function (oo1Db: number, sqlite3Ref: SQLite3Module) {
      sqlite3Ref.capi.sqlite3_busy_timeout(oo1Db, 10000);
    },
  );
}
