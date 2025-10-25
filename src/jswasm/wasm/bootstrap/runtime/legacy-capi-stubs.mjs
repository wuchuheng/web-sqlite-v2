/**
 * @typedef {import("./legacy-capi-stubs.d.ts").LegacyCapiStubs} LegacyCapiStubs
 */

/**
 * Provides placeholder implementations for legacy C API entry points that are
 * initialised later in the bootstrap sequence. Keeping these stubs isolated
 * simplifies the main bootstrap file while preserving compatibility with the
 * downstream modules that patch in real implementations.
 *
 * @returns {LegacyCapiStubs}
 */
export function createLegacyCapiStubs() {
    return {
        sqlite3_bind_blob: undefined,
        sqlite3_bind_text: undefined,
        sqlite3_create_function_v2: (
            _pDb,
            _funcName,
            _nArg,
            _eTextRep,
            _pApp,
            _xFunc,
            _xStep,
            _xFinal,
            _xDestroy,
        ) => {},
        sqlite3_create_function: (
            _pDb,
            _funcName,
            _nArg,
            _eTextRep,
            _pApp,
            _xFunc,
            _xStep,
            _xFinal,
        ) => {},
        sqlite3_create_window_function: (
            _pDb,
            _funcName,
            _nArg,
            _eTextRep,
            _pApp,
            _xStep,
            _xFinal,
            _xValue,
            _xInverse,
            _xDestroy,
        ) => {},
        sqlite3_prepare_v3: (
            _dbPtr,
            _sql,
            _sqlByteLen,
            _prepFlags,
            _stmtPtrPtr,
            _strPtrPtr,
        ) => {},
        sqlite3_prepare_v2: (
            _dbPtr,
            _sql,
            _sqlByteLen,
            _stmtPtrPtr,
            _strPtrPtr,
        ) => {},
        sqlite3_exec: (_pDb, _sql, _callback, _pVoid, _pErrMsg) => {},
        sqlite3_randomness: (_n, _outPtr) => {},
    };
}
