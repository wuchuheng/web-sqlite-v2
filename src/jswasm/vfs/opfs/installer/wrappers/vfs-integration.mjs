/**
 * Sets up optional VFS methods (randomness and sleep).
 * @param {object} deps - Dependencies object
 * @returns {object} Additional VFS methods
 */
export function setupOptionalVfsMethods(deps) {
  const { opfsVfs, dVfs, wasm, state } = deps;
  const methods = Object.create(null);

  // 1. Input handling
  // 1.1 Check if default VFS provides xRandomness
  if (dVfs) {
    opfsVfs.$xRandomness = dVfs.$xRandomness;
    opfsVfs.$xSleep = dVfs.$xSleep;
  }

  // 2. Core processing
  // 2.1 Provide fallback xRandomness if needed
  if (!opfsVfs.$xRandomness) {
    methods.xRandomness = function (pVfs, nOut, pOut) {
      const heap = wasm.heap8u();
      let i = 0;
      for (; i < nOut; ++i) heap[pOut + i] = ((Math.random() * 255000) & 0xff);
      return i;
    };
  }

  // 2.2 Provide fallback xSleep if needed
  if (!opfsVfs.$xSleep) {
    methods.xSleep = function (pVfs, ms) {
      Atomics.wait(state.sabOPView, state.opIds.xSleep, 0, ms);
      return 0;
    };
  }

  // 3. Output handling
  return methods;
}

/**
 * Integrates OPFS VFS with OO1 API if available.
 * @param {object} deps - Dependencies object
 */
export function integrateWithOo1(deps) {
  const { sqlite3, opfsVfs, opfsUtil } = deps;

  // 1. Input handling
  if (!sqlite3.oo1) {
    return;
  }

  // 2. Core processing
  // 2.1 Create OpfsDb class
  const OpfsDb = function (...args) {
    const opt = sqlite3.oo1.DB.dbCtorHelper.normalizeArgs(...args);
    opt.vfs = opfsVfs.$zName;
    sqlite3.oo1.DB.dbCtorHelper.call(this, opt);
  };
  OpfsDb.prototype = Object.create(sqlite3.oo1.DB.prototype);

  // 2.2 Register OpfsDb and utility methods
  sqlite3.oo1.OpfsDb = OpfsDb;
  OpfsDb.importDb = opfsUtil.importDb;

  // 2.3 Set post-open callback for busy timeout
  sqlite3.oo1.DB.dbCtorHelper.setVfsPostOpenCallback(opfsVfs.pointer, function (oo1Db, sqlite3Ref) {
    sqlite3Ref.capi.sqlite3_busy_timeout(oo1Db, 10000);
  });
}
